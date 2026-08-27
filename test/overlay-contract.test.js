// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DEVICE_DEFINITION } from "../src/model.js";

const swiftLayout = readFileSync(new URL("../overlay/macos/KeebWeaverOverlay/Sources/KeebWeaverOverlay/Layout.swift", import.meta.url), "utf8");
const swiftView = readFileSync(new URL("../overlay/macos/KeebWeaverOverlay/Sources/KeebWeaverOverlay/OverlayView.swift", import.meta.url), "utf8");
const swiftFrame = readFileSync(new URL("../overlay/macos/KeebWeaverOverlay/Sources/KeebWeaverOverlay/LayerStateFrame.swift", import.meta.url), "utf8");
const swiftBluetooth = readFileSync(new URL("../overlay/macos/KeebWeaverOverlay/Sources/KeebWeaverOverlay/BluetoothLayerStateClient.swift", import.meta.url), "utf8");
const swiftModel = readFileSync(new URL("../overlay/macos/KeebWeaverOverlay/Sources/KeebWeaverOverlay/OverlayModel.swift", import.meta.url), "utf8");
const overlayReadme = readFileSync(new URL("../overlay/macos/KeebWeaverOverlay/README.md", import.meta.url), "utf8");
const firmwareLayerState = readFileSync(new URL("../firmware/modules/keebweaver_display/src/layer_state_ble.c", import.meta.url), "utf8");
const firmwarePointerSpeed = readFileSync(new URL("../firmware/modules/keebweaver_display/include/keebweaver/pointer_speed.h", import.meta.url), "utf8");
const pointerSpeedSource = readFileSync(new URL("../firmware/modules/keebweaver_display/src/pointer_speed.c", import.meta.url), "utf8");
const sharedContract = JSON.parse(readFileSync(
  new URL("../overlay/contract/v1/keebweaver-overlay.json", import.meta.url),
  "utf8",
));

test("shared overlay contract mirrors the exact physical layout and four firmware layers", () => {
  const expectedPositions = DEVICE_DEFINITION.positions
    .filter((position) => position.kind === "key")
    .map((position) => position.id)
    .sort();
  const contractPositions = [
    ...sharedContract.layout.rows.flatMap((row) => [...row.left, ...row.right]),
    ...sharedContract.layout.leftThumbs,
    ...sharedContract.layout.rightThumbs,
  ].map((key) => key.id).sort();

  assert.deepEqual(contractPositions, expectedPositions);
  assert.deepEqual(
    sharedContract.layers.map(({ id, firmwareIndex }) => [id, firmwareIndex]),
    [["base", 0], ["navigation", 1], ["numbers", 2], ["symbols", 3]],
  );
  assert.deepEqual(sharedContract.device.supportedSides, [
    "ergokeeb_corne_left",
    "ergokeeb_corne_right",
  ]);
});

test("macOS overlay includes every physical key exactly once", () => {
  const expected = DEVICE_DEFINITION.positions
    .filter((position) => position.kind === "key")
    .map((position) => position.id)
    .sort();
  const actual = [...swiftLayout.matchAll(/\bkey\("(r\d+c\d+)"/g)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, actual.length);
});

test("macOS overlay exposes shifted coding symbols", () => {
  assert.match(swiftLayout, /shiftedOverrides/);
  assert.match(swiftLayout, /key\("r2c13", ",",[\s\S]*shifted: \[\.base: "<"/);
  assert.match(swiftLayout, /key\("r2c14", "\.",[\s\S]*shifted: \[\.base: ">"/);
  assert.match(swiftLayout, /\.symbols: "`"/);
  assert.match(swiftLayout, /\.symbols: "~"/);
  assert.match(swiftView, /Toggle\("Shift held", isOn: \$model\.shiftPreview\)/);
  assert.match(swiftView, /KeyboardDiagramView\(layer: model\.visibleLayer, shiftHeld: model\.shiftPreview\)/);
});

test("macOS overlay and firmware pin the same BLE frame contract", () => {
  const currentFrame = sharedContract.layerStateFrames.find((frame) => frame.version === 2);
  assert.ok(currentFrame);
  assert.match(swiftFrame, new RegExp(`static let version: UInt8 = ${currentFrame.version}`));
  assert.match(swiftFrame, new RegExp(`static let byteCount = ${currentFrame.length}`));
  assert.match(firmwareLayerState, new RegExp(`KEEBWEAVER_LAYER_STATE_FRAME_VERSION ${currentFrame.version}u`));
  assert.match(firmwareLayerState, new RegExp(`KEEBWEAVER_LAYER_STATE_FRAME_BYTES ${currentFrame.length}u`));
  assert.match(swiftFrame, /supportedLayerMask/);
  assert.match(swiftFrame, /highestActiveLayer/);

  for (const uuid of [
    sharedContract.bluetooth.serviceUuid,
    sharedContract.bluetooth.layerStateCharacteristic.uuid,
    sharedContract.bluetooth.pointerSpeedCharacteristic.uuid,
  ]) {
    assert.match(swiftBluetooth, new RegExp(uuid.toUpperCase()));
    assert.match(firmwareLayerState, new RegExp(`0x${uuid.slice(0, 8)}`));
  }
});

test("macOS overlay and firmware pin the same pointer-speed bounds", () => {
  for (const [name, value] of [
    ["Minimum", sharedContract.pointerSpeed.minimum],
    ["Default", sharedContract.pointerSpeed.default],
    ["Maximum", sharedContract.pointerSpeed.maximum],
  ]) {
    assert.match(swiftModel, new RegExp(`pointerSpeed${name} = ${value}`));
  }
  assert.match(firmwarePointerSpeed, new RegExp(`KEEBWEAVER_POINTER_SPEED_MIN ${sharedContract.pointerSpeed.minimum}u`));
  assert.match(firmwarePointerSpeed, new RegExp(`KEEBWEAVER_POINTER_SPEED_DEFAULT ${sharedContract.pointerSpeed.default}u`));
  assert.match(firmwarePointerSpeed, new RegExp(`KEEBWEAVER_POINTER_SPEED_MAX ${sharedContract.pointerSpeed.maximum}u`));
});

test("release documentation describes firmware-owned pointer-speed persistence", () => {
  assert.match(overlayReadme, /persists[\s\S]*ZMK settings/);
  assert.match(overlayReadme, /five seconds after the last change/);
  assert.match(overlayReadme, /settings-reset image intentionally clears/);
  assert.match(pointerSpeedSource, /SETTINGS_STATIC_HANDLER_DEFINE/);
  assert.match(pointerSpeedSource, /settings_save_one\(POINTER_SPEED_SETTINGS_KEY/);
});
