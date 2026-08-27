// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const declaration = JSON.parse(readFileSync(new URL("overlay/packaging/release-targets.json", root), "utf8"));

test("release targets require current artifacts and reserve future desktop targets", () => {
  const required = declaration.targets.filter((target) => target.status === "required");
  const planned = declaration.targets.filter((target) => target.status === "planned");

  assert.deepEqual(required.map((target) => target.id), [
    "firmware.ergokeeb-corne-left",
    "firmware.ergokeeb-corne-right",
    "firmware.ergokeeb-corne-settings-reset",
    "overlay.macos",
  ]);
  assert.deepEqual(required.at(-1).architectures, ["arm64", "x86_64"]);
  assert.deepEqual(planned.map((target) => target.platform), ["windows", "linux"]);
  assert.ok(planned.every((target) => target.assetTemplate.includes("{architecture}")));
});

test("release metadata covers the exact declared asset set and detects tampering", () => {
  const directory = mkdtempSync(join(tmpdir(), "keebweaver-release-test-"));
  try {
    const requiredInputs = [
      ...declaration.targets.filter((target) => target.status === "required").map((target) => target.asset),
      ...declaration.metadataAssets.filter((asset) => !asset.generated).map((asset) => asset.asset),
    ];
    for (const name of requiredInputs) writeFileSync(join(directory, name), `fixture:${name}\n`);

    const environment = {
      ...process.env,
      GITHUB_REF_NAME: "v0.2.0",
      GITHUB_SHA: "a".repeat(40),
      RELEASE_TAG: "v0.2.0",
      SOURCE_DATE_EPOCH: "1786723200",
    };
    execFileSync("node", ["overlay/packaging/create-release-metadata.mjs", directory], { cwd: root, env: environment });
    execFileSync("node", ["overlay/packaging/verify-release-assets.mjs", directory], { cwd: root, env: environment });

    const checksums = readFileSync(join(directory, "SHA256SUMS"), "utf8").trimEnd().split("\n");
    assert.equal(checksums.length, requiredInputs.length + 2);
    assert.ok(checksums.some((line) => line.endsWith("  keebweaver-overlay-macos-universal.zip")));
    assert.ok(checksums.some((line) => line.endsWith("  keebweaver-release-manifest.json")));

    writeFileSync(join(directory, "keebweaver-overlay-macos-universal.zip"), "tampered\n");
    assert.throws(
      () => execFileSync("node", ["overlay/packaging/verify-release-assets.mjs", directory], { cwd: root, env: environment, stdio: "pipe" }),
      /Command failed/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Homebrew Cask rendering binds a stable version and exact archive checksum", () => {
  const directory = mkdtempSync(join(tmpdir(), "keebweaver-cask-test-"));
  try {
    const output = join(directory, "keebweaver-overlay.rb");
    const checksum = "b".repeat(64);
    execFileSync("node", ["overlay/packaging/homebrew/render-cask.mjs", "0.2.0", checksum, output], { cwd: root });
    const cask = readFileSync(output, "utf8");

    assert.match(cask, /cask "keebweaver-overlay"/);
    assert.match(cask, /version "0\.2\.0"/);
    assert.ok(cask.includes(`sha256 "${checksum}"`));
    assert.match(cask, /keebweaver-overlay-macos-universal\.zip/);
    assert.match(cask, /depends_on macos: ">= :ventura"/);
    assert.match(cask, /app "KeebWeaver Overlay\.app"/);
    assert.doesNotMatch(cask, /\{\{/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("macOS release metadata binds the exact universal archive and signed source", () => {
  const directory = mkdtempSync(join(tmpdir(), "keebweaver-macos-manifest-test-"));
  try {
    const archivePath = join(directory, "keebweaver-overlay-macos-universal.zip");
    const manifestPath = join(directory, "keebweaver-overlay-macos-manifest.json");
    writeFileSync(archivePath, "archive fixture\n");
    const archive = readFileSync(archivePath);
    writeFileSync(manifestPath, `${JSON.stringify({
      schemaVersion: 1,
      target: "overlay.macos",
      asset: "keebweaver-overlay-macos-universal.zip",
      version: "0.2.0",
      bundleIdentifier: "com.keebweaver.overlay",
      minimumSystemVersion: "13.0",
      architectures: ["arm64", "x86_64"],
      archiveSha256: createHash("sha256").update(archive).digest("hex"),
      archiveSize: statSync(archivePath).size,
      signing: { type: "Developer ID Application", hardenedRuntime: true, secureTimestamp: true },
      notarization: { accepted: true, stapled: true },
      source: { repository: "Cyberlane/keebweaver", commit: "a".repeat(40), tag: "v0.2.0" },
    }, null, 2)}\n`);

    const environment = { ...process.env, GITHUB_SHA: "a".repeat(40) };
    execFileSync("node", ["overlay/packaging/macos/verify-manifest.mjs", archivePath, manifestPath], { cwd: root, env: environment });
    writeFileSync(archivePath, "changed archive fixture\n");
    assert.throws(
      () => execFileSync("node", ["overlay/packaging/macos/verify-manifest.mjs", archivePath, manifestPath], { cwd: root, env: environment, stdio: "pipe" }),
      /Command failed/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
