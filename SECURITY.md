# Security policy

## Supported versions

Security fixes are applied to the latest tagged release and the default branch.
Pre-release builds and locally modified firmware are supported on a best-effort
basis only.

## Reporting a vulnerability

Use GitHub's private **Report a vulnerability** feature in the Security tab.
Do not open a public issue for an unpatched vulnerability, device-write bypass,
partition-overlap problem, or Web Serial origin/identity flaw.

Include the affected version, supported hardware target, reproduction steps,
impact, and whether a physical keyboard was written. Never attach credentials,
Bluetooth records, recovered firmware, or private device captures.

## Security boundaries

- The browser may upload display artwork only after a versioned handshake,
  firmware-reported side check, length validation, and CRC validation. A
  self-reported side is a compatibility check, not cryptographic device
  identity.
- The artwork partition is independent of ZMK settings and Bluetooth storage.
- Firmware builds produce files only; they never mount or write bootloader
  volumes.
- Project imports validate fail closed and preserve unknown records rather than
  silently producing lossy output. Imported behavior labels are inserted as
  text, not interpreted as HTML.
- The Overlay does not request Accessibility or Input Monitoring permission and
  does not inspect typed input. It matches the exact keyboard name, custom UUIDs,
  and required characteristic properties. Firmware requires an encrypted BLE
  link, but another peripheral can copy a name and UUID, so the channel is not
  cryptographic application identity.
- The Overlay can write only a `300...2400` volatile pointer-speed value; it
  cannot change keymaps, bonds, persistent ZMK settings, or firmware.

These boundaries reduce risk but do not make third-party firmware installation
risk-free. Keep a verified recovery image for the exact device before flashing.
Published firmware comes only from the signed-tag workflow with checksums,
SBOMs, license notices, and artifact attestations.
