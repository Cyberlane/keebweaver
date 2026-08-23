import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const releaseNotes = readFileSync(new URL("../docs/RELEASE_NOTES.md", import.meta.url), "utf8");

test("unbundled static entry resolves local Three.js modules", () => {
  assert.match(index, /<script type="importmap">/);
  assert.match(index, /"three": "\.\/node_modules\/three\/build\/three\.module\.js"/);
  assert.match(index, /"three\/addons\/": "\.\/node_modules\/three\/examples\/jsm\/"/);
  assert.match(index, /<script type="module" src="\.\/src\/app\.js"><\/script>/);
});

test("Pages release brief names the shipped runtime boundaries", () => {
  assert.match(index, /v0\.2\.0 release candidate/);
  assert.match(index, /Pointer speed survives a reboot/);
  assert.match(index, /Shifted coding symbols are visible/);
  assert.match(index, /ergokeeb_corne_left/);
  assert.match(index, /settings-reset image/);
  assert.match(releaseNotes, /keebweaver\/pointer_speed/);
  assert.match(releaseNotes, /manual `Shift held` preview/);
  assert.match(releaseNotes, /GitHub artifact attestations/);
});
