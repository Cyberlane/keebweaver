# v0.2.0 release notes (candidate)

Status: release candidate. The tag-triggered GitHub Actions build and the
separate manual publish workflow still have to pass before this becomes a
public release.

## What is included

- The verified ErgoKeeb Eyelash Corne target with exact side-specific firmware
  targets: `ergokeeb_corne_left` and `ergokeeb_corne_right`. Generic Corne
  images are not compatible.
- The macOS Beginner profile with Base, Navigation, Numbers, and Symbols
  layers. The Symbols layer includes the coding characters `<`, `>`, `_`, `+`,
  `|`, and `~` in the documented positions.
- A native macOS Overlay that follows the optional encrypted BLE layer channel
  and provides a manual `Shift held` preview. The preview makes pairs such as
  `,` → `<`, `.` → `>`, `-` → `_`, `=` → `+`, `\` → `|`, and `` ` `` → `~`
  visible without Accessibility or Input Monitoring permission.
- Pointer-speed control from the Overlay and Symbols-layer shortcuts. The
  firmware persists the bounded value under `keebweaver/pointer_speed` after a
  five-second debounce, restores it on boot, and remains the source of truth
  after a BLE reconnect. Wait about five seconds after the last change before
  powering down. The settings-reset image clears this value with other ZMK
  settings.
- The nice!view artwork studio with a dedicated display partition and a
  checksum-validated USB transfer path that does not require a firmware flash
  for each artwork change.
- Deterministic, fail-closed project records that remain non-runnable browser
  intent and cannot generate or apply a keymap.

## Release assets

The release workflow produces these exact assets from the pinned build closure:

- `keebweaver-ergokeeb-corne-left.uf2`
- `keebweaver-ergokeeb-corne-right.uf2`
- `keebweaver-ergokeeb-corne-settings-reset.uf2`
- `SHA256SUMS`, build manifest, dependency/file-level SPDX inventories, license
  notices, and GitHub artifact attestations.

Use the normal left and right images for an update. They are not
interchangeable. Use the settings-reset image only for an intentional recovery
that also clears persistent ZMK settings and Bluetooth bonds. Release UF2s must
come from the signed tag workflow; local artifacts are for development
verification only.

## Boundaries before publication

- The browser Pages app is a design, validation, and artwork companion. It does
  not flash firmware or apply project intent.
- The Overlay is source-only and ad-hoc development signed. It is not a
  Developer ID-signed or notarized production app.
- Before publication, complete the owner-run physical checks for wired typing,
  split communication, displays, layers, BLE layer following, pointer-speed
  writes, persistence after power cycling, and reconnect behavior. Follow the
  [supported-hardware checklist](SUPPORTED_HARDWARE.md) and
  [flashing guide](FLASHING.md), then verify the Pages deployment separately.
