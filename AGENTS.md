# KeebWeaver contributor guidance

KeebWeaver is an open configurator, display-art studio, and reproducible ZMK
firmware toolkit. The first supported device is the ErgoKeeb Eyelash Corne
variant identified by `ergokeeb_corne_left` and `ergokeeb_corne_right`.

## Safety boundaries

- Never substitute generic Corne firmware for the documented custom targets.
- Build commands may create local artifacts but must never mount, reset, or
  write to a keyboard.
- Keep flashing, settings reset, Bluetooth mutation, and artwork upload as
  explicit user actions with side and target confirmation.
- Treat physical hardware, compiled firmware, persistent ZMK state, and saved
  KeebWeaver projects as separate sources of truth.
- Do not commit recovered firmware, device captures, raw hardware photos,
  credentials, personal paths, or local operating notes.

## Development

- Use `npm ci`, `npm test`, and `npm run check` before proposing a change.
- Keep device-specific facts in the device catalog and personal preferences in
  named profiles; do not hard-code a profile as a universal hardware rule.
- Preserve deterministic project serialization and fail closed on unknown or
  lossy records.
- Keep changes focused and update public documentation when behavior changes.
- Firmware release assets must come from the pinned GitHub Actions build and
  include checksums, a build manifest, and provenance attestation.
