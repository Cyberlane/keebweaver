# KeebWeaver overlay client contract

This directory is the language-neutral boundary shared by KeebWeaver overlay
clients. Versioned contracts describe the checked-in layout mirror, BLE UUIDs,
wire frames, and bounded pointer-speed channel. They are authoritative for
overlay clients only: firmware source and persistent keyboard state remain
separate sources of truth.

Clients must fail closed when a contract version, record, field, frame length,
layer index, mask, UUID, characteristic property, byte order, or bounded value
is unknown. A client may fall back to manual layer selection after rejecting a
BLE contract; it must not reinterpret or repair malformed records.

The current files are:

- `v1/keebweaver-overlay.json` — client contract version 1;
- `v1/layer-state-vectors.json` — valid and invalid golden wire vectors;
- `schema/keebweaver-overlay-contract.schema.json` — JSON Schema for the
  contract document.

Adding fields or changing semantics requires a new contract version. Frame
versions are independent: client contract v1 intentionally accepts layer-state
frame versions 1 and 2 exactly as documented.
