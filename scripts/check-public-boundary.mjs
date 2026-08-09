import { execFileSync } from "node:child_process";
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
for (const commit of commits) {
  const paths = lines(output(["ls-tree", "-r", "--name-only", commit]));
  for (const path of paths) {
    if (!textExtensions.has(extname(path).toLowerCase()) && !["AGENTS.md", "LICENSE"].includes(path)) continue;
    const text = output(["show", `${commit}:${path}`]);
    for (const { pattern, label } of privateTextPatterns) {
      if (pattern.test(text)) failures.push(`${label} in Git history at ${commit}:${path}`);
    }
  }
}

const emails = new Set(lines(output(["log", "--all", "--format=%ae%n%ce"])));
for (const email of emails) {
  if (!email.endsWith("@users.noreply.github.com")) {
    failures.push(`Git history contains a non-noreply author or committer email: ${email}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Public-boundary audit passed for ${tracked.length} tracked files and ${commits.length} reachable commits.`);
