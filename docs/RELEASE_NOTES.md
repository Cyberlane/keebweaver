# Release notes

## Unreleased — desktop Overlay distribution

This work is checked in for the release following `v0.2.0`; it is not evidence
that a new release, Homebrew Cask, or Windows/Linux package is live.

### Planned release outputs

- A universal macOS `keebweaver-overlay-macos-universal.zip` containing
  `KeebWeaver Overlay.app`. The release workflow must Developer ID-sign,
  notarize, staple, checksum, and attest this exact archive before publication.
  Its `keebweaver-overlay-macos-manifest.json` records the bundle, version, and
  architecture boundary used by release verification.
- A Homebrew Cask in `Cyberlane/homebrew-tap` that installs the immutable
  release ZIP. The recommended command becomes available only after the release
  is published, the tap update succeeds, and a clean live installation is
  verified:

  ```sh
  brew install --cask Cyberlane/tap/keebweaver-overlay
  ```

- A versioned language-neutral Overlay contract and shared C#/Avalonia
  structure for Windows and Linux. Those clients do not have release assets and
  must not be described as runtime-qualified until target-OS physical BLE and
  desktop-integration checks are recorded.

Pages links to GitHub Releases for the app ZIP rather than publishing another
binary copy. A local ad-hoc-signed build is for development and is not the
production artifact.

### Other unreleased behavior

- The macOS Beginner profile's Numbers layer maps the left home-row A/S/D/F/G
  positions to Bluetooth Host 1–5. It does not expose a destructive bond-clear
  shortcut. A normal exact-target firmware update preserves existing bonds;
  saved ZMK Studio bindings can still override the compiled keymap until the
  user explicitly restores the stock Studio settings.

## v0.2.0 — published 2026-08-23

The published `v0.2.0` release contains exact-target firmware and provenance
assets. It does **not** contain a desktop Overlay ZIP or Homebrew Cask.

### Included behavior

- The verified ErgoKeeb Eyelash Corne target with exact side-specific firmware
  targets: `ergokeeb_corne_left` and `ergokeeb_corne_right`. Generic Corne
  images are not compatible.
- The macOS Beginner profile with Base, Navigation, Numbers, and Symbols
  layers. The Symbols layer includes the coding characters `<`, `>`, `_`, `+`,
  `|`, and `~` in the documented positions.
- A source-built native macOS Overlay that follows the optional encrypted BLE
  layer channel and provides a manual `Shift held` preview. The preview makes
  pairs such as `,` → `<`, `.` → `>`, `-` → `_`, `=` → `+`, `\` → `|`, and
  `` ` `` → `~` visible without Accessibility or Input Monitoring permission.
- Pointer-speed control from the source Overlay and Symbols-layer shortcuts.
  Firmware persists the bounded value under `keebweaver/pointer_speed` after a
  five-second debounce, restores it on boot, and remains the source of truth
  after a BLE reconnect. The settings-reset image clears this value with other
  ZMK settings.
- The nice!view artwork studio with a dedicated display partition and a
  checksum-validated USB transfer path that does not require a firmware flash
  for each artwork change.
- Deterministic, fail-closed project records that remain non-runnable browser
  intent and cannot generate or apply a keymap.

### Published assets

- `keebweaver-ergokeeb-corne-left.uf2`
- `keebweaver-ergokeeb-corne-right.uf2`
- `keebweaver-ergokeeb-corne-settings-reset.uf2`
- `SHA256SUMS`, build manifest, dependency/file-level SPDX inventories, license
  notices, and GitHub artifact attestations.

The left and right images are not interchangeable. Use the settings-reset image
only for intentional recovery that may clear persistent ZMK settings and
Bluetooth bonds. Release UF2s come from the signed tag workflow; local
artifacts are development verification only.

### Qualification boundary

The browser Pages app is a design, validation, and artwork companion. It does
not flash firmware or apply project intent. The optional Overlay BLE helper has
source/build coverage, but owner-run physical layer-following, pointer-speed
persistence, and reconnect evidence was not recorded for `v0.2.0`; automatic
following therefore remains experimental. Manual Overlay layer selection does
not depend on firmware or physical hardware.
