// SPDX-License-Identifier: MIT

using System.ComponentModel;
using System.Runtime.InteropServices;
using Avalonia.Controls;
using Avalonia.Platform;
using KeebWeaver.Overlay.Core.Platform;
using KeebWeaver.Overlay.UI.Platform;

namespace KeebWeaver.Overlay.Windows;

internal sealed partial class WindowsPlatformWindowIntegration : IPlatformWindowIntegration
{
    private const int GwlExStyle = -20;
    private const long WsExTransparent = 0x00000020L;
    private const long WsExLayered = 0x00080000L;

    public OverlayPlatformCapabilities Capabilities { get; } = new(
        Platform: "Windows",
        WindowBackend: "Win32",
        SupportsClickThrough: true,
        SupportsTransparency: true,
        SupportsTrayRecovery: false,
        Degradations:
        [
            "Pass-through recovery currently uses the Windows taskbar; tray recovery still requires native qualification.",
        ]);

    public void Attach(Window window)
    {
        ArgumentNullException.ThrowIfNull(window);
    }

    public bool TrySetClickThrough(Window window, bool enabled, out string? degradation)
    {
        ArgumentNullException.ThrowIfNull(window);
        degradation = null;

        var handle = window.TryGetPlatformHandle();
        if (handle is null || !string.Equals(handle.HandleDescriptor, "HWND", StringComparison.Ordinal))
        {
            degradation = "Pass-through requires an initialized Win32 window handle.";
            return false;
        }

        Marshal.SetLastPInvokeError(0);
        var current = GetWindowLongPtr(handle.Handle, GwlExStyle);
        var error = Marshal.GetLastPInvokeError();
        if (current == IntPtr.Zero && error != 0)
        {
            degradation = $"Could not read Win32 window style ({new Win32Exception(error).Message}).";
            return false;
        }

        var style = current.ToInt64();
        style = enabled
            ? style | WsExTransparent | WsExLayered
            : style & ~WsExTransparent;

        Marshal.SetLastPInvokeError(0);
        var previous = SetWindowLongPtr(handle.Handle, GwlExStyle, new IntPtr(style));
        error = Marshal.GetLastPInvokeError();
        if (previous == IntPtr.Zero && error != 0)
        {
            degradation = $"Could not update Win32 pass-through style ({new Win32Exception(error).Message}).";
            return false;
        }

        return true;
    }

    [LibraryImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
    private static partial IntPtr GetWindowLongPtr(IntPtr window, int index);

    [LibraryImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
    private static partial IntPtr SetWindowLongPtr(IntPtr window, int index, IntPtr newValue);
}
