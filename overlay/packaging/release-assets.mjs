// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const targetDeclarationName = "keebweaver-release-targets.json";
export const releaseManifestName = "keebweaver-release-manifest.json";
export const checksumsName = "SHA256SUMS";

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function validateTargetDeclaration(declaration) {
  if (declaration.schemaVersion !== 1) throw new Error("Unsupported release target schema.");
  if (!Array.isArray(declaration.targets) || declaration.targets.length === 0) {
    throw new Error("Release target declaration has no targets.");
  }
  if (!Array.isArray(declaration.metadataAssets) || declaration.metadataAssets.length === 0) {
    throw new Error("Release target declaration has no metadata assets.");
  }

  const targetIds = new Set();
  const assetNames = new Set();
  for (const target of declaration.targets) {
    if (typeof target.id !== "string" || targetIds.has(target.id)) {
      throw new Error(`Invalid or duplicate release target id: ${target.id}`);
    }
    targetIds.add(target.id);
    if (!new Set(["required", "planned"]).has(target.status)) {
      throw new Error(`Invalid status for release target ${target.id}.`);
    }
    if (target.status === "required") {
      validateAssetName(target.asset, `release target ${target.id}`);
      if (assetNames.has(target.asset)) throw new Error(`Duplicate release asset: ${target.asset}`);
      assetNames.add(target.asset);
    } else if (typeof target.assetTemplate !== "string" || !target.assetTemplate.includes("{architecture}")) {
      throw new Error(`Planned release target ${target.id} must declare an architecture template.`);
    }
  }

  for (const metadata of declaration.metadataAssets) {
    validateAssetName(metadata.asset, "release metadata");
    if (assetNames.has(metadata.asset)) throw new Error(`Duplicate release asset: ${metadata.asset}`);
    assetNames.add(metadata.asset);
  }

  for (const generatedName of [targetDeclarationName, releaseManifestName, checksumsName]) {
    const metadata = declaration.metadataAssets.find((entry) => entry.asset === generatedName);
    if (!metadata?.generated) throw new Error(`${generatedName} must be declared as generated metadata.`);
  }

  const checksumMetadata = declaration.metadataAssets.find((entry) => entry.asset === checksumsName);
  if (checksumMetadata.checksummed !== false) throw new Error(`${checksumsName} cannot checksum itself.`);
}

function validateAssetName(name, owner) {
  if (typeof name !== "string" || !name || name !== name.split("/").at(-1) || name === "." || name === "..") {
    throw new Error(`Invalid asset name for ${owner}: ${name}`);
  }
}

export function expectedAssetNames(declaration) {
  validateTargetDeclaration(declaration);
  return [
    ...declaration.targets.filter((target) => target.status === "required").map((target) => target.asset),
    ...declaration.metadataAssets.map((metadata) => metadata.asset),
  ];
}

export function manifestInputNames(declaration) {
  return expectedAssetNames(declaration).filter((name) => name !== releaseManifestName && name !== checksumsName);
}

export function checksummedAssetNames(declaration) {
  return expectedAssetNames(declaration).filter((name) => name !== checksumsName);
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function describeAsset(directory, name) {
  const path = new URL(`${encodeURIComponent(name)}`, ensureDirectoryUrl(directory));
  const stats = statSync(path);
  if (!stats.isFile()) throw new Error(`Release asset is not a regular file: ${name}`);
  return { name, sha256: sha256File(path), size: stats.size };
}

export function ensureDirectoryUrl(directory) {
  const url = directory instanceof URL
    ? directory
    : pathToFileURL(directory.endsWith("/") ? directory : `${directory}/`);
  return url.href.endsWith("/") ? url : new URL(`${url.href}/`);
}
