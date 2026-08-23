import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DEVICE_DEFINITION, DISPLAY_PRESENTATION, FIVE_WAY_CONTROL, FIVE_WAY_IDS, POSITION_IDS, PROJECT_LAYER_IDS, PROJECT_LAYER_SOURCES, positionById, stableSerialize } from "../src/model.js";
import { PROJECT_INTENT, RUNTIME_BASELINE, fixtureWithOpaqueRecord } from "../src/fixtures.js";
import { PROJECT_FILE_VERSION, createDraftProjectIntent, parseProjectFile, revertDraftBinding, serializeProjectFile, updateDraftBinding } from "../src/project.js";
import { PHYSICAL_SCENE_LAYOUT } from "../src/scene.js";
import { validateConfiguration } from "../src/validation.js";

test("historical device fixture validates with exactly 48 unique positions", () => {
  const report = validateConfiguration({ deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE, projectIntent: PROJECT_INTENT });
  assert.equal(POSITION_IDS.length, 48);
  assert.equal(new Set(POSITION_IDS).size, 48);
  assert.deepEqual(FIVE_WAY_IDS, ["r0c9", "r1c8", "r1c9", "r1c10", "r2c9"]);
  assert.equal(report.status, "pass");
  assert.equal(report.errors.length, 0);
});

test("beginner proposal has four explicit layers linked to captured references", () => {
  assert.deepEqual(PROJECT_INTENT.layers.map((layer) => layer.id), PROJECT_LAYER_IDS);
  assert.deepEqual(Object.fromEntries(PROJECT_INTENT.layers.map((layer) => [layer.id, layer.sourceLayerId])), PROJECT_LAYER_SOURCES);
  assert.equal(PROJECT_INTENT.layers.find((layer) => layer.id === "Base").bindings.r3c4, "Numbers (hold)");
  assert.equal(PROJECT_INTENT.layers.find((layer) => layer.id === "Base").bindings.r3c5, "Space / Symbols (hold)");
  assert.equal(PROJECT_INTENT.layers.find((layer) => layer.id === "Base").bindings.r3c11, "Enter / Navigation (hold)");
  assert.equal(PROJECT_INTENT.layers.find((layer) => layer.id === "Base").bindings.r3c12, "Reserved");
  assert.equal(PROJECT_INTENT.layers.find((layer) => layer.id === "Numbers").bindings.r0c11, "7");
  assert.equal(PROJECT_INTENT.layers.find((layer) => layer.id === "Navigation").bindings.r1c1, "←");
  assert.equal(PROJECT_INTENT.layers.find((layer) => layer.id === "Symbols").bindings.r2c13, "<");
  assert.equal(PROJECT_INTENT.layers.find((layer) => layer.id === "Symbols").bindings.r2c14, ">");
  assert.equal(PROJECT_INTENT.layers.find((layer) => layer.id === "Symbols").bindings.r2c16, "`");
});

test("reference-verified scene has 42 physical keys and keeps r2c6 source-only", () => {
  assert.equal(DEVICE_DEFINITION.positions.filter((position) => position.kind === "key").length, 42);
  assert.equal(positionById("r2c6").kind, "source-only");
  assert.match(positionById("r2c6").label, /no reference-verified physical key/i);
});

test("reference-verified projection keeps portrait inner displays and one five-way cap below the right display", () => {
  assert.deepEqual(FIVE_WAY_CONTROL.positionIds, {
    up: "r0c9", left: "r1c8", press: "r1c9", right: "r1c10", down: "r2c9",
  });
  assert.ok(DISPLAY_PRESENTATION.every((display) => display.stageHeight > display.stageWidth));
  assert.ok(DISPLAY_PRESENTATION[0].stageX < DISPLAY_PRESENTATION[1].stageX);
  assert.ok(FIVE_WAY_CONTROL.stageY > DISPLAY_PRESENTATION[1].stageY + DISPLAY_PRESENTATION[1].stageHeight);
  assert.equal(DEVICE_DEFINITION.presentation.fiveWayControl, FIVE_WAY_CONTROL);
});

test("lower hardware bays remain clear of both innermost thumb keys", () => {
  for (const positionId of ["r3c5", "r3c11"]) {
    const clearance = PHYSICAL_SCENE_LAYOUT.thumbZ[positionId]
      - PHYSICAL_SCENE_LAYOUT.innerThumbProjectedHalfDepth
      - (PHYSICAL_SCENE_LAYOUT.lowerHardwareZ + PHYSICAL_SCENE_LAYOUT.lowerHardwareHalfDepth);
    assert.ok(clearance >= PHYSICAL_SCENE_LAYOUT.minimumHardwareGap, `${positionId} clearance ${clearance} is too small`);
  }
});

test("missing a five-way position fails closed", () => {
  const incompleteDefinition = { ...DEVICE_DEFINITION, positions: DEVICE_DEFINITION.positions.filter((position) => position.id !== "r1c9") };
  const report = validateConfiguration({ deviceDefinition: incompleteDefinition, runtimeSnapshot: RUNTIME_BASELINE, projectIntent: PROJECT_INTENT });
  assert.equal(report.status, "incompatible");
  assert.match(report.errors.map((error) => error.message).join(" "), /five-way pointer/i);
});

test("unknown project position fails closed", () => {
  const projectWithUnknownPosition = {
    ...PROJECT_INTENT,
    layers: PROJECT_INTENT.layers.map((layer) => layer.id === "Base" ? { ...layer, bindings: { ...layer.bindings, r9c9: "Unknown" } } : layer),
  };
  const report = validateConfiguration({ deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE, projectIntent: projectWithUnknownPosition });
  assert.equal(report.status, "incompatible");
  assert.match(report.errors.map((error) => error.message).join(" "), /unknown position/i);
});

test("draft behavior edits replace only project intent and stay non-runnable", () => {
  const draft = createDraftProjectIntent();
  const initialReport = validateConfiguration({ deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE, projectIntent: draft });
  const edited = updateDraftBinding(draft, { layerId: "Base", positionId: "r0c1", binding: "Quick action" });
  const report = validateConfiguration({ deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE, projectIntent: edited });
  assert.equal(draft.layers.find((layer) => layer.id === "Base").bindings.r0c1, "Q");
  assert.equal(edited.layers.find((layer) => layer.id === "Base").bindings.r0c1, "Quick action");
  assert.equal(RUNTIME_BASELINE.layers.find((layer) => layer.id === "QWERTY").bindings.r0c1, "Q");
  assert.equal(edited.mode, "draft-only");
  assert.equal(report.status, "pass");
  assert.equal(report.draftChangeCount, initialReport.draftChangeCount + 1);
  assert.match(report.warnings.map((warning) => warning.message).join(" "), /non-runnable draft/i);
});

test("draft editor rejects invalid targets and can revert to the captured baseline", () => {
  const draft = createDraftProjectIntent();
  assert.throws(() => updateDraftBinding(draft, { layerId: "Base", positionId: "r9c9", binding: "Test" }), /unknown project position/i);
  assert.throws(() => updateDraftBinding(draft, { layerId: "Base", positionId: "r0c1", binding: "  " }), /cannot be blank/i);
  const changed = updateDraftBinding(draft, { layerId: "Base", positionId: "r0c1", binding: "Quick action" });
  const reverted = revertDraftBinding(changed, RUNTIME_BASELINE, { layerId: "Base", positionId: "r0c1" });
  assert.equal(reverted.layers.find((layer) => layer.id === "Base").bindings.r0c1, "Q");
});

test("project-file round trip is deterministic and preserves a validated draft", () => {
  const changed = updateDraftBinding(createDraftProjectIntent(), { layerId: "Base", positionId: "r0c1", binding: "Quick action" });
  const first = serializeProjectFile(changed);
  const second = serializeProjectFile({ opaqueRecords: [], layers: changed.layers, mode: "draft-only", platform: "macOS", profileId: PROJECT_INTENT.profileId, deviceId: DEVICE_DEFINITION.id, schemaVersion: PROJECT_INTENT.schemaVersion });
  const imported = parseProjectFile(first, { deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE });
  assert.equal(first, second);
  assert.equal(imported.ok, true);
  assert.equal(imported.projectIntent.layers.find((layer) => layer.id === "Base").bindings.r0c1, "Quick action");
  assert.ok(imported.report.draftChangeCount > 0);
});

test("project-file import fails closed for malformed or incompatible data", () => {
  const malformed = parseProjectFile("not json", { deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE });
  const wrongDevice = parseProjectFile(JSON.stringify({
    format: "keebweaver-project",
    formatVersion: PROJECT_FILE_VERSION,
    projectIntent: { ...createDraftProjectIntent(), deviceId: "generic-corne" },
  }), { deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE });
  const missingPosition = parseProjectFile(JSON.stringify({
    format: "keebweaver-project",
    formatVersion: PROJECT_FILE_VERSION,
    projectIntent: {
      ...createDraftProjectIntent(),
      layers: createDraftProjectIntent().layers.map((layer) => layer.id === "Base" ? { ...layer, bindings: Object.fromEntries(Object.entries(layer.bindings).filter(([id]) => id !== "r3c4")) } : layer),
    },
  }), { deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE });
  assert.equal(malformed.ok, false);
  assert.match(malformed.message, /valid JSON/i);
  assert.equal(wrongDevice.ok, false);
  assert.match(wrongDevice.message, /different device/i);
  assert.equal(missingPosition.ok, false);
  assert.match(missingPosition.message, /missing position/i);
});

test("imported behavior labels remain inert text at the browser rendering boundary", () => {
  const payload = "</span><img src=x onerror=alert(1)>";
  const projectIntent = createDraftProjectIntent();
  projectIntent.layers.find((layer) => layer.id === "Base").bindings.r0c0 = payload;
  const imported = parseProjectFile(JSON.stringify({
    format: "keebweaver-project",
    formatVersion: PROJECT_FILE_VERSION,
    projectIntent,
  }), { deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE });
  const browserSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

  assert.equal(imported.ok, true);
  assert.equal(imported.projectIntent.layers.find((layer) => layer.id === "Base").bindings.r0c0, payload);
  assert.doesNotMatch(browserSource, /\.innerHTML\s*=|insertAdjacentHTML|document\.write|\beval\s*\(/);
  assert.match(browserSource, /bindingLabel\.textContent\s*=\s*compactBinding\(binding\)/);
  assert.match(browserSource, /positionLabel\.textContent\s*=\s*position\.id/);
});

test("opaque records are preserved and reported without a lossy pass", () => {
  const report = validateConfiguration({ deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE, projectIntent: fixtureWithOpaqueRecord() });
  assert.equal(report.status, "opaque-preserved");
  assert.equal(report.errors.length, 0);
  assert.match(report.warnings.map((warning) => warning.message).join(" "), /opaque record/i);
});

test("normalized serialization and fingerprint are deterministic despite object key order", () => {
  const first = validateConfiguration({ deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE, projectIntent: PROJECT_INTENT });
  const reorderedIntent = { opaqueRecords: [], layers: PROJECT_INTENT.layers, platform: "macOS", mode: "draft-only", profileId: PROJECT_INTENT.profileId, deviceId: DEVICE_DEFINITION.id, schemaVersion: PROJECT_INTENT.schemaVersion };
  const second = validateConfiguration({ deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE, projectIntent: reorderedIntent });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.serialization, second.serialization);
  assert.equal(stableSerialize({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
});
