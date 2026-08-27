// SPDX-License-Identifier: MIT

using KeebWeaver.Overlay.Core.Protocol;

namespace KeebWeaver.Overlay.Core.Transport;

public sealed class KeyboardTelemetryEventArgs(LayerStateFrame frame) : EventArgs
{
    public LayerStateFrame Frame { get; } = frame;
}

public sealed class KeyboardClientStatusEventArgs(
    string message,
    bool connected,
    bool pointerSpeedAvailable) : EventArgs
{
    public string Message { get; } = message;
    public bool Connected { get; } = connected;
    public bool PointerSpeedAvailable { get; } = pointerSpeedAvailable;
}

public interface IKeyboardClient : IAsyncDisposable
{
    event EventHandler<KeyboardTelemetryEventArgs>? TelemetryReceived;
    event EventHandler<KeyboardClientStatusEventArgs>? StatusChanged;

    Task RunAsync(CancellationToken cancellationToken);
    Task SetPointerSpeedAsync(ushort pointerSpeed, CancellationToken cancellationToken);
}
