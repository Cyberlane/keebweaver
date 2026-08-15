// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DEVICE_DEFINITION } from "../src/model.js";

const swiftLayout = readFileSync(new URL("../macos/KeebWeaverOverlay/Sources/KeebWeaverOverlay/Layout.swift", import.meta.url), "utf8");
const swiftFrame = readFileSync(new URL("../macos/KeebWeaverOverlay/Sources/KeebWeaverOverlay/LayerStateFrame.swift", import.meta.url), "utf8");
const swiftBluetooth = readFileSync(new URL("../macos/KeebWeaverOverlay/Sources/KeebWeaverOverlay/BluetoothLayerStateClient.swift", import.meta.url), "utf8");
const swiftModel = readFileSync(new URL("../macos/KeebWeaverOverlay/Sources/KeebWeaverOverlay/OverlayModel.swift", import.meta.url), "utf8");
const firmwareLayerState = readFileSync(new URL("../firmware/modules/keebweaver_display/src/layer_state_ble.c", import.meta.url), "utf8");
const firmwarePointerSpeed = readFileSync(new URL("../firmware/modules/keebweaver_display/include/keebweaver/pointer_speed.h", import.meta.url), "utf8");

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

test("macOS overlay and firmware pin the same BLE frame contract", () => {
  assert.match(swiftFrame, /static let version: UInt8 = 2/);
  assert.match(swiftFrame, /static let byteCount = 6/);
  assert.match(firmwareLayerState, /KEEBWEAVER_LAYER_STATE_FRAME_VERSION 2u/);
  assert.match(firmwareLayerState, /KEEBWEAVER_LAYER_STATE_FRAME_BYTES 6u/);

  for (const id of ["0001", "0002", "0003"]) {
    assert.match(swiftBluetooth, new RegExp(`8F4B${id}-2A0E-4F6E-9A1C-3D7B56C4E201`));
    assert.match(firmwareLayerState, new RegExp(`0x8f4b${id}`));
  }
});

test("macOS overlay and firmware pin the same pointer-speed bounds", () => {
  for (const [name, value] of [["Minimum", 300], ["Default", 1200], ["Maximum", 2400]]) {
    assert.match(swiftModel, new RegExp(`pointerSpeed${name} = ${value}`));
  }
  assert.match(firmwarePointerSpeed, /KEEBWEAVER_POINTER_SPEED_MIN 300u/);
  assert.match(firmwarePointerSpeed, /KEEBWEAVER_POINTER_SPEED_DEFAULT 1200u/);
  assert.match(firmwarePointerSpeed, /KEEBWEAVER_POINTER_SPEED_MAX 2400u/);
});
