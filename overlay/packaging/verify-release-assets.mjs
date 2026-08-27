#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  checksummedAssetNames,
  checksumsName,
  describeAsset,
  ensureDirectoryUrl,
  expectedAssetNames,
  manifestInputNames,
  readJson,
  releaseManifestName,
  targetDeclarationName,
  validateTargetDeclaration,
} from "./release-assets.mjs";

const scriptDirectory = new URL("./", import.meta.url);
const sourceDeclaration = readJson(new URL("release-targets.json", scriptDirectory));
const packageManifest = readJson(new URL("../../package.json", scriptDirectory));
const releaseDirectoryArgument = process.argv[2];
const listOnly = process.argv[3] === "--list";
if (!releaseDirectoryArgument || process.argv.length > 4 || (process.argv[3] && !listOnly)) {
  throw new Error("Usage: verify-release-assets.mjs <release-directory> [--list]");
}

validateTargetDeclaration(sourceDeclaration);
const releaseDirectoryPath = resolve(releaseDirectoryArgument);
const releaseDirectory = ensureDirectoryUrl(releaseDirectoryPath);
const expectedNames = expectedAssetNames(sourceDeclaration);
for (const name of expectedNames) {
  if (!existsSync(new URL(encodeURIComponent(name), releaseDirectory))) {
    throw new Error(`Missing required release asset: ${name}`);
  }
}

const actualNames = readdirSync(releaseDirectoryPath, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();
assertSameNames(actualNames, [...expectedNames].sort(), "release directory");

const downloadedDeclaration = readJson(new URL(targetDeclarationName, releaseDirectory));
if (JSON.stringify(downloadedDeclaration) !== JSON.stringify(sourceDeclaration)) {
  throw new Error("Downloaded release target declaration differs from the signed source declaration.");
}

const checksumEntries = parseChecksums(readFileSync(new URL(checksumsName, releaseDirectory), "utf8"));
assertSameNames([...checksumEntries.keys()].sort(), [...checksummedAssetNames(sourceDeclaration)].sort(), checksumsName);
for (const [name, expectedDigest] of checksumEntries) {
  const actualDigest = describeAsset(releaseDirectory, name).sha256;
  if (actualDigest !== expectedDigest) throw new Error(`Checksum mismatch for ${name}.`);
}

const manifest = readJson(new URL(releaseManifestName, releaseDirectory));
if (manifest.schemaVersion !== 1 || manifest.project !== "KeebWeaver") throw new Error("Invalid release manifest identity.");
if (manifest.version !== packageManifest.version || manifest.tag !== `v${packageManifest.version}`) {
  throw new Error("Release manifest version does not match the signed source package.");
}
if (!/^[a-f0-9]{40}$/.test(manifest.commit)) throw new Error("Release manifest has an invalid commit.");
const expectedCommit = process.env.GITHUB_SHA;
if (expectedCommit && manifest.commit !== expectedCommit) throw new Error("Release manifest commit does not match the checked-out tag.");

const manifestNames = manifest.assets?.map((asset) => asset.name).sort() || [];
assertSameNames(manifestNames, [...manifestInputNames(sourceDeclaration)].sort(), releaseManifestName);
for (const asset of manifest.assets) {
  const actual = describeAsset(releaseDirectory, asset.name);
  if (actual.sha256 !== asset.sha256 || actual.size !== asset.size) {
    throw new Error(`Release manifest mismatch for ${asset.name}.`);
  }
}

if (listOnly) {
  process.stdout.write(`${expectedNames.join("\n")}\n`);
} else {
  process.stdout.write(`Verified ${expectedNames.length} declared release assets.\n`);
}

function parseChecksums(text) {
  const entries = new Map();
  for (const line of text.trimEnd().split("\n")) {
    const match = line.match(/^([a-f0-9]{64})  ([^/]+)$/);
    if (!match) throw new Error(`Malformed checksum line: ${line}`);
    if (entries.has(match[2])) throw new Error(`Duplicate checksum entry: ${match[2]}`);
    entries.set(match[2], match[1]);
  }
  return entries;
}

function assertSameNames(actual, expected, owner) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${owner} asset set mismatch. Expected ${expected.join(", ")}; received ${actual.join(", ")}.`);
  }
}
