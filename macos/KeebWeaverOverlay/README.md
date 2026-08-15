# KeebWeaver Overlay

KeebWeaver Overlay is a small native macOS helper for learning the current
ErgoKeeb Eyelash Corne beginner layout. It is an always-on-top, translucent
panel with selectable Base, Navigation, Numbers, and Symbols views.

It does not request Accessibility or Input Monitoring permission and does not
listen to typed text. When the matching helper firmware is installed, it uses
CoreBluetooth to receive active-layer notifications. A separate characteristic
can read and write only the bounded, volatile pointer-speed value.

The initial OSS release is source-only. The local build script applies an
ad-hoc development signature; it does not produce a Developer ID-signed or
Apple-notarized distribution.

## Build and launch

Requires macOS 13 or newer, Swift 6, and Node.js 22.12 or newer. From the
repository root:

```sh
bash macos/KeebWeaverOverlay/build-app.sh
open "macos/build/KeebWeaver Overlay.app"
```

The keyboard icon in the macOS menu bar provides Show, Hide, Pass-through, and
Quit commands. The window position, selected layer, and opacity are retained
locally by macOS. The app has no updater and makes no internet requests.

## Layout state

The overlay mirrors the checked-in beginner keymap. The selected layer shows its
active output in the large label and the underlying base key in the small label.
Transparent positions are shown as inherited base keys.

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

## Bluetooth trust boundary

The app requires the exact documented keyboard name, service UUID, and
characteristic properties. Firmware characteristics require an encrypted BLE
link. Names and custom UUIDs can still be copied by another peripheral, so this
is not application-level cryptographic identity. Do not treat the overlay as a
security or authentication display.

The app never changes bonds, ZMK settings, key bindings, or firmware. Pointer
speed writes affect only the current runtime and reset to the firmware default
after reboot.
