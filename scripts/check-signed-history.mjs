// SPDX-License-Identifier: MIT

import { execFileSync } from "node:child_process";

const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const gh = (args) => execFileSync("gh", args, { encoding: "utf8" }).trim();
const lines = (value) => value ? value.split("\n").filter(Boolean) : [];
const failures = [];
const commits = lines(git(["rev-list", "HEAD"]));
const tags = lines(git(["tag", "--list", "v*", "--sort=refname"]));

for (const commit of commits) {
  const object = git(["cat-file", "commit", commit]);
  if (!/^gpgsig /m.test(object)) failures.push(`unsigned commit reachable from HEAD: ${commit}`);
}

for (const tag of tags) {
  if (git(["cat-file", "-t", `refs/tags/${tag}`]) !== "tag") {
    failures.push(`release tag is not an annotated signed tag: ${tag}`);
    continue;
  }
  const object = git(["cat-file", "tag", tag]);
  if (!/-----BEGIN (?:PGP|SSH) SIGNATURE-----/.test(object)) {
    failures.push(`release tag has no embedded signature: ${tag}`);
  }
}

if (process.env.GITHUB_ACTIONS === "true") {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !process.env.GH_TOKEN) {
    failures.push("GitHub signature verification requires GITHUB_REPOSITORY and GH_TOKEN.");
  } else {
    for (const commit of commits) {
      if (gh(["api", `repos/${repository}/commits/${commit}`, "--jq", ".commit.verification.verified"]) !== "true") {
        failures.push(`GitHub does not verify commit signature: ${commit}`);
      }
    }
    for (const tag of tags) {
      const tagObject = gh(["api", `repos/${repository}/git/ref/tags/${tag}`, "--jq", ".object.sha"]);
      if (gh(["api", `repos/${repository}/git/tags/${tagObject}`, "--jq", ".verification.verified"]) !== "true") {
        failures.push(`GitHub does not verify release tag signature: ${tag}`);
      }
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

const remoteSuffix = process.env.GITHUB_ACTIONS === "true" ? " with GitHub verification" : " with embedded signatures";
console.log(`Signed-history audit passed for ${commits.length} commits and ${tags.length} release tags${remoteSuffix}.`);
