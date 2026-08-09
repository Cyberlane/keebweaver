# Releasing KeebWeaver

Releases are built by GitHub Actions from a signed `vMAJOR.MINOR.PATCH` tag.
Do not upload locally built UF2 files to a release.

## Release gate

1. Update `package.json` and `package-lock.json` to the intended version.
2. Update release notes and any compatibility or reset requirements.
3. Run `npm ci`, `npm run check`, and `npm run build:firmware` from a clean
   checkout.
4. Confirm the default-branch CI and firmware-build checks are green.
5. Confirm no private artifacts, local paths, or private operating material
   appears in any reachable Git ref.
6. Create and push a signed tag, for example `git tag -s v0.1.0`.

The release workflow checks that the tag matches `package.json`, rebuilds all
three UF2 files in the pinned container, verifies file type and target family,
creates checksums and a build manifest, generates GitHub artifact attestations,
creates an immutable-ready draft, attaches every asset, and only then publishes
the release with generated notes.

## Independent audit

After publication, download the release assets into a clean directory, verify
`SHA256SUMS`, verify at least the left and right artifacts with
`gh attestation verify`, run `gh release verify` and `gh release verify-asset`,
and inspect the UF2 family/address before announcing the release.
