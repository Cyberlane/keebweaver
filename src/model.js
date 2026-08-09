export const DEVICE_ID = "ergokeeb-corne-48-v1";

export const RUNTIME_LAYER_IDS = Object.freeze(["QWERTY", "NUMBER", "SYMBOL", "Fn"]);
export const PROJECT_LAYER_SOURCES = Object.freeze({
  Base: "QWERTY",
  Navigation: "Fn",
  Numbers: "NUMBER",
  Symbols: "SYMBOL",
});
export const PROJECT_LAYER_IDS = Object.freeze(Object.keys(PROJECT_LAYER_SOURCES));

export const SOURCE_BASELINE = Object.freeze({
  vendorConfig: "4ade934d97d9f696753aa4185998c2d7b92ee293",
  zmkRange: [
    "f1b944b1efc01805a769cb2b15797c2c611bcc5f",
    "461f5c832fb8854d87dca54d113d306323697219",
  ],
  zephyr: "0fa4cc26d8b1e5243570ccc0f7f66c4c428d2961",
});

const FIVE_WAY_LABELS = Object.freeze({
  r0c9: "Pointer up",
  r1c8: "Pointer left",
  r1c9: "Pointer click",
  r1c10: "Pointer right",
  r2c9: "Pointer down",
});

const SOURCE_ONLY_LABELS = Object.freeze({
  r2c6: "Source-only Space position; no reference-verified physical key",
});

const POSITION_COORDINATES = [
  [0, 0, 0, 0.37], [0, 1, 1, 0.37], [0, 2, 2, 0.12], [0, 3, 3, 0], [0, 4, 4, 0.12], [0, 5, 5, 0.24], [0, 9, 9.25, 0.24], [0, 11, 11.5, 0.24], [0, 12, 12.5, 0.12], [0, 13, 13.5, 0], [0, 14, 14.5, 0.12], [0, 15, 15.5, 0.37], [0, 16, 16.5, 0.37],
  [1, 0, 0, 1.37], [1, 1, 1, 1.37], [1, 2, 2, 1.12], [1, 3, 3, 1], [1, 4, 4, 1.12], [1, 5, 5, 1.24], [1, 8, 8.25, 1.24], [1, 9, 9.25, 1.24], [1, 10, 10.25, 1.24], [1, 11, 11.5, 1.24], [1, 12, 12.5, 1.12], [1, 13, 13.5, 1], [1, 14, 14.5, 1.12], [1, 15, 15.5, 1.37], [1, 16, 16.5, 1.37],
  [2, 0, 0, 2.37], [2, 1, 1, 2.37], [2, 2, 2, 2.12], [2, 3, 3, 2], [2, 4, 4, 2.12], [2, 5, 5, 2.24], [2, 6, 6.25, 2.24], [2, 9, 9.25, 2.24], [2, 11, 11.5, 2.24], [2, 12, 12.5, 2.12], [2, 13, 13.5, 2], [2, 14, 14.5, 2.12], [2, 15, 15.5, 2.37], [2, 16, 16.5, 2.37],
  [3, 3, 3.5, 3.12], [3, 4, 4.5, 3.12, 12, 4.5, 4.12], [3, 5, 5.5, 3.12, 24, 5.15, 4.33], [3, 11, 11, 3.12, -24, 12.3, 4.33], [3, 12, 12, 3.12, -12, 13, 4.12], [3, 13, 13, 3.12],
];

export const POSITIONS = Object.freeze(POSITION_COORDINATES.map(([row, col, x, y, rotation = 0, rotationX, rotationY]) => {
  const id = `r${row}c${col}`;
  const kind = FIVE_WAY_LABELS[id] ? "five-way" : SOURCE_ONLY_LABELS[id] ? "source-only" : "key";
  return Object.freeze({
    id,
    row,
    col,
    x,
    y,
    rotation,
    rotationX: rotationX ?? x,
    rotationY: rotationY ?? y,
    side: x < 8 ? "left" : "right",
    kind,
    label: FIVE_WAY_LABELS[id] ?? SOURCE_ONLY_LABELS[id] ?? null,
  });
}));

export const POSITION_IDS = Object.freeze(POSITIONS.map((position) => position.id));
export const FIVE_WAY_IDS = Object.freeze(POSITIONS.filter((position) => position.kind === "five-way").map((position) => position.id));

// Visual-reference metadata only. These measurements project the physical
// keyboard photos into the visual stage; they are not electrical or firmware
// facts. The physical reference shows the 160x68 panels mounted in portrait
// orientation in normal typing position.
export const DISPLAY_PRESENTATION = Object.freeze([
  Object.freeze({ side: "left", stageX: 0.358, stageY: 0.08, stageWidth: 0.078, stageHeight: 0.5, bezelRotation: 0, screenRotation: 0, confidence: "reference-verified-physical-layout" }),
  Object.freeze({ side: "right", stageX: 0.492, stageY: 0.08, stageWidth: 0.078, stageHeight: 0.5, bezelRotation: 0, screenRotation: 0, confidence: "reference-verified-physical-layout" }),
]);

export const FIVE_WAY_CONTROL = Object.freeze({
  id: "right-five-way",
  positionIds: Object.freeze({
    up: "r0c9",
    left: "r1c8",
    press: "r1c9",
    right: "r1c10",
    down: "r2c9",
  }),
  stageX: 0.49,
  stageY: 0.605,
  confidence: "reference-verified physical layout; source-correlated matrix actions",
});

export const DEVICE_DEFINITION = Object.freeze({
  id: DEVICE_ID,
  schemaVersion: 1,
  sourceBaseline: SOURCE_BASELINE,
  positions: POSITIONS,
  roles: Object.freeze({ left: "central", right: "peripheral" }),
  displays: Object.freeze([
    Object.freeze({ side: "left", kind: "nice_view", width: 160, height: 68, confidence: "source-correlated" }),
    Object.freeze({ side: "right", kind: "nice_view", width: 160, height: 68, confidence: "source-correlated" }),
  ]),
  presentation: Object.freeze({ displays: DISPLAY_PRESENTATION, fiveWayControl: FIVE_WAY_CONTROL }),
  capabilities: Object.freeze({
    usb: "left-only",
    bluetooth: "both-halves",
    studio: "left-only",
    rgb: "source-correlated",
    battery: "source-correlated",
    pointer: "five-way-matrix",
    leftEncoder: "needs-physical-verification",
  }),
});

export function positionById(id) {
  return POSITIONS.find((position) => position.id === id) ?? null;
}

export function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableSerialize(value) {
  return JSON.stringify(stableValue(value));
}

export function fingerprint(value) {
  const text = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a-${hash.toString(16).padStart(8, "0")}`;
}
