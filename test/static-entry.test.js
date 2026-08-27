import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const overlayGuide = readFileSync(new URL("../docs/OVERLAY.md", import.meta.url), "utf8");
const releaseNotes = readFileSync(new URL("../docs/RELEASE_NOTES.md", import.meta.url), "utf8");
const releasing = readFileSync(new URL("../docs/RELEASING.md", import.meta.url), "utf8");

const homebrewCommand = "brew install --cask Cyberlane/tap/keebweaver-overlay";
const macosAsset = "keebweaver-overlay-macos-universal.zip";

test("unbundled static entry resolves local Three.js modules", () => {
  assert.match(index, /<script type="importmap">/);
  assert.match(index, /"three": "\.\/node_modules\/three\/build\/three\.module\.js"/);
  assert.match(index, /"three\/addons\/": "\.\/node_modules\/three\/examples\/jsm\/"/);
  assert.match(index, /<script type="module" src="\.\/src\/app\.js"><\/script>/);
});

test("Pages separates the published firmware release from Overlay distribution", () => {
  assert.match(index, /Published v0\.2\.0 · firmware assets/);
  assert.match(index, /Pointer speed survives a reboot/);
  assert.match(index, /Shifted coding symbols are visible/);
  assert.match(index, /ergokeeb_corne_left/);
  assert.match(index, /settings-reset image/);
  assert.match(index, /v0\.2\.0 does not contain an Overlay ZIP/);
  assert.match(releaseNotes, /keebweaver\/pointer_speed/);
  assert.match(releaseNotes, /`Shift held` preview/);
  assert.match(releaseNotes, /GitHub artifact attestations/);
});

test("Pages exposes the gated Homebrew command without mirroring a binary", () => {
  assert.ok(index.includes(homebrewCommand));
  assert.match(index, /id="copy-homebrew-command"/);
  assert.match(index, /aria-describedby="homebrew-copy-status"/);
  assert.match(index, /id="homebrew-copy-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(index, /Pending signed\/notarized release and live Homebrew tap verification/);
  assert.match(index, /https:\/\/github\.com\/Cyberlane\/keebweaver\/releases/);
  assert.match(index, /does not host or mirror a binary/);
  assert.doesNotMatch(index, /href="[^"]*keebweaver-overlay-macos-universal\.zip/);

  assert.match(app, /navigator\.clipboard\?\.writeText/);
  assert.match(app, /document\.execCommand\("copy"\)/);
  assert.match(app, /Select the command text and copy it manually/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);

  assert.match(styles, /\.install-command code[\s\S]*overflow-wrap: anywhere/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.install-command \{ grid-template-columns: 1fr; \}/);
});

test("repository docs keep the Overlay release and platform gates aligned", () => {
  for (const document of [overlayGuide, releaseNotes, releasing]) {
    assert.ok(document.includes(homebrewCommand));
    assert.ok(document.includes(macosAsset));
  }

  assert.match(overlayGuide, /Available from source now/);
  assert.match(overlayGuide, /Windows[\s\S]*No release asset yet/);
  assert.match(overlayGuide, /Linux[\s\S]*No release asset yet/);
  assert.match(overlayGuide, /Pages links to that release page and does not host or mirror another copy/);
  assert.match(releasing, /release\.published/);
  assert.match(releasing, /never touches keyboard firmware|does not rebuild the application/);
});
