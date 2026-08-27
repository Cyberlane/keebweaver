// SPDX-License-Identifier: MIT

using System.Text.Json.Serialization;

namespace KeebWeaver.Overlay.Core.Contract;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class OverlayContract
{
    [JsonPropertyName("$schema")]
    public string? Schema { get; init; }

    public required int ContractVersion { get; init; }
    public required string ContractId { get; init; }
    public required AuthorityContract Authority { get; init; }
    public required DeviceContract Device { get; init; }
    public required IReadOnlyList<LayerContract> Layers { get; init; }
    public required LayoutContract Layout { get; init; }
    public required BluetoothContract Bluetooth { get; init; }
    public required IReadOnlyList<FrameContract> LayerStateFrames { get; init; }
    public required PointerSpeedContract PointerSpeed { get; init; }

    [JsonIgnore]
    public IReadOnlyDictionary<byte, LayerContract> LayersByFirmwareIndex =>
        _layersByFirmwareIndex ??= Layers.ToDictionary(layer => checked((byte)layer.FirmwareIndex));

    [JsonIgnore]
    public IReadOnlyDictionary<string, LayerContract> LayersById =>
        _layersById ??= Layers.ToDictionary(layer => layer.Id, StringComparer.Ordinal);

    [JsonIgnore]
    public ushort SupportedLayerMask => checked((ushort)((1u << Layers.Count) - 1u));

    private Dictionary<byte, LayerContract>? _layersByFirmwareIndex;
    private Dictionary<string, LayerContract>? _layersById;
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class AuthorityContract
{
    public required string Scope { get; init; }
    public required bool FirmwareIsAuthoritative { get; init; }
    public required string UnknownRecords { get; init; }
    public required bool ManualFallback { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class DeviceContract
{
    public required string CatalogId { get; init; }
    public required string ExpectedBluetoothName { get; init; }
    public required IReadOnlyList<string> SupportedSides { get; init; }
    public required string LayoutProfileId { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class LayerContract
{
    public required string Id { get; init; }
    public required int FirmwareIndex { get; init; }
    public required string Title { get; init; }
    public required string Instruction { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class LayoutContract
{
    public required IReadOnlyList<KeyboardRowContract> Rows { get; init; }
    public required IReadOnlyList<KeyContract> LeftThumbs { get; init; }
    public required IReadOnlyList<KeyContract> RightThumbs { get; init; }
    public required IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> NeutralPlatformLabels { get; init; }
    public required PointerClusterContract PointerCluster { get; init; }

    [JsonIgnore]
    public IReadOnlyList<KeyContract> AllKeys =>
        _allKeys ??= Rows.SelectMany(row => row.Left.Concat(row.Right))
            .Concat(LeftThumbs)
            .Concat(RightThumbs)
            .ToArray();

    public string LabelFor(KeyContract key, string layerId, bool shiftHeld, bool neutralPlatform)
    {
        var normal = key.Overrides.GetValueOrDefault(layerId, key.Base);
        if (neutralPlatform && NeutralPlatformLabels.TryGetValue(key.Id, out var labels))
        {
            normal = labels.GetValueOrDefault(layerId, normal);
        }

        return shiftHeld ? key.ShiftedOverrides.GetValueOrDefault(layerId, normal) : normal;
    }

    private IReadOnlyList<KeyContract>? _allKeys;
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class KeyboardRowContract
{
    public required string Id { get; init; }
    public required string Pointer { get; init; }
    public required IReadOnlyList<KeyContract> Left { get; init; }
    public required IReadOnlyList<KeyContract> Right { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class KeyContract
{
    public required string Id { get; init; }
    public required string Base { get; init; }
    public required double Width { get; init; }
    public required IReadOnlyDictionary<string, string> Overrides { get; init; }
    public required IReadOnlyDictionary<string, string> ShiftedOverrides { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class PointerClusterContract
{
    public required string Up { get; init; }
    public required string Left { get; init; }
    public required string Click { get; init; }
    public required string Right { get; init; }
    public required string Down { get; init; }
    public required string SymbolsUpMeaning { get; init; }
    public required string SymbolsDownMeaning { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class BluetoothContract
{
    public required string ServiceUuid { get; init; }
    public required CharacteristicContract LayerStateCharacteristic { get; init; }
    public required CharacteristicContract PointerSpeedCharacteristic { get; init; }
    public required string ApplicationIdentity { get; init; }

    [JsonIgnore]
    public Guid ServiceGuid => Guid.ParseExact(ServiceUuid, "D");

    [JsonIgnore]
    public Guid LayerStateCharacteristicGuid => Guid.ParseExact(LayerStateCharacteristic.Uuid, "D");

    [JsonIgnore]
    public Guid PointerSpeedCharacteristicGuid => Guid.ParseExact(PointerSpeedCharacteristic.Uuid, "D");
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CharacteristicContract
{
    public required string Uuid { get; init; }
    public required IReadOnlyList<string> RequiredProperties { get; init; }
    public required bool Encrypted { get; init; }
    public bool Optional { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class FrameContract
{
    public required int Version { get; init; }
    public required int Length { get; init; }
    public required string ByteOrder { get; init; }
    public required IReadOnlyList<FrameFieldContract> Fields { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class FrameFieldContract
{
    public required string Name { get; init; }
    public required int Offset { get; init; }
    public required int Length { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class PointerSpeedContract
{
    public required int Minimum { get; init; }
    public required int Maximum { get; init; }
    public required int Default { get; init; }
    public required int Step { get; init; }
    public required int WireLength { get; init; }
    public required string ByteOrder { get; init; }
    public required string OutOfRangeRead { get; init; }
    public required string OutOfRangeRequest { get; init; }
}
