import { fingerprint, stableSerialize } from "./model.js";

function record(type, message) {
  return { type, message };
}

function uniqueNonBlank(values) {
  return values.length > 0
    && values.every((value) => typeof value === "string" && value.trim())
    && new Set(values).size === values.length;
}

function validateBindingMaps(layers, label, positionIds, errors) {
  for (const layer of layers) {
    if (!layer?.bindings || typeof layer.bindings !== "object" || Array.isArray(layer.bindings)) {
      errors.push(record("error", `${label} ${layer?.id ?? "unknown"} is missing its binding map.`));
      continue;
    }
    const bindingIds = Object.keys(layer.bindings);
    const unknownPositions = bindingIds.filter((id) => !positionIds.includes(id));
    const missingPositions = positionIds.filter((id) => !(id in layer.bindings));
    const invalidBindings = bindingIds.filter((id) => typeof layer.bindings[id] !== "string" || !layer.bindings[id].trim());
    if (unknownPositions.length) errors.push(record("error", `${label} ${layer.id} contains unknown position IDs: ${unknownPositions.join(", ")}.`));
    if (missingPositions.length) errors.push(record("error", `${label} ${layer.id} is missing position IDs: ${missingPositions.join(", ")}.`));
    if (invalidBindings.length) errors.push(record("error", `${label} ${layer.id} contains blank or non-text behavior labels: ${invalidBindings.join(", ")}.`));
  }
}

function countDraftChanges(runtimeSnapshot, projectIntent, positionIds) {
  return projectIntent.layers.reduce((count, intentLayer) => {
    const runtimeLayer = runtimeSnapshot.layers.find((layer) => layer.id === intentLayer.sourceLayerId);
    if (!runtimeLayer) return count;
    return count + positionIds.filter((id) => runtimeLayer.bindings[id] !== intentLayer.bindings[id]).length;
  }, 0);
}

export function normalizedRecord({ deviceDefinition, runtimeSnapshot, projectIntent }) {
  return {
    device: {
      id: deviceDefinition.id,
      positions: deviceDefinition.positions.map(({ id, row, col, x, y, rotation, side, kind }) => ({ id, row, col, x, y, rotation, side, kind })),
      roles: deviceDefinition.roles,
      displays: deviceDefinition.displays,
      capabilities: deviceDefinition.capabilities,
      sourceBaseline: deviceDefinition.sourceBaseline,
    },
    runtime: {
      deviceId: runtimeSnapshot.deviceId,
      captureKind: runtimeSnapshot.captureKind,
      layers: runtimeSnapshot.layers.map((layer) => ({ id: layer.id, bindings: layer.bindings })),
      opaqueRecords: runtimeSnapshot.opaqueRecords,
    },
    intent: {
      schemaVersion: projectIntent.schemaVersion,
      profileId: projectIntent.profileId,
      deviceId: projectIntent.deviceId,
      mode: projectIntent.mode,
      platform: projectIntent.platform,
      layers: projectIntent.layers,
      opaqueRecords: projectIntent.opaqueRecords,
    },
  };
}

/**
 * Validate one selected device, captured baseline, and profile. Device-specific
 * requirements live in the selected catalog entry rather than in this engine.
 */
export function validateConfiguration({ deviceDefinition, runtimeSnapshot, projectIntent }) {
  const errors = [];
  const warnings = [];

  if (!deviceDefinition || typeof deviceDefinition !== "object") {
    throw new TypeError("A device definition is required.");
  }
  if (!runtimeSnapshot || typeof runtimeSnapshot !== "object") {
    throw new TypeError("A runtime snapshot is required.");
  }
  if (!projectIntent || typeof projectIntent !== "object") {
    throw new TypeError("A project intent is required.");
  }

  if (typeof deviceDefinition.id !== "string" || !deviceDefinition.id.trim()) errors.push(record("error", "Device definition has no stable ID."));
  if (runtimeSnapshot.deviceId !== deviceDefinition.id) errors.push(record("error", "Runtime snapshot belongs to a different device definition."));
  if (projectIntent.deviceId !== deviceDefinition.id) errors.push(record("error", "Project intent belongs to a different device definition."));

  const positions = Array.isArray(deviceDefinition.positions) ? deviceDefinition.positions : [];
  const positionIds = positions.map((position) => position?.id);
  if (!uniqueNonBlank(positionIds)) errors.push(record("error", "Device position IDs must be non-empty and unique."));

  const fiveWayIds = positions.filter((position) => position.kind === "five-way").map((position) => position.id);
  const declaredFiveWayIds = Object.values(deviceDefinition.presentation?.fiveWayControl?.positionIds ?? {});
  if (declaredFiveWayIds.length && (!uniqueNonBlank(declaredFiveWayIds) || declaredFiveWayIds.some((id) => !fiveWayIds.includes(id)))) {
    errors.push(record("error", "One or more declared five-way pointer positions are missing from the device geometry."));
  }

  const runtimeLayers = Array.isArray(runtimeSnapshot.layers) ? runtimeSnapshot.layers : [];
  const runtimeLayerIds = runtimeLayers.map((layer) => layer?.id);
  if (!uniqueNonBlank(runtimeLayerIds)) errors.push(record("error", "Runtime layer IDs must be non-empty and unique."));

  const projectLayers = Array.isArray(projectIntent.layers) ? projectIntent.layers : [];
  const projectLayerIds = projectLayers.map((layer) => layer?.id);
  if (!uniqueNonBlank(projectLayerIds)) errors.push(record("error", "Project layer IDs must be non-empty and unique."));
  for (const layer of projectLayers) {
    if (!runtimeLayerIds.includes(layer.sourceLayerId)) {
      errors.push(record("error", `${layer?.id ?? "Unknown layer"} refers to a missing runtime source layer.`));
    }
  }

  if (!Number.isInteger(projectIntent.schemaVersion) || projectIntent.schemaVersion < 1) errors.push(record("error", "Project intent schema version is not supported."));
  if (projectIntent.mode !== "draft-only") errors.push(record("error", "Project intent is not marked as a non-runnable draft."));
  if (typeof projectIntent.platform !== "string" || !projectIntent.platform.trim()) errors.push(record("error", "Project intent must declare a target platform."));

  validateBindingMaps(runtimeLayers, "Runtime baseline", positionIds, errors);
  validateBindingMaps(projectLayers, "Project intent", positionIds, errors);

  const opaqueRecords = [...(runtimeSnapshot.opaqueRecords ?? []), ...(projectIntent.opaqueRecords ?? [])];
  const draftChangeCount = countDraftChanges(runtimeSnapshot, projectIntent, positionIds);
  if (opaqueRecords.length) warnings.push(record("warning", `${opaqueRecords.length} opaque record(s) preserved; lossy export must remain disabled.`));

  if (!errors.length) {
    warnings.push(record("pass", `${positionIds.length}-position device geometry and capability model accepted.`));
    warnings.push(record("pass", "Runtime snapshot and project intent remain separate records."));
    if (draftChangeCount) warnings.push(record("note", `${draftChangeCount} proposed behavior label(s) differ from the captured baseline; this remains a local, non-runnable draft.`));
  }

  const normalized = normalizedRecord({ deviceDefinition, runtimeSnapshot, projectIntent });
  const status = errors.length ? "incompatible" : opaqueRecords.length ? "opaque-preserved" : "pass";
  return { status, errors, warnings, draftChangeCount, fingerprint: fingerprint(normalized), serialization: stableSerialize(normalized), normalized };
}
