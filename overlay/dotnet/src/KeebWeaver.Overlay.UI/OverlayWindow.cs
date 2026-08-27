// SPDX-License-Identifier: MIT

using System.ComponentModel;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Threading;
using KeebWeaver.Overlay.Core.Contract;
using KeebWeaver.Overlay.Core.State;
using KeebWeaver.Overlay.UI.Platform;

namespace KeebWeaver.Overlay.UI;

public sealed class OverlayWindow : Window
{
    private readonly OverlayState _state;
    private readonly OverlayController _controller;
    private readonly IPlatformWindowIntegration _windowIntegration;
    private readonly bool _useNeutralPlatformLabels;
    private readonly TextBlock _statusText;
    private readonly TextBlock _instructionText;
    private readonly TextBlock _pointerSpeedText;
    private readonly TextBlock _platformNoticeText;
    private readonly StackPanel _diagram;
    private readonly CheckBox _followLiveCheckBox;
    private readonly CheckBox _shiftPreviewCheckBox;
    private readonly CheckBox _clickThroughCheckBox;
    private readonly Slider _opacitySlider;
    private readonly Slider _pointerSpeedSlider;
    private readonly Button _pointerSlowerButton;
    private readonly Button _pointerFasterButton;
    private readonly Button _pointerResetButton;
    private readonly Dictionary<string, Button> _layerButtons = new(StringComparer.Ordinal);
    private bool _refreshing;

    public OverlayWindow(
        OverlayState state,
        OverlayController controller,
        IPlatformWindowIntegration windowIntegration,
        bool useNeutralPlatformLabels)
    {
        _state = state ?? throw new ArgumentNullException(nameof(state));
        _controller = controller ?? throw new ArgumentNullException(nameof(controller));
        _windowIntegration = windowIntegration ?? throw new ArgumentNullException(nameof(windowIntegration));
        _useNeutralPlatformLabels = useNeutralPlatformLabels;

        Title = "KeebWeaver Overlay";
        Width = 760;
        Height = 390;
        MinWidth = 650;
        MinHeight = 330;
        Topmost = true;
        ShowInTaskbar = true;
        CanResize = true;
        Background = Brushes.Transparent;
        TransparencyBackgroundFallback = NordPalette.PolarNight0;
        if (_windowIntegration.Capabilities.SupportsTransparency)
        {
            TransparencyLevelHint = [WindowTransparencyLevel.Transparent];
        }

        _statusText = SmallText();
        _instructionText = SmallText();
        _pointerSpeedText = SmallText();
        _platformNoticeText = SmallText(foreground: NordPalette.AuroraYellow);
        _diagram = new StackPanel { Spacing = 4 };

        _followLiveCheckBox = new CheckBox { Content = "Follow BLE" };
        _shiftPreviewCheckBox = new CheckBox { Content = "Shift held" };
        _clickThroughCheckBox = new CheckBox
        {
            Content = "Pass-through",
            IsEnabled = _windowIntegration.Capabilities.SupportsClickThrough,
        };
        _opacitySlider = new Slider { Minimum = 0.45, Maximum = 1.0, Width = 80 };
        _pointerSpeedSlider = new Slider
        {
            Minimum = _state.Contract.PointerSpeed.Minimum,
            Maximum = _state.Contract.PointerSpeed.Maximum,
            TickFrequency = _state.Contract.PointerSpeed.Step,
            IsSnapToTickEnabled = true,
            Width = 160,
        };
        _pointerSlowerButton = CompactButton("−", "Decrease pointer speed");
        _pointerFasterButton = CompactButton("+", "Increase pointer speed");
        _pointerResetButton = CompactButton("↺", "Reset pointer speed");

        Content = BuildContent();
        WireEvents();
        RefreshFromState();
    }

    private Control BuildContent()
    {
        var header = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto,Auto,Auto"),
            ColumnSpacing = 10,
        };
        var title = new TextBlock
        {
            Text = "KeebWeaver",
            Foreground = NordPalette.SnowStorm2,
            FontSize = 17,
            FontWeight = FontWeight.Bold,
            VerticalAlignment = VerticalAlignment.Center,
        };
        header.Children.Add(title);

        Grid.SetColumn(_statusText, 2);
        header.Children.Add(_statusText);
        Grid.SetColumn(_clickThroughCheckBox, 3);
        header.Children.Add(_clickThroughCheckBox);

        var opacityPanel = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 5,
            VerticalAlignment = VerticalAlignment.Center,
            Children =
            {
                SmallText("Opacity"),
                _opacitySlider,
            },
        };
        Grid.SetColumn(opacityPanel, 4);
        header.Children.Add(opacityPanel);

        var layers = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 5,
        };
        foreach (var layer in _state.Contract.Layers)
        {
            var button = new Button
            {
                Content = layer.Title,
                Tag = layer.Id,
                Padding = new Thickness(10, 4),
            };
            button.Click += OnLayerButtonClick;
            _layerButtons.Add(layer.Id, button);
            layers.Children.Add(button);
        }

        var layerControls = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("Auto,Auto,Auto,*"),
            ColumnSpacing = 10,
        };
        layerControls.Children.Add(layers);
        Grid.SetColumn(_followLiveCheckBox, 1);
        layerControls.Children.Add(_followLiveCheckBox);
        Grid.SetColumn(_shiftPreviewCheckBox, 2);
        layerControls.Children.Add(_shiftPreviewCheckBox);
        Grid.SetColumn(_instructionText, 3);
        layerControls.Children.Add(_instructionText);

        var speedControls = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 6,
            VerticalAlignment = VerticalAlignment.Center,
            Children =
            {
                SmallText("Speed", NordPalette.SnowStorm1),
                _pointerSlowerButton,
                _pointerSpeedSlider,
                _pointerFasterButton,
                _pointerSpeedText,
                _pointerResetButton,
            },
        };

        var noticePanel = new StackPanel
        {
            Spacing = 2,
            Children =
            {
                _platformNoticeText,
                SmallText("Manual layer and Shift preview only; this app does not monitor typed input."),
            },
        };

        var body = new StackPanel
        {
            Spacing = 8,
            Children =
            {
                header,
                layerControls,
                speedControls,
                new ScrollViewer
                {
                    HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
                    VerticalScrollBarVisibility = ScrollBarVisibility.Disabled,
                    Content = _diagram,
                },
                noticePanel,
            },
        };

        return new Border
        {
            Padding = new Thickness(12),
            Background = NordPalette.PolarNight0,
            BorderBrush = NordPalette.PolarNight3,
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(14),
            Child = body,
        };
    }

    private void WireEvents()
    {
        _state.PropertyChanged += OnStatePropertyChanged;

        _followLiveCheckBox.PropertyChanged += (_, args) =>
        {
            if (!_refreshing && args.Property == ToggleButton.IsCheckedProperty)
            {
                _state.FollowLiveLayer = _followLiveCheckBox.IsChecked == true;
            }
        };
        _shiftPreviewCheckBox.PropertyChanged += (_, args) =>
        {
            if (!_refreshing && args.Property == ToggleButton.IsCheckedProperty)
            {
                _state.ShiftPreview = _shiftPreviewCheckBox.IsChecked == true;
            }
        };
        _clickThroughCheckBox.PropertyChanged += (_, args) =>
        {
            if (!_refreshing && args.Property == ToggleButton.IsCheckedProperty)
            {
                SetClickThrough(_clickThroughCheckBox.IsChecked == true);
            }
        };

        _opacitySlider.PropertyChanged += (_, args) =>
        {
            if (!_refreshing && args.Property == RangeBase.ValueProperty)
            {
                _state.Opacity = _opacitySlider.Value;
            }
        };
        _pointerSpeedSlider.PropertyChanged += (_, args) =>
        {
            if (!_refreshing && args.Property == RangeBase.ValueProperty)
            {
                _ = _controller.RequestPointerSpeedAsync(checked((int)Math.Round(_pointerSpeedSlider.Value)));
            }
        };
        _pointerSlowerButton.Click += (_, _) => _ = _controller.RequestPointerSpeedAsync(
            _state.PointerSpeed - _state.Contract.PointerSpeed.Step);
        _pointerFasterButton.Click += (_, _) => _ = _controller.RequestPointerSpeedAsync(
            _state.PointerSpeed + _state.Contract.PointerSpeed.Step);
        _pointerResetButton.Click += (_, _) => _ = _controller.RequestPointerSpeedAsync(
            _state.Contract.PointerSpeed.Default);

        Closed += (_, _) => _state.PropertyChanged -= OnStatePropertyChanged;
    }

    private void SetClickThrough(bool enabled)
    {
        if (_refreshing)
        {
            return;
        }

        if (_windowIntegration.TrySetClickThrough(this, enabled, out var degradation))
        {
            _state.ClickThrough = enabled;
            return;
        }

        _state.PlatformNotice = degradation ?? "Pass-through is unavailable on this window backend.";
        _refreshing = true;
        _clickThroughCheckBox.IsChecked = false;
        _refreshing = false;
    }

    private void OnLayerButtonClick(object? sender, Avalonia.Interactivity.RoutedEventArgs eventArgs)
    {
        if (sender is Button { Tag: string layerId })
        {
            _state.SelectManualLayer(layerId);
        }
    }

    private void OnStatePropertyChanged(object? sender, PropertyChangedEventArgs eventArgs)
    {
        if (Dispatcher.UIThread.CheckAccess())
        {
            RefreshFromState();
        }
        else
        {
            Dispatcher.UIThread.Post(RefreshFromState);
        }
    }

    private void RefreshFromState()
    {
        _refreshing = true;
        try
        {
            Opacity = _state.Opacity;
            _opacitySlider.Value = _state.Opacity;
            _followLiveCheckBox.IsChecked = _state.FollowLiveLayer;
            _shiftPreviewCheckBox.IsChecked = _state.ShiftPreview;
            _clickThroughCheckBox.IsChecked = _state.ClickThrough;
            _statusText.Text = _state.ConnectionMessage;
            _statusText.Foreground = _state.BluetoothConnected
                ? NordPalette.AuroraGreen
                : NordPalette.AuroraYellow;
            _pointerSpeedText.Text = _state.PointerSpeed.ToString(System.Globalization.CultureInfo.InvariantCulture);
            _pointerSpeedSlider.Value = _state.PointerSpeed;
            var speedEnabled = _state.BluetoothConnected && _state.PointerSpeedAvailable;
            _pointerSpeedSlider.IsEnabled = speedEnabled;
            _pointerSlowerButton.IsEnabled = speedEnabled;
            _pointerFasterButton.IsEnabled = speedEnabled;
            _pointerResetButton.IsEnabled = speedEnabled;
            _platformNoticeText.Text = _state.PlatformNotice ?? string.Empty;
            _platformNoticeText.IsVisible = !string.IsNullOrWhiteSpace(_state.PlatformNotice);

            var layer = _state.Contract.LayersById[_state.VisibleLayerId];
            _instructionText.Text = layer.Instruction;
            foreach (var (layerId, button) in _layerButtons)
            {
                button.Background = layerId == layer.Id ? AccentFor(layerId) : NordPalette.PolarNight2;
            }

            RebuildDiagram(layer.Id);
        }
        finally
        {
            _refreshing = false;
        }
    }

    private void RebuildDiagram(string layerId)
    {
        _diagram.Children.Clear();
        foreach (var row in _state.Contract.Layout.Rows)
        {
            var grid = new Grid
            {
                ColumnDefinitions = new ColumnDefinitions("Auto,82,Auto"),
                ColumnSpacing = 8,
            };
            grid.Children.Add(BuildKeyGroup(row.Left, layerId));
            var pointer = BuildPointerRow(row.Pointer, layerId);
            Grid.SetColumn(pointer, 1);
            grid.Children.Add(pointer);
            var right = BuildKeyGroup(row.Right, layerId);
            Grid.SetColumn(right, 2);
            grid.Children.Add(right);
            _diagram.Children.Add(grid);
        }

        var thumbs = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("Auto,82,Auto"),
            ColumnSpacing = 8,
        };
        thumbs.Children.Add(BuildKeyGroup(_state.Contract.Layout.LeftThumbs, layerId));
        var rightThumbs = BuildKeyGroup(_state.Contract.Layout.RightThumbs, layerId);
        Grid.SetColumn(rightThumbs, 2);
        thumbs.Children.Add(rightThumbs);
        _diagram.Children.Add(thumbs);
    }

    private Control BuildKeyGroup(IReadOnlyList<KeyContract> keys, string layerId)
    {
        var panel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 3 };
        foreach (var key in keys)
        {
            var normal = _state.Contract.Layout.LabelFor(
                key, layerId, shiftHeld: false, _useNeutralPlatformLabels);
            var primary = _state.Contract.Layout.LabelFor(
                key, layerId, _state.ShiftPreview, _useNeutralPlatformLabels);
            var hasOverride = key.Overrides.ContainsKey(layerId) ||
                (_useNeutralPlatformLabels &&
                 _state.Contract.Layout.NeutralPlatformLabels.TryGetValue(key.Id, out var labels) &&
                 labels.ContainsKey(layerId));
            var secondary = BuildSecondaryLabel(key, layerId, normal, primary, hasOverride);
            var labelPanel = new StackPanel
            {
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                Spacing = 1,
                Children =
                {
                    new TextBlock
                    {
                        Text = primary,
                        Foreground = NordPalette.SnowStorm2,
                        FontWeight = FontWeight.SemiBold,
                        FontSize = primary.Length > 9 ? 8 : 11,
                        TextAlignment = TextAlignment.Center,
                        TextWrapping = TextWrapping.Wrap,
                        MaxLines = 2,
                    },
                    new TextBlock
                    {
                        Text = secondary ?? string.Empty,
                        IsVisible = secondary is not null,
                        Foreground = NordPalette.SnowStorm0,
                        Opacity = 0.68,
                        FontSize = 7,
                        TextAlignment = TextAlignment.Center,
                    },
                },
            };
            var keyCap = new Border
            {
                Width = 35 * key.Width,
                Height = 39,
                Background = hasOverride && layerId != "base" ? AccentFor(layerId) : NordPalette.PolarNight2,
                BorderBrush = hasOverride && layerId != "base" ? AccentFor(layerId) : NordPalette.PolarNight3,
                BorderThickness = new Thickness(hasOverride && layerId != "base" ? 1.5 : 1),
                CornerRadius = new CornerRadius(6),
                Child = labelPanel,
            };
            ToolTip.SetTip(keyCap, $"{primary} • {_state.Contract.LayersById[layerId].Title}");
            panel.Children.Add(keyCap);
        }

        return panel;
    }

    private string? BuildSecondaryLabel(
        KeyContract key,
        string layerId,
        string normal,
        string primary,
        bool hasOverride)
    {
        if (_state.ShiftPreview && primary != normal)
        {
            return normal;
        }

        if (!_state.ShiftPreview && key.ShiftedOverrides.TryGetValue(layerId, out var shifted))
        {
            return layerId == "base" ? $"⇧ {shifted}" : $"{key.Base} · ⇧{shifted}";
        }

        return layerId == "base" ? null : hasOverride ? key.Base : "base";
    }

    private Control BuildPointerRow(string pointerRow, string layerId)
    {
        var pointer = _state.Contract.Layout.PointerCluster;
        return pointerRow switch
        {
            "up" => PointerButton(pointer.Up,
                layerId == "symbols" ? pointer.SymbolsUpMeaning : "Pointer up"),
            "horizontal" => new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Center,
                Spacing = 4,
                Children =
                {
                    PointerButton(pointer.Left, "Pointer left"),
                    PointerButton(pointer.Click, "Pointer click"),
                    PointerButton(pointer.Right, "Pointer right"),
                },
            },
            "down" => PointerButton(pointer.Down,
                layerId == "symbols" ? pointer.SymbolsDownMeaning : "Pointer down"),
            _ => throw new InvalidOperationException("The validated pointer row is unsupported."),
        };
    }

    private static Border PointerButton(string label, string help)
    {
        var control = new Border
        {
            Width = 23,
            Height = 23,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            Background = NordPalette.FrostDeep,
            BorderBrush = NordPalette.FrostBlue,
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(5),
            Child = new TextBlock
            {
                Text = label,
                Foreground = NordPalette.SnowStorm1,
                FontSize = 11,
                FontWeight = FontWeight.SemiBold,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
            },
        };
        ToolTip.SetTip(control, help);
        return control;
    }

    private static Button CompactButton(string text, string help)
    {
        var button = new Button
        {
            Content = text,
            Padding = new Thickness(8, 2),
            MinWidth = 30,
        };
        ToolTip.SetTip(button, help);
        return button;
    }

    private static TextBlock SmallText(string text = "", IBrush? foreground = null) => new()
    {
        Text = text,
        Foreground = foreground ?? NordPalette.SnowStorm0,
        FontSize = 11,
        VerticalAlignment = VerticalAlignment.Center,
        TextWrapping = TextWrapping.Wrap,
    };

    private static IBrush AccentFor(string layerId) => layerId switch
    {
        "navigation" => NordPalette.AuroraGreen,
        "numbers" => NordPalette.AuroraYellow,
        "symbols" => NordPalette.AuroraPurple,
        _ => NordPalette.PolarNight3,
    };
}
