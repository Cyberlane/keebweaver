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
  physical-side identity check, length validation, and CRC validation.
- The artwork partition is independent of ZMK settings and Bluetooth storage.
- Firmware builds produce files only; they never mount or write bootloader
  volumes.
- Project imports validate fail closed and preserve unknown records rather than
  silently producing lossy output.

These boundaries reduce risk but do not make third-party firmware installation
risk-free. Keep a verified recovery image for the exact device before flashing.
