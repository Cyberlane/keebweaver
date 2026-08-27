# KeebWeaver Overlay

KeebWeaver Overlay is a small native macOS helper for learning the current
ErgoKeeb Eyelash Corne beginner layout. It is an always-on-top, translucent
panel with selectable Base, Navigation, Numbers, and Symbols views.

It does not request Accessibility or Input Monitoring permission and does not
listen to typed text. When the matching helper firmware is installed, it uses
CoreBluetooth to receive active-layer notifications. A separate characteristic
can read and write only the bounded pointer-speed value. The firmware persists
that value in ZMK settings after a short debounce, so it survives normal
power cycles without another firmware flash.

The published `v0.2.0` release is source-only for the Overlay. The `v0.3.0`
release candidate is intended to add a universal Developer ID-signed and
Apple-notarized ZIP, then make that exact artifact available through Homebrew
after live tap verification. Checked-in release configuration is not proof
that either path is available.

Once that release and tap gate passes, the recommended installation command is:

```sh
brew install --cask Cyberlane/tap/keebweaver-overlay
```

Until then, use the source build below. The local build script applies an
ad-hoc development signature and does not produce a distributable app.

## Build and launch

Requires macOS 13 or newer, Swift 6, and Node.js 22.12 or newer. From the
repository root:

```sh
swift test --package-path overlay/macos/KeebWeaverOverlay
bash overlay/macos/KeebWeaverOverlay/build-app.sh
open "dist/overlay/macos/KeebWeaver Overlay.app"
```

The keyboard icon in the macOS menu bar provides Show, Hide, Pass-through, and
Quit commands. The window position, selected layer, and opacity are retained
locally by macOS. The app has no updater and makes no internet requests.

## Layout state

The overlay mirrors the checked-in beginner keymap. The selected layer shows its
active output in the large label and the underlying base key in the small label.
Transparent positions are shown as inherited base keys.

The `Shift held` checkbox is a manual preview of Shift-modified output. It makes
common pairs such as `,` → `<`, `.` → `>`, `-` → `_`, `=` → `+`, `\` → `|`, and
`` ` `` → `~` visible without requiring Accessibility or Input Monitoring access.
The overlay intentionally does not detect physical key presses.

Automatic highlighting works only with the BLE-enabled left-half firmware. The
version 2 layer frame contains six little-endian bytes:

| Offset | Size | Value |
| --- | ---: | --- |
| 0 | 1 | Protocol version (`2`) |
| 1 | 1 | Highest active layer index |
| 2 | 2 | Active-layer bit mask |
| 4 | 2 | Pointer speed, `300...2400` |

The decoder also accepts the legacy four-byte version 1 frame, which omits
pointer speed. Unknown versions and lengths fail closed. If helper firmware is
not installed, the manual tabs remain available.

The keyboard is authoritative for the current pointer speed. The overlay reads
it again after reconnecting, and changes made by the slider or the Symbols-layer
pointer shortcuts are sent to the same bounded BLE characteristic. Wait about
five seconds after the last change before powering down so the debounced
settings write can complete. The settings-reset image intentionally clears this
value with the other persistent ZMK settings.

## Bluetooth trust boundary

The app requires the exact documented keyboard name, service UUID, and
characteristic properties. Firmware characteristics require an encrypted BLE
link. Names and custom UUIDs can still be copied by another peripheral, so this
is not application-level cryptographic identity. Do not treat the overlay as a
security or authentication display.

The app never changes bonds, key bindings, or firmware. Pointer-speed writes
change the keyboard's runtime setting through the helper; persistence is owned
by the firmware rather than by a separate macOS preference.

For installation, update/uninstall, direct-download verification, and current
Windows/Linux status, see [`docs/OVERLAY.md`](../../../docs/OVERLAY.md).
