# Desktop layout Overlay

KeebWeaver Overlay is an always-on-top learning aid for the verified ErgoKeeb
Eyelash Corne target. It is a separate companion app: it does not flash the
keyboard, change Bluetooth bonds or key bindings, inspect typed text, or
request Accessibility, Input Monitoring, or global keyboard-hook permission.

## Platform status

| Platform | Implementation | Distribution status |
| --- | --- | --- |
| macOS 13+ | Native SwiftUI/AppKit app with CoreBluetooth | Available from source now. The signed/notarized ZIP and Homebrew Cask are gated on the verified `v0.3.0` release. |
| Windows | C#/Avalonia shared UI with a WinRT GATT adapter | Source preview; compile verification is not physical BLE or desktop-runtime qualification. No release asset yet. |
| Linux | C#/Avalonia shared UI with a BlueZ D-Bus adapter | Source preview for X11/XWayland; physical BLE and desktop-runtime qualification are pending. No release asset yet. |

The Windows and Linux rows describe checked-in implementation structure, not
runtime parity. Windows must still be exercised against the physical keyboard.
On Linux, transparency, click-through behavior, and tray support vary by
compositor and desktop and must degrade visibly when unavailable. X11/XWayland
is the initial baseline; native Wayland support in Avalonia is experimental and
is outside the first supported release.

## Install on macOS

### Recommended after the verified v0.3.0 release: Homebrew

Once the `v0.3.0` release page lists `keebweaver-overlay-macos-universal.zip` as signed
and notarized **and** a clean live tap installation has been recorded, install
the exact same release artifact with:

```sh
brew install --cask Cyberlane/tap/keebweaver-overlay
```

The published `v0.2.0` release does not include that ZIP, and the Cask is not
claimed available yet. Configuration in this repository is not proof that the
release asset was published or that the tap works. Do not advertise or rely on
the command until both checks have passed.

After the Cask is live, Homebrew owns app updates and removal:

```sh
brew upgrade --cask keebweaver-overlay
brew uninstall --cask keebweaver-overlay
```

Normal uninstall leaves local macOS preferences intact. Use the explicit
destructive variant only when you also intend to remove those preferences:

```sh
brew uninstall --cask --zap keebweaver-overlay
```

Homebrew installs the immutable signed/notarized ZIP produced by KeebWeaver's
release workflow; it does not rebuild the app and it never touches keyboard
firmware or persistent ZMK state.

### Direct release download

After the same release gate passes, the alternative is the exact
`keebweaver-overlay-macos-universal.zip` asset on
[GitHub Releases](https://github.com/Cyberlane/keebweaver/releases). GitHub
Pages links to that release page and does not host or mirror another copy of
the binary. Check `SHA256SUMS`, the GitHub artifact attestation, the Developer
ID signature, and notarization before moving `KeebWeaver Overlay.app` to
`/Applications`:

```sh
gh release download TAG --repo Cyberlane/keebweaver \
  --pattern keebweaver-overlay-macos-universal.zip --pattern SHA256SUMS
grep -F "  keebweaver-overlay-macos-universal.zip" SHA256SUMS | \
  shasum -a 256 -c -
gh release verify-asset TAG keebweaver-overlay-macos-universal.zip \
  --repo Cyberlane/keebweaver
gh attestation verify keebweaver-overlay-macos-universal.zip \
  --repo Cyberlane/keebweaver
ditto -x -k keebweaver-overlay-macos-universal.zip .
codesign --verify --deep --strict --verbose=2 "KeebWeaver Overlay.app"
spctl --assess --type execute --verbose=2 "KeebWeaver Overlay.app"
```

Replace `TAG` with the release tag that actually contains the asset. A source
archive, an ad-hoc-signed local bundle, or a ZIP copied from Pages is not the
production application.

### Build from source now

Requires macOS 13 or newer, Swift 6, and Node.js 22.12 or newer. From the
repository root:

```sh
swift test --package-path overlay/macos/KeebWeaverOverlay
bash overlay/macos/KeebWeaverOverlay/build-app.sh
open "dist/overlay/macos/KeebWeaver Overlay.app"
```

The local script creates an ad-hoc development signature. It does not produce
a Developer ID-signed or Apple-notarized distribution and should not be
redistributed as one.

## Use the Overlay

The floating panel stays above normal windows and can be moved, resized, made
translucent, hidden, or set to pass through mouse clicks. The default panel is
intentionally compact; use its resize handle for larger keycaps. The menu-bar
keyboard icon can recover the panel when pass-through is enabled.

The panel has four manual views matching the runnable firmware layers:

- Base — normal QWERTY typing;
- Navigation — hold the Enter / Nav thumb key;
- Numbers — hold the Num thumb key;
- Symbols — hold the Space / Sym thumb key.

Large labels show the selected layer's output. Small labels show the underlying
base key, making transparent positions and layer changes easier to learn. The
`Shift held` checkbox manually previews Shift-modified output, including
`,` → `<`, `.` → `>`, `-` → `_`, `=` → `+`, `\` → `|`, and `` ` `` → `~`.
It intentionally does not detect physical key presses.

## Optional BLE following and pointer speed

When the BLE-enabled exact left-half firmware is installed, the Overlay looks
for the KeebWeaver layer-state GATT channel. It subscribes to versioned,
encrypted notifications and follows the highest active layer. The compact
speed control writes only the bounded pointer-speed value; firmware persists
it through ZMK settings after a short debounce. The keyboard is authoritative
after reconnect, so the client reads the saved value rather than keeping a
competing desktop preference. Allow about five seconds after the last change
before powering down so the debounced write can finish.

The client requires the documented `ErgoKeeb Corne` name, service UUID,
characteristic properties, and frame shape. Malformed values and unexpected
contracts fail closed. BLE link encryption prevents plain unauthenticated GATT
access, but another peripheral can copy a name and UUIDs; this is not
cryptographic application identity.

If the helper is absent, manual layer tabs remain fully usable. Installing the
app does not install firmware. Build or download only the exact custom
`ergokeeb_corne_left` and `ergokeeb_corne_right` images, and follow the
[flashing safety guide](FLASHING.md). Never substitute a generic Corne image.

## Windows and Linux contributor preview

The shared contract, parser, state, UI, and platform shells live under
`overlay/contract/` and `overlay/dotnet/`. Restore and run the platform-neutral
tests with:

```sh
cd overlay/dotnet
dotnet restore KeebWeaverOverlay.slnx --locked-mode
dotnet build KeebWeaverOverlay.slnx --no-restore
dotnet test tests/KeebWeaver.Overlay.Core.Tests/KeebWeaver.Overlay.Core.Tests.csproj \
  --no-build --no-restore
```

On the matching target OS, start the relevant source preview with one of these
commands after the restore and build above:

```sh
dotnet run --project src/KeebWeaver.Overlay.Windows/KeebWeaver.Overlay.Windows.csproj --no-restore
dotnet run --project src/KeebWeaver.Overlay.Linux/KeebWeaver.Overlay.Linux.csproj --no-restore
```

Do not run the Windows command on Linux or the Linux command on Windows. These
are source previews, not official packages. A successful macOS-hosted test or
cross-platform compile proves only the shared logic and build boundary. Do not
call either desktop client supported until it has been run on its target OS
with the physical keyboard and its BLE, reconnect, tray recovery,
transparency, click-through, and degraded-capability states recorded.
