# KeebWeaver

KeebWeaver is an open split-keyboard configurator, nice!view artwork studio,
and reproducible ZMK firmware toolkit. It keeps hardware definitions, captured
runtime state, and user profiles separate so an opinionated layout can be
shared without pretending it is universal.

The first verified target is the ErgoKeeb Eyelash Corne identified by the
custom ZMK boards `ergokeeb_corne_left` and `ergokeeb_corne_right`. Generic
Corne firmware is **not** compatible with this target.

## What it does

- Renders an accessible 2D map and interactive Three.js model of the supported
  48-position source layout and 42 physical keys.
- Ships a named **macOS Beginner** profile with Base, Navigation, Numbers, and
  Symbols layers; it is a preset, not a hardware requirement.
- Imports and exports deterministic, fail-closed `keebweaver-project` files.
- Edits independent 68×160 portrait artwork for both nice!view displays.
- Uploads validated artwork through a dedicated versioned Web Serial protocol
  after compatible firmware is installed.
- Builds side-specific ZMK UF2 images in a pinned container without mounting or
  writing to a keyboard.
- Makes no analytics or application-initiated network requests. Production
  browser assets are bundled locally; serving or downloading the app still
  uses the hosting provider's network boundary.

KeebWeaver does not automatically flash firmware, reset settings, change
Bluetooth bonds, or apply ZMK Studio state.

## Quick start

Requires Node.js 22.12 or newer.

```sh
npm ci
npm test
npm run serve
```

Open <http://localhost:4173>. Chrome or another Web Serial implementation is
required only for direct artwork upload; design, validation, and project-file
work function without a connected keyboard.

For a native always-on-top learning aid on macOS, see the
[macOS layout overlay](docs/OVERLAY.md). It is a separate local companion and
does not flash, modify, or inspect typed input. With the optional BLE helper
firmware, it reads layer state and can write only a bounded, volatile pointer
speed value over an encrypted BLE link. The first OSS distribution is
source-built and ad-hoc signed, not Developer ID signed or notarized.

Create an optimized static build with:

```sh
npm run build
npm run preview
```

## Supported hardware

| Target | Status | Controller | Displays | Notes |
| --- | --- | --- | --- | --- |
| ErgoKeeb Eyelash Corne, `ergokeeb_corne_left/right` | Verified reference target | nRF52840 | Two portrait nice!view panels | Custom 48-position source matrix and five-way pointer/click cluster |

Support means the checked-in model, keymap, build inputs, partition layout, and
tests describe this exact target. It does not imply compatibility with standard
Corne, Sofle, or similarly shaped boards. See
[Supported hardware](docs/SUPPORTED_HARDWARE.md) before building or installing
firmware.

## Project and profile model

The public catalog lives in `src/catalog.js`:

- A **device entry** owns geometry, displays, roles, capabilities, and a
  separately captured reference baseline.
- A **profile entry** owns user-facing layout preferences and its target
  platform.
- The validator derives its position and layer constraints from the selected
  catalog entries instead of assuming that every device is this Corne or every
  profile targets macOS.

The browser currently treats project bindings as reviewable behavior labels;
it does not generate a runnable ZMK keymap from those labels. The checked-in
firmware keymap is the auditable reference implementation for the bundled
profile. See [Architecture](docs/ARCHITECTURE.md).

## Firmware builds

Requires Docker or a compatible container engine:

```sh
npm run build:firmware
```

The build pins the container, Corne board source, ZMK, and Zephyr closure and
writes ignored local artifacts to `firmware/artifacts/`:

- `keebweaver-ergokeeb-corne-left.uf2`
- `keebweaver-ergokeeb-corne-right.uf2`
- `keebweaver-ergokeeb-corne-settings-reset.uf2`
- `build-manifest.txt`
- `SHA256SUMS`
- `spdx/` file-level source/build inventories for each exact target

The left and right images are not interchangeable. The settings-reset image is
destructive: it clears persistent ZMK settings and Bluetooth bonds. Read the
[installation and recovery guide](docs/FLASHING.md) before copying any UF2.

Release binaries are built only by the tag-triggered GitHub Actions workflow.
The workflow leaves a draft for a separate manual verification-and-publish
workflow. Each published release includes checksums, the pinned build manifest,
dependency and file-level SPDX inventories, license notices, and GitHub
artifact provenance attestations. Verify a downloaded release with:

```sh
sha256sum -c SHA256SUMS
gh attestation verify keebweaver-ergokeeb-corne-left.uf2 \
  --repo Cyberlane/keebweaver
gh release verify v0.2.0 --repo Cyberlane/keebweaver
```

## Display artwork

The normal firmware images reserve a dedicated 64 KiB artwork partition,
separate from ZMK settings and Bluetooth storage. Each half stores one 1,360
byte bitmap using alternating records, CRC32 validation, and last-written
activation metadata. An interrupted or invalid transfer leaves the previous
record usable.

The gallery includes original KeebWeaver presets and the MIT-licensed historic
ZMK nice!view Mountain and Balloon art. See [Third-party notices](THIRD_PARTY_NOTICES.md)
and the [artwork protocol](docs/ARTWORK_PROTOCOL.md).

## Development

```sh
npm ci
npm run check
npm run build:firmware
```

`npm run check` runs unit tests, the production build, release-metadata checks,
the signed-history policy, and the public-boundary audit. The audit rejects
tracked device images, firmware captures, local home paths, private artifact
directories, and private content retained anywhere in reachable Git history.
`"private": true` in `package.json` prevents accidental npm publication; it
does not change the repository's MIT source license.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and
[SUPPORT.md](SUPPORT.md). By participating, contributors agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License and trademarks

Original KeebWeaver work is MIT licensed. Third-party components retain their
own notices; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

KeebWeaver is an independent community project. It is not affiliated with or
endorsed by ErgoKeeb, ZMK, nice!view, or Three.js. Product and project names are
the property of their respective owners.
