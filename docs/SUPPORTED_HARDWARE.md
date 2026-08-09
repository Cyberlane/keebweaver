# Supported hardware

## ErgoKeeb Eyelash Corne reference target

KeebWeaver's first target is the custom nRF52840 split board exposed to ZMK as:

- `ergokeeb_corne_left` — central half and normal USB host connection;
- `ergokeeb_corne_right` — peripheral half;
- `nice_view` — 160×68 one-bit memory display on each half.

The source model contains 48 matrix positions: 42 physical keycaps, five
matrix-based pointer/click positions, and one source-only position. The physical
panels are presented as 68×160 portrait displays.

## Identification checklist

Before using a release binary, confirm all of the following:

- The existing firmware or board source identifies the exact custom targets
  above, not `corne_left`, `corne_right`, or another generic board.
- Both controllers are nRF52840/nice!nano-compatible and enter a `NICENANO` UF2
  bootloader volume.
- The left half is the central USB/Studio side.
- Both displays are nice!view-compatible 160×68 panels.
- The right-side five-way control maps to independent up, left, click, right,
  and down matrix positions.
- A side-specific recovery image for the exact keyboard is retained privately.

If any item is unknown or differs, stop. Do not test compatibility by flashing.

## Qualification status

The reference keymap has been qualified for USB typing, split communication,
both displays, pointer/click, Base/Navigation/Numbers/Symbols layers, and initial
Bluetooth host use. The separately versioned artwork transport has automated
protocol, partition, and build coverage; each release still identifies whether
live-device artwork qualification was performed.

## Unsupported substitutions

- Generic Corne, Sofle, or nice!nano shield images.
- A binary for the opposite half.
- Unknown ErgoKeeb board revisions that reuse the product name.
- A settings-reset image used as a normal firmware update.
