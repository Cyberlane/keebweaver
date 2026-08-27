// SPDX-License-Identifier: MIT

using Avalonia;
using KeebWeaver.Overlay.Core.Contract;
using KeebWeaver.Overlay.UI;

namespace KeebWeaver.Overlay.Linux;

internal static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        var contract = ContractLoader.LoadDefault();
        OverlayApplication.Configure(() => new OverlayRuntime(
            contract,
            new BlueZKeyboardClient(contract),
            new LinuxPlatformWindowIntegration(),
            UseNeutralPlatformLabels: true));

        BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    private static AppBuilder BuildAvaloniaApp() => AppBuilder
        .Configure<OverlayApplication>()
        // Avalonia 12 defaults to X11, including XWayland sessions. Native
        // Wayland is experimental and is deliberately not selected here.
        .UsePlatformDetect()
        .LogToTrace();
}
