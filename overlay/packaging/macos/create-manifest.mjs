#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const appPath = process.argv[2] && resolve(process.argv[2]);
const archivePath = process.argv[3] && resolve(process.argv[3]);
const outputPath = process.argv[4] && resolve(process.argv[4]);
if (!appPath || !archivePath || !outputPath || process.argv.length !== 5) {
  throw new Error("Usage: create-manifest.mjs <app-path> <archive-path> <output-path>");
}

const packageManifest = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
const plist = `${appPath}/Contents/Info.plist`;
const executable = `${appPath}/Contents/MacOS/KeebWeaverOverlay`;
const version = command("plutil", ["-extract", "CFBundleShortVersionString", "raw", plist]);
if (version !== packageManifest.version) throw new Error("App version does not match package.json.");

const signature = spawnSync("codesign", ["--display", "--verbose=4", appPath], { encoding: "utf8" });
if (signature.status !== 0) throw new Error(signature.stderr || "Unable to inspect app signature.");
const signatureDetails = `${signature.stdout}${signature.stderr}`;
if (!/^Authority=Developer ID Application:/m.test(signatureDetails)) throw new Error("App lacks a Developer ID Application signature.");
if (!/^Timestamp=.+$/m.test(signatureDetails)) throw new Error("App signature lacks a secure timestamp.");
if (!/^CodeDirectory .*flags=.*\(runtime\)/m.test(signatureDetails)) throw new Error("App signature lacks hardened runtime.");
command("xcrun", ["stapler", "validate", appPath]);
command("spctl", ["--assess", "--type", "execute", appPath]);

const architectures = command("lipo", ["-archs", executable]).split(/\s+/).sort();
if (JSON.stringify(architectures) !== JSON.stringify(["arm64", "x86_64"])) {
  throw new Error(`Unexpected app architectures: ${architectures.join(", ")}`);
}

const archive = readFileSync(archivePath);
const manifest = {
  schemaVersion: 1,
  target: "overlay.macos",
  asset: basename(archivePath),
  version,
  bundleIdentifier: command("plutil", ["-extract", "CFBundleIdentifier", "raw", plist]),
  minimumSystemVersion: command("plutil", ["-extract", "LSMinimumSystemVersion", "raw", plist]),
  architectures,
  archiveSha256: createHash("sha256").update(archive).digest("hex"),
  archiveSize: statSync(archivePath).size,
  signing: {
    type: "Developer ID Application",
    hardenedRuntime: true,
    secureTimestamp: true
  },
  notarization: {
    accepted: true,
    stapled: true
  },
  source: {
    repository: process.env.GITHUB_REPOSITORY || "Cyberlane/keebweaver",
    commit: process.env.GITHUB_SHA || command("git", ["rev-parse", "HEAD"]),
    tag: process.env.GITHUB_REF_NAME || `v${version}`
  }
};
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

function command(program, args) {
  return execFileSync(program, args, { encoding: "utf8" }).trim();
}
