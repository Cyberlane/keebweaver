import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  DISPLAY_PORTRAIT_HEIGHT,
  DISPLAY_PORTRAIT_WIDTH,
  portraitImageDataForArtwork,
} from "./display-art.js";

export const PHYSICAL_SCENE_LAYOUT = Object.freeze({
  lowerHardwareZ: 1.5,
  lowerHardwareHalfDepth: 0.47,
  innerThumbProjectedHalfDepth: 0.59,
  minimumHardwareGap: 0.05,
  thumbZ: Object.freeze({
    r3c3: 1.95,
    r3c4: 2.14,
    r3c5: 2.62,
    r3c11: 2.62,
    r3c12: 2.14,
    r3c13: 1.95,
  }),
});

const LAYER_ACCENTS = Object.freeze({
  Base: "#ff5a50",
  Navigation: "#6ee7e7",
  Numbers: "#ffbf69",
  Symbols: "#b898ff",
});

const LAYER_ICONS = Object.freeze({
  Base: "QWERTY",
  Navigation: "NAV ✦",
  Numbers: "NUM [123]",
  Symbols: "SYM {&*}",
});

const POINTER_DIRECTION = Object.freeze({
  up: "r0c9",
  left: "r1c8",
  press: "r1c9",
  right: "r1c10",
  down: "r2c9",
});

// Sculpted Kailh Choc low-profile keycap geometry with ergonomic cylindrical finger dish
function createChocKeycapGeometry(width = 0.82, height = 0.20, depth = 0.82, radius = 0.075, dishDepth = 0.028) {
  const geom = new RoundedBoxGeometry(width, height, depth, 6, radius);
  const pos = geom.attributes.position;
  const halfH = height / 2;
  const halfW = width * 0.45;
  const halfD = depth * 0.45;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    if (y > halfH * 0.3) {
      const normX = Math.min(1, Math.max(-1, x / halfW));
      const normZ = Math.min(1, Math.max(-1, z / halfD));
      const dish = Math.max(0, 1 - normX * normX) * Math.max(0, 1 - normZ * normZ * 0.6);
      pos.setY(i, y - dish * dishDepth);
    }
  }
  geom.computeVertexNormals();
  return geom;
}

// 512x512 High-Res Keycap Canvas Texture
function makeKeyLabelTexture(binding, positionId, layerId = "Base") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.userData = { canvas, binding, positionId, layerId };
  drawKeyLabel(texture, binding, positionId, LAYER_ACCENTS[layerId] ?? "#ff5a50", false);
  return texture;
}

function parseBindingLegend(binding) {
  let main = binding;
  let sub = "";

  if (binding.includes(" / ")) {
    const parts = binding.split(" / ");
    main = parts[0];
    sub = parts[1];
  } else if (binding.startsWith("Pointer ")) {
    main = binding.replace("Pointer ", "PTR ");
  } else if (binding === "Transparent") {
    main = "·";
  }

  return { main, sub };
}

function drawKeyLabel(texture, binding, positionId, accent, selected) {
  const { canvas } = texture.userData;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  if (selected) {
    const glow = ctx.createRadialGradient(256, 256, 10, 256, 256, 240);
    glow.addColorStop(0, `${accent}40`);
    glow.addColorStop(0.65, `${accent}18`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = `${accent}88`;
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, 456, 456);
  } else {
    const dishShade = ctx.createRadialGradient(256, 256, 80, 256, 256, 240);
    dishShade.addColorStop(0, "rgba(255,255,255,0.025)");
    dishShade.addColorStop(0.8, "transparent");
    dishShade.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = dishShade;
    ctx.fillRect(0, 0, 512, 512);
  }

  const { main, sub } = parseBindingLegend(binding);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const isCompact = main.length > 4;
  const mainFontSize = isCompact ? (main.length > 8 ? 58 : 72) : 106;

  ctx.font = `800 ${mainFontSize}px "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`;
  ctx.fillStyle = selected ? "#ffffff" : "#f0ece1";

  if (selected) {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 24;
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
  }

  const mainY = sub ? 218 : 246;
  ctx.fillText(main, 256, mainY);

  if (sub) {
    ctx.shadowBlur = 0;
    ctx.font = `700 36px "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`;
    ctx.fillStyle = selected ? accent : "rgba(220, 230, 225, 0.65)";
    ctx.fillText(sub.toUpperCase(), 256, 310);
  }

  ctx.shadowBlur = 0;
  ctx.font = `600 28px "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`;
  ctx.fillStyle = selected ? `${accent}cc` : "rgba(180, 195, 190, 0.38)";
  ctx.fillText(positionId.toUpperCase(), 256, 420);

  ctx.fillStyle = selected ? accent : "rgba(180, 195, 190, 0.15)";
  ctx.fillRect(196, 444, 120, 3);

  ctx.restore();
  texture.needsUpdate = true;
}

// 160x68 High-Contrast Sharp Memory LCD Display Texture (Portrait Aspect 320x768)
function makeDisplayTexture(side) {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 768;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.anisotropy = 4;
  texture.userData = { canvas, side };
  return texture;
}

function drawDisplay(texture, layerName, primary, secondary, layerId = "Base") {
  const { canvas, side } = texture.userData;
  const ctx = canvas.getContext("2d");
  const isLeft = side === "left";

  ctx.fillStyle = "#d2ddcf";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(40, 56, 48, 0.05)";
  for (let x = 4; x < canvas.width; x += 8) ctx.fillRect(x, 0, 2, canvas.height);
  for (let y = 4; y < canvas.height; y += 8) ctx.fillRect(0, y, canvas.width, 2);

  const ink = "#131b17";
  const inkMuted = "#384740";
  const accentBox = "#131b17";

  ctx.save();

  // Header
  ctx.fillStyle = ink;
  ctx.fillRect(16, 16, canvas.width - 32, 42);

  ctx.fillStyle = "#d2ddcf";
  ctx.font = `800 20px "JetBrains Mono", monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(isLeft ? "▲ CENTRAL [L]" : "● PERIPH [R]", 28, 37);

  ctx.textAlign = "right";
  ctx.fillText(isLeft ? "USB · BT1" : "BLE SYNC", canvas.width - 28, 37);

  // Status
  ctx.fillStyle = ink;
  ctx.fillRect(16, 66, canvas.width - 32, 2);

  ctx.font = `700 18px "JetBrains Mono", monospace`;
  ctx.textAlign = "left";
  ctx.fillText(isLeft ? "BAT: [■■■■□] 87%" : "BAT: [■■■■■] 94%", 22, 92);

  ctx.textAlign = "right";
  ctx.fillText(isLeft ? "⚡ CHG" : "1.2 ms", canvas.width - 22, 92);

  // Layer hero
  ctx.fillStyle = inkMuted;
  ctx.font = `700 15px "JetBrains Mono", monospace`;
  ctx.textAlign = "left";
  ctx.fillText("ACTIVE LAYER", 22, 132);

  ctx.fillStyle = accentBox;
  ctx.fillRect(16, 146, canvas.width - 32, 88);

  ctx.fillStyle = "#d2ddcf";
  ctx.textAlign = "center";
  ctx.font = `800 36px "JetBrains Mono", monospace`;
  ctx.fillText(layerName.toUpperCase(), canvas.width / 2, 185);

  ctx.font = `700 18px "JetBrains Mono", monospace`;
  ctx.fillText(LAYER_ICONS[layerId] ?? "LAYER ACTIVE", canvas.width / 2, 216);

  ctx.fillStyle = ink;
  ctx.fillRect(16, 248, canvas.width - 32, 2);

  if (isLeft) {
    ctx.fillStyle = ink;
    ctx.font = `700 16px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    ctx.fillText("MATRIX ACTIVITY (L)", 22, 274);

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        const px = 24 + c * 46;
        const py = 296 + r * 38;
        const active = (r + c) % 4 === 1;
        if (active) {
          ctx.fillStyle = ink;
          ctx.fillRect(px, py, 38, 28);
          ctx.fillStyle = "#d2ddcf";
          ctx.font = `800 14px monospace`;
          ctx.textAlign = "center";
          ctx.fillText("ON", px + 19, py + 15);
        } else {
          ctx.strokeStyle = ink;
          ctx.lineWidth = 2;
          ctx.strokeRect(px, py, 38, 28);
        }
      }
    }

    ctx.fillStyle = ink;
    ctx.fillRect(16, 428, canvas.width - 32, 2);
    ctx.font = `700 16px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    ctx.fillText("POLLING RATE: 1000 HZ", 22, 456);
    ctx.fillText("ZMK STUDIO: CONNECTED", 22, 484);
  } else {
    ctx.fillStyle = ink;
    ctx.font = `700 16px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    ctx.fillText("INSPECTOR TARGET", 22, 274);

    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 290, canvas.width - 40, 110);

    ctx.fillStyle = ink;
    ctx.font = `800 28px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.fillText(primary.toUpperCase(), canvas.width / 2, 330);

    const words = secondary.toUpperCase().split(" ");
    ctx.font = `700 18px "JetBrains Mono", monospace`;
    ctx.fillText(words.slice(0, 2).join(" "), canvas.width / 2, 365);
    if (words.length > 2) ctx.fillText(words.slice(2).join(" "), canvas.width / 2, 388);

    ctx.fillStyle = ink;
    ctx.fillRect(16, 420, canvas.width - 32, 2);
    ctx.font = `700 16px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    ctx.fillText("5-WAY SQUARE POINTER", 22, 448);

    ctx.strokeRect(22, 464, canvas.width - 44, 22);
    ctx.fillRect(26, 468, 180, 14);
  }

  ctx.fillStyle = ink;
  ctx.fillRect(16, 680, canvas.width - 32, 2);
  ctx.font = `800 18px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText(isLeft ? "160×68 NICE!VIEW" : "EYELASH CORNE", canvas.width / 2, 715);
  ctx.font = `700 14px "JetBrains Mono", monospace`;
  ctx.fillText("CHOC LOW-PROFILE", canvas.width / 2, 740);

  ctx.restore();
  texture.needsUpdate = true;
}

function drawArtworkDisplay(texture, artwork, caption) {
  const { canvas } = texture.userData;
  const ctx = canvas.getContext("2d");
  const artCanvas = texture.userData.artCanvas ?? document.createElement("canvas");
  artCanvas.width = DISPLAY_PORTRAIT_WIDTH;
  artCanvas.height = DISPLAY_PORTRAIT_HEIGHT;
  texture.userData.artCanvas = artCanvas;
  const artContext = artCanvas.getContext("2d");
  const image = artContext.createImageData(DISPLAY_PORTRAIT_WIDTH, DISPLAY_PORTRAIT_HEIGHT);
  image.data.set(portraitImageDataForArtwork(artwork));
  artContext.putImageData(image, 0, 0);

  ctx.fillStyle = "#d2ddcf";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(artCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.fillStyle = "rgba(7, 13, 13, 0.78)";
  ctx.fillRect(16, 16, canvas.width - 32, 30);
  ctx.fillStyle = "#d2ddcf";
  ctx.font = `800 16px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText(caption.toUpperCase(), canvas.width / 2, 36);
  texture.needsUpdate = true;
}

// Procedural workbench desk mat texture
function makeDeskMatTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#080c0c";
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = "rgba(45, 75, 70, 0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 1024; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(75, 130, 120, 0.18)";
  for (let x = 16; x < 1024; x += 32) {
    for (let y = 16; y < 1024; y += 32) {
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  ctx.strokeStyle = "rgba(110, 231, 231, 0.28)";
  ctx.lineWidth = 1.5;
  [256, 512, 768].forEach((cx) => {
    [256, 512, 768].forEach((cy) => {
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy);
      ctx.lineTo(cx + 12, cy);
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx, cy + 12);
      ctx.stroke();
    });
  });

  ctx.fillStyle = "rgba(100, 140, 130, 0.35)";
  ctx.font = "600 13px ui-monospace, monospace";
  for (let x = 64; x < 1024; x += 128) {
    ctx.fillText(`${x}mm`, x + 4, 20);
    ctx.fillText(`${x}mm`, x + 4, 1014);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  return texture;
}

// Corne Eyelash case outline aligned to the verified reference geometry.
function createCorneCasePoints(side) {
  let points = [
    // Outer pinky straight vertical edge
    [-3.25, -1.45],
    // Top of pinky columns 0 & 1
    [-1.35, -1.45],
    // Step up to ring column 2
    [-1.35, -1.72],
    [-0.45, -1.72],
    // Step up to peak of middle column 3
    [-0.45, -1.88],
    [0.45, -1.88],
    // Step down to index column 4
    [0.45, -1.72],
    [1.35, -1.72],
    // Step down to inner index column 5
    [1.35, -1.55],
    [2.25, -1.55],
    // Top rail of display bay
    [3.65, -1.55],
    // Inner straight vertical edge along display & lower bay
    [3.65, 2.05],
    // Chamfer to inner thumb
    [2.85, 2.18],
    // Thumb cluster arc wrapping r3c5
    [2.78, 3.22],
    [1.85, 3.22],
    // Thumb cluster arc wrapping r3c4
    [1.85, 2.74],
    [0.90, 2.74],
    // Thumb cluster arc wrapping r3c3
    [0.90, 2.48],
    [-0.05, 2.48],
    // Waist indent connecting thumb cluster to bottom of col 1
    [-0.85, 1.62],
    // Flat bottom edge under pinky cols 0 & 1
    [-3.25, 1.62],
  ];

  if (side === "right") {
    points = points.map(([x, z]) => [-x, z]).reverse();
  }
  return points;
}

// Extrude directly in world (x, z) space without geometry.center() shift
function createCaseLayer(side, material, depth, bevelSize = 0.04) {
  const points = createCorneCasePoints(side);
  const shape = new THREE.Shape();
  // Map -z so rotateX(-Math.PI / 2) returns exact (x, z) coordinates in 3D
  shape.moveTo(points[0][0], -points[0][1]);
  points.slice(1).forEach(([x, z]) => shape.lineTo(x, -z));
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 12,
  });
  geom.rotateX(-Math.PI / 2);
  // Do NOT call geom.center() so coordinates stay strictly aligned with keys!

  const mesh = new THREE.Mesh(geom, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

// Precision Socket-Head Hex Cap Screw with metallic specular and inner socket recess
function createScrew(x, z) {
  const screwGroup = new THREE.Group();

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.05, 24),
    new THREE.MeshStandardMaterial({ color: 0x949e9a, roughness: 0.22, metalness: 0.94 }),
  );
  cap.castShadow = true;
  screwGroup.add(cap);

  const hex = new THREE.Mesh(
    new THREE.CylinderGeometry(0.040, 0.040, 0.015, 6),
    new THREE.MeshBasicMaterial({ color: 0x141817 }),
  );
  hex.position.y = 0.022;
  screwGroup.add(hex);

  screwGroup.position.set(x, 0.32, z);
  return screwGroup;
}

// Recessed USB-C Connector Port
function createUsbPort(side) {
  const group = new THREE.Group();

  const cutout = new THREE.Mesh(
    new RoundedBoxGeometry(0.58, 0.22, 0.16, 3, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x111615, roughness: 0.8, metalness: 0.2 }),
  );
  group.add(cutout);

  const metalShield = new THREE.Mesh(
    new RoundedBoxGeometry(0.48, 0.14, 0.12, 3, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x929c98, roughness: 0.28, metalness: 0.9 }),
  );
  metalShield.position.z = -0.02;
  group.add(metalShield);

  const tongue = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.03, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x080b0b }),
  );
  tongue.position.z = -0.03;
  group.add(tongue);

  const x = side === "left" ? 2.94 : -2.94;
  group.position.set(x, 0.22, -1.58);
  return group;
}

// Portrait nice!view Display Module
function createDisplay(side, texture, materials) {
  const group = new THREE.Group();

  const frame = new THREE.Mesh(new RoundedBoxGeometry(1.18, 0.22, 2.58, 5, 0.08), materials.gloss);
  frame.castShadow = true;
  frame.receiveShadow = true;
  frame.position.y = 0.28;
  group.add(frame);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 1.62),
    new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff, toneMapped: false }),
  );
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, 0.395, -0.2);
  group.add(screen);

  group.add(createScrew(-0.42, 1.05), createScrew(0.42, 1.05));
  group.add(createScrew(-0.42, -1.05), createScrew(0.42, -1.05));

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 1.70),
    materials.displayGlass,
  );
  glass.rotation.x = -Math.PI / 2;
  glass.position.set(0, 0.405, -0.2);
  group.add(glass);

  group.userData.side = side;
  return group;
}

// Kailh Choc Low-Profile Key Assembly
function createKeyMesh(position, binding, materials, layerId) {
  const group = new THREE.Group();

  const switchBase = new THREE.Mesh(
    new RoundedBoxGeometry(0.88, 0.16, 0.88, 3, 0.06),
    materials.switchBase,
  );
  switchBase.position.y = 0.16;
  switchBase.castShadow = true;
  group.add(switchBase);

  const stem = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.14, 0.24),
    materials.switchStem,
  );
  stem.position.y = 0.24;
  group.add(stem);

  const capGeom = createChocKeycapGeometry(0.82, 0.20, 0.82, 0.08, 0.026);
  const capMat = materials.keycap.clone();
  const cap = new THREE.Mesh(capGeom, capMat);
  cap.position.y = 0.36;
  cap.castShadow = true;
  cap.receiveShadow = true;
  cap.userData = { positionId: position.id, target: group };
  group.add(cap);

  const texture = makeKeyLabelTexture(binding, position.id, layerId);
  const legend = new THREE.Mesh(
    new THREE.PlaneGeometry(0.74, 0.74),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
  );
  legend.rotation.x = -Math.PI / 2;
  legend.position.y = 0.465;
  legend.userData = { positionId: position.id, target: group };
  group.add(legend);

  group.userData = {
    positionId: position.id,
    cap,
    legend,
    texture,
    binding,
    selected: false,
    hovered: false,
    baseY: 0,
    currentY: 0.26,
    targetY: 0.26,
  };
  return group;
}

// Tactile square five-way pointing control aligned to the reference geometry.
function createPointerControl(materials) {
  const group = new THREE.Group();

  const cradle = new THREE.Mesh(new RoundedBoxGeometry(1.04, 0.18, 0.96, 4, 0.08), materials.plate);
  cradle.position.y = 0.22;
  cradle.castShadow = true;
  group.add(cradle);

  group.add(createScrew(-0.38, 0.34), createScrew(0.38, 0.34));

  const ledFrame = new THREE.Mesh(
    new RoundedBoxGeometry(0.68, 0.02, 0.68, 3, 0.04),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.55 }),
  );
  ledFrame.position.y = 0.325;
  group.add(ledFrame);

  const collar = new THREE.Mesh(
    new RoundedBoxGeometry(0.60, 0.08, 0.60, 3, 0.04),
    materials.pointerCollar,
  );
  collar.position.y = 0.37;
  group.add(collar);

  const nubGroup = new THREE.Group();
  nubGroup.position.y = 0.42;

  const cap = new THREE.Mesh(
    new RoundedBoxGeometry(0.50, 0.18, 0.50, 4, 0.06),
    materials.pointerBody,
  );
  cap.position.y = 0.10;
  cap.castShadow = true;
  cap.userData = { pointerControl: true, target: group };
  nubGroup.add(cap);

  const top = new THREE.Mesh(
    new RoundedBoxGeometry(0.44, 0.06, 0.44, 3, 0.04),
    materials.pointerGrip,
  );
  top.position.y = 0.19;
  top.userData = { pointerControl: true, target: group };
  nubGroup.add(top);

  const centerPip = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x880e0a }),
  );
  centerPip.position.y = 0.22;
  centerPip.userData = { pointerControl: true, target: group };
  nubGroup.add(centerPip);

  const ridgeMat = new THREE.MeshBasicMaterial({ color: 0xa81410 });
  const nRidge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.035), ridgeMat);
  nRidge.position.set(0, 0.21, -0.13);
  nRidge.userData = { pointerControl: true, target: group };
  nubGroup.add(nRidge);

  const sRidge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.035), ridgeMat);
  sRidge.position.set(0, 0.21, 0.13);
  sRidge.userData = { pointerControl: true, target: group };
  nubGroup.add(sRidge);

  const wRidge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, 0.12), ridgeMat);
  wRidge.position.set(-0.13, 0.21, 0);
  wRidge.userData = { pointerControl: true, target: group };
  nubGroup.add(wRidge);

  const eRidge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, 0.12), ridgeMat);
  eRidge.position.set(0.13, 0.21, 0);
  eRidge.userData = { pointerControl: true, target: group };
  nubGroup.add(eRidge);

  group.add(nubGroup);

  group.userData = {
    cap,
    top,
    nubGroup,
    ledFrame,
    selectedPositionId: null,
    baseY: 0,
    targetTiltX: 0,
    targetTiltZ: 0,
    currentTiltX: 0,
    currentTiltZ: 0,
  };
  return group;
}

// Left Lower Hardware Bay (Matte 3D-Printed Blank Cover Plate matching IMG_3486)
function createBlankControlPlate(materials) {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new RoundedBoxGeometry(1.04, 0.18, 0.96, 4, 0.08), materials.plate);
  plate.position.y = 0.22;
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  group.add(createScrew(-0.38, 0.34), createScrew(0.38, 0.34));
  group.add(createScrew(-0.38, -0.34), createScrew(0.38, -0.34));

  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.44),
    new THREE.MeshBasicMaterial({
      color: 0x111717,
      transparent: true,
      opacity: 0.85,
    }),
  );
  badge.rotation.x = -Math.PI / 2;
  badge.position.y = 0.315;
  group.add(badge);

  return group;
}

function localPosition(position, side) {
  const center = side === "left" ? 3 : 13.75;
  return {
    x: (position.x - center) * 0.9,
    z: PHYSICAL_SCENE_LAYOUT.thumbZ[position.id] ?? (position.y - 1.32) * 1.02,
  };
}

function pointerActionFromPoint(intersection, pointerGroup) {
  const point = pointerGroup.worldToLocal(intersection.point.clone());
  if (Math.hypot(point.x, point.z) < 0.12) return POINTER_DIRECTION.press;
  if (Math.abs(point.x) > Math.abs(point.z)) return point.x < 0 ? POINTER_DIRECTION.left : POINTER_DIRECTION.right;
  return point.z < 0 ? POINTER_DIRECTION.up : POINTER_DIRECTION.down;
}

export function createKeyboardScene({ container, positions, initialLayer, selectedPositionId, onSelect }) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive KeebWeaver model of the supported ErgoKeeb Eyelash Corne split keyboard. Drag to orbit, scroll to zoom, and click keys to inspect.",
  );
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070b0b, 0.02);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 14.8, 17.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.3, 0.2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 11;
  controls.maxDistance = 34;
  controls.minPolarAngle = 0.42;
  controls.maxPolarAngle = 1.32;
  controls.minAzimuthAngle = -0.75;
  controls.maxAzimuthAngle = 0.75;
  controls.enablePan = false;
  controls.zoomToCursor = true;
  controls.saveState();

  const materials = {
    caseBottom: new THREE.MeshStandardMaterial({ color: 0x0e1313, roughness: 0.82, metalness: 0.15 }),
    caseEdge: new THREE.MeshStandardMaterial({ color: 0xdf292c, roughness: 0.38, metalness: 0.72 }),
    caseTop: new THREE.MeshStandardMaterial({ color: 0x141a1a, roughness: 0.68, metalness: 0.25 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x1c2423, roughness: 0.46, metalness: 0.32 }),
    gloss: new THREE.MeshPhysicalMaterial({ color: 0x070a0a, roughness: 0.18, metalness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    displayGlass: new THREE.MeshPhysicalMaterial({ color: 0xd6e8dc, roughness: 0.08, metalness: 0.05, transmission: 0.85, transparent: true, opacity: 0.28, ior: 1.52 }),
    switchBase: new THREE.MeshStandardMaterial({ color: 0x0a0e0e, roughness: 0.72, metalness: 0.08 }),
    switchStem: new THREE.MeshStandardMaterial({ color: 0x228899, roughness: 0.32, metalness: 0.05 }),
    keycap: new THREE.MeshStandardMaterial({ color: 0x222727, roughness: 0.64, metalness: 0.04 }),
    pointerBody: new THREE.MeshStandardMaterial({ color: 0xd62824, roughness: 0.48, metalness: 0.08 }),
    pointerGrip: new THREE.MeshStandardMaterial({ color: 0xee3832, roughness: 0.72, metalness: 0.02 }),
    pointerCollar: new THREE.MeshStandardMaterial({ color: 0x1c2323, roughness: 0.30, metalness: 0.88 }),
  };

  const ambient = new THREE.HemisphereLight(0xdfeae2, 0x0f1515, 2.3);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff8ee, 4.2);
  keyLight.position.set(-8, 14, 11);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 40;
  keyLight.shadow.bias = -0.0001;
  const d = 14;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  scene.add(keyLight);

  const redRimLight = new THREE.PointLight(0xff332b, 28, 22, 2);
  redRimLight.position.set(-11, 3, -4);
  scene.add(redRimLight);

  const cyanRimLight = new THREE.PointLight(0x44eeff, 22, 22, 2);
  cyanRimLight.position.set(11, 4, -4);
  scene.add(cyanRimLight);

  const deskGlowLight = new THREE.PointLight(0xff4433, 8, 14, 2);
  deskGlowLight.position.set(0, 0.4, 1.5);
  scene.add(deskGlowLight);

  const matTexture = makeDeskMatTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(54, 38),
    new THREE.MeshStandardMaterial({
      map: matTexture,
      roughness: 0.85,
      metalness: 0.12,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.42;
  floor.receiveShadow = true;
  scene.add(floor);

  const hardware = new THREE.Group();
  hardware.rotation.x = -0.025;
  scene.add(hardware);

  const keyGroups = new Map();
  const selectableMeshes = [];
  const displayTextures = new Map();
  const halves = {};
  let pointerGroup;
  let displayArtwork = { left: null, right: null };

  ["left", "right"].forEach((side) => {
    const half = new THREE.Group();
    half.position.x = side === "left" ? -4.38 : 4.38;
    half.rotation.y = side === "left" ? -0.12 : 0.12;
    hardware.add(half);
    halves[side] = half;

    // Solid Multi-layer Case Tray strictly aligned to key coordinates (no geometry.center shift!)
    const bottomTray = createCaseLayer(side, materials.caseBottom, 0.18, 0.05);
    bottomTray.position.y = -0.08;
    half.add(bottomTray);

    const redTrimWall = createCaseLayer(side, materials.caseEdge, 0.24, 0.04);
    redTrimWall.position.y = 0.04;
    half.add(redTrimWall);

    const topBezel = createCaseLayer(side, materials.caseTop, 0.20, 0.03);
    topBezel.position.y = 0.14;
    half.add(topBezel);

    const switchPlate = createCaseLayer(side, materials.plate, 0.07, 0.02);
    switchPlate.position.y = 0.22;
    half.add(switchPlate);

    // Socket-head screws following the real PCB/case layout
    const screwPositions = side === "left"
      ? [[-3.05, -1.25], [-3.05, 1.40], [0.00, -1.65], [3.42, -1.35], [3.42, 1.80], [2.55, 2.98], [-0.70, 2.20]]
      : [[3.05, -1.25], [3.05, 1.40], [0.00, -1.65], [-3.42, -1.35], [-3.42, 1.80], [-2.55, 2.98], [0.70, 2.20]];
    screwPositions.forEach(([sx, sz]) => half.add(createScrew(sx, sz)));

    half.add(createUsbPort(side));

    const texture = makeDisplayTexture(side);
    displayTextures.set(side, texture);
    const display = createDisplay(side, texture, materials);
    display.position.set(side === "left" ? 2.94 : -2.94, 0.04, -0.25);
    half.add(display);

    if (side === "left") {
      const blankControlPlate = createBlankControlPlate(materials);
      blankControlPlate.position.set(2.94, 0.04, PHYSICAL_SCENE_LAYOUT.lowerHardwareZ);
      half.add(blankControlPlate);
    }

    positions.filter((position) => position.side === side && position.kind === "key").forEach((position) => {
      const key = createKeyMesh(position, initialLayer.bindings[position.id], materials, initialLayer.id);
      const point = localPosition(position, side);
      key.position.set(point.x, 0.02, point.z);
      key.rotation.y = THREE.MathUtils.degToRad(-position.rotation);
      key.userData.baseY = key.position.y;
      key.userData.currentY = key.position.y;
      key.userData.targetY = key.position.y;
      half.add(key);
      keyGroups.set(position.id, key);
      selectableMeshes.push(key.userData.cap, key.userData.legend);
    });

    if (side === "right") {
      pointerGroup = createPointerControl(materials);
      pointerGroup.position.set(-2.94, 0.04, PHYSICAL_SCENE_LAYOUT.lowerHardwareZ);
      pointerGroup.userData.baseY = pointerGroup.position.y;
      half.add(pointerGroup);
      selectableMeshes.push(pointerGroup.userData.cap, pointerGroup.userData.top);
    }
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let currentLayer = initialLayer;
  let currentSelectedPositionId = selectedPositionId;
  let hoveredTarget = null;
  let pointerDown = null;
  let disposed = false;
  let animationFrameId = null;

  function setRayFromEvent(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  function intersectionAt(event) {
    setRayFromEvent(event);
    return raycaster.intersectObjects(selectableMeshes, false)[0] ?? null;
  }

  function selectFromIntersection(intersection) {
    if (!intersection) return;
    if (intersection.object.userData.pointerControl) {
      onSelect(pointerActionFromPoint(intersection, pointerGroup));
      return;
    }
    if (intersection.object.userData.positionId) {
      onSelect(intersection.object.userData.positionId);
    }
  }

  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointerDown = { x: event.clientX, y: event.clientY };
  });

  renderer.domElement.addEventListener("pointerup", (event) => {
    if (!pointerDown || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 6) return;
    selectFromIntersection(intersectionAt(event));
  });

  renderer.domElement.addEventListener("pointermove", (event) => {
    const intersection = intersectionAt(event);
    const nextHoveredTarget = intersection?.object.userData.target ?? null;
    if (nextHoveredTarget !== hoveredTarget) {
      hoveredTarget = nextHoveredTarget;
    }
    renderer.domElement.style.cursor = intersection ? "pointer" : "grab";
  });

  renderer.domElement.addEventListener("pointerleave", () => {
    hoveredTarget = null;
    renderer.domElement.style.cursor = "grab";
  });

  function update({ layer, selectedPositionId: nextSelectedPositionId }) {
    currentLayer = layer;
    currentSelectedPositionId = nextSelectedPositionId;
    const accent = LAYER_ACCENTS[layer.id] ?? "#ff5a50";

    keyGroups.forEach((group, positionId) => {
      const binding = layer.bindings[positionId];
      group.userData.binding = binding;
      group.userData.selected = positionId === currentSelectedPositionId;
      drawKeyLabel(group.userData.texture, binding, positionId, accent, group.userData.selected);

      group.userData.cap.material.emissive.set(group.userData.selected ? accent : "#000000");
      group.userData.cap.material.emissiveIntensity = group.userData.selected ? 0.22 : 0;
    });

    pointerGroup.userData.selectedPositionId = currentSelectedPositionId;
    const pointerSelected = Object.values(POINTER_DIRECTION).includes(currentSelectedPositionId);
    pointerGroup.userData.cap.material.emissive.set(pointerSelected ? "#5c0806" : "#000000");
    pointerGroup.userData.cap.material.emissiveIntensity = pointerSelected ? 0.38 : 0;
    pointerGroup.userData.ledFrame.material.color.set(pointerSelected ? accent : "#ff3b30");
    pointerGroup.userData.ledFrame.material.opacity = pointerSelected ? 0.90 : 0.50;

    let tiltX = 0;
    let tiltZ = 0;
    if (currentSelectedPositionId === POINTER_DIRECTION.up) tiltZ = -0.20;
    else if (currentSelectedPositionId === POINTER_DIRECTION.down) tiltZ = 0.20;
    else if (currentSelectedPositionId === POINTER_DIRECTION.left) tiltX = -0.20;
    else if (currentSelectedPositionId === POINTER_DIRECTION.right) tiltX = 0.20;

    pointerGroup.userData.targetTiltX = tiltX;
    pointerGroup.userData.targetTiltZ = tiltZ;

    const binding = layer.bindings[currentSelectedPositionId] ?? "Active Key";
    if (displayArtwork.left) drawArtworkDisplay(displayTextures.get("left"), displayArtwork.left, "Left artwork preview");
    else drawDisplay(displayTextures.get("left"), layer.name, layer.name, layer.description.replace("Captured ", ""), layer.id);
    if (displayArtwork.right) drawArtworkDisplay(displayTextures.get("right"), displayArtwork.right, "Right artwork preview");
    else drawDisplay(displayTextures.get("right"), layer.name, currentSelectedPositionId, binding, layer.id);
  }

  function tick() {
    if (disposed) return;

    controls.update();

    keyGroups.forEach((group) => {
      const isSelected = group.userData.selected;
      const isHovered = hoveredTarget === group;
      const targetRaise = isSelected ? 0.10 : isHovered ? 0.05 : 0;
      group.userData.targetY = group.userData.baseY + targetRaise;
      group.position.y = THREE.MathUtils.lerp(group.position.y, group.userData.targetY, 0.18);
    });

    const isPointerSelected = Object.values(POINTER_DIRECTION).includes(currentSelectedPositionId);
    const isPointerHovered = hoveredTarget === pointerGroup;
    const targetPointerRaise = isPointerSelected ? 0.08 : isPointerHovered ? 0.04 : 0;
    pointerGroup.position.y = THREE.MathUtils.lerp(
      pointerGroup.position.y,
      pointerGroup.userData.baseY + targetPointerRaise,
      0.18,
    );

    if (pointerGroup.userData.nubGroup) {
      pointerGroup.userData.currentTiltX = THREE.MathUtils.lerp(
        pointerGroup.userData.currentTiltX,
        pointerGroup.userData.targetTiltX,
        0.16,
      );
      pointerGroup.userData.currentTiltZ = THREE.MathUtils.lerp(
        pointerGroup.userData.currentTiltZ,
        pointerGroup.userData.targetTiltZ,
        0.16,
      );
      pointerGroup.userData.nubGroup.rotation.z = -pointerGroup.userData.currentTiltX;
      pointerGroup.userData.nubGroup.rotation.x = pointerGroup.userData.currentTiltZ;
    }

    renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(tick);
  }

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  update({ layer: initialLayer, selectedPositionId });
  tick();

  return {
    update,
    setDisplayArtwork({ left, right }) {
      displayArtwork = { left: left ?? null, right: right ?? null };
      update({ layer: currentLayer, selectedPositionId: currentSelectedPositionId });
    },
    resetView() {
      controls.reset();
    },
    dispose() {
      disposed = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      matTexture.dispose();
      displayTextures.forEach((tex) => tex.dispose());
      keyGroups.forEach((group) => {
        group.userData.texture.dispose();
        group.userData.cap.geometry.dispose();
      });
    },
  };
}
