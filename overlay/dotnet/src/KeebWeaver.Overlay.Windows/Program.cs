// SPDX-License-Identifier: MIT

using Avalonia;
using KeebWeaver.Overlay.Core.Contract;
using KeebWeaver.Overlay.UI;

namespace KeebWeaver.Overlay.Windows;

internal static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        var contract = ContractLoader.LoadDefault();
        OverlayApplication.Configure(() => new OverlayRuntime(
            contract,
            new WindowsBluetoothKeyboardClient(contract),
            new WindowsPlatformWindowIntegration(),
            UseNeutralPlatformLabels: true));

        BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    private static AppBuilder BuildAvaloniaApp() => AppBuilder
        .Configure<OverlayApplication>()
        .UsePlatformDetect()
        .LogToTrace();
}
