// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

test("firmware dependency SBOM records the pinned build closure", () => {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const output = execFileSync("node", ["scripts/create-firmware-sbom.mjs"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
    env: { ...process.env, GITHUB_SHA: commit, SOURCE_DATE_EPOCH: "1786723200" },
  });
  const sbom = JSON.parse(output);

  assert.equal(sbom.spdxVersion, "SPDX-2.3");
  assert.equal(sbom.packages[0].versionInfo, "0.3.0");
  assert.match(sbom.packages[0].downloadLocation, new RegExp(`${commit}$`));
  assert.deepEqual(sbom.packages.slice(1, 4).map((entry) => entry.licenseDeclared), ["MIT", "MIT", "Apache-2.0"]);
  assert.match(sbom.packages.at(-1).comment, /sha256:[a-f0-9]{64}/);
  assert.equal(sbom.relationships.length, sbom.packages.length - 1);
});

test("release license bundle includes every redistributed license boundary", () => {
  const root = new URL("../", import.meta.url);
  const output = execFileSync("node", ["scripts/create-license-bundle.mjs"], {
    cwd: root,
    encoding: "utf8",
  });

  for (const path of [
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "LICENSES/ZMK-MIT.txt",
    "LICENSES/NORD-MIT.txt",
    "LICENSES/ZEPHYR-APACHE-2.0.txt",
  ]) {
    assert.match(output, new RegExp(path.replaceAll(".", "\\.")));
    assert.ok(output.includes(readFileSync(new URL(path, root), "utf8").trimEnd()));
  }
});

test("release creation stays draft until the separate manual verification workflow", () => {
  const root = new URL("../", import.meta.url);
  const release = readFileSync(new URL(".github/workflows/release.yml", root), "utf8");
  const publish = readFileSync(new URL(".github/workflows/publish-release.yml", root), "utf8");

  assert.match(release, /gh release create .*--draft/);
  assert.doesNotMatch(release, /--draft=false/);
  assert.match(release, /npm run check\n\s+env:\n\s+GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(publish, /workflow_dispatch:/);
  assert.match(publish, /verify-release-assets\.mjs/);
  assert.match(publish, /verify-app\.sh[\s\S]*distribution/);
  assert.match(publish, /gh attestation verify/);
  assert.match(publish, /RELEASE_PUBLISH_TOKEN/);
  assert.match(publish, /gh release edit .*--draft=false/);
});

test("tag releases fail closed on universal Developer ID signing and notarization", () => {
  const release = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
  const buildScript = readFileSync(new URL("../overlay/macos/KeebWeaverOverlay/build-app.sh", import.meta.url), "utf8");

  for (const gate of [
    "MACOS_DEVELOPER_ID_APPLICATION_P12_BASE64",
    "MACOS_DEVELOPER_ID_APPLICATION_PASSWORD",
    "MACOS_DEVELOPER_ID_APPLICATION_IDENTITY",
    "MACOS_NOTARYTOOL_KEY_P8_BASE64",
    "MACOS_NOTARYTOOL_KEY_ID",
    "MACOS_NOTARYTOOL_ISSUER_ID",
    "notarytool submit",
    "stapler staple",
    "keebweaver-overlay-macos-universal.zip",
    "actions/download-artifact@",
  ]) {
    assert.ok(release.includes(gate), `missing release gate: ${gate}`);
  }
  assert.match(release, /KEEBWEAVER_BUILD_ARCHS: arm64 x86_64/);
  assert.match(release, /KEEBWEAVER_SIGNING_MODE: distribution/);
  assert.match(buildScript, /--options runtime/);
  assert.match(buildScript, /--timestamp/);
  assert.match(release, /verify-release-assets\.mjs/);
  assert.match(release, /subject-path: firmware\/artifacts\/\*/);
});

test("Homebrew publishing runs only after publication and verifies its signed tap commit", () => {
  const workflow = readFileSync(new URL("../.github/workflows/publish-homebrew.yml", import.meta.url), "utf8");

  assert.match(workflow, /release:\n\s+types: \[published\]/);
  assert.doesNotMatch(workflow, /workflow_dispatch:|push:/);
  assert.match(workflow, /HOMEBREW_TAP_TOKEN/);
  assert.match(workflow, /brew audit --cask --strict --online/);
  assert.match(workflow, /brew install --cask --require-sha/);
  assert.match(workflow, /createCommitOnBranch/);
  assert.match(workflow, /\.commit\.verification\.verified/);
  assert.match(workflow, /cmp .*readback-cask\.rb/);
});

test("all GitHub Actions dependencies are pinned to full commit SHAs", () => {
  const root = new URL("../.github/workflows/", import.meta.url);
  for (const name of ["ci.yml", "firmware.yml", "overlay.yml", "pages.yml", "publish-homebrew.yml", "publish-release.yml", "release.yml"]) {
    const workflow = readFileSync(new URL(name, root), "utf8");
    for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
      assert.match(match[1], /@[a-f0-9]{40}$/, `${name}: ${match[1]}`);
    }
  }
});
