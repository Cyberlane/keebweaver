// SPDX-License-Identifier: MIT

using System.Reflection;
using System.Text.Json;

namespace KeebWeaver.Overlay.Core.Contract;

public sealed class ContractException : Exception
{
    public ContractException(string message) : base(message)
    {
    }

    public ContractException(string message, Exception innerException) : base(message, innerException)
    {
    }
}

public static class ContractLoader
{
    private const string EmbeddedContractName =
        "KeebWeaver.Overlay.Contract.v1.keebweaver-overlay.json";

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        MaxDepth = 32,
        ReadCommentHandling = JsonCommentHandling.Disallow,
        AllowTrailingCommas = false,
    };

    public static OverlayContract LoadDefault()
    {
        using var stream = typeof(ContractLoader).Assembly.GetManifestResourceStream(EmbeddedContractName)
            ?? throw new ContractException($"Embedded overlay contract '{EmbeddedContractName}' was not found.");
        return Load(stream);
    }

    public static OverlayContract Load(Stream stream)
    {
        ArgumentNullException.ThrowIfNull(stream);

        try
        {
            using var document = JsonDocument.Parse(stream, new JsonDocumentOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow,
                MaxDepth = 32,
            });
            EnsureNoDuplicateProperties(document.RootElement, "$");

            var contract = document.RootElement.Deserialize<OverlayContract>(SerializerOptions)
                ?? throw new ContractException("The overlay contract was empty.");
            Validate(contract);
            return contract;
        }
        catch (ContractException)
        {
            throw;
        }
        catch (Exception exception) when (exception is JsonException or OverflowException or ArgumentException)
        {
            throw new ContractException("The overlay contract is malformed or unsupported.", exception);
        }
    }

    public static void Validate(OverlayContract contract)
    {
        ArgumentNullException.ThrowIfNull(contract);

        Require(contract.ContractVersion == 1, "Only overlay client contract version 1 is supported.");
        Require(contract.ContractId == "keebweaver-overlay-client-v1", "The contract id is not recognized.");
        Require(contract.Authority.Scope == "overlay-client-only", "The contract authority scope is invalid.");
        Require(contract.Authority.FirmwareIsAuthoritative, "The contract must keep firmware authoritative.");
        Require(contract.Authority.UnknownRecords == "reject", "The contract must reject unknown records.");
        Require(contract.Authority.ManualFallback, "The contract must preserve manual fallback.");

        Require(contract.Device.CatalogId == "ergokeeb-corne-eyelash", "The device catalog id is unsupported.");
        Require(contract.Device.ExpectedBluetoothName == "ErgoKeeb Corne", "The Bluetooth name is unsupported.");
        Require(contract.Device.LayoutProfileId == "macos-beginner-v1", "The layout profile is unsupported.");
        Require(contract.Device.SupportedSides.SequenceEqual(
            ["ergokeeb_corne_left", "ergokeeb_corne_right"], StringComparer.Ordinal),
            "The exact supported side targets are invalid.");

        Require(contract.Layers.Count == 4, "Exactly four firmware layers are supported by contract v1.");
        var expectedLayers = new[]
        {
            (Id: "base", Index: 0),
            (Id: "navigation", Index: 1),
            (Id: "numbers", Index: 2),
            (Id: "symbols", Index: 3),
        };
        for (var index = 0; index < expectedLayers.Length; index++)
        {
            var actual = contract.Layers[index];
            var expected = expectedLayers[index];
            Require(actual.Id == expected.Id && actual.FirmwareIndex == expected.Index,
                $"Layer {index} does not match contract v1.");
            Require(!string.IsNullOrWhiteSpace(actual.Title) && !string.IsNullOrWhiteSpace(actual.Instruction),
                $"Layer '{actual.Id}' has an empty display record.");
        }

        var keys = contract.Layout.AllKeys;
        Require(keys.Count == 42, "The ErgoKeeb overlay layout must contain exactly 42 physical keys.");
        Require(keys.Select(key => key.Id).Distinct(StringComparer.Ordinal).Count() == keys.Count,
            "Keyboard position ids must be unique.");
        Require(contract.Layout.Rows.Count == 3 &&
                contract.Layout.Rows.Select(row => row.Pointer).SequenceEqual(["up", "horizontal", "down"]),
            "The three pointer-cluster rows are invalid.");

        var layerIds = contract.LayersById.Keys.ToHashSet(StringComparer.Ordinal);
        foreach (var key in keys)
        {
            Require(!string.IsNullOrWhiteSpace(key.Id) && !string.IsNullOrWhiteSpace(key.Base) &&
                    double.IsFinite(key.Width) && key.Width > 0,
                "A keyboard key record is invalid.");
            Require(key.Overrides.Keys.All(layerIds.Contains) && key.ShiftedOverrides.Keys.All(layerIds.Contains),
                $"Key '{key.Id}' references an unknown layer.");
        }

        var keyIds = keys.Select(key => key.Id).ToHashSet(StringComparer.Ordinal);
        foreach (var (keyId, labels) in contract.Layout.NeutralPlatformLabels)
        {
            Require(keyIds.Contains(keyId), $"Neutral label record '{keyId}' references an unknown key.");
            Require(labels.Keys.All(layerIds.Contains), $"Neutral label record '{keyId}' references an unknown layer.");
        }

        RequireUuid(contract.Bluetooth.ServiceUuid, "service");
        RequireUuid(contract.Bluetooth.LayerStateCharacteristic.Uuid, "layer-state characteristic");
        RequireUuid(contract.Bluetooth.PointerSpeedCharacteristic.Uuid, "pointer-speed characteristic");
        Require(contract.Bluetooth.ServiceUuid == "8f4b0001-2a0e-4f6e-9a1c-3d7b56c4e201" &&
                contract.Bluetooth.LayerStateCharacteristic.Uuid == "8f4b0002-2a0e-4f6e-9a1c-3d7b56c4e201" &&
                contract.Bluetooth.PointerSpeedCharacteristic.Uuid == "8f4b0003-2a0e-4f6e-9a1c-3d7b56c4e201",
            "The contract v1 BLE UUID triplet is invalid.");
        RequireExactProperties(contract.Bluetooth.LayerStateCharacteristic, ["read", "notify"], optional: false);
        RequireExactProperties(contract.Bluetooth.PointerSpeedCharacteristic, ["read", "write"], optional: true);
        Require(contract.Bluetooth.ApplicationIdentity == "name-and-uuid-contract-only",
            "The BLE identity limitation must remain explicit.");

        Require(contract.LayerStateFrames.Count == 2, "Contract v1 supports exactly frame versions 1 and 2.");
        ValidateFrame(contract.LayerStateFrames[0], 1, 4,
            [("version", 0, 1), ("highestLayerIndex", 1, 1), ("activeLayerMask", 2, 2)]);
        ValidateFrame(contract.LayerStateFrames[1], 2, 6,
            [("version", 0, 1), ("highestLayerIndex", 1, 1), ("activeLayerMask", 2, 2), ("pointerSpeed", 4, 2)]);

        var speed = contract.PointerSpeed;
        Require(speed.Minimum == 300 && speed.Maximum == 2400 && speed.Default == 1200 && speed.Step == 100,
            "The contract v1 pointer-speed bounds are invalid.");
        Require(speed.WireLength == 2 && speed.ByteOrder == "little-endian",
            "The pointer-speed wire encoding is invalid.");
        Require(speed.OutOfRangeRead == "reject" && speed.OutOfRangeRequest == "reject",
            "Pointer-speed clients must reject out-of-range values.");
    }

    private static void EnsureNoDuplicateProperties(JsonElement element, string path)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in element.EnumerateObject())
            {
                if (!names.Add(property.Name))
                {
                    throw new ContractException($"Duplicate property '{property.Name}' at {path}.");
                }

                EnsureNoDuplicateProperties(property.Value, $"{path}.{property.Name}");
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            var index = 0;
            foreach (var item in element.EnumerateArray())
            {
                EnsureNoDuplicateProperties(item, $"{path}[{index++}]");
            }
        }
    }

    private static void ValidateFrame(
        FrameContract frame,
        int version,
        int length,
        IReadOnlyList<(string Name, int Offset, int Length)> fields)
    {
        Require(frame.Version == version && frame.Length == length && frame.ByteOrder == "little-endian",
            $"Layer-state frame v{version} metadata is invalid.");
        Require(frame.Fields.Count == fields.Count, $"Layer-state frame v{version} has unknown fields.");
        for (var index = 0; index < fields.Count; index++)
        {
            var actual = frame.Fields[index];
            var expected = fields[index];
            Require(actual.Name == expected.Name && actual.Offset == expected.Offset && actual.Length == expected.Length,
                $"Layer-state frame v{version} field {index} is invalid.");
        }
    }

    private static void RequireExactProperties(
        CharacteristicContract characteristic,
        IReadOnlyList<string> required,
        bool optional)
    {
        Require(characteristic.RequiredProperties.SequenceEqual(required, StringComparer.Ordinal),
            $"Characteristic '{characteristic.Uuid}' properties are invalid.");
        Require(characteristic.Encrypted, $"Characteristic '{characteristic.Uuid}' must remain encrypted.");
        Require(characteristic.Optional == optional, $"Characteristic '{characteristic.Uuid}' optionality is invalid.");
    }

    private static void RequireUuid(string value, string record)
    {
        Require(Guid.TryParseExact(value, "D", out _) && value == value.ToLowerInvariant(),
            $"The {record} UUID is not canonical lowercase UUID text.");
    }

    private static void Require(bool condition, string message)
    {
        if (!condition)
        {
            throw new ContractException(message);
        }
    }
}
