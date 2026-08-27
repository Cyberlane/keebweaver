// SPDX-License-Identifier: MIT

using Avalonia.Controls;
using KeebWeaver.Overlay.Core.Platform;

namespace KeebWeaver.Overlay.UI.Platform;

public interface IPlatformWindowIntegration
{
    OverlayPlatformCapabilities Capabilities { get; }

    void Attach(Window window);

    bool TrySetClickThrough(Window window, bool enabled, out string? degradation);
}
