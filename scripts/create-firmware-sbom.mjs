// SPDX-License-Identifier: MIT

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const buildScript = readFileSync(new URL("firmware/scripts/build.sh", root), "utf8");
const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function requiredPin(name) {
  const match = buildScript.match(new RegExp(`^${name}=([^\\s]+)$`, "m"));
  if (!match) throw new Error(`Missing ${name} pin in firmware build script.`);
  return match[1];
}

const commit = process.env.GITHUB_SHA || git(["rev-parse", "HEAD"]);
const sourceEpoch = Number(process.env.SOURCE_DATE_EPOCH || git(["show", "-s", "--format=%ct", commit]));
if (!Number.isInteger(sourceEpoch) || sourceEpoch <= 0) throw new Error("SOURCE_DATE_EPOCH must be a positive integer.");

const boardURL = requiredPin("board_source_url");
const boardCommit = requiredPin("board_source_commit");
const zmkCommit = requiredPin("zmk_commit");
const zephyrCommit = requiredPin("zephyr_commit");
const container = requiredPin("container_image");
const created = new Date(sourceEpoch * 1000).toISOString().replace(".000Z", "Z");

const packages = [
  {
    SPDXID: "SPDXRef-Package-KeebWeaver-Firmware",
    name: "KeebWeaver firmware source",
    versionInfo: manifest.version,
    downloadLocation: `git+https://github.com/Cyberlane/keebweaver.git@${commit}`,
    filesAnalyzed: false,
    licenseConcluded: "MIT",
    licenseDeclared: "MIT",
    copyrightText: "Copyright (c) 2026 KeebWeaver contributors",
  },
  {
    SPDXID: "SPDXRef-Package-ErgoKeeb-Corne-Boards",
    name: "CorneZMK ErgoKeeb board definitions",
    versionInfo: boardCommit,
    downloadLocation: `${boardURL}@${boardCommit}`,
    filesAnalyzed: false,
    licenseConcluded: "MIT",
    licenseDeclared: "MIT",
    copyrightText: "Copyright ZMK Contributors",
  },
  {
    SPDXID: "SPDXRef-Package-ZMK",
    name: "ZMK Firmware",
    versionInfo: zmkCommit,
    downloadLocation: `git+https://github.com/zmkfirmware/zmk.git@${zmkCommit}`,
    filesAnalyzed: false,
    licenseConcluded: "MIT",
    licenseDeclared: "MIT",
    copyrightText: "Copyright ZMK Contributors",
  },
  {
    SPDXID: "SPDXRef-Package-Zephyr",
    name: "Zephyr Project",
    versionInfo: zephyrCommit,
    downloadLocation: `git+https://github.com/zmkfirmware/zephyr.git@${zephyrCommit}`,
    filesAnalyzed: false,
    licenseConcluded: "Apache-2.0",
    licenseDeclared: "Apache-2.0",
    copyrightText: "NOASSERTION",
  },
  {
    SPDXID: "SPDXRef-Package-Build-Container",
    name: "ZMK build container",
    versionInfo: container.split("@sha256:")[1],
    downloadLocation: "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: "NOASSERTION",
    copyrightText: "NOASSERTION",
    comment: `Pinned OCI image: ${container}`,
  },
];

const sbom = {
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  SPDXID: "SPDXRef-DOCUMENT",
  name: `KeebWeaver firmware dependency closure v${manifest.version}`,
  documentNamespace: `https://github.com/Cyberlane/keebweaver/releases/download/v${manifest.version}/keebweaver-firmware-dependencies.spdx.json`,
  creationInfo: {
    created,
    creators: ["Tool: KeebWeaver create-firmware-sbom.mjs"],
  },
  documentDescribes: ["SPDXRef-Package-KeebWeaver-Firmware"],
  comment: "Dependency-level SBOM for the pinned firmware build closure. It is not a file-level inventory of the container image.",
  packages,
  relationships: packages.slice(1).map((dependency) => ({
    spdxElementId: "SPDXRef-Package-KeebWeaver-Firmware",
    relationshipType: "DEPENDS_ON",
    relatedSpdxElement: dependency.SPDXID,
  })),
};

process.stdout.write(`${JSON.stringify(sbom, null, 2)}\n`);
