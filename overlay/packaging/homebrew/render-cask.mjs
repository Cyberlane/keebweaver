#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [version, sha256, outputArgument] = process.argv.slice(2);
if (!version || !sha256 || !outputArgument || process.argv.length !== 5) {
  throw new Error("Usage: render-cask.mjs <version> <sha256> <output-path>");
}
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
  throw new Error(`Homebrew Cask releases require a stable semantic version: ${version}`);
}
if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Homebrew Cask SHA-256 is invalid.");

const template = readFileSync(new URL("keebweaver-overlay.rb.template", import.meta.url), "utf8");
if (template.match(/\{\{VERSION\}\}/g)?.length !== 1 || template.match(/\{\{SHA256\}\}/g)?.length !== 1) {
  throw new Error("Homebrew Cask template placeholders are invalid.");
}
const cask = template.replace("{{VERSION}}", version).replace("{{SHA256}}", sha256);
if (cask.includes("{{")) throw new Error("Homebrew Cask template contains unresolved placeholders.");
writeFileSync(resolve(outputArgument), cask);
