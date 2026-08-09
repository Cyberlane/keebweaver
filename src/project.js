import { PROJECT_INTENT } from "./fixtures.js";
import { stableSerialize } from "./model.js";
import { validateConfiguration } from "./validation.js";

export const PROJECT_FILE_FORMAT = "keebweaver-project";
export const PROJECT_FILE_VERSION = 1;

function cloneBindings(bindings) {
  return { ...bindings };
}

function cloneRecords(records = []) {
  return records.map((record) => ({ ...record }));
}

/**
 * Creates a mutable-by-replacement proposal record. The captured Studio
 * baseline is never mutated or used as an output target.
 */
export function createDraftProjectIntent(seed = PROJECT_INTENT) {
  return {
    schemaVersion: seed.schemaVersion,
    profileId: seed.profileId,
    deviceId: seed.deviceId,
    platform: seed.platform,
    mode: "draft-only",
    layers: seed.layers.map((layer) => ({ id: layer.id, sourceLayerId: layer.sourceLayerId, bindings: cloneBindings(layer.bindings) })),
    opaqueRecords: cloneRecords(seed.opaqueRecords),
  };
}

function requireDraftTarget(intent, layerId, positionId) {
  const layer = intent.layers.find((candidate) => candidate.id === layerId);
  if (!layer) throw new RangeError(`Unknown project layer: ${layerId}`);
  if (!(positionId in layer.bindings)) throw new RangeError(`Unknown project position: ${positionId}`);
  return layer;
}

function cleanBinding(binding) {
  if (typeof binding !== "string") throw new TypeError("Draft behavior labels must be text.");
  const cleaned = binding.trim().replace(/\s+/g, " ");
  if (!cleaned) throw new RangeError("Draft behavior labels cannot be blank.");
  if (cleaned.length > 80) throw new RangeError("Draft behavior labels are limited to 80 characters.");
  return cleaned;
}

export function updateDraftBinding(intent, { layerId, positionId, binding }) {
  requireDraftTarget(intent, layerId, positionId);
  const nextBinding = cleanBinding(binding);
  return {
    ...intent,
    mode: "draft-only",
    layers: intent.layers.map((layer) => layer.id === layerId
      ? { ...layer, bindings: { ...layer.bindings, [positionId]: nextBinding } }
      : layer),
  };
}

export function revertDraftBinding(intent, runtimeSnapshot, { layerId, positionId }) {
  const draftLayer = requireDraftTarget(intent, layerId, positionId);
  const runtimeLayer = runtimeSnapshot.layers.find((layer) => layer.id === draftLayer.sourceLayerId);
  if (!runtimeLayer || !(positionId in runtimeLayer.bindings)) {
    throw new RangeError(`No captured reference exists for ${layerId} / ${positionId}.`);
  }
  return updateDraftBinding(intent, { layerId, positionId, binding: runtimeLayer.bindings[positionId] });
}

export function projectFileEnvelope(intent) {
  return {
    format: PROJECT_FILE_FORMAT,
    formatVersion: PROJECT_FILE_VERSION,
    projectIntent: intent,
  };
}

export function serializeProjectFile(intent) {
  return stableSerialize(projectFileEnvelope(intent));
}

function isImportableShape(intent) {
  return Boolean(intent)
    && typeof intent === "object"
    && !Array.isArray(intent)
    && Array.isArray(intent.layers)
    && Array.isArray(intent.opaqueRecords)
    && intent.layers.every((layer) => layer && typeof layer === "object" && !Array.isArray(layer) && layer.bindings && typeof layer.bindings === "object" && !Array.isArray(layer.bindings));
}

/**
 * Parse a user-selected local project document. Imported data is accepted only
 * after it validates against the immutable device definition and the separately
 * captured runtime snapshot. It has no route to firmware or device state.
 */
export function parseProjectFile(text, { deviceDefinition, runtimeSnapshot }) {
  if (typeof text !== "string") return { ok: false, message: "Project files must be text JSON." };
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    return { ok: false, message: "Project file is not valid JSON." };
  }
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return { ok: false, message: "Project file must contain an object envelope." };
  }
  if (envelope.format !== PROJECT_FILE_FORMAT || envelope.formatVersion !== PROJECT_FILE_VERSION) {
    return { ok: false, message: "Project file format or version is not supported." };
  }
  if (!isImportableShape(envelope.projectIntent)) {
    return { ok: false, message: "Project file has no complete project-intent record." };
  }

  const report = validateConfiguration({ deviceDefinition, runtimeSnapshot, projectIntent: envelope.projectIntent });
  if (report.status === "incompatible") {
    return { ok: false, message: report.errors.map((error) => error.message).join(" "), report };
  }
  return { ok: true, projectIntent: createDraftProjectIntent(envelope.projectIntent), report };
}
