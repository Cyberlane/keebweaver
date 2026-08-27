// SPDX-License-Identifier: MIT

using KeebWeaver.Overlay.Core.Contract;
using KeebWeaver.Overlay.Core.Transport;
using KeebWeaver.Overlay.UI.Platform;

namespace KeebWeaver.Overlay.UI;

public sealed record OverlayRuntime(
    OverlayContract Contract,
    IKeyboardClient KeyboardClient,
    IPlatformWindowIntegration WindowIntegration,
    bool UseNeutralPlatformLabels);
