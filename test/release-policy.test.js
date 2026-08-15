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
  assert.equal(sbom.packages[0].versionInfo, "0.2.0");
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
  assert.match(publish, /sha256sum -c SHA256SUMS/);
  assert.match(publish, /gh attestation verify/);
  assert.match(publish, /gh release edit .*--draft=false/);
});

test("all GitHub Actions dependencies are pinned to full commit SHAs", () => {
  const root = new URL("../.github/workflows/", import.meta.url);
  for (const name of ["ci.yml", "firmware.yml", "overlay.yml", "pages.yml", "publish-release.yml", "release.yml"]) {
    const workflow = readFileSync(new URL(name, root), "utf8");
    for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
      assert.match(match[1], /@[a-f0-9]{40}$/, `${name}: ${match[1]}`);
    }
  }
});
