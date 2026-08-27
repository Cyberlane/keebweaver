// SPDX-License-Identifier: MIT

namespace KeebWeaver.Overlay.Core.Platform;

public sealed record OverlayPlatformCapabilities(
    string Platform,
    string WindowBackend,
    bool SupportsClickThrough,
    bool SupportsTransparency,
    bool SupportsTrayRecovery,
    IReadOnlyList<string> Degradations)
{
    public string? Summary => Degradations.Count == 0 ? null : string.Join(" ", Degradations);
}
