import { DEFAULT_DEVICE, DEFAULT_PROFILE } from "./catalog.js";
import { positionById } from "./model.js";
import {
  DISPLAY_ART_BYTES,
  DISPLAY_PORTRAIT_HEIGHT,
  DISPLAY_PORTRAIT_WIDTH,
  DISPLAY_PRESETS,
  artworkFromPortraitImageData,
  artworkFromPreset,
  cloneArtwork,
  invertArtwork,
  portraitImageDataForArtwork,
  setPortraitPixel,
} from "./display-art.js";
import { DisplayArtTransfer } from "./display-transfer.js";
import { createDraftProjectIntent, parseProjectFile, revertDraftBinding, serializeProjectFile, updateDraftBinding } from "./project.js";
import { createKeyboardScene } from "./scene.js";
import { validateConfiguration } from "./validation.js";

const keyboard = document.querySelector("#keyboard");
const layerTabs = document.querySelector("#layer-tabs");
const layerDescription = document.querySelector("#layer-description");
const inspector = document.querySelector("#key-inspector");
const validationStatus = document.querySelector("#validation-status");
const validationList = document.querySelector("#validation-list");
const fingerprint = document.querySelector("#validation-fingerprint");
const serializationPanel = document.querySelector("#serialization-panel");
const serializationOutput = document.querySelector("#serialization-output");
const sceneSelectedId = document.querySelector("#scene-selected-id");
const sceneSelectedBinding = document.querySelector("#scene-selected-binding");
const draftEditorForm = document.querySelector("#draft-editor-form");
const draftBindingInput = document.querySelector("#draft-binding");
const draftTarget = document.querySelector("#draft-target");
const draftBaselineBinding = document.querySelector("#draft-baseline-binding");
const draftEditorFeedback = document.querySelector("#draft-editor-feedback");
const projectFileInput = document.querySelector("#project-file-input");
const displayPresetGrid = document.querySelector("#display-preset-grid");
const displayArtCanvas = document.querySelector("#display-art-canvas");
const artByteCount = document.querySelector("#art-byte-count");
const artPenButton = document.querySelector("#art-pen-button");
const artEraserButton = document.querySelector("#art-eraser-button");
const artBrushSize = document.querySelector("#art-brush-size");
const artInvertButton = document.querySelector("#art-invert-button");
const artClearButton = document.querySelector("#art-clear-button");
const artImageInput = document.querySelector("#art-image-input");
const artImportButton = document.querySelector("#art-import-button");
const artDownloadButton = document.querySelector("#art-download-button");
const artThreshold = document.querySelector("#art-threshold");
const artEditorFeedback = document.querySelector("#art-editor-feedback");
const artConnectButton = document.querySelector("#art-connect-button");
const artConnectionStatus = document.querySelector("#art-connection-status");
const artUploadButton = document.querySelector("#art-upload-button");
const artDisconnectButton = document.querySelector("#art-disconnect-button");
const artUploadProgress = document.querySelector("#art-upload-progress");
const homebrewCopyButton = document.querySelector("#copy-homebrew-command");
const homebrewCommand = document.querySelector("#homebrew-command");
const homebrewCopyStatus = document.querySelector("#homebrew-copy-status");

const DEVICE_DEFINITION = DEFAULT_DEVICE.definition;
const RUNTIME_BASELINE = DEFAULT_DEVICE.runtimeBaseline;

let selectedLayerId = "Base";
let selectedPositionId = "r3c5";
let projectIntent = createDraftProjectIntent(DEFAULT_PROFILE.intent);
let draftFeedback = `${DEFAULT_PROFILE.name} loaded: QWERTY base, clear thumb-held layers, and no app-specific macros.`;
let draftFeedbackIsError = false;
let sceneController = null;
let selectedDisplaySide = "left";
let displayArtwork = { left: artworkFromPreset("summit"), right: artworkFromPreset("layer-card") };
let artworkTool = "draw";
let artworkDrawing = false;
let importedArtwork = null;
let selectedArtworkPreset = { left: "summit", right: "layer-card" };
let displayTransfer = null;
let artworkFeedback = "Choose a gallery design, import an image, or draw directly. The 3D keyboard previews both display images.";
let artworkFeedbackIsError = false;

function selectedRuntimeLayer() {
  return RUNTIME_BASELINE.layers.find((layer) => layer.id === selectedDraftLayer().sourceLayerId);
}

function selectedDraftLayer() {
  return projectIntent.layers.find((layer) => layer.id === selectedLayerId);
}

// The renderer needs display-copy metadata, but that belongs to the captured
// baseline rather than the intentionally minimal project record. Only the
// draft bindings flow into this presentation projection.
function selectedPresentationLayer() {
  const draftLayer = selectedDraftLayer();
  const runtimeLayer = selectedRuntimeLayer();
  return {
    ...runtimeLayer,
    id: draftLayer.id,
    name: draftLayer.id,
    description: `${draftLayer.id} beginner proposal · captured reference ${runtimeLayer.name}`,
    bindings: draftLayer.bindings,
  };
}

function compactBinding(binding) {
  return binding
    .replace("Pointer ", "")
    .replace("Transparent", "·")
    .replace("Shift / Caps", "Shift")
    .replace("Symbol / ", "Sym/");
}

function selectPosition(positionId) {
  selectedPositionId = positionId;
  render();
}

function renderLayerTabs() {
  layerTabs.replaceChildren(...projectIntent.layers.map((layer) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "layer-tab";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(layer.id === selectedLayerId));
    button.textContent = layer.id;
    button.addEventListener("click", () => {
      selectedLayerId = layer.id;
      render();
    });
    return button;
  }));
}

function renderKeyboard() {
  const baselineLayer = selectedRuntimeLayer();
  const draftLayer = selectedDraftLayer();
  keyboard.replaceChildren(...DEVICE_DEFINITION.positions.map((position) => {
    const button = document.createElement("button");
    const binding = draftLayer.bindings[position.id];
    const baselineBinding = baselineLayer.bindings[position.id];
    button.type = "button";
    button.className = `accessible-key${position.kind === "five-way" ? " is-pointer" : ""}${position.kind === "source-only" ? " is-source-only" : ""}${position.id === selectedPositionId ? " is-selected" : ""}`;
    button.setAttribute("aria-pressed", String(position.id === selectedPositionId));
    button.setAttribute("aria-label", `${position.id}, ${position.label ?? "key"}, proposed ${binding}, captured baseline ${baselineBinding}`);
    const bindingLabel = document.createElement("span");
    bindingLabel.textContent = compactBinding(binding);
    const positionLabel = document.createElement("span");
    positionLabel.className = "key-id";
    positionLabel.textContent = position.id;
    button.replaceChildren(bindingLabel, positionLabel);
    button.addEventListener("click", () => selectPosition(position.id));
    return button;
  }));
}

function renderInspector() {
  const position = positionById(selectedPositionId);
  const baselineBinding = selectedRuntimeLayer().bindings[position.id];
  const draftBinding = selectedDraftLayer().bindings[position.id];
  const values = [
    ["Position", position.id],
    ["Proposed layer", selectedDraftLayer().id],
    ["Captured reference", `${selectedRuntimeLayer().name} · ${baselineBinding}`],
    ["Proposed draft", draftBinding],
    ["Control", position.kind === "five-way" ? position.label : position.kind === "source-only" ? "Source-only position · no physical key" : "Matrix key"],
    ["Side", position.side],
    ["Geometry", `x ${position.x}, y ${position.y}, ${position.rotation}°`],
    ["Edit state", "Local draft only · no export or device path"],
  ];
  inspector.replaceChildren(...values.flatMap(([term, description]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = description;
    return [dt, dd];
  }));
}

function renderDraftEditor() {
  const baselineBinding = selectedRuntimeLayer().bindings[selectedPositionId];
  const draftBinding = selectedDraftLayer().bindings[selectedPositionId];
  draftTarget.textContent = selectedPositionId;
  draftBindingInput.value = draftBinding;
  draftBaselineBinding.textContent = baselineBinding;
  draftEditorFeedback.textContent = draftFeedback;
  draftEditorFeedback.className = `draft-feedback${draftFeedbackIsError ? " is-error" : ""}`;
}

function renderValidation() {
  const report = validateConfiguration({ deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE, projectIntent });
  validationStatus.textContent = report.status === "pass" && report.draftChangeCount ? "valid draft" : report.status.replace("-", " ");
  validationStatus.className = `validation-status${report.status === "incompatible" ? " is-error" : report.status === "opaque-preserved" ? " is-warning" : ""}`;
  validationList.replaceChildren(...[...report.errors, ...report.warnings].map((item) => {
    const li = document.createElement("li");
    li.className = item.type === "pass" ? "" : item.type;
    li.textContent = item.message;
    return li;
  }));
  fingerprint.textContent = `normalized local-draft fingerprint · ${report.fingerprint}`;
  serializationOutput.textContent = JSON.stringify(report.normalized, null, 2);
}

function renderPresentation() {
  const baselineLayer = selectedRuntimeLayer();
  const presentationLayer = selectedPresentationLayer();
  layerDescription.textContent = `${presentationLayer.description}. The captured baseline remains unchanged.`;
  sceneSelectedId.textContent = selectedPositionId;
  sceneSelectedBinding.textContent = presentationLayer.bindings[selectedPositionId];
  sceneController?.update({ layer: presentationLayer, selectedPositionId });
}

function activeArtwork() {
  return displayArtwork[selectedDisplaySide];
}

function renderArtworkToCanvas(canvas, artwork) {
  const context = canvas.getContext("2d");
  const image = context.createImageData(DISPLAY_PORTRAIT_WIDTH, DISPLAY_PORTRAIT_HEIGHT);
  image.data.set(portraitImageDataForArtwork(artwork));
  context.putImageData(image, 0, 0);
}

function setArtworkFeedback(message, isError = false) {
  artworkFeedback = message;
  artworkFeedbackIsError = isError;
}

function renderArtworkStudio() {
  renderArtworkToCanvas(displayArtCanvas, activeArtwork());
  artByteCount.textContent = `${DISPLAY_ART_BYTES.toLocaleString()} bytes`;
  artPenButton.classList.toggle("is-active", artworkTool === "draw");
  artPenButton.setAttribute("aria-pressed", String(artworkTool === "draw"));
  artEraserButton.classList.toggle("is-active", artworkTool === "erase");
  artEraserButton.setAttribute("aria-pressed", String(artworkTool === "erase"));
  document.querySelectorAll("[data-display-side]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.displaySide === selectedDisplaySide));
  });
  displayPresetGrid.querySelectorAll(".display-preset").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.presetId === selectedArtworkPreset[selectedDisplaySide]);
  });
  artEditorFeedback.textContent = artworkFeedback;
  artEditorFeedback.className = `draft-feedback${artworkFeedbackIsError ? " is-error" : ""}`;
  sceneController?.setDisplayArtwork(displayArtwork);
  renderArtworkConnection();
}

function renderArtworkConnection() {
  const connected = displayTransfer?.device;
  const sideMatches = connected?.side?.toLowerCase() === selectedDisplaySide;
  artConnectButton.hidden = Boolean(connected);
  artDisconnectButton.hidden = !connected;
  artUploadButton.disabled = !sideMatches;
  artUploadButton.className = sideMatches ? "outline-button upload-primary" : "disabled-button upload-primary";
  if (!connected) {
    artConnectionStatus.textContent = DisplayArtTransfer.isSupported()
      ? "No artwork port connected. Connect the half you are updating."
      : "Web Serial is unavailable here. Use Chrome on localhost or HTTPS after the art-enabled firmware is installed.";
    artConnectionStatus.className = "connection-status";
    return;
  }
  artConnectionStatus.textContent = sideMatches
    ? `Connected to the ${connected.side === "L" ? "left" : "right"} half. This selected image is ready to save.`
    : `Connected to the ${connected.side === "L" ? "left" : "right"} half. Select the matching display before saving.`;
  artConnectionStatus.className = "connection-status";
}

function renderPresetGallery() {
  displayPresetGrid.replaceChildren(...DISPLAY_PRESETS.map((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "display-preset";
    button.dataset.presetId = preset.id;
    const preview = document.createElement("canvas");
    preview.width = DISPLAY_PORTRAIT_WIDTH;
    preview.height = DISPLAY_PORTRAIT_HEIGHT;
    renderArtworkToCanvas(preview, preset.render());
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const description = document.createElement("span");
    title.textContent = preset.name;
    description.textContent = preset.description;
    copy.append(title, description);
    button.append(preview, copy);
    button.addEventListener("click", () => {
      displayArtwork = { ...displayArtwork, [selectedDisplaySide]: artworkFromPreset(preset.id) };
      selectedArtworkPreset = { ...selectedArtworkPreset, [selectedDisplaySide]: preset.id };
      importedArtwork = null;
      setArtworkFeedback(`Applied ${preset.name} to the ${selectedDisplaySide} display preview.`);
      renderArtworkStudio();
    });
    return button;
  }));
}

function artworkPoint(event) {
  const bounds = displayArtCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(DISPLAY_PORTRAIT_WIDTH - 1, Math.floor((event.clientX - bounds.left) * DISPLAY_PORTRAIT_WIDTH / bounds.width))),
    y: Math.max(0, Math.min(DISPLAY_PORTRAIT_HEIGHT - 1, Math.floor((event.clientY - bounds.top) * DISPLAY_PORTRAIT_HEIGHT / bounds.height))),
  };
}

function paintArtwork(event) {
  const { x, y } = artworkPoint(event);
  const artwork = cloneArtwork(activeArtwork());
  const size = Number(artBrushSize.value);
  const radius = Math.floor((size - 1) / 2);
  for (let py = y - radius; py < y - radius + size; py += 1) {
    for (let px = x - radius; px < x - radius + size; px += 1) setPortraitPixel(artwork, px, py, artworkTool === "draw");
  }
  displayArtwork = { ...displayArtwork, [selectedDisplaySide]: artwork };
  selectedArtworkPreset = { ...selectedArtworkPreset, [selectedDisplaySide]: null };
  importedArtwork = null;
  setArtworkFeedback(`Custom ${selectedDisplaySide} artwork edited locally. Save it to that half when ready.`);
  renderArtworkStudio();
}

function repaintImportedArtwork() {
  if (!importedArtwork || importedArtwork.side !== selectedDisplaySide) return;
  displayArtwork = {
    ...displayArtwork,
    [selectedDisplaySide]: artworkFromPortraitImageData(importedArtwork.data, DISPLAY_PORTRAIT_WIDTH, DISPLAY_PORTRAIT_HEIGHT, Number(artThreshold.value)),
  };
  selectedArtworkPreset = { ...selectedArtworkPreset, [selectedDisplaySide]: null };
  setArtworkFeedback(`Re-rendered the imported image for the ${selectedDisplaySide} display at threshold ${artThreshold.value}.`);
  renderArtworkStudio();
}

function render() {
  renderLayerTabs();
  renderKeyboard();
  renderInspector();
  renderDraftEditor();
  renderValidation();
  renderPresentation();
  renderArtworkStudio();
}

function copyWithSelectionFallback(value) {
  const copyTarget = document.createElement("textarea");
  copyTarget.value = value;
  copyTarget.readOnly = true;
  copyTarget.style.position = "fixed";
  copyTarget.style.opacity = "0";
  document.body.append(copyTarget);
  copyTarget.select();
  const copied = document.execCommand("copy");
  copyTarget.remove();
  return copied;
}

homebrewCopyButton.addEventListener("click", async () => {
  const command = homebrewCopyButton.dataset.copyText || homebrewCommand.textContent.trim();
  let copied = false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(command);
      copied = true;
    }
  } catch {
    // The selection fallback below covers denied or unavailable Clipboard API access.
  }

  if (!copied) {
    try {
      copied = copyWithSelectionFallback(command);
    } catch {
      copied = false;
    }
  }

  homebrewCopyStatus.classList.toggle("is-copied", copied);
  homebrewCopyStatus.classList.toggle("is-error", !copied);
  homebrewCopyStatus.textContent = copied
    ? "Command copied. Release and live tap availability are still pending."
    : "Copy is unavailable here. Select the command text and copy it manually.";
  homebrewCopyButton.focus();
});

document.querySelector("#validate-button").addEventListener("click", renderValidation);
document.querySelector("#serialization-button").addEventListener("click", () => {
  serializationPanel.hidden = false;
  serializationPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
document.querySelector("#close-serialization").addEventListener("click", () => { serializationPanel.hidden = true; });
document.querySelector("#export-project-button").addEventListener("click", () => {
  const blob = new Blob([serializeProjectFile(projectIntent)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = "keebweaver-ergokeeb-corne-project.json";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  draftFeedback = "Downloaded a validated project record only; it contains no firmware and cannot change the keyboard.";
  draftFeedbackIsError = false;
  renderDraftEditor();
});
document.querySelector("#import-project-button").addEventListener("click", () => projectFileInput.click());
projectFileInput.addEventListener("change", async () => {
  const [file] = projectFileInput.files;
  projectFileInput.value = "";
  if (!file) return;
  if (file.size > 256 * 1024) {
    draftFeedback = "Project files are limited to 256 KB.";
    draftFeedbackIsError = true;
    renderDraftEditor();
    return;
  }
  try {
    const result = parseProjectFile(await file.text(), { deviceDefinition: DEVICE_DEFINITION, runtimeSnapshot: RUNTIME_BASELINE });
    if (!result.ok) throw new Error(result.message);
    projectIntent = result.projectIntent;
    draftFeedback = `Imported a validated local draft with ${result.report.draftChangeCount} proposed behavior label(s).`;
    draftFeedbackIsError = false;
    render();
  } catch (error) {
    draftFeedback = error.message || "Could not import this project file.";
    draftFeedbackIsError = true;
    renderDraftEditor();
  }
});
document.querySelector("#reset-draft-button").addEventListener("click", () => {
  projectIntent = createDraftProjectIntent();
  draftFeedback = "Draft reset to the conservative beginner proposal. No device state was read or changed.";
  draftFeedbackIsError = false;
  render();
});

draftEditorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    projectIntent = updateDraftBinding(projectIntent, {
      layerId: selectedLayerId,
      positionId: selectedPositionId,
      binding: draftBindingInput.value,
    });
    draftFeedback = `Saved ${selectedLayerId} / ${selectedPositionId} to this local draft only.`;
    draftFeedbackIsError = false;
    render();
  } catch (error) {
    draftFeedback = error.message;
    draftFeedbackIsError = true;
    renderDraftEditor();
  }
});

document.querySelector("#revert-binding-button").addEventListener("click", () => {
  projectIntent = revertDraftBinding(projectIntent, RUNTIME_BASELINE, {
    layerId: selectedLayerId,
    positionId: selectedPositionId,
  });
  draftFeedback = `Reverted ${selectedLayerId} / ${selectedPositionId} to its captured reference label.`;
  draftFeedbackIsError = false;
  render();
});

renderPresetGallery();

document.querySelectorAll("[data-display-side]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedDisplaySide = button.dataset.displaySide;
    setArtworkFeedback(`Editing the ${selectedDisplaySide} display image. The other half remains unchanged.`);
    renderArtworkStudio();
  });
});

artPenButton.addEventListener("click", () => { artworkTool = "draw"; renderArtworkStudio(); });
artEraserButton.addEventListener("click", () => { artworkTool = "erase"; renderArtworkStudio(); });
artInvertButton.addEventListener("click", () => {
  displayArtwork = { ...displayArtwork, [selectedDisplaySide]: invertArtwork(activeArtwork()) };
  selectedArtworkPreset = { ...selectedArtworkPreset, [selectedDisplaySide]: null };
  importedArtwork = null;
  setArtworkFeedback(`Inverted the ${selectedDisplaySide} display artwork locally.`);
  renderArtworkStudio();
});
artClearButton.addEventListener("click", () => {
  displayArtwork = { ...displayArtwork, [selectedDisplaySide]: new Uint8Array(DISPLAY_ART_BYTES) };
  selectedArtworkPreset = { ...selectedArtworkPreset, [selectedDisplaySide]: null };
  importedArtwork = null;
  setArtworkFeedback(`Cleared the ${selectedDisplaySide} display artwork locally.`);
  renderArtworkStudio();
});
displayArtCanvas.addEventListener("pointerdown", (event) => {
  artworkDrawing = true;
  displayArtCanvas.setPointerCapture(event.pointerId);
  paintArtwork(event);
});
displayArtCanvas.addEventListener("pointermove", (event) => { if (artworkDrawing) paintArtwork(event); });
displayArtCanvas.addEventListener("pointerup", () => { artworkDrawing = false; });
displayArtCanvas.addEventListener("pointercancel", () => { artworkDrawing = false; });
artImportButton.addEventListener("click", () => artImageInput.click());
artImageInput.addEventListener("change", () => {
  const [file] = artImageInput.files;
  artImageInput.value = "";
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    setArtworkFeedback("Imported artwork is limited to 10 MB.", true);
    renderArtworkStudio();
    return;
  }
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = DISPLAY_PORTRAIT_WIDTH;
    canvas.height = DISPLAY_PORTRAIT_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, DISPLAY_PORTRAIT_WIDTH, DISPLAY_PORTRAIT_HEIGHT);
    context.drawImage(image, 0, 0, DISPLAY_PORTRAIT_WIDTH, DISPLAY_PORTRAIT_HEIGHT);
    importedArtwork = {
      side: selectedDisplaySide,
      data: context.getImageData(0, 0, DISPLAY_PORTRAIT_WIDTH, DISPLAY_PORTRAIT_HEIGHT).data,
    };
    repaintImportedArtwork();
    URL.revokeObjectURL(objectUrl);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    setArtworkFeedback("This image could not be imported.", true);
    renderArtworkStudio();
  };
  image.src = objectUrl;
});
artThreshold.addEventListener("input", repaintImportedArtwork);
artDownloadButton.addEventListener("click", () => {
  const blob = new Blob([activeArtwork()], { type: "application/octet-stream" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `keebweaver-${selectedDisplaySide}-display-art.kwar`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  setArtworkFeedback(`Downloaded a ${selectedDisplaySide} display bitmap backup.`);
  renderArtworkStudio();
});
artConnectButton.addEventListener("click", async () => {
  try {
    setArtworkFeedback("Choose the display-art serial port for the half connected by USB.");
    renderArtworkStudio();
    displayTransfer = await DisplayArtTransfer.connect();
    setArtworkFeedback(`Connected to the ${displayTransfer.device.side === "L" ? "left" : "right"} display-art port.`);
  } catch (error) {
    displayTransfer = null;
    setArtworkFeedback(error.message || "Could not connect to the display-art USB port.", true);
  }
  renderArtworkStudio();
});
artDisconnectButton.addEventListener("click", async () => {
  const transfer = displayTransfer;
  displayTransfer = null;
  try { await transfer?.close(); } catch { /* stale USB cable is safe to ignore */ }
  setArtworkFeedback("Disconnected the display-art USB port.");
  renderArtworkStudio();
});
artUploadButton.addEventListener("click", async () => {
  if (!displayTransfer || displayTransfer.device.side.toLowerCase() !== selectedDisplaySide) return;
  artUploadButton.disabled = true;
  artUploadProgress.hidden = false;
  artUploadProgress.value = 0;
  try {
    await displayTransfer.upload(activeArtwork(), (progress) => { artUploadProgress.value = progress; });
    setArtworkFeedback(`Saved the ${selectedDisplaySide} artwork to its dedicated keyboard flash partition. No firmware flash was needed.`);
  } catch (error) {
    setArtworkFeedback(error.message || "Artwork upload failed before it could be committed.", true);
  } finally {
    artUploadProgress.hidden = true;
    renderArtworkStudio();
  }
});

sceneController = createKeyboardScene({
  container: document.querySelector("#three-stage"),
  positions: DEVICE_DEFINITION.positions,
  initialLayer: selectedPresentationLayer(),
  selectedPositionId,
  onSelect: selectPosition,
});
document.querySelector("#reset-view").addEventListener("click", () => sceneController.resetView());

render();
