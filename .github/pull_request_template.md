## Outcome

Describe the user-visible result and exact hardware scope.

## Verification

- [ ] `npm run check`
- [ ] `npm run build:firmware` when firmware, board, or partition inputs changed
- [ ] Overlay Swift tests and source app build when macOS or BLE behavior changed
- [ ] Browser or visual check when presentation changed
- [ ] No generated firmware, device captures, local paths, or private data added
- [ ] Third-party SPDX and copyright notices preserved
- [ ] Every commit is signed and GitHub reports it as verified

## Hardware boundary

State whether a physical device write was performed. A software-only change
should normally say `not performed`.

## Security and release boundary

For project import, Web Serial, BLE, workflow, dependency, or release changes,
describe the trust boundary, fail-closed behavior, artifact provenance, and any
owner-run hardware or external review that is still pending.
