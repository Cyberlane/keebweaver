// SPDX-License-Identifier: MIT

using System.Text.Json;
using KeebWeaver.Overlay.Core.Contract;
using KeebWeaver.Overlay.Core.Protocol;

namespace KeebWeaver.Overlay.Core.Tests;

public sealed class LayerStateFrameParserTests
{
    private readonly LayerStateFrameParser _parser = new(ContractLoader.LoadDefault());

    [Fact]
    public void AllGoldenValidFramesDecodeExactly()
    {
        foreach (var vector in Vectors().ValidLayerStateFrames)
        {
            var accepted = _parser.TryParse(
                Convert.FromHexString(vector.Hex),
                out var frame,
                out var rejection);

            Assert.True(accepted, vector.Name);
            Assert.NotNull(frame);
            Assert.Equal(FrameRejectionReason.None, rejection);
            Assert.Equal(vector.Version, frame.Version);
            Assert.Equal(vector.HighestLayerIndex, frame.HighestLayerIndex);
            Assert.Equal(vector.ActiveLayerMask, frame.ActiveLayerMask);
            Assert.Equal(vector.PointerSpeed, frame.PointerSpeed);
        }
    }

    [Fact]
    public void AllGoldenInvalidFramesFailClosedForDocumentedReason()
    {
        foreach (var vector in Vectors().InvalidLayerStateFrames)
        {
            var accepted = _parser.TryParse(
                Convert.FromHexString(vector.Hex),
                out var frame,
                out var rejection);

            Assert.False(accepted, vector.Name);
            Assert.Null(frame);
            Assert.Equal(ExpectedReason(vector.Reason), rejection);
        }
    }

    [Fact]
    public void PointerSpeedGoldenValuesRespectExactLengthAndBounds()
    {
        var vectors = Vectors();
        foreach (var vector in vectors.ValidPointerSpeedValues)
        {
            Assert.True(_parser.TryDecodePointerSpeed(
                Convert.FromHexString(vector.Hex), out var speed, out var rejection));
            Assert.Equal(FrameRejectionReason.None, rejection);
            Assert.Equal(vector.Value, speed);
            Assert.Equal(vector.Hex, Convert.ToHexString(_parser.EncodePointerSpeed(speed)).ToLowerInvariant());
        }

        foreach (var vector in vectors.InvalidPointerSpeedValues)
        {
            Assert.False(_parser.TryDecodePointerSpeed(
                Convert.FromHexString(vector.Hex), out _, out var rejection));
            Assert.Equal(ExpectedReason(vector.Reason), rejection);
        }
    }

    [Theory]
    [InlineData(299)]
    [InlineData(2401)]
    public void PointerSpeedEncoderRejectsOutOfRangeRequests(int speed)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => _parser.EncodePointerSpeed(speed));
    }

    private static VectorDocument Vectors()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "contract", "layer-state-vectors.json");
        return JsonSerializer.Deserialize<VectorDocument>(
            File.ReadAllText(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Golden vectors did not deserialize.");
    }

    private static FrameRejectionReason ExpectedReason(string reason) => reason switch
    {
        "empty-frame" => FrameRejectionReason.EmptyFrame,
        "unknown-version" => FrameRejectionReason.UnknownVersion,
        "wrong-length" => FrameRejectionReason.WrongLength,
        "unknown-layer-index" => FrameRejectionReason.UnknownLayerIndex,
        "unknown-layer-mask" => FrameRejectionReason.UnknownLayerMask,
        "inconsistent-highest-layer" => FrameRejectionReason.InconsistentHighestLayer,
        "pointer-speed-out-of-range" => FrameRejectionReason.PointerSpeedOutOfRange,
        _ => throw new InvalidOperationException($"Unknown golden rejection reason '{reason}'."),
    };

    private sealed class VectorDocument
    {
        public required IReadOnlyList<ValidFrameVector> ValidLayerStateFrames { get; init; }
        public required IReadOnlyList<InvalidVector> InvalidLayerStateFrames { get; init; }
        public required IReadOnlyList<ValidSpeedVector> ValidPointerSpeedValues { get; init; }
        public required IReadOnlyList<InvalidVector> InvalidPointerSpeedValues { get; init; }
    }

    private sealed class ValidFrameVector
    {
        public required string Name { get; init; }
        public required string Hex { get; init; }
        public required byte Version { get; init; }
        public required byte HighestLayerIndex { get; init; }
        public required ushort ActiveLayerMask { get; init; }
        public ushort? PointerSpeed { get; init; }
    }

    private sealed class ValidSpeedVector
    {
        public required string Name { get; init; }
        public required string Hex { get; init; }
        public required ushort Value { get; init; }
    }

    private sealed class InvalidVector
    {
        public required string Name { get; init; }
        public required string Hex { get; init; }
        public required string Reason { get; init; }
    }
}
