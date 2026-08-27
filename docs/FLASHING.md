# Firmware installation and recovery

> **Warning:** This procedure writes to physical hardware. A wrong target can
> make the keyboard unavailable until a correct recovery image is restored.
> The settings-reset image also clears ZMK settings and Bluetooth bonds.

## Before starting

1. Complete the identification checklist in
   [Supported hardware](SUPPORTED_HARDWARE.md).
2. Verify the release checksums and GitHub attestation.
3. Keep exact, side-specific recovery UF2 files outside this repository.
4. Use a known data-capable cable and connect only one half at a time.
5. Label the physical left and right halves before entering the bootloader.

## Normal firmware update

Use this path when compatible KeebWeaver firmware is already installed and the
release notes do not require a settings reset:

1. Connect the left half, enter its `NICENANO` bootloader, and copy only
   `keebweaver-ergokeeb-corne-left.uf2`.
2. Wait for automatic ejection before disconnecting it.
3. Repeat on the right half using only
   `keebweaver-ergokeeb-corne-right.uf2`.
4. Reconnect normally and verify USB typing, the wireless split, both displays,
   all four layers, pointer movement/click, and existing Bluetooth operation.
   On the Numbers layer, the left home-row A/S/D/F/G positions select Host 1–5.
   A normal firmware update preserves existing bonds; selecting an empty host
   starts advertising for a new pairing. No bond-clear action is bound.
   If this keyboard previously saved edits through ZMK Studio, those runtime
   bindings override the newly flashed stock keymap. Use Studio's **Restore
   Stock Settings** action after the normal flash to discard only the saved
   Studio keymap and reveal these compiled bindings; do not use the destructive
   settings-reset UF2 for this.
   The persisted pointer-speed setting is stored in ZMK settings and survives
   normal power cycles; a settings-reset image clears it along with other
   runtime settings.

The optional Overlay BLE helper is compiled only into the exact normal left
image. It is not present in the right or settings-reset image and does not
install itself. After an explicit left-half update, qualify layer notifications
and bounded pointer-speed changes separately; do not infer live-device success
from a compiler or simulator result.

## Clean installation or recovery reset

Only use this path when the release notes or a known recovery procedure require
it. It erases persistent settings and Bluetooth bonds.

1. Apply `keebweaver-ergokeeb-corne-settings-reset.uf2` to the left half.
2. Apply the same settings-reset image to the right half.
3. Apply the normal left image to the left half.
4. Apply the normal right image to the right half.
5. Qualify wired operation before removing or recreating host pairings.

## Stop conditions

Stop without copying another file if:

- the bootloader volume does not have the expected name;
- the connected side or target filename is uncertain;
- a transfer does not eject normally;
- the board, display, or controller differs from the supported checklist;
- checksum or provenance verification fails.

Do not copy multiple UF2 files to one mounted bootloader volume. Do not route
firmware through a synchronized folder. Record the observed failure before a
second reset or flash attempt.
