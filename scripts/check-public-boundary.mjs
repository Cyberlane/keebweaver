import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const output = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const lines = (value) => value ? value.split("\n").filter(Boolean) : [];
const failures = [];

const forbiddenPrefixes = ["evidence/", "uploads/", "firmware/artifacts/", ".firmware-work/"];
const forbiddenExtensions = new Set([".uf2", ".heic"]);
const textExtensions = new Set([".c", ".conf", ".css", ".dts", ".dtsi", ".html", ".js", ".json", ".keymap", ".md", ".mjs", ".overlay", ".sh", ".txt", ".yaml", ".yml"]);
const privateTextPatterns = [
  { pattern: /\/Users\/[A-Za-z0-9._-]+\//, label: "absolute macOS home path" },
  { pattern: /[A-Za-z]:\\Users\\[^\\]+\\/i, label: "absolute Windows home path" },
  { pattern: /file:\/\//i, label: "local file URL" },
  { pattern: new RegExp(["obsi", "dian"].join(""), "i"), label: "private-notes application reference" },
];

const tracked = lines(output(["ls-files"]));
for (const path of tracked) {
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

console.log(`Public-boundary audit passed for ${tracked.length} tracked files and ${commits.length} reachable commits.`);
