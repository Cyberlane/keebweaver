// SPDX-License-Identifier: MIT

using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Styling;
using Avalonia.Themes.Fluent;
using KeebWeaver.Overlay.Core.State;

namespace KeebWeaver.Overlay.UI;

public sealed class OverlayApplication : Application
{
    private static Func<OverlayRuntime>? _runtimeFactory;
    private OverlayController? _controller;

    public static void Configure(Func<OverlayRuntime> runtimeFactory)
    {
        ArgumentNullException.ThrowIfNull(runtimeFactory);
        if (Interlocked.CompareExchange(ref _runtimeFactory, runtimeFactory, null) is not null)
        {
            throw new InvalidOperationException("The overlay application was already configured.");
        }
    }

    public override void Initialize()
    {
        RequestedThemeVariant = ThemeVariant.Dark;
        Styles.Add(new FluentTheme());
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var runtime = (_runtimeFactory ?? throw new InvalidOperationException(
                "Configure must be called before starting the overlay application."))();
            var state = new OverlayState(runtime.Contract)
            {
                PlatformNotice = runtime.WindowIntegration.Capabilities.Summary,
            };
            _controller = new OverlayController(state, runtime.KeyboardClient, SynchronizationContext.Current);

            var window = new OverlayWindow(
                state,
                _controller,
                runtime.WindowIntegration,
                runtime.UseNeutralPlatformLabels);
            runtime.WindowIntegration.Attach(window);
            desktop.MainWindow = window;
            desktop.Exit += OnDesktopExit;
            _controller.Start();
        }

        base.OnFrameworkInitializationCompleted();
    }

    private void OnDesktopExit(object? sender, ControlledApplicationLifetimeExitEventArgs eventArgs)
    {
        if (_controller is null)
        {
            return;
        }

        _controller.DisposeAsync().AsTask().GetAwaiter().GetResult();
        _controller = null;
    }
}
