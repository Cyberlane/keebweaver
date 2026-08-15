// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const sections = [
  ["KeebWeaver original work", "LICENSE"],
  ["Third-party notices", "THIRD_PARTY_NOTICES.md"],
  ["ZMK and historic nice!view artwork", "LICENSES/ZMK-MIT.txt"],
  ["Nord color palette", "LICENSES/NORD-MIT.txt"],
  ["Zephyr Project", "LICENSES/ZEPHYR-APACHE-2.0.txt"],
];

const output = sections.map(([title, path]) => {
  const text = readFileSync(new URL(path, root), "utf8").trimEnd();
  return `${"=".repeat(72)}\n${title}\n${path}\n${"=".repeat(72)}\n${text}`;
}).join("\n\n");

process.stdout.write(`${output}\n`);
