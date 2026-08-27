// SPDX-License-Identifier: MIT

using System.ComponentModel;
using System.Runtime.CompilerServices;
using KeebWeaver.Overlay.Core.Contract;
using KeebWeaver.Overlay.Core.Protocol;

namespace KeebWeaver.Overlay.Core.State;

public sealed class OverlayState : INotifyPropertyChanged
{
    private readonly OverlayContract _contract;
    private string _selectedLayerId;
    private string? _detectedLayerId;
    private bool _followLiveLayer = true;
    private bool _shiftPreview;
    private double _opacity = 0.94;
    private bool _clickThrough;
    private string _connectionMessage = "BLE: starting";
    private bool _bluetoothConnected;
    private bool _pointerSpeedAvailable;
    private int _pointerSpeed;
    private string? _platformNotice;

    public OverlayState(OverlayContract contract)
    {
        ArgumentNullException.ThrowIfNull(contract);
        ContractLoader.Validate(contract);
        _contract = contract;
        _selectedLayerId = contract.Layers[0].Id;
        _pointerSpeed = contract.PointerSpeed.Default;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public OverlayContract Contract => _contract;

    public string SelectedLayerId
    {
        get => _selectedLayerId;
        private set => SetField(ref _selectedLayerId, value);
    }

    public string? DetectedLayerId
    {
        get => _detectedLayerId;
        private set
        {
            if (SetField(ref _detectedLayerId, value))
            {
                OnPropertyChanged(nameof(VisibleLayerId));
            }
        }
    }

    public string VisibleLayerId => FollowLiveLayer && DetectedLayerId is not null
        ? DetectedLayerId
        : SelectedLayerId;

    public bool FollowLiveLayer
    {
        get => _followLiveLayer;
        set
        {
            if (SetField(ref _followLiveLayer, value))
            {
                OnPropertyChanged(nameof(VisibleLayerId));
            }
        }
    }

    public bool ShiftPreview
    {
        get => _shiftPreview;
        set => SetField(ref _shiftPreview, value);
    }

    public double Opacity
    {
        get => _opacity;
        set => SetField(ref _opacity, Math.Clamp(value, 0.45, 1.0));
    }

    public bool ClickThrough
    {
        get => _clickThrough;
        set => SetField(ref _clickThrough, value);
    }

    public string ConnectionMessage
    {
        get => _connectionMessage;
        private set => SetField(ref _connectionMessage, value);
    }

    public bool BluetoothConnected
    {
        get => _bluetoothConnected;
        private set => SetField(ref _bluetoothConnected, value);
    }

    public bool PointerSpeedAvailable
    {
        get => _pointerSpeedAvailable;
        private set => SetField(ref _pointerSpeedAvailable, value);
    }

    public int PointerSpeed
    {
        get => _pointerSpeed;
        private set => SetField(ref _pointerSpeed, value);
    }

    public string? PlatformNotice
    {
        get => _platformNotice;
        set => SetField(ref _platformNotice, value);
    }

    public void SelectManualLayer(string layerId)
    {
        if (!_contract.LayersById.ContainsKey(layerId))
        {
            throw new ArgumentException("The manual layer is not in the overlay contract.", nameof(layerId));
        }

        SelectedLayerId = layerId;
        FollowLiveLayer = false;
    }

    public void ApplyTelemetry(LayerStateFrame frame)
    {
        ArgumentNullException.ThrowIfNull(frame);
        if (!_contract.LayersById.ContainsKey(frame.LayerId))
        {
            throw new ArgumentException("Telemetry referenced an unknown layer.", nameof(frame));
        }

        DetectedLayerId = frame.LayerId;
        if (frame.PointerSpeed is { } pointerSpeed)
        {
            ApplyPointerSpeed(pointerSpeed);
        }
    }

    public void ApplyPointerSpeed(ushort pointerSpeed)
    {
        if (pointerSpeed < _contract.PointerSpeed.Minimum || pointerSpeed > _contract.PointerSpeed.Maximum)
        {
            throw new ArgumentOutOfRangeException(nameof(pointerSpeed));
        }

        PointerSpeed = pointerSpeed;
    }

    public void SetConnectionStatus(string message, bool connected, bool pointerSpeedAvailable)
    {
        ConnectionMessage = message;
        BluetoothConnected = connected;
        PointerSpeedAvailable = connected && pointerSpeedAvailable;
        if (!connected)
        {
            DetectedLayerId = null;
        }
    }

    private bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
        {
            return false;
        }

        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
