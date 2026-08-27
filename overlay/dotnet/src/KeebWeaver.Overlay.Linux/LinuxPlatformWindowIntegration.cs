// SPDX-License-Identifier: MIT

using Avalonia.Controls;
using KeebWeaver.Overlay.Core.Platform;
using KeebWeaver.Overlay.UI.Platform;

namespace KeebWeaver.Overlay.Linux;

internal sealed class LinuxPlatformWindowIntegration : IPlatformWindowIntegration
{
    public LinuxPlatformWindowIntegration()
    {
        var display = Environment.GetEnvironmentVariable("DISPLAY");
        var waylandDisplay = Environment.GetEnvironmentVariable("WAYLAND_DISPLAY");
        var backend = !string.IsNullOrWhiteSpace(display) && !string.IsNullOrWhiteSpace(waylandDisplay)
            ? "XWayland"
            : !string.IsNullOrWhiteSpace(display)
                ? "X11"
                : !string.IsNullOrWhiteSpace(waylandDisplay)
                    ? "native Wayland (unsupported initial target)"
                    : "no desktop display detected";

        var degradations = new List<string>
        {
            "Linux transparency depends on the active compositor.",
            "Pass-through and tray recovery are disabled until qualified per desktop environment.",
        };
        if (string.IsNullOrWhiteSpace(display))
        {
            degradations.Add("The initial Linux target requires X11 or XWayland; native Wayland remains experimental.");
        }

        Capabilities = new OverlayPlatformCapabilities(
            Platform: "Linux",
            WindowBackend: backend,
            SupportsClickThrough: false,
            SupportsTransparency: !string.IsNullOrWhiteSpace(display),
            SupportsTrayRecovery: false,
            Degradations: degradations);
    }

    public OverlayPlatformCapabilities Capabilities { get; }

    public void Attach(Window window)
    {
        ArgumentNullException.ThrowIfNull(window);
    }

    public bool TrySetClickThrough(Window window, bool enabled, out string? degradation)
    {
        ArgumentNullException.ThrowIfNull(window);
        degradation = enabled
            ? "Pass-through is not enabled for the initial X11/XWayland release. Manual mode remains available."
            : null;
        return !enabled;
    }
}
