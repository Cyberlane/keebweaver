import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const keymap = readFileSync(new URL("../firmware/config/ergokeeb_corne.keymap", import.meta.url), "utf8");
const buildMatrix = readFileSync(new URL("../firmware/build.yaml", import.meta.url), "utf8");
const firmwareConfig = readFileSync(new URL("../firmware/config/ergokeeb_corne.conf", import.meta.url), "utf8");
const leftFirmwareConfig = readFileSync(new URL("../firmware/config/ergokeeb_corne_left.conf", import.meta.url), "utf8");
const firmwareOverlay = readFileSync(new URL("../firmware/config/ergokeeb_corne.overlay", import.meta.url), "utf8");
const displayKconfig = readFileSync(new URL("../firmware/modules/keebweaver_display/Kconfig", import.meta.url), "utf8");
const displayFirmware = readFileSync(new URL("../firmware/modules/keebweaver_display/src/display_art.c", import.meta.url), "utf8");
const buildScript = readFileSync(new URL("../firmware/scripts/build.sh", import.meta.url), "utf8");
const westManifest = readFileSync(new URL("../firmware/west.yml", import.meta.url), "utf8");

test("firmware keeps the approved beginner thumb layout", () => {
  assert.match(keymap, /&kp LGUI\s+&mo 2\s+&lt 3 SPACE\s+&lt 1 ENTER\s+&none\s+&kp RALT/);
  assert.match(keymap, /display-name = "Navigation"/);
  assert.match(keymap, /&kp LA\(LEFT\).*&kp LA\(RIGHT\).*&kp HOME.*&kp END.*&kp PG_UP/);
});

test("firmware maps a right-hand numpad and common symbols", () => {
  assert.match(keymap, /&kp N7\s+&kp N8\s+&kp N9\s+&kp FSLH\s+&kp BSPC\s+&kp DEL/);
  assert.match(keymap, /&kp N4\s+&kp N5\s+&kp N6\s+&kp ASTRK/);
  assert.match(keymap, /&kp N1\s+&kp N2\s+&kp N3\s+&kp MINUS/);
  assert.match(keymap, /&kp EXCL\s+&kp AT\s+&kp HASH\s+&kp DLLR\s+&kp PRCNT/);
  assert.match(keymap, /&kp LPAR\s+&kp RPAR\s+&kp LBKT\s+&kp RBKT\s+&kp LBRC\s+&kp RBRC/);
});

test("firmware preserves the five-way mouse/click cluster on every layer", () => {
  for (const binding of ["&mmv MOVE_UP", "&mmv MOVE_LEFT", "&mkp LCLK", "&mmv MOVE_RIGHT", "&mmv MOVE_DOWN"]) {
    assert.equal(keymap.split(binding).length - 1, 4, `${binding} must occur once per layer`);
  }
});

test("firmware build matrix uses the documented ErgoKeeb targets", () => {
  assert.match(buildMatrix, /board: ergokeeb_corne_left\n    shield: nice_view/);
  assert.match(buildMatrix, /board: ergokeeb_corne_right\n    shield: nice_view/);
  assert.match(buildMatrix, /board: ergokeeb_corne_left\n    shield: settings_reset/);
  assert.match(buildMatrix, /CONFIG_ZMK_STUDIO=y/);
  assert.match(buildScript, /zmk-build-arm@sha256:[a-f0-9]{64}/);
  assert.doesNotMatch(buildScript, /zmk-build-arm:stable/);
  assert.match(westManifest, /revision: edf5c0814fd3ea202e43aad2d68fd32e882a518c/);
  assert.match(buildScript, /zephyr_commit=dacab4875df72109b96cc8977547a0dc04875bcd/);
  assert.match(buildScript, /SPDX-License-Identifier: MIT/);
  assert.doesNotMatch(firmwareConfig, /CONFIG_EC11/);
  assert.match(leftFirmwareConfig, /CONFIG_EC11_TRIGGER_GLOBAL_THREAD=y/);
  assert.match(buildScript, /ergokeeb_corne_left\.conf/);
});

test("display artwork uses a dedicated partition and separate USB endpoint", () => {
  assert.match(displayKconfig, /default y if SHIELD_NICE_VIEW/);
  assert.match(displayKconfig, /select USB_CDC_ACM/);
  assert.match(firmwareConfig, /# CONFIG_NICE_VIEW_WIDGET_STATUS is not set/);
  assert.match(firmwareOverlay, /partition@dc000/);
  assert.match(firmwareOverlay, /0x00010000/);
  assert.match(firmwareOverlay, /keebweaver_display_usb/);
  assert.match(displayFirmware, /KEEBWEAVER_ART_SLOT_COUNT 2u/);
  assert.match(displayFirmware, /flash_area_erase/);
  assert.match(displayFirmware, /crc32_ieee/);
});
