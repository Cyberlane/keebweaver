// SPDX-License-Identifier: MIT

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

const output = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const lines = (value) => value ? value.split("\n").filter(Boolean) : [];
const failures = [];

const forbiddenPrefixes = ["evidence/", "uploads/", "firmware/artifacts/", ".firmware-work/"];
const forbiddenExtensions = new Set([".uf2", ".heic"]);
const textExtensions = new Set([".c", ".conf", ".css", ".dts", ".dtsi", ".h", ".html", ".js", ".json", ".keymap", ".md", ".mjs", ".overlay", ".plist", ".sh", ".swift", ".txt", ".yaml", ".yml"]);
const privateTextPatterns = [
  { pattern: /\/Users\/[A-Za-z0-9._-]+\//, label: "absolute macOS home path" },
  { pattern: /[A-Za-z]:\\Users\\[^\\]+\\/i, label: "absolute Windows home path" },
  { pattern: /file:\/\//i, label: "local file URL" },
  { pattern: new RegExp(["obsi", "dian"].join(""), "i"), label: "private-notes application reference" },
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: "private key material" },
  { pattern: /\b(?:gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/, label: "GitHub credential" },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/, label: "AWS access key" },
];

// A directory move leaves deleted index entries visible to `git ls-files`
// until the rename is staged. Audit the files present in the working tree;
// the separate history pass below still covers every deleted path and blob.
const tracked = lines(output(["ls-files"])).filter(existsSync);
const untracked = lines(output(["ls-files", "--others", "--exclude-standard"]));
const visible = [...new Set([...tracked, ...untracked])];
for (const path of visible) {
  if (forbiddenPrefixes.some((prefix) => path.startsWith(prefix))) {
    failures.push(`tracked private path: ${path}`);
  }
  if (forbiddenExtensions.has(extname(path).toLowerCase())) {
    failures.push(`tracked device artifact: ${path}`);
  }
  if (!textExtensions.has(extname(path).toLowerCase()) && !["AGENTS.md", "LICENSE"].includes(path)) continue;
  const text = readFileSync(path, "utf8");
  for (const { pattern, label } of privateTextPatterns) {
    if (pattern.test(text)) failures.push(`${label} in ${path}`);
  }
}

const historyPaths = lines(output(["log", "--all", "--format=", "--name-only"]));
for (const path of historyPaths) {
  if (forbiddenPrefixes.some((prefix) => path.startsWith(prefix)) || forbiddenExtensions.has(extname(path).toLowerCase())) {
    failures.push(`private path appears in Git history: ${path}`);
  }
}

const commits = lines(output(["rev-list", "--all"]));
const historyGrepPatterns = [
  "/Users/[[:alnum:]_.-]+/",
  "[A-Za-z]:\\\\Users\\\\[^\\\\]+\\\\",
  ["file:", "//"].join(""),
  ["obsi", "dian"].join(""),
  "-----BEGIN [A-Z ]*PRIVATE KEY-----",
  "gh[opsu]_[[:alnum:]_]+",
  "github_pat_[[:alnum:]_]+",
  "AKIA[0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z]",
];

for (let index = 0; index < commits.length; index += 100) {
  const commitBatch = commits.slice(index, index + 100);
  const grep = spawnSync("git", [
    "grep", "-I", "-i", "-l",
    ...historyGrepPatterns.flatMap((pattern) => ["-e", pattern]),
    ...commitBatch,
    "--",
  ], { encoding: "utf8" });
  if (grep.status === 0) {
    for (const match of lines(grep.stdout.trim())) failures.push(`private text appears in Git history at ${match}`);
  } else if (grep.status !== 1) {
    throw new Error(grep.stderr.trim() || `git grep failed with status ${grep.status}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Public-boundary audit passed for ${tracked.length} tracked files, ${untracked.length} visible untracked files, and ${commits.length} reachable commits.`);
