import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("unbundled static entry resolves local Three.js modules", () => {
  assert.match(index, /<script type="importmap">/);
  assert.match(index, /"three": "\.\/node_modules\/three\/build\/three\.module\.js"/);
  assert.match(index, /"three\/addons\/": "\.\/node_modules\/three\/examples\/jsm\/"/);
  assert.match(index, /<script type="module" src="\.\/src\/app\.js"><\/script>/);
});
