// SPDX-License-Identifier: MIT

using KeebWeaver.Overlay.Core.Contract;
using KeebWeaver.Overlay.Core.Protocol;
using KeebWeaver.Overlay.Core.State;

namespace KeebWeaver.Overlay.Core.Tests;

public sealed class OverlayStateTests
{
    [Fact]
    public void ManualModeStaysAuthoritativeUntilFollowIsReenabled()
    {
        var state = new OverlayState(ContractLoader.LoadDefault());
        state.SelectManualLayer("numbers");

        state.ApplyTelemetry(new LayerStateFrame(2, 3, "symbols", 8, 1200));

        Assert.False(state.FollowLiveLayer);
        Assert.Equal("numbers", state.VisibleLayerId);
        Assert.Equal("symbols", state.DetectedLayerId);

        state.FollowLiveLayer = true;
        Assert.Equal("symbols", state.VisibleLayerId);
    }

    [Fact]
    public void DisconnectReturnsToManualViewAndDisablesWrites()
    {
        var state = new OverlayState(ContractLoader.LoadDefault());
        state.SetConnectionStatus("connected", connected: true, pointerSpeedAvailable: true);
        state.ApplyTelemetry(new LayerStateFrame(2, 1, "navigation", 2, 1200));

        state.SetConnectionStatus("disconnected", connected: false, pointerSpeedAvailable: true);

        Assert.False(state.BluetoothConnected);
        Assert.False(state.PointerSpeedAvailable);
        Assert.Null(state.DetectedLayerId);
        Assert.Equal("base", state.VisibleLayerId);
    }

    [Fact]
    public void StateRejectsUnknownLayersAndOutOfRangeSpeed()
    {
        var state = new OverlayState(ContractLoader.LoadDefault());

        Assert.Throws<ArgumentException>(() => state.SelectManualLayer("future-layer"));
        Assert.Throws<ArgumentOutOfRangeException>(() => state.ApplyPointerSpeed(299));
    }
}
