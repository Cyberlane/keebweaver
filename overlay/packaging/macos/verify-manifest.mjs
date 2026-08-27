#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

const archivePath = process.argv[2] && resolve(process.argv[2]);
const manifestPath = process.argv[3] && resolve(process.argv[3]);
if (!archivePath || !manifestPath || process.argv.length !== 4) {
  throw new Error("Usage: verify-manifest.mjs <archive-path> <manifest-path>");
}

const packageManifest = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const archive = readFileSync(archivePath);
const expectedSha256 = createHash("sha256").update(archive).digest("hex");

if (manifest.schemaVersion !== 1 || manifest.target !== "overlay.macos") throw new Error("Invalid macOS Overlay manifest identity.");
if (manifest.asset !== basename(archivePath)) throw new Error("macOS Overlay manifest names the wrong archive.");
if (manifest.version !== packageManifest.version) throw new Error("macOS Overlay manifest version mismatch.");
if (manifest.bundleIdentifier !== "com.keebweaver.overlay") throw new Error("macOS Overlay bundle identifier mismatch.");
if (manifest.minimumSystemVersion !== "13.0") throw new Error("macOS Overlay minimum system version mismatch.");
if (JSON.stringify(manifest.architectures) !== JSON.stringify(["arm64", "x86_64"])) {
  throw new Error("macOS Overlay architecture declaration mismatch.");
}
if (manifest.archiveSha256 !== expectedSha256 || manifest.archiveSize !== statSync(archivePath).size) {
  throw new Error("macOS Overlay archive digest or size mismatch.");
}
if (manifest.signing?.type !== "Developer ID Application" || !manifest.signing.hardenedRuntime || !manifest.signing.secureTimestamp) {
  throw new Error("macOS Overlay signing declaration is incomplete.");
}
if (!manifest.notarization?.accepted || !manifest.notarization?.stapled) {
  throw new Error("macOS Overlay notarization declaration is incomplete.");
}
if (!/^[a-f0-9]{40}$/.test(manifest.source?.commit || "")) throw new Error("macOS Overlay source commit is invalid.");
if (manifest.source.tag !== `v${packageManifest.version}`) throw new Error("macOS Overlay source tag mismatch.");
if (process.env.GITHUB_SHA && manifest.source.commit !== process.env.GITHUB_SHA) {
  throw new Error("macOS Overlay source commit differs from the checked-out tag.");
}

process.stdout.write(`Verified macOS Overlay manifest for ${manifest.asset}.\n`);
