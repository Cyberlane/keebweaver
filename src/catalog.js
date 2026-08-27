import { PROJECT_INTENT, RUNTIME_BASELINE } from "./fixtures.js";
import { DEVICE_DEFINITION } from "./model.js";

export const DEVICE_CATALOG = Object.freeze([
  Object.freeze({
    id: DEVICE_DEFINITION.id,
    name: "ErgoKeeb Eyelash Corne",
    status: "verified-reference-target",
    definition: DEVICE_DEFINITION,
    runtimeBaseline: RUNTIME_BASELINE,
  }),
]);

export const PROFILE_CATALOG = Object.freeze([
  Object.freeze({
    id: "macos-beginner-v1",
    name: "macOS Beginner",
    description: "Familiar QWERTY with dedicated Navigation, Numbers, and Symbols thumb layers plus five Bluetooth host selectors.",
    deviceId: DEVICE_DEFINITION.id,
    intent: PROJECT_INTENT,
  }),
]);

export const DEFAULT_DEVICE = DEVICE_CATALOG[0];
export const DEFAULT_PROFILE = PROFILE_CATALOG[0];

export function deviceCatalogEntry(id) {
  return DEVICE_CATALOG.find((entry) => entry.id === id) ?? null;
}

export function profileCatalogEntry(id, deviceId) {
  return PROFILE_CATALOG.find((entry) => entry.id === id && (!deviceId || entry.deviceId === deviceId)) ?? null;
}
