// SPDX-License-Identifier: MIT

using KeebWeaver.Overlay.Core.Contract;
using KeebWeaver.Overlay.Core.Protocol;
using KeebWeaver.Overlay.Core.Transport;
using KeebWeaver.Overlay.Linux.BlueZ;
using Tmds.DBus.Protocol;

namespace KeebWeaver.Overlay.Linux;

internal sealed class BlueZKeyboardClient : IKeyboardClient
{
    private const string BlueZDestination = "org.bluez";
    private const string AdapterInterface = "org.bluez.Adapter1";
    private const string DeviceInterface = "org.bluez.Device1";
    private const string ServiceInterface = "org.bluez.GattService1";
    private const string CharacteristicInterface = "org.bluez.GattCharacteristic1";

    private readonly OverlayContract _contract;
    private readonly LayerStateFrameParser _parser;
    private readonly KeyboardTelemetryGate _telemetryGate;
    private readonly object _gate = new();
    private GattCharacteristic1? _speedCharacteristic;
    private bool _disposed;

    public BlueZKeyboardClient(OverlayContract contract)
    {
        _contract = contract ?? throw new ArgumentNullException(nameof(contract));
        _parser = new LayerStateFrameParser(contract);
        _telemetryGate = new KeyboardTelemetryGate(_parser);
    }

    public event EventHandler<KeyboardTelemetryEventArgs>? TelemetryReceived;
    public event EventHandler<KeyboardClientStatusEventArgs>? StatusChanged;

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        ThrowIfDisposed();
        var address = DBusAddress.System
            ?? throw new InvalidOperationException("The Linux system D-Bus is unavailable.");
        using var connection = new DBusConnection(address);
        await connection.ConnectAsync().ConfigureAwait(false);
        var manager = new ObjectManager(connection, BlueZDestination, "/");

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await DiscoverAndMonitorAsync(connection, manager, cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                Report($"BLE: BlueZ rejected or unavailable ({exception.GetType().Name}); retrying",
                    connected: false, speedAvailable: false);
            }
            finally
            {
                lock (_gate)
                {
                    _speedCharacteristic = null;
                }
            }

            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task SetPointerSpeedAsync(ushort pointerSpeed, CancellationToken cancellationToken)
    {
        ThrowIfDisposed();
        var bytes = _parser.EncodePointerSpeed(pointerSpeed);
        GattCharacteristic1 characteristic;
        lock (_gate)
        {
            characteristic = _speedCharacteristic
                ?? throw new InvalidOperationException("The BlueZ pointer-speed characteristic is unavailable.");
        }

        cancellationToken.ThrowIfCancellationRequested();
        await characteristic.WriteValueAsync(bytes, new Dictionary<string, VariantValue>()).ConfigureAwait(false);
    }

    public ValueTask DisposeAsync()
    {
        _disposed = true;
        lock (_gate)
        {
            _speedCharacteristic = null;
        }
        return ValueTask.CompletedTask;
    }

    private async Task DiscoverAndMonitorAsync(
        DBusConnection connection,
        ObjectManager manager,
        CancellationToken cancellationToken)
    {
        var objects = await manager.GetManagedObjectsAsync().ConfigureAwait(false);
        var adapterPaths = objects
            .Where(entry => entry.Value.ContainsKey(AdapterInterface))
            .Select(entry => entry.Key)
            .ToArray();
        if (adapterPaths.Length == 0)
        {
            throw new InvalidOperationException("BlueZ exposed no Bluetooth adapter.");
        }

        var poweredAdapters = new List<(ObjectPath Path, Adapter1 Adapter)>();
        foreach (var path in adapterPaths)
        {
            var adapter = new Adapter1(connection, BlueZDestination, path);
            if (await adapter.GetPoweredAsync().ConfigureAwait(false))
            {
                poweredAdapters.Add((path, adapter));
            }
        }
        if (poweredAdapters.Count == 0)
        {
            Report("BLE: Bluetooth adapters are powered off; manual mode available",
                connected: false, speedAvailable: false);
            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken).ConfigureAwait(false);
            return;
        }

        Report("BLE: BlueZ searching for ErgoKeeb Corne", connected: false, speedAvailable: false);
        var discoveryStartedByThisClient = new List<Adapter1>();
        foreach (var (_, adapter) in poweredAdapters)
        {
            try
            {
                await adapter.StartDiscoveryAsync().ConfigureAwait(false);
                discoveryStartedByThisClient.Add(adapter);
            }
            catch (DBusErrorReplyException exception) when (exception.ErrorName == "org.bluez.Error.InProgress")
            {
                // Do not stop a discovery session this D-Bus client did not start.
            }
        }

        ObjectPath devicePath;
        try
        {
            devicePath = await FindExpectedDeviceAsync(connection, manager, cancellationToken)
                .ConfigureAwait(false);
        }
        finally
        {
            foreach (var adapter in discoveryStartedByThisClient)
            {
                try
                {
                    await adapter.StopDiscoveryAsync().ConfigureAwait(false);
                }
                catch (DBusErrorReplyException)
                {
                }
            }
        }

        var device = new Device1(connection, BlueZDestination, devicePath);
        if (!await device.GetConnectedAsync().ConfigureAwait(false))
        {
            Report("BLE: BlueZ connecting to keyboard", connected: false, speedAvailable: false);
            await device.ConnectAsync().ConfigureAwait(false);
        }

        await WaitForServicesAsync(device, cancellationToken).ConfigureAwait(false);
        await MonitorGattAsync(connection, manager, device, devicePath, cancellationToken)
            .ConfigureAwait(false);
    }

    private async Task<ObjectPath> FindExpectedDeviceAsync(
        DBusConnection connection,
        ObjectManager manager,
        CancellationToken cancellationToken)
    {
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var objects = await manager.GetManagedObjectsAsync().ConfigureAwait(false);
            foreach (var (path, interfaces) in objects)
            {
                if (!interfaces.ContainsKey(DeviceInterface))
                {
                    continue;
                }

                var device = new Device1(connection, BlueZDestination, path);
                try
                {
                    if (string.Equals(
                        await device.GetNameAsync().ConfigureAwait(false),
                        _contract.Device.ExpectedBluetoothName,
                        StringComparison.Ordinal))
                    {
                        return path;
                    }
                }
                catch (DBusErrorReplyException)
                {
                    // BlueZ may remove a discovery object between enumeration and read.
                }
            }

            await Task.Delay(TimeSpan.FromMilliseconds(750), cancellationToken).ConfigureAwait(false);
        }
    }

    private static async Task WaitForServicesAsync(Device1 device, CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow.AddSeconds(15);
        while (!await device.GetServicesResolvedAsync().ConfigureAwait(false))
        {
            if (DateTimeOffset.UtcNow >= deadline)
            {
                throw new TimeoutException("BlueZ did not resolve the keyboard GATT services.");
            }

            await Task.Delay(TimeSpan.FromMilliseconds(250), cancellationToken).ConfigureAwait(false);
        }
    }

    private async Task MonitorGattAsync(
        DBusConnection connection,
        ObjectManager manager,
        Device1 device,
        ObjectPath devicePath,
        CancellationToken cancellationToken)
    {
        var objects = await manager.GetManagedObjectsAsync().ConfigureAwait(false);
        var matchingServices = new List<(ObjectPath Path, GattService1 Service)>();
        foreach (var (path, interfaces) in objects)
        {
            if (!interfaces.ContainsKey(ServiceInterface))
            {
                continue;
            }

            var service = new GattService1(connection, BlueZDestination, path);
            if (await service.GetDeviceAsync().ConfigureAwait(false) == devicePath &&
                string.Equals(await service.GetUUIDAsync().ConfigureAwait(false),
                    _contract.Bluetooth.ServiceUuid, StringComparison.OrdinalIgnoreCase))
            {
                matchingServices.Add((path, service));
            }
        }
        if (matchingServices.Count != 1)
        {
            throw new InvalidOperationException("BlueZ did not expose exactly one KeebWeaver service.");
        }

        var servicePath = matchingServices[0].Path;
        var layerCandidates = new List<GattCharacteristic1>();
        var speedCandidates = new List<GattCharacteristic1>();
        foreach (var (path, interfaces) in objects)
        {
            if (!interfaces.ContainsKey(CharacteristicInterface))
            {
                continue;
            }

            var characteristic = new GattCharacteristic1(connection, BlueZDestination, path);
            if (await characteristic.GetServiceAsync().ConfigureAwait(false) != servicePath)
            {
                continue;
            }

            var uuid = await characteristic.GetUUIDAsync().ConfigureAwait(false);
            if (string.Equals(uuid, _contract.Bluetooth.LayerStateCharacteristic.Uuid,
                StringComparison.OrdinalIgnoreCase))
            {
                layerCandidates.Add(characteristic);
            }
            else if (string.Equals(uuid, _contract.Bluetooth.PointerSpeedCharacteristic.Uuid,
                StringComparison.OrdinalIgnoreCase))
            {
                speedCandidates.Add(characteristic);
            }
        }

        if (layerCandidates.Count != 1 ||
            !Supports(await layerCandidates[0].GetFlagsAsync().ConfigureAwait(false), ["read", "notify"]))
        {
            throw new InvalidOperationException("The BlueZ layer-state characteristic contract was rejected.");
        }
        if (speedCandidates.Count > 1 ||
            (speedCandidates.Count == 1 &&
             !Supports(await speedCandidates[0].GetFlagsAsync().ConfigureAwait(false), ["read", "write"])))
        {
            throw new InvalidOperationException("The BlueZ pointer-speed characteristic contract was rejected.");
        }

        var layer = layerCandidates[0];
        var speed = speedCandidates.SingleOrDefault();
        var completed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        async ValueTask OnLayerPropertiesChanged(IChangedGattCharacteristic1Properties changed)
        {
            if (!changed.HasValueChanged)
            {
                return;
            }

            try
            {
                AcceptLayerValue(changed.Value ?? await layer.GetValueAsync().ConfigureAwait(false));
            }
            catch (Exception exception)
            {
                completed.TrySetException(exception);
            }
        }

        void OnDevicePropertiesChanged(IChangedDevice1Properties changed)
        {
            if (changed.HasConnectedChanged && changed.Connected == false)
            {
                completed.TrySetResult();
            }
        }

        using var layerWatcher = await layer.WatchPropertiesChangedAsync(
            OnLayerPropertiesChanged, emitOnCapturedContext: false).ConfigureAwait(false);
        using var deviceWatcher = await device.WatchPropertiesChangedAsync(
            OnDevicePropertiesChanged, emitOnCapturedContext: false).ConfigureAwait(false);

        await layer.StartNotifyAsync().ConfigureAwait(false);
        try
        {
            AcceptLayerValue(await layer.ReadValueAsync(new Dictionary<string, VariantValue>()).ConfigureAwait(false));
            if (speed is not null)
            {
                AcceptSpeedValue(await speed.ReadValueAsync(new Dictionary<string, VariantValue>()).ConfigureAwait(false));
            }

            lock (_gate)
            {
                _speedCharacteristic = speed;
            }
            Report("BLE: connected through BlueZ; following active layer",
                connected: true, speedAvailable: speed is not null);

            using var cancellationRegistration = cancellationToken.Register(
                static state => ((TaskCompletionSource)state!).TrySetCanceled(), completed);
            await completed.Task.ConfigureAwait(false);
        }
        finally
        {
            lock (_gate)
            {
                _speedCharacteristic = null;
            }
            try
            {
                await layer.StopNotifyAsync().ConfigureAwait(false);
            }
            catch (DBusErrorReplyException)
            {
            }
        }
    }

    private void AcceptLayerValue(byte[] bytes)
    {
        if (!_telemetryGate.TryAcceptLayerState(bytes, out var frame, out var reason) || frame is null)
        {
            throw new InvalidOperationException($"Layer-state frame rejected: {reason}.");
        }

        TelemetryReceived?.Invoke(this, new KeyboardTelemetryEventArgs(frame));
    }

    private void AcceptSpeedValue(byte[] bytes)
    {
        if (!_telemetryGate.TryAcceptPointerSpeed(bytes, out var frame, out var reason))
        {
            throw new InvalidOperationException($"Pointer-speed value rejected: {reason}.");
        }

        if (frame is not null)
        {
            TelemetryReceived?.Invoke(this, new KeyboardTelemetryEventArgs(frame));
        }
    }

    private static bool Supports(IEnumerable<string> actualFlags, IReadOnlyList<string> requiredFlags)
    {
        var flags = actualFlags.ToHashSet(StringComparer.Ordinal);
        return requiredFlags.All(flags.Contains);
    }

    private void Report(string message, bool connected, bool speedAvailable) =>
        StatusChanged?.Invoke(this, new KeyboardClientStatusEventArgs(message, connected, speedAvailable));

    private void ThrowIfDisposed()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
    }
}
