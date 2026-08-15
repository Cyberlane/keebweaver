# Releasing KeebWeaver

Releases are built by GitHub Actions from a GitHub-verified signed
`vMAJOR.MINOR.PATCH` tag whose signed commit is on `main`. Do not upload locally
built UF2 files to a release.

## Release gate

1. Update `package.json` and `package-lock.json` to the intended version.
2. Update release notes, the compatibility matrix, and any reset requirements.
3. Run `npm ci`, `npm run check`, and `npm run build:firmware` from a clean
   checkout.
4. Build and test the Overlay on macOS with
   `swift test --package-path macos/KeebWeaverOverlay` and
   `bash macos/KeebWeaverOverlay/build-app.sh`.
5. Confirm the required default-branch checks are green and every commit on the
   release lineage is signed.
6. From a fresh clone, run the public-boundary audit, Gitleaks across all refs,
   and `git fsck --full --no-reflogs --unreachable`. Investigate every result;
   never weaken a scanner merely to make it pass.
7. Confirm no private artifacts, local paths, or private operating material
   appears in any reachable public ref.
8. Create and push a signed tag, for example `git tag -s v0.2.0`.

The tag workflow checks tag and commit signatures plus `main` ancestry, checks
that the tag matches `package.json`, rebuilds all three UF2 files in the pinned
container, verifies file type and target family, and requires a clean tagged
source tree. It emits checksums, a build manifest, web and firmware dependency
SBOMs, Zephyr-generated file-level SPDX documents for each target, license
notices, and GitHub artifact attestations. It creates a draft release and does
not publish it.

Review the draft assets, then run **Publish release** with the exact tag. That
manual workflow downloads the draft anew, checks every checksum, verifies all
three UF2 files and attestations, and publishes only if the draft is still
intact. The macOS Overlay remains source-only until a separate Developer ID,
notarization, and update-channel policy is approved; do not attach the local
ad-hoc-signed app bundle as a production binary.

## Independent audit

After publication, download the release assets into a clean directory, verify
`SHA256SUMS`, verify all three UF2 attestations, run `gh release verify` and
`gh release verify-asset`, inspect the UF2 family/address, and verify the Pages
deployment before announcing the release.

## Compatibility matrix

| Release | Browser project envelope | Native Overlay | BLE helper | Firmware targets |
| --- | --- | --- | --- | --- |
| v0.2.0 | format v1 / intent schema v2 | source-only, macOS 13+ | frame v2; reads legacy v1; optional left-half service | `ergokeeb_corne_left`, `ergokeeb_corne_right`, exact left settings reset |
