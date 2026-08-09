# Architecture

KeebWeaver separates four sources of truth that must not silently overwrite one
another:

1. **Physical device** — controller, matrix, displays, split roles, and visible
   geometry.
2. **Compiled firmware** — Devicetree, Kconfig, keymap, and module code in a
   specific build closure.
3. **Persistent runtime state** — ZMK settings, Studio state, and Bluetooth
   bonds stored on the keyboard.
4. **KeebWeaver project** — a deterministic, local profile-intent document.

## Browser application

`src/catalog.js` exposes device and profile entries. The initial device entry
combines the immutable ErgoKeeb Corne definition with a read-only captured
reference. The macOS Beginner profile is a separate intent record.

`src/validation.js` derives required positions and source-layer relationships
from the selected records. It does not assume one global device or platform.
Unknown positions, missing bindings, incompatible source layers, invalid
project modes, and lossy opaque records fail closed.

The accessible 2D map and Three.js scene are projections of the same device and
profile records. Three.js is presentation-only and does not own configuration
state.

## Project documents

`keebweaver-project` version 1 is deterministic JSON with no timestamps. It
contains a non-runnable profile intent, not compiled keycodes. Importing a
project cannot access Web Serial or change firmware.

## Firmware

The firmware build uses the custom side-specific ErgoKeeb boards, the checked-in
keymap/configuration, and the KeebWeaver display module. `build.sh` records all
source revisions, the pinned container digest, and artifact checksums.

Build and install are separate operations. No script in this repository mounts
or writes a bootloader volume.

## Adding a device

A device contribution needs:

- a stable device ID and exact side-specific build targets;
- public source and license provenance;
- position geometry and capabilities;
- a runtime/reference fixture that is clearly identified as such;
- at least one named profile;
- deterministic validation, scene, and build tests;
- an installation stop/rollback matrix.

Do not infer electrical compatibility from a case photo or a familiar keyboard
name.
