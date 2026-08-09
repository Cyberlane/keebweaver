# KeebWeaver artwork protocol

The artwork protocol is a dedicated USB CDC transport for one 160×68 one-bit
bitmap per keyboard half. It does not share ZMK Studio framing and cannot change
the keymap, Bluetooth bonds, or ZMK settings.

## Version 1 framing

All multibyte integers are little-endian.

| Field | Size | Description |
| --- | ---: | --- |
| Magic | 4 bytes | ASCII `KWAR` |
| Version | 1 byte | `1` |
| Command | 1 byte | Hello, Begin, Chunk, Commit, or Abort |
| Payload length | 2 bytes | Maximum 130 bytes |
| Payload CRC32 | 4 bytes | IEEE CRC32 of the payload |
| Payload | variable | Command data |

The Hello response identifies protocol version, physical side, width, height,
and exact artwork byte length. A browser must reject the endpoint if any value
is incompatible with the selected device/side.

An upload sends Begin with the required total length, contiguous Chunk frames,
and Commit with the whole-image CRC32. The firmware writes an inactive slot,
validates it, and writes activation metadata last. Abort discards the in-flight
upload.

## Storage

The ErgoKeeb reference overlay reserves a 64 KiB partition at `0x000dc000`,
separate from the code and ZMK settings partitions. Two 4 KiB records are used
for atomic replacement; the remaining reserved capacity permits future
versioning without moving settings storage.

Protocol changes that alter framing, dimensions, storage records, or flash
layout require a version increase and backward-compatibility decision.
