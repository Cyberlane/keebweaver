// SPDX-License-Identifier: MIT

using KeebWeaver.Overlay.Core.Protocol;

namespace KeebWeaver.Overlay.Core.Transport;

public sealed class KeyboardTelemetryGate(LayerStateFrameParser parser)
{
    private readonly object _gate = new();
    private LayerStateFrame? _lastFrame;

    public bool TryAcceptLayerState(
        ReadOnlySpan<byte> data,
        out LayerStateFrame? frame,
        out FrameRejectionReason rejectionReason)
    {
        lock (_gate)
        {
            if (!parser.TryParse(data, out frame, out rejectionReason))
            {
                return false;
            }

            _lastFrame = frame;
            return true;
        }
    }

    public bool TryAcceptPointerSpeed(
        ReadOnlySpan<byte> data,
        out LayerStateFrame? frame,
        out FrameRejectionReason rejectionReason)
    {
        lock (_gate)
        {
            frame = null;
            if (!parser.TryDecodePointerSpeed(data, out var pointerSpeed, out rejectionReason))
            {
                return false;
            }

            if (_lastFrame is null)
            {
                rejectionReason = FrameRejectionReason.None;
                return true;
            }

            frame = _lastFrame with { PointerSpeed = pointerSpeed };
            _lastFrame = frame;
            rejectionReason = FrameRejectionReason.None;
            return true;
        }
    }
}
