import { DEVICE_DEFINITION, POSITION_IDS, PROJECT_LAYER_SOURCES } from "./model.js";

function layerBindings(overrides) {
  return Object.fromEntries(POSITION_IDS.map((id) => [id, overrides[id] ?? "Transparent"]));
}

const qwerty = layerBindings({
  r0c0: "Tab", r0c1: "Q", r0c2: "W", r0c3: "E", r0c4: "R", r0c5: "T", r0c9: "Pointer ↑", r0c11: "Y", r0c12: "U", r0c13: "I", r0c14: "O", r0c15: "P", r0c16: "Backspace",
  r1c0: "Shift / Caps", r1c1: "A", r1c2: "S", r1c3: "D", r1c4: "F", r1c5: "G", r1c8: "Pointer ←", r1c9: "Pointer click", r1c10: "Pointer →", r1c11: "H", r1c12: "J", r1c13: "K", r1c14: "L", r1c15: ";", r1c16: "'",
  r2c0: "Control", r2c1: "Z", r2c2: "X", r2c3: "C", r2c4: "V", r2c5: "B", r2c6: "Space", r2c9: "Pointer ↓", r2c11: "N", r2c12: "M", r2c13: ",", r2c14: ".", r2c15: "/", r2c16: "Escape",
  r3c3: "Command", r3c4: "Number", r3c5: "Symbol / Space", r3c11: "Symbol / Enter", r3c12: "Fn", r3c13: "Option",
});

const number = layerBindings({
  r0c1: "1", r0c2: "2", r0c3: "3", r0c4: "4", r0c5: "5", r0c9: "Pointer ↑", r0c11: "6", r0c12: "7", r0c13: "8", r0c14: "9", r0c15: "0", r0c16: "Backspace",
  r1c1: "Clear BT", r1c2: "BT 0", r1c3: "BT 1", r1c4: "BT 2", r1c5: "BT 3", r1c8: "Pointer ←", r1c9: "Pointer click", r1c10: "Pointer →", r1c11: "←", r1c12: "↓", r1c13: "↑", r1c14: "→", r1c15: "Home", r1c16: "Page Up",
  r2c1: "RGB off", r2c2: "RGB on", r2c5: "RGB effect", r2c6: "Mute", r2c9: "Pointer ↓", r2c11: "RGB reverse", r2c12: "RGB speed", r2c13: "RGB brighter", r2c14: "RGB dimmer", r2c15: "End", r2c16: "Page Down",
  r3c11: "Insert", r3c12: "Delete",
});

const symbol = layerBindings({
  r0c1: "!", r0c2: "@", r0c3: "#", r0c4: "$", r0c5: "%", r0c9: "Pointer ↑", r0c11: "^", r0c12: "&", r0c13: "*", r0c14: "(", r0c15: ")", r0c16: "Backspace",
  r1c1: "Clear BT", r1c2: "Mouse left", r1c3: "Mouse middle", r1c4: "Mouse right", r1c5: "Mouse 4", r1c8: "Pointer ←", r1c9: "Pointer click", r1c10: "Pointer →", r1c11: "-", r1c12: "=", r1c13: "[", r1c14: "]", r1c15: "\\", r1c16: "`",
  r2c1: "USB", r2c2: "Bluetooth", r2c5: "Mouse 5", r2c9: "Pointer ↓", r2c11: "_", r2c12: "+", r2c13: "{", r2c14: "}", r2c15: "|", r2c16: "~",
  r3c5: "Space", r3c11: "Enter",
});

const fn = layerBindings({
  r0c0: "Studio unlock", r0c1: "F1", r0c2: "F2", r0c3: "F3", r0c4: "F4", r0c5: "F5", r0c9: "Pointer ↑", r0c11: "F6", r0c12: "F7", r0c13: "F8", r0c14: "F9", r0c15: "F10", r0c16: "F11",
  r1c2: "Mouse left", r1c3: "Mouse middle", r1c4: "Mouse right", r1c5: "Mouse 4", r1c8: "Pointer ←", r1c9: "Pointer click", r1c10: "Pointer →", r1c11: "Bootloader", r1c12: "Mouse left", r1c13: "Mouse middle", r1c14: "Mouse right", r1c15: "Print Screen", r1c16: "F12",
  r2c1: "System reset", r2c3: "Bootloader", r2c5: "Mouse 5", r2c6: "Mute", r2c9: "Pointer ↓", r2c13: "Bootloader", r2c14: "System reset", r2c15: "Scroll Lock", r2c16: "Pause",
});

const pointerBindings = Object.freeze({
  r0c9: "Pointer ↑",
  r1c8: "Pointer ←",
  r1c9: "Pointer click",
  r1c10: "Pointer →",
  r2c9: "Pointer ↓",
});

function proposalBindings(overrides) {
  return layerBindings({ ...pointerBindings, ...overrides });
}

// Conservative beginner proposal: familiar QWERTY, three distinct momentary
// thumb layers, and no app-specific macro or pointer-mode learning burden.
const beginnerBase = {
  ...qwerty,
  r3c4: "Numbers (hold)",
  r3c5: "Space / Symbols (hold)",
  r3c11: "Enter / Navigation (hold)",
  r3c12: "Reserved",
};

const beginnerNavigation = proposalBindings({
  r0c1: "Word left", r0c2: "Word right", r0c3: "Home", r0c4: "End", r0c5: "Page up",
  r1c1: "←", r1c2: "↓", r1c3: "↑", r1c4: "→", r1c5: "Page down",
  r2c1: "Undo", r2c2: "Cut", r2c3: "Copy", r2c4: "Paste", r2c5: "Redo",
});

const beginnerNumbers = proposalBindings({
  r0c11: "7", r0c12: "8", r0c13: "9", r0c14: "/", r0c15: "Backspace", r0c16: "Delete",
  r1c11: "4", r1c12: "5", r1c13: "6", r1c14: "*", r1c15: "Home", r1c16: "Page up",
  r2c11: "1", r2c12: "2", r2c13: "3", r2c14: "-", r2c15: "End", r2c16: "Page down",
  r3c11: "0", r3c12: ".", r3c13: "+",
});

const beginnerSymbols = proposalBindings({
  r0c11: "!", r0c12: "@", r0c13: "#", r0c14: "$", r0c15: "%", r0c16: "Backspace",
  r1c11: "(", r1c12: ")", r1c13: "[", r1c14: "]", r1c15: "{", r1c16: "}",
  r2c11: "-", r2c12: "=", r2c13: "<", r2c14: ">", r2c15: "\\", r2c16: "`",
  r3c11: "Enter", r3c12: "'", r3c13: "\"",
});

export const RUNTIME_BASELINE = Object.freeze({
  schemaVersion: 1,
  deviceId: DEVICE_DEFINITION.id,
  captureKind: "zmk-studio-read-only",
  layers: Object.freeze([
    Object.freeze({ id: "QWERTY", name: "QWERTY", color: "red", description: "Captured base layer · read only", bindings: qwerty }),
    Object.freeze({ id: "NUMBER", name: "NUMBER", color: "amber", description: "Captured numbers and navigation layer · read only", bindings: number }),
    Object.freeze({ id: "SYMBOL", name: "SYMBOL", color: "cyan", description: "Captured symbols and mouse layer · read only", bindings: symbol }),
    Object.freeze({ id: "Fn", name: "Fn", color: "violet", description: "Captured function and system layer · read only", bindings: fn }),
  ]),
  persistentState: Object.freeze({ captured: true, editable: false }),
  opaqueRecords: Object.freeze([]),
});

export const PROJECT_INTENT = Object.freeze({
  schemaVersion: 2,
  profileId: "macos-beginner-v1",
  deviceId: DEVICE_DEFINITION.id,
  platform: "macOS",
  // This is a proposal record, deliberately separate from the captured
  // persistent Studio state above. It is never treated as device output.
  mode: "draft-only",
  layers: Object.freeze([
    Object.freeze({ id: "Base", sourceLayerId: PROJECT_LAYER_SOURCES.Base, bindings: beginnerBase }),
    Object.freeze({ id: "Navigation", sourceLayerId: PROJECT_LAYER_SOURCES.Navigation, bindings: beginnerNavigation }),
    Object.freeze({ id: "Numbers", sourceLayerId: PROJECT_LAYER_SOURCES.Numbers, bindings: beginnerNumbers }),
    Object.freeze({ id: "Symbols", sourceLayerId: PROJECT_LAYER_SOURCES.Symbols, bindings: beginnerSymbols }),
  ]),
  opaqueRecords: Object.freeze([]),
});

export function fixtureWithOpaqueRecord() {
  return {
    ...PROJECT_INTENT,
    opaqueRecords: [{ type: "custom-devicetree-behavior", source: "&future_behavior", raw: "<opaque>" }],
  };
}
