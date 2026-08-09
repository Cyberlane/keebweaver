import assert from "node:assert/strict";
import test from "node:test";

import viteConfig from "../vite.config.js";

test("Vite emits assets relative to the deployed project path", () => {
  assert.equal(viteConfig.base, "./");
});
