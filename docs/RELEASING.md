# Releasing KeebWeaver

Releases are built by GitHub Actions from a GitHub-verified signed
`vMAJOR.MINOR.PATCH` tag whose signed commit is on `main`. Local UF2 files and
local ad-hoc-signed app bundles are never release assets.

The published `v0.2.0` release contains firmware and provenance only. The
macOS app ZIP and Homebrew Cask described below belong to the next release;
their checked-in automation must not be reported as live delivery.

## Release gate

1. Update `package.json` and `package-lock.json` to the intended version.
2. Update the [release notes](RELEASE_NOTES.md), compatibility matrix, Overlay
   guide, and Pages release brief. Keep unreleased, published, and
   runtime-qualified status distinct.
3. Run `npm ci`, `npm run check`, and `npm run build:firmware` from a clean
   checkout.
4. Build and test the macOS Overlay:

   ```sh
   swift test --package-path overlay/macos/KeebWeaverOverlay
   bash overlay/macos/KeebWeaverOverlay/build-app.sh
   ```

5. Restore and test the cross-platform Overlay contract and shared core:

   ```sh
   (
     cd overlay/dotnet
     dotnet restore KeebWeaverOverlay.slnx --locked-mode
     dotnet build KeebWeaverOverlay.slnx --no-restore
     dotnet test tests/KeebWeaver.Overlay.Core.Tests/KeebWeaver.Overlay.Core.Tests.csproj \
       --no-build --no-restore
   )
   ```

   These checks do not qualify Windows or Linux BLE/runtime behavior.
6. Confirm the required default-branch checks are green and every commit on the
   release lineage is signed.
7. From a fresh clone, run the public-boundary audit, Gitleaks across all refs,
   and `git fsck --full --no-reflogs --unreachable`. Investigate every result;
   never weaken a scanner merely to make it pass.
8. Confirm no private artifacts, local paths, credentials, certificates, or
   private operating material appears in any reachable public ref or artifact.
9. Confirm the macOS release job has its Developer ID certificate and
   notarytool credentials. Signing and notarization fail closed when a required
   secret is absent; an ad-hoc signature is not a fallback.
10. Create and push a new signed tag, for example `git tag -s v0.3.0`. Do not
    reuse or move an already published tag.

The release environment supplies these secret values; only their names belong
in source:

- `MACOS_DEVELOPER_ID_APPLICATION_P12_BASE64`
- `MACOS_DEVELOPER_ID_APPLICATION_PASSWORD`
- `MACOS_DEVELOPER_ID_APPLICATION_IDENTITY`
- `MACOS_NOTARYTOOL_KEY_P8_BASE64`
- `MACOS_NOTARYTOOL_KEY_ID`
- `MACOS_NOTARYTOOL_ISSUER_ID`
- `RELEASE_PUBLISH_TOKEN`
- `HOMEBREW_TAP_TOKEN`

Never commit, print, package, or copy the certificate, private key, passwords,
or token into a release artifact.

Scope `RELEASE_PUBLISH_TOKEN` to Contents write on `Cyberlane/keebweaver` and
`HOMEBREW_TAP_TOKEN` to Contents write on `Cyberlane/homebrew-tap`. The manual
publish step uses the former instead of the built-in `GITHUB_TOKEN` because
GitHub suppresses follow-on workflow runs for events created by
`GITHUB_TOKEN`; a user or GitHub App token is required for the approved
`release.published` Homebrew trigger to run.

## Draft release construction

The tag workflow verifies tag and commit signatures plus `main` ancestry,
checks that the tag matches `package.json`, and requires a clean tagged source
tree. It rebuilds the exact side-specific firmware in the pinned container and
produces:

- `keebweaver-ergokeeb-corne-left.uf2`;
- `keebweaver-ergokeeb-corne-right.uf2`;
- `keebweaver-ergokeeb-corne-settings-reset.uf2`;
- `keebweaver-overlay-macos-universal.zip`, containing
  `KeebWeaver Overlay.app` for Apple Silicon and Intel;
- `keebweaver-overlay-macos-manifest.json`, binding the bundle identity,
  version, architectures, and archive digest;
- checksums, build metadata, dependency/file-level SPDX inventories, license
  notices, and GitHub artifact provenance attestations.

The macOS bundle must use the release version and bundle identifier, enable the
hardened runtime, carry a valid Developer ID Application signature, complete
Apple notarization, and have the notarization ticket stapled before it is
zipped. Every release output, including the app ZIP, must appear in
`SHA256SUMS` and the attestation set.

The workflow creates a draft release and does not publish it. Review the draft
assets, then run **Publish release** with the exact tag. That manual workflow
downloads the draft anew, checks every checksum, verifies the UF2 structure,
app signature/notarization, and attestations, and publishes only if the draft is
still intact.

## Homebrew publication

Publishing the GitHub release is the input to `.github/workflows/publish-homebrew.yml`;
creating a tag or draft must not update the tap. The `release.published`
workflow:

1. downloads the exact `keebweaver-overlay-macos-universal.zip` and release
   verification material;
2. verifies its checksum, GitHub attestation, bundle identity/version,
   Developer ID signature, and notarization;
3. writes or updates `Casks/keebweaver-overlay.rb` in
   `Cyberlane/homebrew-tap` with the immutable release URL and SHA-256;
4. runs strict online Cask audit plus clean install and uninstall checks on a
   macOS runner;
5. pushes through the scoped `HOMEBREW_TAP_TOKEN`; and
6. reads back the tap commit and requires GitHub to report it verified.

Only after that workflow and a separate clean live installation succeed may
documentation change the Homebrew state from pending to available:

```sh
brew install --cask Cyberlane/tap/keebweaver-overlay
```

The Cask installs the release ZIP; it does not rebuild the application. GitHub
Pages links to GitHub Releases and must not publish a duplicate binary.

## Independent audit

After publication, use a clean directory and machine state to:

- download the release assets and verify `SHA256SUMS`;
- verify the three UF2 files and every artifact attestation;
- run `gh release verify` and `gh release verify-asset`;
- expand the app ZIP and independently verify architectures, bundle ID,
  embedded version, Developer ID signature, notarization, and stapling;
- run the app without bypassing Gatekeeper and record manual mode plus the
  declared BLE qualification boundary;
- run strict online Homebrew audit, install, launch, upgrade/no-op, uninstall,
  and read back the installed bundle; and
- verify the deployed Pages digest, links, copy control, keyboard access, and
  narrow-screen no-overflow behavior.

Windows and Linux need their own target-OS build, packaging, physical BLE,
reconnect, tray recovery, transparency, click-through, and degraded-capability
evidence before they gain release assets or supported status. A matrix compile
or shared-core test is not that evidence.

## Failure and rollback boundaries

- **Before publication:** leave the release as a draft. Fix the source and use
  a new versioned signed tag; never substitute a local asset or weaken a check.
- **Release valid, tap update failed:** keep Homebrew marked pending. The signed
  release may remain available for direct download if its independent checks
  passed, but repository configuration is not proof of Cask delivery. Repair
  the tap workflow and repeat the clean installation check.
- **Published asset is faulty:** do not replace an asset behind the same tag or
  silently move the tag. Publish a corrected patch release with new checksums
  and attestation, then update the Cask through the normal published-release
  flow.
- **Cask is faulty:** stop advertising it and revert the tap to the last known
  good immutable release where practical. A normal
  `brew uninstall --cask keebweaver-overlay` preserves preferences; do not use
  `--zap` unless preference deletion is explicitly intended.
- **Overlay runtime issue:** closing or uninstalling the app does not roll back
  or reset firmware. Never use the settings-reset UF2 as an application
  rollback; flashing and ZMK settings/Bluetooth reset remain separate explicit
  hardware actions.

## Compatibility matrix

| Release state | Browser project envelope | Desktop Overlay | BLE helper | Firmware targets |
| --- | --- | --- | --- | --- |
| v0.2.0, published | format v1 / intent schema v2 | macOS source build only; no bundled app or Cask | frame v2; reads legacy v1; optional left-half service; physical OSS qualification not recorded | `ergokeeb_corne_left`, `ergokeeb_corne_right`, exact left settings reset |
| Next release, unreleased | unchanged unless release notes say otherwise | signed/notarized universal macOS ZIP and Homebrew after verification; Windows/Linux source previews pending qualification | shared contract with platform-specific adapters; no implied target-OS proof | exact custom targets only; never generic Corne |
