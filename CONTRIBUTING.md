# Contributing to KeebWeaver

Thank you for helping make split-keyboard configuration safer and easier to
understand.

## Before opening a change

1. Search existing issues and confirm the request fits a documented hardware
   target or a reusable catalog capability.
2. Keep hardware facts, runtime captures, and personal profiles separate.
3. Do not submit recovered firmware, private device captures, raw personal
   photos, credentials, or absolute local paths.
4. For a new board, provide public hardware provenance, side-specific target
   names, a rollback path, and tests. A similar physical layout is not enough.

## Development workflow

```sh
npm ci
npm run check
```

Commits must be signed with a GitHub-verifiable GPG, SSH, or S/MIME signature.
Use a GitHub-provided noreply address if you do not want a personal email in the
public commit graph.

Firmware changes must additionally pass:

```sh
npm run build:firmware
```

Overlay changes must additionally pass:

```sh
swift test --package-path macos/KeebWeaverOverlay
bash macos/KeebWeaverOverlay/build-app.sh
```

Do not flash hardware merely to validate a pull request. Hardware installation
and live qualification require an explicit device owner decision.

## Pull requests

- Explain the user-visible result and the exact supported device scope.
- Include tests for schema, serialization, protocol, or geometry changes.
- State which checks were run and identify any unavailable live-device checks.
- For BLE changes, describe the protocol version, characteristic permissions,
  encryption/identity boundary, and manual fallback.
- Keep generated UF2 files and local build work out of commits.
- Preserve third-party copyright and SPDX notices.

Contributions are accepted under the repository's MIT License.
