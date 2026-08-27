// SPDX-License-Identifier: MIT

using System.Text;
using KeebWeaver.Overlay.Core.Contract;

namespace KeebWeaver.Overlay.Core.Tests;

public sealed class ContractTests
{
    [Fact]
    public void EmbeddedContractMatchesExactOverlayBoundary()
    {
        var contract = ContractLoader.LoadDefault();

        Assert.Equal(1, contract.ContractVersion);
        Assert.Equal(42, contract.Layout.AllKeys.Count);
        Assert.Equal("ErgoKeeb Corne", contract.Device.ExpectedBluetoothName);
        Assert.Equal("8f4b0001-2a0e-4f6e-9a1c-3d7b56c4e201", contract.Bluetooth.ServiceUuid);
        Assert.Equal(300, contract.PointerSpeed.Minimum);
        Assert.Equal(2400, contract.PointerSpeed.Maximum);
        Assert.Equal([0, 1, 2, 3], contract.Layers.Select(layer => layer.FirmwareIndex));
    }

    [Fact]
    public void NeutralLabelsDoNotClaimMacShortcutSemantics()
    {
        var contract = ContractLoader.LoadDefault();
        var key = Assert.Single(contract.Layout.AllKeys, candidate => candidate.Id == "r2c1");

        Assert.Equal("⌘Z", contract.Layout.LabelFor(key, "navigation", shiftHeld: false, neutralPlatform: false));
        Assert.Equal("LGUI+Z", contract.Layout.LabelFor(key, "navigation", shiftHeld: false, neutralPlatform: true));
    }

    [Fact]
    public void UnknownRootPropertyIsRejected()
    {
        var json = ContractJson();
        var mutated = json[..json.LastIndexOf('}')] + ",\"unknownRecord\":true}";

        Assert.Throws<ContractException>(() => LoadText(mutated));
    }

    [Fact]
    public void DuplicatePropertyIsRejected()
    {
        var json = ContractJson();
        var mutated = json.Replace("\"contractVersion\": 1,",
            "\"contractVersion\": 1, \"contractVersion\": 1,", StringComparison.Ordinal);

        Assert.Throws<ContractException>(() => LoadText(mutated));
    }

    private static string ContractJson() =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "contract", "keebweaver-overlay.json"));

    private static OverlayContract LoadText(string json)
    {
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));
        return ContractLoader.Load(stream);
    }
}
