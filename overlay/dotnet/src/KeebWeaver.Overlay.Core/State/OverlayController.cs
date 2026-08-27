// SPDX-License-Identifier: MIT

using KeebWeaver.Overlay.Core.Transport;

namespace KeebWeaver.Overlay.Core.State;

public sealed class OverlayController : IAsyncDisposable
{
    private readonly OverlayState _state;
    private readonly IKeyboardClient _client;
    private readonly SynchronizationContext? _synchronizationContext;
    private readonly CancellationTokenSource _cancellation = new();
    private Task? _runTask;

    public OverlayController(
        OverlayState state,
        IKeyboardClient client,
        SynchronizationContext? synchronizationContext = null)
    {
        _state = state ?? throw new ArgumentNullException(nameof(state));
        _client = client ?? throw new ArgumentNullException(nameof(client));
        _synchronizationContext = synchronizationContext ?? SynchronizationContext.Current;
        _client.TelemetryReceived += OnTelemetryReceived;
        _client.StatusChanged += OnStatusChanged;
    }

    public OverlayState State => _state;

    public void Start()
    {
        if (_runTask is not null)
        {
            return;
        }

        _runTask = Task.Run(() => _client.RunAsync(_cancellation.Token));
        _ = ObserveClientCompletionAsync(_runTask);
    }

    public async Task<bool> RequestPointerSpeedAsync(int requestedSpeed)
    {
        if (!_state.BluetoothConnected || !_state.PointerSpeedAvailable ||
            requestedSpeed < _state.Contract.PointerSpeed.Minimum ||
            requestedSpeed > _state.Contract.PointerSpeed.Maximum)
        {
            return false;
        }

        try
        {
            await _client.SetPointerSpeedAsync(checked((ushort)requestedSpeed), _cancellation.Token)
                .ConfigureAwait(false);
            Dispatch(() => _state.ApplyPointerSpeed(checked((ushort)requestedSpeed)));
            return true;
        }
        catch (OperationCanceledException) when (_cancellation.IsCancellationRequested)
        {
            return false;
        }
        catch (Exception exception)
        {
            Dispatch(() => _state.SetConnectionStatus(
                $"BLE: pointer-speed write failed ({exception.GetType().Name})",
                connected: false,
                pointerSpeedAvailable: false));
            return false;
        }
    }

    public async ValueTask DisposeAsync()
    {
        _client.TelemetryReceived -= OnTelemetryReceived;
        _client.StatusChanged -= OnStatusChanged;
        _cancellation.Cancel();

        if (_runTask is not null)
        {
            try
            {
                await _runTask.ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (_cancellation.IsCancellationRequested)
            {
            }
        }

        await _client.DisposeAsync().ConfigureAwait(false);
        _cancellation.Dispose();
    }

    private async Task ObserveClientCompletionAsync(Task runTask)
    {
        try
        {
            await runTask.ConfigureAwait(false);
            if (!_cancellation.IsCancellationRequested)
            {
                Dispatch(() => _state.SetConnectionStatus(
                    "BLE: client stopped; manual mode available",
                    connected: false,
                    pointerSpeedAvailable: false));
            }
        }
        catch (OperationCanceledException) when (_cancellation.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            Dispatch(() => _state.SetConnectionStatus(
                $"BLE: unavailable ({exception.GetType().Name}); manual mode available",
                connected: false,
                pointerSpeedAvailable: false));
        }
    }

    private void OnTelemetryReceived(object? sender, KeyboardTelemetryEventArgs eventArgs) =>
        Dispatch(() => _state.ApplyTelemetry(eventArgs.Frame));

    private void OnStatusChanged(object? sender, KeyboardClientStatusEventArgs eventArgs) =>
        Dispatch(() => _state.SetConnectionStatus(
            eventArgs.Message,
            eventArgs.Connected,
            eventArgs.PointerSpeedAvailable));

    private void Dispatch(Action action)
    {
        if (_synchronizationContext is null || SynchronizationContext.Current == _synchronizationContext)
        {
            action();
            return;
        }

        _synchronizationContext.Post(static state => ((Action)state!).Invoke(), action);
    }
}
