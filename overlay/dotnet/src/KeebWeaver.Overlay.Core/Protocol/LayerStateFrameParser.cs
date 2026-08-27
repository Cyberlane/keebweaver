// SPDX-License-Identifier: MIT

using System.Buffers.Binary;
using KeebWeaver.Overlay.Core.Contract;

namespace KeebWeaver.Overlay.Core.Protocol;

public enum FrameRejectionReason
{
    None,
    EmptyFrame,
    UnknownVersion,
    WrongLength,
    UnknownLayerIndex,
    UnknownLayerMask,
    InconsistentHighestLayer,
    PointerSpeedOutOfRange,
}

public sealed record LayerStateFrame(
    byte Version,
    byte HighestLayerIndex,
    string LayerId,
    ushort ActiveLayerMask,
    ushort? PointerSpeed);

public sealed class LayerStateFrameParser
{
    private readonly OverlayContract _contract;
    private readonly IReadOnlyDictionary<byte, int> _frameLengths;

    public LayerStateFrameParser(OverlayContract contract)
    {
        ArgumentNullException.ThrowIfNull(contract);
        ContractLoader.Validate(contract);
        _contract = contract;
        _frameLengths = contract.LayerStateFrames.ToDictionary(
            frame => checked((byte)frame.Version),
            frame => frame.Length);
    }

    public bool TryParse(
        ReadOnlySpan<byte> data,
        out LayerStateFrame? frame,
        out FrameRejectionReason rejectionReason)
    {
        frame = null;
        if (data.IsEmpty)
        {
            rejectionReason = FrameRejectionReason.EmptyFrame;
            return false;
        }

        var version = data[0];
        if (!_frameLengths.TryGetValue(version, out var expectedLength))
        {
            rejectionReason = FrameRejectionReason.UnknownVersion;
            return false;
        }

        if (data.Length != expectedLength)
        {
            rejectionReason = FrameRejectionReason.WrongLength;
            return false;
        }

        var highestLayerIndex = data[1];
        if (!_contract.LayersByFirmwareIndex.TryGetValue(highestLayerIndex, out var layer))
        {
            rejectionReason = FrameRejectionReason.UnknownLayerIndex;
            return false;
        }

        var activeLayerMask = BinaryPrimitives.ReadUInt16LittleEndian(data[2..4]);
        if ((activeLayerMask & ~_contract.SupportedLayerMask) != 0)
        {
            rejectionReason = FrameRejectionReason.UnknownLayerMask;
            return false;
        }

        var calculatedHighest = HighestActiveLayer(activeLayerMask);
        if ((activeLayerMask == 0 && highestLayerIndex != 0) ||
            (activeLayerMask != 0 && calculatedHighest != highestLayerIndex))
        {
            rejectionReason = FrameRejectionReason.InconsistentHighestLayer;
            return false;
        }

        ushort? pointerSpeed = null;
        if (version == 2)
        {
            if (!TryDecodePointerSpeed(data[4..6], out var decodedSpeed, out rejectionReason))
            {
                return false;
            }

            pointerSpeed = decodedSpeed;
        }

        frame = new LayerStateFrame(version, highestLayerIndex, layer.Id, activeLayerMask, pointerSpeed);
        rejectionReason = FrameRejectionReason.None;
        return true;
    }

    public bool TryDecodePointerSpeed(
        ReadOnlySpan<byte> data,
        out ushort pointerSpeed,
        out FrameRejectionReason rejectionReason)
    {
        pointerSpeed = 0;
        if (data.Length != _contract.PointerSpeed.WireLength)
        {
            rejectionReason = FrameRejectionReason.WrongLength;
            return false;
        }

        var value = BinaryPrimitives.ReadUInt16LittleEndian(data);
        if (value < _contract.PointerSpeed.Minimum || value > _contract.PointerSpeed.Maximum)
        {
            rejectionReason = FrameRejectionReason.PointerSpeedOutOfRange;
            return false;
        }

        pointerSpeed = value;
        rejectionReason = FrameRejectionReason.None;
        return true;
    }

    public byte[] EncodePointerSpeed(int pointerSpeed)
    {
        if (pointerSpeed < _contract.PointerSpeed.Minimum || pointerSpeed > _contract.PointerSpeed.Maximum)
        {
            throw new ArgumentOutOfRangeException(nameof(pointerSpeed), pointerSpeed,
                "Pointer speed must be within the contract bounds.");
        }

        var bytes = new byte[_contract.PointerSpeed.WireLength];
        BinaryPrimitives.WriteUInt16LittleEndian(bytes, checked((ushort)pointerSpeed));
        return bytes;
    }

    private static byte HighestActiveLayer(ushort mask)
    {
        byte highest = 0;
        while (mask > 1)
        {
            mask >>= 1;
            highest++;
        }

        return highest;
    }
}
