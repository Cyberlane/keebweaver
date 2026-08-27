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

The outer `keebweaver-project` envelope is format version 1. Its bundled
project-intent record is schema version 2; those are independent version
domains. Serialization is deterministic JSON with no timestamps. The document
contains non-runnable behavior labels, not compiled keycodes. Imported labels
are rendered as text, and importing a project cannot access Web Serial or
change firmware.

## Desktop Overlay

Overlay code is grouped by contract and platform so native integrations can
evolve without turning one operating system's behavior into a universal rule:

```text
overlay/
├── contract/v1/                # language-neutral schema and test vectors
├── macos/KeebWeaverOverlay/    # SwiftUI/AppKit and CoreBluetooth
└── dotnet/
    ├── src/KeebWeaver.Overlay.Core/
    ├── src/KeebWeaver.Overlay.UI/
    ├── src/KeebWeaver.Overlay.Windows/
    ├── src/KeebWeaver.Overlay.Linux/
    └── tests/KeebWeaver.Overlay.Core.Tests/
```

The versioned contract owns layer identifiers, BLE UUIDs, frame shapes,
pointer-speed bounds, layout records, and malformed/golden test vectors. Swift
and C# consumers must both reject unknown or lossy records. The contract is an
Overlay-facing mirror that is cross-checked against firmware; it does not
generate firmware or silently change the checked-in keymap.

The macOS projection remains native SwiftUI/AppKit and uses CoreBluetooth. The
Windows and Linux clients share C#/Avalonia UI, parsing, and state. Their BLE
boundaries remain platform-specific: WinRT GATT on Windows and BlueZ over the
system D-Bus on Linux. Linux initially targets Avalonia's X11/XWayland backend;
native Wayland support is experimental and not an initial support promise.
Transparency, click-through, and tray behavior are capabilities that can be
unavailable and must degrade visibly rather than being assumed.

All clients keep manual tabs usable when the optional helper is absent. With
the helper, a platform BLE adapter can read versioned layer-state frames and
write one bounded pointer-speed value. Firmware persists that value through ZMK
settings with a short debounce, so it survives a reboot without a firmware
reflash. Keyboard name, UUID, characteristic properties, and BLE link
encryption narrow the connection boundary but do not provide cryptographic
application identity. The apps do not consume typed input or request global
keyboard hooks.

Source/build verification is distinct from runtime qualification. macOS is the
current usable client; Windows and Linux release assets remain gated on
physical-keyboard and target-desktop evidence.

## Overlay distribution boundary

Source builds are development artifacts. A distributable macOS ZIP must come
from the signed tag workflow, pass Developer ID signing and Apple notarization,
and be included in checksums and provenance attestations. The Homebrew Cask
installs that exact immutable ZIP; it neither rebuilds the app nor modifies
firmware, ZMK settings, Bluetooth bonds, or saved KeebWeaver projects. GitHub
Pages links to GitHub Releases and never hosts a second binary copy.

## Firmware

The firmware build uses the custom side-specific ErgoKeeb boards, the checked-in
keymap/configuration, and the KeebWeaver display module. `build.sh` records all
source revisions, the pinned container and SDK versions, the project tree/dirty
state, artifact checksums, and Zephyr-generated file-level SPDX documents for
each target.

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
