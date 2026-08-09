import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

if (!semver.test(manifest.version)) throw new Error(`package.json has an invalid release version: ${manifest.version}`);
if (lock.version !== manifest.version || lock.packages?.[""]?.version !== manifest.version) {
  throw new Error("package-lock.json version does not match package.json");
}
if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME !== `v${manifest.version}`) {
  throw new Error(`tag ${process.env.GITHUB_REF_NAME} does not match package version v${manifest.version}`);
}

console.log(`Release metadata is consistent for v${manifest.version}.`);
