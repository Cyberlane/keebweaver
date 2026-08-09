import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  DISPLAY_ART_BYTES,
  DISPLAY_HEIGHT,
  DISPLAY_PORTRAIT_HEIGHT,
  DISPLAY_PORTRAIT_WIDTH,
  DISPLAY_PRESET_SAFE_HEIGHT,
  DISPLAY_PRESETS,
  DISPLAY_WIDTH,
  TRANSFER,
  TransferFrameDecoder,
  artworkFromPortraitImageData,
  artworkFromPreset,
  createBlankArtwork,
  createTransferFrame,
  crc32Ieee,
  pixelAt,
  portraitPixelAt,
  setPixel,
  setPortraitPixel,
} from "../src/display-art.js";
import { DisplayArtTransfer } from "../src/display-transfer.js";
import { ZMK_NICE_VIEW_SOURCE, zmkNiceViewAsset } from "../src/zmk-display-art.js";

test("display bitmap uses the exact nice!view 160x68 one-bit payload", () => {
  const bitmap = createBlankArtwork();
  assert.equal(bitmap.length, DISPLAY_ART_BYTES);
  setPixel(bitmap, 0, 0);
  setPixel(bitmap, DISPLAY_WIDTH - 1, DISPLAY_HEIGHT - 1);
  assert.equal(pixelAt(bitmap, 0, 0), true);
  assert.equal(pixelAt(bitmap, DISPLAY_WIDTH - 1, DISPLAY_HEIGHT - 1), true);
  assert.equal(pixelAt(bitmap, 1, 0), false);
});

test("portrait coordinates rotate exactly into the nice!view device buffer", () => {
  const bitmap = createBlankArtwork();
  setPortraitPixel(bitmap, 0, 0);
  setPortraitPixel(bitmap, DISPLAY_PORTRAIT_WIDTH - 1, DISPLAY_PORTRAIT_HEIGHT - 1);
  assert.equal(pixelAt(bitmap, DISPLAY_WIDTH - 1, 0), true);
  assert.equal(pixelAt(bitmap, 0, DISPLAY_HEIGHT - 1), true);
  assert.equal(portraitPixelAt(bitmap, 0, 0), true);
  assert.equal(portraitPixelAt(bitmap, DISPLAY_PORTRAIT_WIDTH - 1, DISPLAY_PORTRAIT_HEIGHT - 1), true);
});

test("every curated preset is a non-empty valid device bitmap", () => {
  assert.ok(DISPLAY_PRESETS.length >= 5);
  for (const preset of DISPLAY_PRESETS) {
    const bitmap = artworkFromPreset(preset.id);
    assert.equal(bitmap.length, DISPLAY_ART_BYTES, preset.id);
    assert.ok(bitmap.some((value) => value !== 0), preset.id);
    for (let y = DISPLAY_PRESET_SAFE_HEIGHT; y < DISPLAY_PORTRAIT_HEIGHT; y += 1) {
      for (let x = 0; x < DISPLAY_PORTRAIT_WIDTH; x += 1) {
        assert.equal(portraitPixelAt(bitmap, x, y), false, `${preset.id} must preserve the live-label area`);
      }
    }
  }
});

test("ZMK presets retain the exact historic nice!view pixel payloads", () => {
  assert.equal(ZMK_NICE_VIEW_SOURCE.commit, "f1b944b1efc01805a769cb2b15797c2c611bcc5f");
  const expectedHashes = {
    mountain: "a43c48276824205483b0d3d3db56e8524304148096cbf4870d3751c0c0992ac3",
    balloon: "c1319e926e813d44839e1e62d66a5b1bf55cfadade9dc79beacce73b38789492",
  };

  for (const [id, expectedHash] of Object.entries(expectedHashes)) {
    const source = zmkNiceViewAsset(id);
    assert.equal(source.width, 140, id);
    assert.equal(source.height, 68, id);
    assert.equal(source.payload.length, 1224, id);
    assert.equal(createHash("sha256").update(source.payload).digest("hex"), expectedHash, id);
    assert.equal(source.sha256, expectedHash, id);

    const preset = artworkFromPreset(`zmk-${id}`);
    const top = Math.floor((DISPLAY_PRESET_SAFE_HEIGHT - source.width) / 2);
    for (let sourceY = 0; sourceY < source.height; sourceY += 1) {
      for (let sourceX = 0; sourceX < source.width; sourceX += 1) {
        const sourceByte = source.payload[sourceY * source.rowBytes + Math.floor(sourceX / 8)];
        const expectedForeground = !(sourceByte & (1 << (7 - (sourceX % 8))));
        assert.equal(
          portraitPixelAt(preset, sourceY, top + source.width - 1 - sourceX),
          expectedForeground,
          `${id} source pixel ${sourceX},${sourceY}`,
        );
      }
    }
  }
});

test("image import thresholds the physical portrait view into device storage", () => {
  const source = new Uint8ClampedArray(DISPLAY_PORTRAIT_WIDTH * DISPLAY_PORTRAIT_HEIGHT * 4);
  source.fill(255);
  source[0] = 0;
  source[1] = 0;
  source[2] = 0;
  const bitmap = artworkFromPortraitImageData(source, DISPLAY_PORTRAIT_WIDTH, DISPLAY_PORTRAIT_HEIGHT, 160);
  assert.equal(portraitPixelAt(bitmap, 0, 0), true);
  assert.equal(pixelAt(bitmap, DISPLAY_WIDTH - 1, 0), true);
  assert.equal(portraitPixelAt(bitmap, 1, 0), false);
});

test("display protocol uses IEEE CRC32 and survives fragmented serial reads", () => {
  assert.equal(crc32Ieee(new TextEncoder().encode("123456789")), 0xcbf43926);
  const payload = new Uint8Array([TRANSFER.status.ok, 0x4c]);
  const frame = createTransferFrame(TRANSFER.command.hello | 0x80, payload);
  const decoder = new TransferFrameDecoder();
  assert.deepEqual(decoder.push(frame.slice(0, 5)), []);
  assert.deepEqual(decoder.push(frame.slice(5, 12)), []);
  const [decoded] = decoder.push(frame.slice(12));
  assert.equal(decoded.command, TRANSFER.command.hello | 0x80);
  assert.deepEqual(decoded.payload, payload);
});

test("a wrong serial endpoint is closed after its handshake is rejected", async () => {
  let readableController;
  let closeCount = 0;
  const port = {
    readable: new ReadableStream({ start(controller) { readableController = controller; } }),
    writable: new WritableStream({
      write() {
        readableController.enqueue(createTransferFrame(
          TRANSFER.command.hello | 0x80,
          new Uint8Array([TRANSFER.status.ok]),
        ));
      },
    }),
    async open() {},
    async close() { closeCount += 1; },
  };
  const originalSerial = Object.getOwnPropertyDescriptor(globalThis.navigator, "serial");
  Object.defineProperty(globalThis.navigator, "serial", {
    configurable: true,
    value: { requestPort: async () => port },
  });

  try {
    await assert.rejects(DisplayArtTransfer.connect(), /incomplete display-art handshake/);
    assert.equal(closeCount, 1);
  } finally {
    if (originalSerial) Object.defineProperty(globalThis.navigator, "serial", originalSerial);
    else delete globalThis.navigator.serial;
  }
});
