#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  checksummedAssetNames,
  checksumsName,
  describeAsset,
  ensureDirectoryUrl,
  manifestInputNames,
  readJson,
  releaseManifestName,
  targetDeclarationName,
  validateTargetDeclaration,
} from "./release-assets.mjs";

const scriptDirectory = new URL("./", import.meta.url);
const repositoryRoot = new URL("../../", scriptDirectory);
const sourceDeclarationPath = new URL("release-targets.json", scriptDirectory);
const packageManifest = readJson(new URL("package.json", repositoryRoot));
const releaseDirectoryArgument = process.argv[2];
if (!releaseDirectoryArgument || process.argv.length !== 3) {
  throw new Error("Usage: create-release-metadata.mjs <release-directory>");
}

const releaseDirectory = ensureDirectoryUrl(resolve(releaseDirectoryArgument));
const declaration = readJson(sourceDeclarationPath);
validateTargetDeclaration(declaration);
copyFileSync(sourceDeclarationPath, new URL(targetDeclarationName, releaseDirectory));

for (const name of manifestInputNames(declaration)) {
  if (!existsSync(new URL(encodeURIComponent(name), releaseDirectory))) {
    throw new Error(`Missing required release asset: ${name}`);
  }
}

const sourceEpoch = Number(process.env.SOURCE_DATE_EPOCH || git(["show", "-s", "--format=%ct", "HEAD"]));
if (!Number.isInteger(sourceEpoch) || sourceEpoch <= 0) throw new Error("SOURCE_DATE_EPOCH must be a positive integer.");
const commit = process.env.GITHUB_SHA || git(["rev-parse", "HEAD"]);
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`Invalid release commit: ${commit}`);
const tag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || `v${packageManifest.version}`;
if (tag !== `v${packageManifest.version}`) {
  throw new Error(`Release tag ${tag} does not match package version v${packageManifest.version}.`);
}

const manifest = {
  schemaVersion: 1,
  project: "KeebWeaver",
  version: packageManifest.version,
  tag,
  commit,
  created: new Date(sourceEpoch * 1000).toISOString().replace(".000Z", "Z"),
  requiredTargets: declaration.targets
    .filter((target) => target.status === "required")
    .map((target) => ({ id: target.id, platform: target.platform, asset: target.asset })),
  plannedTargets: declaration.targets
    .filter((target) => target.status === "planned")
    .map((target) => ({ id: target.id, platform: target.platform, assetTemplate: target.assetTemplate })),
  assets: manifestInputNames(declaration).map((name) => describeAsset(releaseDirectory, name)),
};
writeFileSync(new URL(releaseManifestName, releaseDirectory), `${JSON.stringify(manifest, null, 2)}\n`);

const checksumLines = checksummedAssetNames(declaration).map((name) => {
  if (!existsSync(new URL(encodeURIComponent(name), releaseDirectory))) {
    throw new Error(`Missing checksummed release asset: ${name}`);
  }
  return `${describeAsset(releaseDirectory, name).sha256}  ${name}`;
});
writeFileSync(new URL(checksumsName, releaseDirectory), `${checksumLines.join("\n")}\n`);

process.stdout.write(`Created release metadata for ${checksumLines.length} checksummed assets.\n`);

function git(args) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
}
