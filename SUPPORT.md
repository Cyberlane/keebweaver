# Support

## Supported

- Reproducing a tagged build on the documented target.
- KeebWeaver project import/export and validation.
- Display-art editing and the KeebWeaver artwork protocol.
- Installing, building, and using the macOS Overlay in manual mode.
- Bugs in the bundled macOS Beginner profile.
- Adding a new device through the catalog with adequate public evidence and
  tests.

## Not supported

- Generic Corne or Sofle firmware substituted for the custom ErgoKeeb target.
- Unknown board revisions or controller/display combinations.
- Firmware or project files produced by unrelated configurators.
- Recovery images, vendor support, soldering, battery repair, or bootloader
  replacement.
- Automatic flashing or remote device operation.
- Treating the published `v0.2.0` firmware release as if it contained a
  Developer ID-signed, notarized, or Homebrew-distributed Overlay.
- Windows or Linux runtime-support claims before physical BLE and target
  desktop qualification are recorded; source-preview bug reports remain
  welcome.

The Overlay BLE helper is experimental until owner-run hardware qualification
is recorded. Reports about its exact left-half service are welcome, but a
successful source build is not evidence of physical BLE behavior.

Use GitHub Discussions for usage questions and GitHub Issues for reproducible
bugs. Include KeebWeaver version, browser/macOS version, exact board target, and the
non-sensitive part of `build-manifest.txt`. Do not upload device captures,
pairing records, or recovery firmware.
