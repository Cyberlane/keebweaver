// SPDX-License-Identifier: MIT

using KeebWeaver.Overlay.Core.Contract;
using KeebWeaver.Overlay.Core.Protocol;
using KeebWeaver.Overlay.Core.Transport;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Devices.Enumeration;
using Windows.Security.Cryptography;

namespace KeebWeaver.Overlay.Windows;

internal sealed class WindowsBluetoothKeyboardClient : IKeyboardClient
{
    private readonly OverlayContract _contract;
    private readonly LayerStateFrameParser _parser;
    private readonly KeyboardTelemetryGate _telemetryGate;
    private readonly object _gate = new();
    private BluetoothLEDevice? _device;
    private GattDeviceService? _service;
    private GattCharacteristic? _layerCharacteristic;
    private GattCharacteristic? _speedCharacteristic;
    private TaskCompletionSource? _activeMonitor;
    private bool _disposed;

    public WindowsBluetoothKeyboardClient(OverlayContract contract)
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

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                Report("BLE: searching for ErgoKeeb Corne", connected: false, speedAvailable: false);
                var device = await FindDeviceAsync(cancellationToken).ConfigureAwait(false);
                if (device is null)
                {
                    continue;
                }

                await ConnectAndMonitorAsync(device, cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                Report($"BLE: rejected or unavailable ({exception.GetType().Name}); retrying",
                    connected: false, speedAvailable: false);
            }
            finally
            {
                await ReleaseGattAsync().ConfigureAwait(false);
            }

            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task SetPointerSpeedAsync(ushort pointerSpeed, CancellationToken cancellationToken)
    {
        ThrowIfDisposed();
        var bytes = _parser.EncodePointerSpeed(pointerSpeed);
        GattCharacteristic characteristic;
        lock (_gate)
        {
            characteristic = _speedCharacteristic
                ?? throw new InvalidOperationException("The pointer-speed characteristic is unavailable.");
        }

        var result = await characteristic.WriteValueWithResultAsync(
            CryptographicBuffer.CreateFromByteArray(bytes),
            GattWriteOption.WriteWithResponse).AsTask(cancellationToken).ConfigureAwait(false);
        if (result.Status != GattCommunicationStatus.Success)
        {
            throw new InvalidOperationException($"Pointer-speed write failed with GATT status {result.Status}.");
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        await ReleaseGattAsync().ConfigureAwait(false);
    }

    private async Task<BluetoothLEDevice?> FindDeviceAsync(CancellationToken cancellationToken)
    {
        var knownDevices = await DeviceInformation.FindAllAsync(BluetoothLEDevice.GetDeviceSelector())
            .AsTask(cancellationToken).ConfigureAwait(false);
        var known = knownDevices.FirstOrDefault(device =>
            string.Equals(device.Name, _contract.Device.ExpectedBluetoothName, StringComparison.Ordinal));
        if (known is not null)
        {
            var knownDevice = await BluetoothLEDevice.FromIdAsync(known.Id)
                .AsTask(cancellationToken).ConfigureAwait(false);
            if (knownDevice is not null &&
                string.Equals(knownDevice.Name, _contract.Device.ExpectedBluetoothName, StringComparison.Ordinal))
            {
                return knownDevice;
            }
            knownDevice?.Dispose();
        }

        var completion = new TaskCompletionSource<ulong>(TaskCreationOptions.RunContinuationsAsynchronously);
        using var cancellationRegistration = cancellationToken.Register(
            static state => ((TaskCompletionSource<ulong>)state!).TrySetCanceled(), completion);
        var watcher = new BluetoothLEAdvertisementWatcher
        {
            ScanningMode = BluetoothLEScanningMode.Active,
        };
        void OnReceived(BluetoothLEAdvertisementWatcher sender, BluetoothLEAdvertisementReceivedEventArgs args)
        {
            if (string.Equals(
                args.Advertisement.LocalName,
                _contract.Device.ExpectedBluetoothName,
                StringComparison.Ordinal))
            {
                completion.TrySetResult(args.BluetoothAddress);
            }
        }

        watcher.Received += OnReceived;
        watcher.Start();
        try
        {
            var address = await completion.Task.ConfigureAwait(false);
            var discovered = await BluetoothLEDevice.FromBluetoothAddressAsync(address)
                .AsTask(cancellationToken).ConfigureAwait(false);
            if (discovered is null ||
                !string.Equals(discovered.Name, _contract.Device.ExpectedBluetoothName, StringComparison.Ordinal))
            {
                discovered?.Dispose();
                throw new InvalidOperationException("The discovered Bluetooth device name did not match exactly.");
            }

            return discovered;
        }
        finally
        {
            watcher.Stop();
            watcher.Received -= OnReceived;
        }
    }

    private async Task ConnectAndMonitorAsync(BluetoothLEDevice device, CancellationToken cancellationToken)
    {
        var monitorEnded = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        void OnConnectionStatusChanged(BluetoothLEDevice sender, object args)
        {
            if (sender.ConnectionStatus != BluetoothConnectionStatus.Connected)
            {
                monitorEnded.TrySetResult();
            }
        }

        device.ConnectionStatusChanged += OnConnectionStatusChanged;
        lock (_gate)
        {
            _device = device;
            _activeMonitor = monitorEnded;
        }

        try
        {
            Report("BLE: discovering encrypted layer channel", connected: false, speedAvailable: false);
            var services = await device.GetGattServicesForUuidAsync(
                _contract.Bluetooth.ServiceGuid,
                BluetoothCacheMode.Uncached).AsTask(cancellationToken).ConfigureAwait(false);
            if (services.Status != GattCommunicationStatus.Success || services.Services.Count != 1)
            {
                throw new InvalidOperationException("The exact KeebWeaver GATT service was not found once.");
            }

            var service = services.Services[0];
            _service = service;
            var characteristics = await service.GetCharacteristicsAsync(BluetoothCacheMode.Uncached)
                .AsTask(cancellationToken).ConfigureAwait(false);
            if (characteristics.Status != GattCommunicationStatus.Success)
            {
                throw new InvalidOperationException("KeebWeaver GATT characteristics could not be enumerated.");
            }

            var layers = characteristics.Characteristics.Where(characteristic =>
                characteristic.Uuid == _contract.Bluetooth.LayerStateCharacteristicGuid).ToArray();
            if (layers.Length != 1 || !SupportsLayerState(layers[0].CharacteristicProperties))
            {
                throw new InvalidOperationException("The layer-state characteristic contract was rejected.");
            }

            var speeds = characteristics.Characteristics.Where(characteristic =>
                characteristic.Uuid == _contract.Bluetooth.PointerSpeedCharacteristicGuid).ToArray();
            if (speeds.Length > 1 || (speeds.Length == 1 && !SupportsPointerSpeed(speeds[0].CharacteristicProperties)))
            {
                throw new InvalidOperationException("The pointer-speed characteristic contract was rejected.");
            }

            var layerCharacteristic = layers[0];
            var speedCharacteristic = speeds.SingleOrDefault();
            layerCharacteristic.ValueChanged += OnLayerValueChanged;
            lock (_gate)
            {
                _layerCharacteristic = layerCharacteristic;
                _speedCharacteristic = speedCharacteristic;
            }

            var notifyStatus = await layerCharacteristic
                .WriteClientCharacteristicConfigurationDescriptorAsync(
                    GattClientCharacteristicConfigurationDescriptorValue.Notify)
                .AsTask(cancellationToken).ConfigureAwait(false);
            if (notifyStatus != GattCommunicationStatus.Success)
            {
                throw new InvalidOperationException("Layer-state notifications could not be enabled.");
            }

            var layerRead = await layerCharacteristic.ReadValueAsync(BluetoothCacheMode.Uncached)
                .AsTask(cancellationToken).ConfigureAwait(false);
            if (layerRead.Status != GattCommunicationStatus.Success)
            {
                throw new InvalidOperationException("The layer-state characteristic could not be read.");
            }
            AcceptLayerValue(BufferBytes(layerRead.Value));

            if (speedCharacteristic is not null)
            {
                var speedRead = await speedCharacteristic.ReadValueAsync(BluetoothCacheMode.Uncached)
                    .AsTask(cancellationToken).ConfigureAwait(false);
                if (speedRead.Status != GattCommunicationStatus.Success)
                {
                    throw new InvalidOperationException("The pointer-speed characteristic could not be read.");
                }
                AcceptSpeedValue(BufferBytes(speedRead.Value));
            }

            Report("BLE: connected; following active layer", connected: true,
                speedAvailable: speedCharacteristic is not null);
            using var cancellationRegistration = cancellationToken.Register(
                static state => ((TaskCompletionSource)state!).TrySetCanceled(), monitorEnded);
            await monitorEnded.Task.ConfigureAwait(false);
        }
        finally
        {
            device.ConnectionStatusChanged -= OnConnectionStatusChanged;
        }
    }

    private void OnLayerValueChanged(GattCharacteristic sender, GattValueChangedEventArgs args)
    {
        try
        {
            AcceptLayerValue(BufferBytes(args.CharacteristicValue));
        }
        catch (Exception exception)
        {
            Report($"BLE: malformed layer frame rejected ({exception.Message})",
                connected: false, speedAvailable: false);
            TaskCompletionSource? monitor;
            lock (_gate)
            {
                monitor = _activeMonitor;
            }
            // Ending the monitor, rather than only releasing WinRT objects, guarantees that
            // ConnectAndMonitorAsync exits even when Windows still reports the link connected.
            monitor?.TrySetResult();
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

    private async Task ReleaseGattAsync()
    {
        GattCharacteristic? layer;
        GattDeviceService? service;
        BluetoothLEDevice? device;
        TaskCompletionSource? monitor;
        lock (_gate)
        {
            layer = _layerCharacteristic;
            service = _service;
            device = _device;
            monitor = _activeMonitor;
            _layerCharacteristic = null;
            _speedCharacteristic = null;
            _service = null;
            _device = null;
            _activeMonitor = null;
        }

        monitor?.TrySetResult();

        if (layer is not null)
        {
            layer.ValueChanged -= OnLayerValueChanged;
            try
            {
                await layer.WriteClientCharacteristicConfigurationDescriptorAsync(
                    GattClientCharacteristicConfigurationDescriptorValue.None);
            }
            catch
            {
                // The OS may already have torn down the GATT session.
            }
        }

        service?.Dispose();
        device?.Dispose();
    }

    private static bool SupportsLayerState(GattCharacteristicProperties properties) =>
        properties.HasFlag(GattCharacteristicProperties.Read) &&
        properties.HasFlag(GattCharacteristicProperties.Notify);

    private static bool SupportsPointerSpeed(GattCharacteristicProperties properties) =>
        properties.HasFlag(GattCharacteristicProperties.Read) &&
        properties.HasFlag(GattCharacteristicProperties.Write);

    private static byte[] BufferBytes(global::Windows.Storage.Streams.IBuffer buffer)
    {
        CryptographicBuffer.CopyToByteArray(buffer, out var bytes);
        return bytes;
    }

    private void Report(string message, bool connected, bool speedAvailable) =>
        StatusChanged?.Invoke(this, new KeyboardClientStatusEventArgs(message, connected, speedAvailable));

    private void ThrowIfDisposed()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
    }
}
