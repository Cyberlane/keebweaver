import { zmkNiceViewAsset } from "./zmk-display-art.js";

export const DISPLAY_WIDTH = 160;
export const DISPLAY_HEIGHT = 68;
export const DISPLAY_ROW_BYTES = DISPLAY_WIDTH / 8;
export const DISPLAY_ART_BYTES = DISPLAY_ROW_BYTES * DISPLAY_HEIGHT;
export const DISPLAY_PORTRAIT_WIDTH = DISPLAY_HEIGHT;
export const DISPLAY_PORTRAIT_HEIGHT = DISPLAY_WIDTH;
export const DISPLAY_PRESET_SAFE_HEIGHT = 144;

export const TRANSFER = Object.freeze({
  magic: Object.freeze([0x4b, 0x57, 0x41, 0x52]), // KWAR
  version: 1,
  headerBytes: 12,
  maxPacketPayload: 130,
  command: Object.freeze({ hello: 1, begin: 2, chunk: 3, commit: 4, abort: 5 }),
  status: Object.freeze({ ok: 0, badFrame: 1, badCommand: 2, badLength: 3, badCrc: 4, badOffset: 5, flashError: 6 }),
});

function assertBitmap(bitmap) {
  if (!(bitmap instanceof Uint8Array) || bitmap.length !== DISPLAY_ART_BYTES) {
    throw new Error(`Display artwork must be exactly ${DISPLAY_ART_BYTES} bytes.`);
  }
}

function offsetFor(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= DISPLAY_WIDTH || y < 0 || y >= DISPLAY_HEIGHT) return -1;
  return y * DISPLAY_ROW_BYTES + Math.floor(x / 8);
}

export function createBlankArtwork() {
  return new Uint8Array(DISPLAY_ART_BYTES);
}

export function cloneArtwork(bitmap) {
  assertBitmap(bitmap);
  return new Uint8Array(bitmap);
}

export function pixelAt(bitmap, x, y) {
  assertBitmap(bitmap);
  const offset = offsetFor(x, y);
  return offset >= 0 && Boolean(bitmap[offset] & (1 << (7 - (x % 8))));
}

export function setPixel(bitmap, x, y, on = true) {
  assertBitmap(bitmap);
  const offset = offsetFor(x, y);
  if (offset < 0) return;
  const bit = 1 << (7 - (x % 8));
  if (on) bitmap[offset] |= bit;
  else bitmap[offset] &= ~bit;
}

// The nice!view controller stores a 160x68 landscape buffer, but the panel is
// mounted as a 68x160 portrait display. The configurator always exposes this
// physical view and performs the rotation only at the bitmap boundary.
export function portraitPixelAt(bitmap, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= DISPLAY_PORTRAIT_WIDTH || y < 0 || y >= DISPLAY_PORTRAIT_HEIGHT) return false;
  return pixelAt(bitmap, DISPLAY_WIDTH - 1 - y, x);
}

export function setPortraitPixel(bitmap, x, y, on = true) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= DISPLAY_PORTRAIT_WIDTH || y < 0 || y >= DISPLAY_PORTRAIT_HEIGHT) return;
  setPixel(bitmap, DISPLAY_WIDTH - 1 - y, x, on);
}

export function invertArtwork(bitmap) {
  assertBitmap(bitmap);
  return Uint8Array.from(bitmap, (value) => value ^ 0xff);
}

function line(bitmap, x0, y0, x1, y1, on = true) {
  let dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    setPortraitPixel(bitmap, x0, y0, on);
    if (x0 === x1 && y0 === y1) return;
    const doubled = error * 2;
    if (doubled >= dy) { error += dy; x0 += sx; }
    if (doubled <= dx) { error += dx; y0 += sy; }
  }
}

function rect(bitmap, x, y, width, height, on = true, filled = false) {
  if (filled) {
    for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) setPortraitPixel(bitmap, px, py, on);
    return;
  }
  line(bitmap, x, y, x + width - 1, y, on);
  line(bitmap, x, y, x, y + height - 1, on);
  line(bitmap, x + width - 1, y, x + width - 1, y + height - 1, on);
  line(bitmap, x, y + height - 1, x + width - 1, y + height - 1, on);
}

function circle(bitmap, cx, cy, radius, on = true) {
  let x = radius;
  let y = 0;
  let error = 1 - radius;
  while (x >= y) {
    [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]].forEach(([dx, dy]) => setPortraitPixel(bitmap, cx + dx, cy + dy, on));
    y += 1;
    if (error < 0) error += 2 * y + 1;
    else { x -= 1; error += 2 * (y - x + 1); }
  }
}

function safeSetPortraitPixel(bitmap, x, y, on = true) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= DISPLAY_PORTRAIT_WIDTH || y < 0 || y >= DISPLAY_PRESET_SAFE_HEIGHT) return;
  setPortraitPixel(bitmap, x, y, on);
}

function presetZmkNiceView(id) {
  const source = zmkNiceViewAsset(id);
  const art = createBlankArtwork();
  const top = Math.floor((DISPLAY_PRESET_SAFE_HEIGHT - source.width) / 2);

  for (let sourceY = 0; sourceY < source.height; sourceY += 1) {
    for (let sourceX = 0; sourceX < source.width; sourceX += 1) {
      const sourceByte = source.payload[sourceY * source.rowBytes + Math.floor(sourceX / 8)];
      const paletteIndexOne = Boolean(sourceByte & (1 << (7 - (sourceX % 8))));
      if (!paletteIndexOne) safeSetPortraitPixel(art, sourceY, top + source.width - 1 - sourceX);
    }
  }

  return art;
}

function presetZmkMountain() {
  return presetZmkNiceView("mountain");
}

function presetZmkBalloon() {
  return presetZmkNiceView("balloon");
}

function roundedRect(bitmap, x, y, width, height, r = 2, on = true, filled = false) {
  if (filled) {
    for (let py = y; py < y + height; py++) {
      for (let px = x; px < x + width; px++) {
        const isCorner = (px < x + r && py < y + r && (px - (x + r)) ** 2 + (py - (y + r)) ** 2 > r ** 2) ||
                         (px >= x + width - r && py < y + r && (px - (x + width - r - 1)) ** 2 + (py - (y + r)) ** 2 > r ** 2) ||
                         (px < x + r && py >= y + height - r && (px - (x + r)) ** 2 + (py - (y + height - r - 1)) ** 2 > r ** 2) ||
                         (px >= x + width - r && py >= y + height - r && (px - (x + width - r - 1)) ** 2 + (py - (y + height - r - 1)) ** 2 > r ** 2);
        if (!isCorner) safeSetPortraitPixel(bitmap, px, py, on);
      }
    }
    return;
  }
  line(bitmap, x + r, y, x + width - 1 - r, y, on);
  line(bitmap, x + r, y + height - 1, x + width - 1 - r, y + height - 1, on);
  line(bitmap, x, y + r, x, y + height - 1 - r, on);
  line(bitmap, x + width - 1, y + r, x + width - 1, y + height - 1 - r, on);
  if (r >= 2) {
    safeSetPortraitPixel(bitmap, x + 1, y + 1, on);
    safeSetPortraitPixel(bitmap, x + width - 2, y + 1, on);
    safeSetPortraitPixel(bitmap, x + 1, y + height - 2, on);
    safeSetPortraitPixel(bitmap, x + width - 2, y + height - 2, on);
  }
}

function drawSprite(bitmap, x, y, rows, on = true) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const char = row[c];
      if (char === "1" || char === "#" || char === "X") {
        safeSetPortraitPixel(bitmap, x + c, y + r, on);
      } else if (char === "0") {
        safeSetPortraitPixel(bitmap, x + c, y + r, !on);
      }
    }
  }
}

const GLYPHS_3X5 = Object.freeze({
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "010"],
  K: ["101", "110", "100", "110", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "101", "101", "101"],
  N: ["110", "101", "101", "101", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "011", "001"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "010"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "101", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["110", "001", "010", "100", "111"],
  3: ["110", "001", "010", "001", "110"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "110", "001", "110"],
  6: ["011", "100", "110", "101", "010"],
  7: ["111", "001", "010", "010", "010"],
  8: ["010", "101", "010", "101", "010"],
  9: ["010", "101", "011", "001", "110"],
  ":": ["0", "1", "0", "1", "0"],
  ".": ["0", "0", "0", "0", "1"],
  ",": ["0", "0", "0", "1", "1"],
  "/": ["001", "001", "010", "100", "100"],
  "-": ["000", "000", "111", "000", "000"],
  "+": ["000", "010", "111", "010", "000"],
  "%": ["101", "001", "010", "100", "101"],
  "*": ["000", "101", "010", "101", "000"],
  "=": ["000", "111", "000", "111", "000"],
  "[": ["11", "10", "10", "10", "11"],
  "]": ["11", "01", "01", "01", "11"],
  "(": ["01", "10", "10", "10", "01"],
  ")": ["10", "01", "01", "01", "10"],
  "{": ["01", "10", "01", "10", "01"],
  "}": ["10", "01", "10", "01", "10"],
  "<": ["01", "10", "01", "00", "00"],
  ">": ["10", "01", "10", "00", "00"],
  "!": ["1", "1", "1", "0", "1"],
  "@": ["111", "101", "111", "100", "111"],
  "#": ["101", "111", "101", "111", "101"],
  "$": ["010", "111", "010", "111", "010"],
  "~": ["011", "110", "000", "000", "000"],
  "\\": ["100", "100", "010", "001", "001"],
  "|": ["1", "1", "1", "1", "1"],
  "&": ["010", "101", "010", "101", "011"],
  "▲": ["010", "111", "000", "000", "000"],
  "▼": ["000", "000", "111", "010", "000"],
  "◄": ["001", "011", "111", "011", "001"],
  "►": ["100", "110", "111", "110", "100"],
  "◆": ["010", "111", "111", "010", "000"],
  "◇": ["010", "101", "101", "010", "000"],
  "°": ["110", "110", "000", "000", "000"],
  "'": ["010", "010", "000", "000", "000"],
  "⌘": ["101", "010", "101", "000", "000"],
  "⌥": ["110", "001", "111", "000", "000"],
  "⇧": ["010", "111", "010", "010", "000"],
  "⌃": ["010", "101", "000", "000", "000"],
  " ": ["00", "00", "00", "00", "00"],
});

function text3x5(bitmap, value, x, y, on = true) {
  let cursor = x;
  for (const character of value.toUpperCase()) {
    const glyph = GLYPHS_3X5[character] ?? GLYPHS_3X5[" "];
    const width = glyph[0].length;
    glyph.forEach((row, rowIndex) => [...row].forEach((v, columnIndex) => {
      if (v === "1") safeSetPortraitPixel(bitmap, cursor + columnIndex, y + rowIndex, on);
    }));
    cursor += width + 1;
  }
}

function keycap(bitmap, x, y, width, height, label, active = false) {
  if (active) {
    roundedRect(bitmap, x, y, width, height, 2, true, true);
    const labelX = x + Math.floor((width - label.length * 4 + 1) / 2);
    const labelY = y + Math.floor((height - 5) / 2);
    text3x5(bitmap, label, labelX, labelY, false);
  } else {
    roundedRect(bitmap, x, y, width, height, 2, true, false);
    line(bitmap, x + 1, y + height, x + width - 2, y + height, true);
    const labelX = x + Math.floor((width - label.length * 4 + 1) / 2);
    const labelY = y + Math.floor((height - 5) / 2);
    text3x5(bitmap, label, labelX, labelY, true);
  }
}

const GLYPHS = Object.freeze({
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "#": ["01010", "11111", "01010", "01010", "11111", "01010", "01010"],
  "@": ["01110", "10001", "10111", "10101", "10111", "10000", "01110"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
});

function text(bitmap, value, x, y, scale = 1, on = true) {
  let cursor = x;
  for (const character of value.toUpperCase()) {
    const glyph = GLYPHS[character] ?? GLYPHS[" "];
    glyph.forEach((row, rowIndex) => [...row].forEach((value, columnIndex) => {
      if (value !== "1") return;
      if (scale === 1) safeSetPortraitPixel(bitmap, cursor + columnIndex, y + rowIndex, on);
      else rect(bitmap, cursor + columnIndex * scale, y + rowIndex * scale, scale, scale, on, true);
    }));
    cursor += 6 * scale;
  }
}

function drawStar(art, cx, cy) {
  safeSetPortraitPixel(art, cx, cy, true);
  safeSetPortraitPixel(art, cx - 1, cy, true);
  safeSetPortraitPixel(art, cx + 1, cy, true);
  safeSetPortraitPixel(art, cx, cy - 1, true);
  safeSetPortraitPixel(art, cx, cy + 1, true);
}

function drawPineTree(art, cx, topY, height) {
  const tiers = Math.max(3, Math.floor(height / 4));
  const tierH = Math.floor((height - 3) / tiers);
  for (let t = 0; t < tiers; t++) {
    const yStart = topY + t * (tierH - 1);
    const maxW = 1 + t * 2 + (height > 14 ? 1 : 0);
    for (let dy = 0; dy < tierH; dy++) {
      const w = Math.min(maxW, Math.floor(dy * 1.5) + (t === 0 ? 0 : 1));
      for (let dx = -w; dx <= w; dx++) {
        safeSetPortraitPixel(art, cx + dx, yStart + dy, true);
      }
    }
  }
  for (let y = topY + height - 3; y <= topY + height; y++) {
    safeSetPortraitPixel(art, cx, y, true);
  }
}

function presetSummit() {
  const art = createBlankArtwork();

  rect(art, 2, 2, 64, 140, true, false);
  safeSetPortraitPixel(art, 2, 2, false); safeSetPortraitPixel(art, 65, 2, false);
  safeSetPortraitPixel(art, 2, 141, false); safeSetPortraitPixel(art, 65, 141, false);

  rect(art, 4, 4, 60, 9, true, true);
  text3x5(art, "SUMMIT SIGNAL", 9, 6, false);

  text3x5(art, "ALT 3776M", 6, 15, true);
  text3x5(art, "▲ 98%", 44, 15, true);
  line(art, 4, 22, 63, 22, true);

  const sunX = 48, sunY = 38, sunR = 11;
  circle(art, sunX, sunY, sunR, true);
  for (let dy = -sunR + 1; dy < sunR; dy++) {
    const maxDx = Math.floor(Math.sqrt(sunR * sunR - dy * dy));
    for (let dx = 0; dx < maxDx; dx++) {
      if ((dx + dy) % 2 === 0) safeSetPortraitPixel(art, sunX + dx, sunY + dy, true);
    }
  }
  for (let a = 0; a < 360; a += 15) {
    if ((a >= 45 && a <= 135) || (a >= 225 && a <= 315)) continue;
    const rad = (a * Math.PI) / 180;
    safeSetPortraitPixel(art, Math.round(sunX + 15 * Math.cos(rad)), Math.round(sunY + 15 * Math.sin(rad)), true);
  }

  drawStar(art, 10, 30);
  drawStar(art, 28, 28);
  drawStar(art, 18, 44);
  drawStar(art, 6, 52);
  safeSetPortraitPixel(art, 36, 36, true);
  safeSetPortraitPixel(art, 8, 38, true);

  const mastX = 14, mastY = 48;
  line(art, mastX, mastY, mastX, mastY + 14, true);
  line(art, mastX - 2, mastY + 14, mastX + 2, mastY + 14, true);
  line(art, mastX - 2, mastY + 8, mastX + 2, mastY + 8, true);
  circle(art, mastX, mastY, 3, true);
  safeSetPortraitPixel(art, mastX - 5, mastY - 1, true);
  safeSetPortraitPixel(art, mastX - 6, mastY, true);
  safeSetPortraitPixel(art, mastX - 5, mastY + 1, true);
  safeSetPortraitPixel(art, mastX + 5, mastY - 1, true);
  safeSetPortraitPixel(art, mastX + 6, mastY, true);
  safeSetPortraitPixel(art, mastX + 5, mastY + 1, true);

  line(art, 28, 56, 3, 100, true);
  line(art, 28, 56, 54, 92, true);
  line(art, 28, 56, 32, 106, true);

  line(art, 22, 66, 26, 68, true);
  line(art, 26, 68, 28, 74, true);
  line(art, 28, 74, 32, 72, true);

  for (let y = 57; y <= 98; y++) {
    const ridgeX = Math.round(28 + (y - 56) * (4 / 50));
    const rightX = Math.min(64, Math.round(28 + (y - 56) * (26 / 36)));
    for (let x = ridgeX; x <= rightX; x++) {
      if ((x + y) % 2 === 0) safeSetPortraitPixel(art, x, y, true);
    }
  }

  line(art, 50, 66, 36, 88, true);
  line(art, 50, 66, 64, 88, true);
  line(art, 50, 66, 52, 102, true);
  for (let y = 67; y <= 96; y++) {
    const rX = Math.round(50 + (y - 66) * (2 / 36));
    const rightX = Math.min(64, Math.round(50 + (y - 66) * (14 / 22)));
    for (let x = rX; x <= rightX; x++) {
      if ((x + y) % 2 === 0) safeSetPortraitPixel(art, x, y, true);
    }
  }

  line(art, 3, 106, 24, 98, true);
  line(art, 24, 98, 48, 108, true);
  line(art, 48, 108, 64, 102, true);

  for (let x = 4; x <= 63; x++) {
    if (x % 3 !== 0) safeSetPortraitPixel(art, x, 114, true);
    if (x % 4 !== 0) safeSetPortraitPixel(art, x, 122, true);
    if (x % 2 === 0) safeSetPortraitPixel(art, x, 130, true);
  }

  drawPineTree(art, 56, 96, 24);
  drawPineTree(art, 48, 106, 18);
  drawPineTree(art, 8, 100, 22);
  drawPineTree(art, 18, 108, 18);
  drawPineTree(art, 26, 114, 14);
  drawPineTree(art, 38, 112, 16);
  drawPineTree(art, 61, 108, 16);
  drawPineTree(art, 4, 112, 14);

  rect(art, 3, 133, 62, 8, true, true);
  text3x5(art, "35°21'N 138°43'E", 6, 135, false);

  return art;
}

function presetOrbit() {
  const art = createBlankArtwork();

  rect(art, 2, 2, 64, 140, true, false);
  line(art, 2, 2, 6, 2, false); line(art, 2, 2, 2, 6, false); line(art, 2, 6, 6, 2, true);
  line(art, 61, 2, 65, 2, false); line(art, 65, 2, 65, 6, false); line(art, 61, 2, 65, 6, true);
  line(art, 2, 141, 6, 141, false); line(art, 2, 141, 2, 137, false); line(art, 2, 137, 6, 141, true);
  line(art, 61, 141, 65, 141, false); line(art, 65, 141, 65, 137, false); line(art, 61, 141, 65, 137, true);

  rect(art, 7, 4, 54, 9, true, true);
  text3x5(art, "ORBIT // SATURN", 10, 6, false);

  text3x5(art, "VOYAGER-2", 6, 15, true);
  text3x5(art, "DEEP SPACE", 36, 15, true);
  line(art, 4, 22, 63, 22, true);

  const satX = 34, satY = 32;
  rect(art, satX - 3, satY - 3, 7, 7, true, true);
  safeSetPortraitPixel(art, satX, satY, false);
  rect(art, satX - 14, satY - 2, 9, 5, true, false);
  line(art, satX - 11, satY - 2, satX - 11, satY + 2, true);
  line(art, satX - 8, satY - 2, satX - 8, satY + 2, true);
  line(art, satX - 5, satY, satX - 3, satY, true);
  rect(art, satX + 6, satY - 2, 9, 5, true, false);
  line(art, satX + 9, satY - 2, satX + 9, satY + 2, true);
  line(art, satX + 12, satY - 2, satX + 12, satY + 2, true);
  line(art, satX + 3, satY, satX + 6, satY, true);
  line(art, satX - 4, satY - 6, satX + 4, satY - 6, true);
  safeSetPortraitPixel(art, satX - 3, satY - 5, true);
  safeSetPortraitPixel(art, satX + 3, satY - 5, true);
  safeSetPortraitPixel(art, satX, satY - 4, true);
  safeSetPortraitPixel(art, satX, satY - 7, true);
  safeSetPortraitPixel(art, satX - 1, satY + 4, true);
  safeSetPortraitPixel(art, satX + 1, satY + 4, true);
  safeSetPortraitPixel(art, satX, satY + 5, true);
  safeSetPortraitPixel(art, satX, satY + 7, true);
  safeSetPortraitPixel(art, satX, satY + 9, true);

  drawStar(art, 8, 30);
  drawStar(art, 58, 28);
  drawStar(art, 12, 48);
  drawStar(art, 56, 52);
  drawStar(art, 6, 96);
  drawStar(art, 60, 94);
  safeSetPortraitPixel(art, 20, 25, true);
  safeSetPortraitPixel(art, 48, 26, true);
  safeSetPortraitPixel(art, 52, 44, true);

  const planetX = 34, planetY = 74, planetR = 15;
  for (let dy = -planetR; dy <= planetR; dy++) {
    const maxDx = Math.floor(Math.sqrt(planetR * planetR - dy * dy));
    for (let dx = -maxDx; dx <= maxDx; dx++) {
      const px = planetX + dx;
      const py = planetY + dy;
      if (dy >= -2 && dy <= 3) {
        // equatorial clear
      } else if (dy >= -7 && dy < -2) {
        if ((px + py) % 2 === 0) safeSetPortraitPixel(art, px, py, true);
      } else if (dy < -7) {
        if ((px + py) % 3 === 0 || py % 2 === 0) safeSetPortraitPixel(art, px, py, true);
      } else if (dy > 3 && dy <= 8) {
        if ((px + py) % 2 === 0) safeSetPortraitPixel(art, px, py, true);
      } else {
        if ((px + py) % 3 === 0) safeSetPortraitPixel(art, px, py, true);
      }
    }
  }
  circle(art, planetX, planetY, planetR, true);

  const cosT = Math.cos(0.24);
  const sinT = Math.sin(0.24);
  for (let py = planetY - 14; py <= planetY + 14; py++) {
    for (let px = planetX - 32; px <= planetX + 32; px++) {
      const rx = (px - planetX) * cosT + (py - planetY) * sinT;
      const ry = -(px - planetX) * sinT + (py - planetY) * cosT;
      const distSqOuter = (rx / 30) ** 2 + (ry / 9) ** 2;
      const distSqCassiniOut = (rx / 26) ** 2 + (ry / 7.8) ** 2;
      const distSqCassiniIn = (rx / 24) ** 2 + (ry / 7.2) ** 2;
      const distSqInner = (rx / 19) ** 2 + (ry / 5.7) ** 2;

      const distFromCenter = Math.sqrt((px - planetX) ** 2 + (py - planetY) ** 2);
      if (ry < 0 && distFromCenter < planetR) continue;
      if (ry < 0 && rx > 4 && rx < 18) continue;

      if (distSqOuter <= 1.05 && distSqCassiniOut >= 0.95) {
        if (distSqOuter >= 0.98 || (px + py) % 2 === 0) safeSetPortraitPixel(art, px, py, true);
      } else if (distSqCassiniIn <= 1.05 && distSqInner >= 0.95) {
        if (distSqCassiniIn >= 0.98 || distSqInner <= 1.02 || (px + py) % 2 === 0) {
          safeSetPortraitPixel(art, px, py, true);
        }
      }
    }
  }

  const moonX = 10, moonY = 60;
  circle(art, moonX, moonY, 3, true);
  safeSetPortraitPixel(art, moonX - 1, moonY - 1, false);
  for (let a = 90; a < 270; a += 10) {
    const rad = (a * Math.PI) / 180;
    const ox = Math.round(planetX + 28 * Math.cos(rad));
    const oy = Math.round(planetY + 16 * Math.sin(rad));
    if (a % 20 === 0) safeSetPortraitPixel(art, ox, oy, true);
  }

  line(art, 4, 108, 63, 108, true);

  const radarX = 18, radarY = 124, radarR = 11;
  circle(art, radarX, radarY, radarR, true);
  line(art, radarX - radarR, radarY, radarX + radarR, radarY, true);
  line(art, radarX, radarY - radarR, radarX, radarY + radarR, true);
  line(art, radarX, radarY, radarX + 7, radarY - 7, true);
  safeSetPortraitPixel(art, radarX + 5, radarY - 4, true);
  safeSetPortraitPixel(art, radarX + 4, radarY - 4, true);
  safeSetPortraitPixel(art, radarX + 5, radarY - 5, true);

  text3x5(art, "VEL", 33, 112, true);
  text3x5(art, "7.8K/S", 46, 112, true);
  text3x5(art, "APO", 33, 120, true);
  text3x5(art, "420KM", 46, 120, true);
  text3x5(art, "PER", 33, 128, true);
  text3x5(art, "185KM", 46, 128, true);

  rect(art, 6, 137, 56, 5, true, true);
  text3x5(art, "ORBIT STABLE", 14, 137, false);

  return art;
}

function presetLayerCard() {
  const art = createBlankArtwork();

  rect(art, 2, 2, 64, 140, true, false);
  safeSetPortraitPixel(art, 4, 4, true); safeSetPortraitPixel(art, 63, 4, true);
  safeSetPortraitPixel(art, 4, 139, true); safeSetPortraitPixel(art, 63, 139, true);

  rect(art, 5, 4, 58, 9, true, true);
  text3x5(art, "LAYER MATRIX", 11, 6, false);

  rect(art, 4, 16, 38, 7, true, true);
  text3x5(art, "L1:NUMPAD", 6, 17, false);
  line(art, 42, 19, 63, 19, true);

  const numpadKeys = [
    ["7", "8", "9", "/"],
    ["4", "5", "6", "*"],
    ["1", "2", "3", "-"],
    ["0", ".", "=", "+"],
  ];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const kx = 5 + c * 15;
      const ky = 25 + r * 7;
      keycap(art, kx, ky, 13, 6, numpadKeys[r][c]);
    }
  }

  rect(art, 4, 54, 42, 7, true, true);
  text3x5(art, "L2:SYMBOLS", 6, 55, false);
  line(art, 46, 57, 63, 57, true);

  const symKeys = [
    ["{", "}", "(", ")"],
    ["[", "]", "<", ">"],
    ["!", "@", "#", "$"],
    ["~", "\\", "|", "&"],
  ];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const kx = 5 + c * 15;
      const ky = 63 + r * 7;
      keycap(art, kx, ky, 13, 6, symKeys[r][c]);
    }
  }

  rect(art, 4, 92, 34, 7, true, true);
  text3x5(art, "L3:NAV", 6, 93, false);
  line(art, 38, 95, 63, 95, true);

  keycap(art, 5, 107, 11, 7, "HM");
  keycap(art, 18, 107, 9, 7, "◄");
  keycap(art, 29, 100, 9, 6, "▲");
  keycap(art, 29, 107, 9, 7, "▼");
  keycap(art, 40, 107, 9, 7, "►");
  keycap(art, 51, 107, 12, 7, "END");

  line(art, 4, 118, 63, 118, true);
  rect(art, 14, 116, 40, 6, true, true);
  text3x5(art, "THUMB HOLDS", 17, 117, false);

  keycap(art, 5, 124, 13, 7, "SPC");
  keycap(art, 19, 124, 12, 7, "▼L1", true);
  line(art, 32, 127, 35, 127, true);
  keycap(art, 37, 124, 12, 7, "▼L2", true);
  keycap(art, 50, 124, 13, 7, "ENT");

  text3x5(art, "LEFT", 10, 134, true);
  text3x5(art, "RIGHT", 42, 134, true);

  return art;
}

function presetFocus() {
  const art = createBlankArtwork();

  rect(art, 2, 2, 64, 140, true, false);
  safeSetPortraitPixel(art, 2, 2, false); safeSetPortraitPixel(art, 65, 2, false);
  safeSetPortraitPixel(art, 2, 141, false); safeSetPortraitPixel(art, 65, 141, false);

  rect(art, 6, 4, 56, 9, true, true);
  text3x5(art, "FOCUS 25 // TIMER", 9, 6, false);

  text3x5(art, "· DEEP WORK SESSION ·", 7, 15, true);
  line(art, 4, 22, 63, 22, true);

  const dialX = 34, dialY = 54, dialR = 26;
  circle(art, dialX, dialY, dialR, true);

  for (let m = 0; m < 60; m += 5) {
    const angle = (m * 6 - 90) * (Math.PI / 180);
    const rOuter = dialR - 1;
    const rInner = (m % 15 === 0 || m === 25) ? dialR - 4 : dialR - 2;
    const x0 = Math.round(dialX + rOuter * Math.cos(angle));
    const y0 = Math.round(dialY + rOuter * Math.sin(angle));
    const x1 = Math.round(dialX + rInner * Math.cos(angle));
    const y1 = Math.round(dialY + rInner * Math.sin(angle));
    line(art, x0, y0, x1, y1, true);
  }

  for (let dy = -dialR + 1; dy <= dialR - 1; dy++) {
    const maxDx = Math.floor(Math.sqrt((dialR - 1) ** 2 - dy * dy));
    for (let dx = -maxDx; dx <= maxDx; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 18 && dist < dialR - 1) {
        let angle = Math.atan2(dx, -dy);
        if (angle < 0) angle += 2 * Math.PI;
        if (angle <= (25 / 60) * 2 * Math.PI) {
          const px = dialX + dx;
          const py = dialY + dy;
          if ((px + py) % 2 === 0) safeSetPortraitPixel(art, px, py, true);
        }
      }
    }
  }

  const angle25 = (25 * 6 - 90) * (Math.PI / 180);
  line(art, dialX, dialY, Math.round(dialX + (dialR - 1) * Math.cos(angle25)), Math.round(dialY + (dialR - 1) * Math.sin(angle25)), true);
  line(art, dialX, dialY, dialX, dialY - dialR + 1, true);

  roundedRect(art, dialX - 19, dialY - 6, 39, 13, 2, true, true);
  text(art, "25:00", dialX - 14, dialY - 3, 1, false);

  line(art, 4, 84, 63, 84, true);
  rect(art, 4, 87, 44, 7, true, true);
  text3x5(art, "INTERVALS [4/4]", 6, 88, false);

  keycap(art, 4, 96, 14, 11, "◆25", false);
  keycap(art, 19, 96, 14, 11, "◆25", false);
  keycap(art, 34, 96, 14, 11, "◆25", false);
  keycap(art, 49, 96, 15, 11, "◇15", true);

  line(art, 4, 110, 63, 110, true);

  const hx = 6, hy = 114;
  line(art, hx, hy, hx + 12, hy, true);
  line(art, hx, hy + 20, hx + 12, hy + 20, true);
  line(art, hx + 1, hy + 1, hx + 5, hy + 10, true);
  line(art, hx + 11, hy + 1, hx + 7, hy + 10, true);
  line(art, hx + 5, hy + 10, hx + 1, hy + 19, true);
  line(art, hx + 7, hy + 10, hx + 11, hy + 19, true);
  safeSetPortraitPixel(art, hx + 6, hy + 10, true);
  safeSetPortraitPixel(art, hx + 6, hy + 12, true);
  safeSetPortraitPixel(art, hx + 6, hy + 15, true);
  line(art, hx + 4, hy + 17, hx + 8, hy + 17, true);
  line(art, hx + 3, hy + 18, hx + 9, hy + 18, true);
  line(art, hx + 2, hy + 19, hx + 10, hy + 19, true);

  text3x5(art, "FLOW STATE", 23, 115, true);
  text3x5(art, "STREAK 4X", 23, 123, true);
  rect(art, 22, 131, 42, 6, true, true);
  text3x5(art, "DAILY GOAL MET", 24, 132, false);

  return art;
}

function presetMacPad() {
  const art = createBlankArtwork();

  rect(art, 2, 2, 64, 140, true, false);
  safeSetPortraitPixel(art, 2, 2, false); safeSetPortraitPixel(art, 65, 2, false);
  safeSetPortraitPixel(art, 2, 141, false); safeSetPortraitPixel(art, 65, 141, false);

  for (let y = 3; y <= 19; y += 2) {
    line(art, 4, y, 63, y, true);
  }
  rect(art, 6, 5, 56, 11, false, true);
  roundedRect(art, 6, 5, 56, 11, 2, true, true);

  const macX = 9, macY = 6;
  rect(art, macX, macY, 9, 8, false, true);
  rect(art, macX, macY, 9, 8, true, false);
  rect(art, macX + 2, macY + 2, 5, 3, true, true);
  safeSetPortraitPixel(art, macX + 3, macY + 3, false);
  safeSetPortraitPixel(art, macX + 5, macY + 3, false);
  line(art, macX + 2, macY + 6, macX + 6, macY + 6, true);

  text3x5(art, "MAC PAD PRO", 22, 8, false);
  line(art, 4, 21, 63, 21, true);

  const shortcuts = [
    { key: "⌘C", name: "COPY", desc: "CLIP", sprite: ["11100", "10110", "11101", "00111", "00101"] },
    { key: "⌘V", name: "PASTE", desc: "INSRT", sprite: ["01110", "01010", "11111", "00100", "01110"] },
    { key: "⌘Z", name: "UNDO", desc: "REVRT", sprite: ["01110", "10001", "10111", "10000", "01100"] },
    { key: "⌘Y", name: "REDO", desc: "REPT", sprite: ["01110", "10001", "11101", "00001", "00110"] },
    { key: "⌘F", name: "FIND", desc: "SRCH", sprite: ["01110", "10001", "10001", "01110", "00011"] },
    { key: "⌘K", name: "CMD", desc: "PLTTE", sprite: ["10001", "01010", "00100", "01010", "10001"] },
  ];

  for (let i = 0; i < shortcuts.length; i++) {
    const item = shortcuts[i];
    const sy = 24 + i * 14;
    roundedRect(art, 4, sy, 60, 12, 2, true, false);
    keycap(art, 6, sy + 2, 16, 8, item.key, true);
    text3x5(art, item.name, 25, sy + 2, true);
    text3x5(art, item.desc, 25, sy + 7, true);
    drawSprite(art, 56, sy + 3, item.sprite, true);
  }

  line(art, 4, 110, 63, 110, true);
  rect(art, 14, 108, 40, 6, true, true);
  text3x5(art, "MODIFIER KEYS", 16, 109, false);

  keycap(art, 5, 117, 13, 11, "⌘", false);
  keycap(art, 20, 117, 13, 11, "⌥", false);
  keycap(art, 35, 117, 13, 11, "⌃", false);
  keycap(art, 50, 117, 13, 11, "⇧", false);

  text3x5(art, "CMD", 6, 130, true);
  text3x5(art, "OPT", 21, 130, true);
  text3x5(art, "CTL", 36, 130, true);
  text3x5(art, "SFT", 51, 130, true);

  rect(art, 4, 137, 60, 5, true, true);
  text3x5(art, "MACOS ERGOKEEB", 12, 137, false);

  return art;
}

function presetCyberSplit() {
  const art = createBlankArtwork();

  rect(art, 2, 2, 64, 140, true, false);
  safeSetPortraitPixel(art, 2, 2, false); safeSetPortraitPixel(art, 65, 2, false);
  safeSetPortraitPixel(art, 2, 141, false); safeSetPortraitPixel(art, 65, 141, false);

  rect(art, 4, 4, 60, 9, true, true);
  text3x5(art, "EYELASH CORNE", 8, 6, false);

  text3x5(art, "WIRELESS BLE", 6, 15, true);
  text3x5(art, "42-KEY", 44, 15, true);
  line(art, 4, 22, 63, 22, true);

  rect(art, 5, 26, 27, 56, true, false);
  rect(art, 7, 28, 9, 18, true, true);
  text3x5(art, "OLED", 8, 34, false);

  for (let c = 0; c < 5; c++) {
    const colX = 18 + c * 2;
    const colYOffset = [4, 2, 0, 2, 5][c];
    for (let r = 0; r < 3; r++) {
      const ky = 48 + colYOffset + r * 7;
      safeSetPortraitPixel(art, colX, ky, true);
      safeSetPortraitPixel(art, colX + 1, ky, true);
    }
  }
  rect(art, 17, 72, 4, 6, true, true);
  rect(art, 22, 74, 4, 6, true, true);
  rect(art, 27, 75, 4, 6, true, true);

  line(art, 32, 50, 35, 50, true);
  safeSetPortraitPixel(art, 33, 48, true); safeSetPortraitPixel(art, 34, 48, true);
  safeSetPortraitPixel(art, 33, 52, true); safeSetPortraitPixel(art, 34, 52, true);
  safeSetPortraitPixel(art, 32, 46, true); safeSetPortraitPixel(art, 35, 46, true);
  safeSetPortraitPixel(art, 32, 54, true); safeSetPortraitPixel(art, 35, 54, true);

  rect(art, 36, 26, 27, 56, true, false);
  rect(art, 38, 28, 9, 18, true, true);
  text3x5(art, "OLED", 39, 34, false);

  circle(art, 42, 54, 5, true);
  safeSetPortraitPixel(art, 42, 54, true);
  safeSetPortraitPixel(art, 42, 52, true); safeSetPortraitPixel(art, 42, 56, true);
  safeSetPortraitPixel(art, 40, 54, true); safeSetPortraitPixel(art, 44, 54, true);

  for (let c = 0; c < 5; c++) {
    const colX = 49 + c * 2;
    const colYOffset = [5, 2, 0, 2, 4][c];
    for (let r = 0; r < 3; r++) {
      const ky = 48 + colYOffset + r * 7;
      safeSetPortraitPixel(art, colX, ky, true);
      safeSetPortraitPixel(art, colX + 1, ky, true);
    }
  }
  rect(art, 37, 75, 4, 6, true, true);
  rect(art, 42, 74, 4, 6, true, true);
  rect(art, 47, 72, 4, 6, true, true);

  line(art, 4, 86, 63, 86, true);

  rect(art, 4, 89, 44, 7, true, true);
  text3x5(art, "SYSTEM TELEMETRY", 6, 90, false);

  text3x5(art, "MCU", 6, 100, true);
  text3x5(art, "NRF52840 BLE", 20, 100, true);

  text3x5(art, "FW", 6, 108, true);
  text3x5(art, "ZMK 3.5 CORNE", 20, 108, true);

  text3x5(art, "POL", 6, 116, true);
  text3x5(art, "1000HZ ULTRA", 20, 116, true);

  text3x5(art, "BAT", 6, 124, true);
  rect(art, 20, 124, 28, 5, true, false);
  rect(art, 48, 125, 2, 3, true, true);
  rect(art, 22, 125, 22, 3, true, true);
  text3x5(art, "92%", 51, 124, true);

  rect(art, 4, 134, 60, 7, true, true);
  text3x5(art, "MASTER [L] · PERIPH [R]", 6, 135, false);

  return art;
}

function presetSynthwave() {
  const art = createBlankArtwork();

  rect(art, 2, 2, 64, 140, true, false);
  safeSetPortraitPixel(art, 2, 2, false); safeSetPortraitPixel(art, 65, 2, false);
  safeSetPortraitPixel(art, 2, 141, false); safeSetPortraitPixel(art, 65, 141, false);

  rect(art, 5, 4, 58, 9, true, true);
  text3x5(art, "RETROWAVE 1984", 7, 6, false);

  text3x5(art, "NEON HORIZON", 6, 15, true);
  text3x5(art, "STEREO", 42, 15, true);
  line(art, 4, 22, 63, 22, true);

  const sunX = 34, sunY = 46, sunR = 16;
  for (let dy = -sunR; dy <= sunR; dy++) {
    const maxDx = Math.floor(Math.sqrt(sunR * sunR - dy * dy));
    const py = sunY + dy;
    const isBlindCut = (dy === 1 || dy === 4 || dy === 5 || dy === 8 || dy === 9 || dy === 10 || dy >= 13);
    if (!isBlindCut) {
      for (let dx = -maxDx; dx <= maxDx; dx++) {
        const px = sunX + dx;
        if (dy < 0 || (px + py) % 2 === 0) safeSetPortraitPixel(art, px, py, true);
      }
    }
  }
  circle(art, sunX, sunY, sunR, true);

  drawStar(art, 8, 28);
  drawStar(art, 58, 28);
  drawStar(art, 12, 44);
  drawStar(art, 56, 44);
  safeSetPortraitPixel(art, 18, 34, true);
  safeSetPortraitPixel(art, 50, 34, true);

  line(art, 3, 68, 16, 58, true);
  line(art, 16, 58, 28, 66, true);
  line(art, 28, 66, 42, 56, true);
  line(art, 42, 56, 54, 64, true);
  line(art, 54, 64, 64, 58, true);
  for (let x = 4; x <= 63; x++) {
    for (let y = 66; y <= 72; y++) {
      if ((x + y) % 3 === 0) safeSetPortraitPixel(art, x, y, true);
    }
  }

  line(art, 3, 72, 64, 72, true);

  const vpX = 34, vpY = 72;
  const gridBottomX = [4, 12, 20, 27, 34, 41, 48, 56, 63];
  for (const bx of gridBottomX) {
    line(art, vpX, vpY, bx, 132, true);
  }
  const gridY = [75, 79, 84, 91, 100, 111, 124];
  for (const gy of gridY) {
    line(art, 4, gy, 63, gy, true);
  }

  line(art, 8, 108, 6, 88, true);
  line(art, 6, 88, 8, 72, true);
  line(art, 8, 72, 12, 64, true);
  line(art, 12, 64, 4, 58, true); line(art, 4, 58, 2, 62, true);
  line(art, 12, 64, 10, 54, true); line(art, 10, 54, 8, 56, true);
  line(art, 12, 64, 20, 58, true); line(art, 20, 58, 22, 62, true);
  line(art, 12, 64, 18, 68, true);

  line(art, 58, 108, 60, 88, true);
  line(art, 60, 88, 58, 72, true);
  line(art, 58, 72, 54, 64, true);
  line(art, 54, 64, 62, 58, true); line(art, 62, 58, 64, 62, true);
  line(art, 54, 64, 56, 54, true); line(art, 56, 54, 58, 56, true);
  line(art, 54, 64, 46, 58, true); line(art, 46, 58, 44, 62, true);
  line(art, 54, 64, 48, 68, true);

  rect(art, 4, 134, 60, 7, true, true);
  text3x5(art, "SYNTHWAVE · 1984", 10, 135, false);

  return art;
}

function presetMatrix() {
  const art = createBlankArtwork();

  rect(art, 2, 2, 64, 140, true, false);
  safeSetPortraitPixel(art, 2, 2, false); safeSetPortraitPixel(art, 65, 2, false);
  safeSetPortraitPixel(art, 2, 141, false); safeSetPortraitPixel(art, 65, 141, false);

  rect(art, 4, 4, 60, 9, true, true);
  safeSetPortraitPixel(art, 7, 7, false); safeSetPortraitPixel(art, 8, 7, false);
  safeSetPortraitPixel(art, 11, 7, false); safeSetPortraitPixel(art, 12, 7, false);
  safeSetPortraitPixel(art, 15, 7, false); safeSetPortraitPixel(art, 16, 7, false);
  text3x5(art, "TTY1:ERGOKEEB", 22, 6, false);

  const codeLines = [
    "> ./keeb --status",
    "0101 1100 0011",
    "0xFA 0x8C 0x12",
    "BLE: CONNECTED",
    "MTX: 42 KEYS OK",
    "SCAN: 1000 HZ",
    "MEM: 256K / 1MB",
    "UPTIME: 42:18:09",
  ];
  for (let i = 0; i < codeLines.length; i++) {
    const ly = 16 + i * 7;
    text3x5(art, codeLines[i], 5, ly, true);
  }

  rect(art, 5, 74, 6, 2, true, true);
  line(art, 4, 79, 63, 79, true);

  rect(art, 4, 82, 38, 7, true, true);
  text3x5(art, "DIAGNOSTICS", 6, 83, false);

  text3x5(art, "CPU", 5, 93, true);
  rect(art, 18, 93, 34, 5, true, false);
  rect(art, 19, 94, 28, 3, true, true);
  text3x5(art, "88%", 53, 93, true);

  text3x5(art, "BAT", 5, 102, true);
  rect(art, 18, 102, 34, 5, true, false);
  rect(art, 52, 103, 2, 3, true, true);
  rect(art, 19, 103, 31, 3, true, true);
  text3x5(art, "99%", 55, 102, true);

  text3x5(art, "SIG", 5, 111, true);
  rect(art, 19, 114, 2, 2, true, true);
  rect(art, 23, 112, 2, 4, true, true);
  rect(art, 27, 110, 2, 6, true, true);
  rect(art, 31, 108, 2, 8, true, true);
  text3x5(art, "-42 DBM", 36, 111, true);

  text3x5(art, "USB", 5, 120, true);
  text3x5(art, "HIGH-SPEED HID", 18, 120, true);

  rect(art, 4, 129, 60, 11, true, true);
  text3x5(art, "SYSTEM [OK]", 19, 131, false);
  text3x5(art, "ALL SYSTEMS NOMINAL", 6, 136, false);

  return art;
}

export const DISPLAY_PRESETS = Object.freeze([
  Object.freeze({ id: "zmk-mountain", name: "ZMK Mountain", description: "Historic MIT-licensed ZMK nice!view mountain art, fitted above the live label.", render: presetZmkMountain }),
  Object.freeze({ id: "zmk-balloon", name: "ZMK Balloon", description: "Historic MIT-licensed ZMK nice!view balloon art, preserved pixel-for-pixel above the live label.", render: presetZmkBalloon }),
  Object.freeze({ id: "summit", name: "Summit Signal", description: "A tall mountain skyline with snowcaps, evergreen pines, and celestial telemetry.", render: presetSummit }),
  Object.freeze({ id: "orbit", name: "Orbit", description: "Saturn with tilted rings, a deep space Voyager probe, and an orbital radar HUD.", render: presetOrbit }),
  Object.freeze({ id: "layer-card", name: "Layer Card", description: "Numpad, programming symbols, Vim nav cluster, and split thumb hold map.", render: presetLayerCard }),
  Object.freeze({ id: "focus", name: "Focus 25", description: "Pomodoro chronograph with a 25-minute sweep sector, intervals, and hourglass.", render: presetFocus }),
  Object.freeze({ id: "mac-pad", name: "Mac Pad", description: "Classic Mac retro shortcuts with 3D keycaps, icons, and Apple modifier legend.", render: presetMacPad }),
  Object.freeze({ id: "cyber-split", name: "Cyber Split", description: "Eyelash Corne split keyboard hardware schematic with wireless BLE telemetry.", render: presetCyberSplit }),
  Object.freeze({ id: "synthwave", name: "Synthwave Sunset", description: "80s retrowave neon sunset, perspective wireframe grid, and tropical palms.", render: presetSynthwave }),
  Object.freeze({ id: "matrix", name: "Matrix Terminal", description: "Cyberpunk hacker terminal HUD with telemetry gauges and live diagnostics.", render: presetMatrix }),
]);

export function artworkFromPreset(id) {
  const preset = DISPLAY_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Unknown display preset: ${id}`);
  return preset.render();
}

export function portraitImageDataForArtwork(bitmap) {
  assertBitmap(bitmap);
  const rgba = new Uint8ClampedArray(DISPLAY_PORTRAIT_WIDTH * DISPLAY_PORTRAIT_HEIGHT * 4);
  for (let y = 0; y < DISPLAY_PORTRAIT_HEIGHT; y += 1) {
    for (let x = 0; x < DISPLAY_PORTRAIT_WIDTH; x += 1) {
      const index = (y * DISPLAY_PORTRAIT_WIDTH + x) * 4;
      const on = portraitPixelAt(bitmap, x, y);
      const color = on ? 18 : 224;
      rgba[index] = color;
      rgba[index + 1] = on ? 28 : 235;
      rgba[index + 2] = on ? 24 : 222;
      rgba[index + 3] = 255;
    }
  }
  return rgba;
}

export function artworkFromPortraitImageData(data, width, height, threshold = 160) {
  if (!(data instanceof Uint8ClampedArray) || width !== DISPLAY_PORTRAIT_WIDTH || height !== DISPLAY_PORTRAIT_HEIGHT || data.length !== width * height * 4) {
    throw new Error(`Imported artwork must resolve to ${DISPLAY_PORTRAIT_WIDTH}x${DISPLAY_PORTRAIT_HEIGHT} portrait RGBA pixels.`);
  }
  const artwork = createBlankArtwork();
  for (let y = 0; y < DISPLAY_PORTRAIT_HEIGHT; y += 1) {
    for (let x = 0; x < DISPLAY_PORTRAIT_WIDTH; x += 1) {
      const index = (y * DISPLAY_PORTRAIT_WIDTH + x) * 4;
      const alpha = data[index + 3];
      const luminance = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
      setPortraitPixel(artwork, x, y, alpha >= 128 && luminance < threshold);
    }
  }
  return artwork;
}

let crcTable;
function crcTableForIeee() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    crcTable[index] = value >>> 0;
  }
  return crcTable;
}

export function crc32Ieee(data) {
  if (!(data instanceof Uint8Array)) throw new Error("CRC input must be bytes.");
  let crc = 0xffffffff;
  const table = crcTableForIeee();
  for (const byte of data) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

export function createTransferFrame(command, payload = new Uint8Array()) {
  if (!(payload instanceof Uint8Array) || payload.length > TRANSFER.maxPacketPayload) throw new Error("Invalid display transfer payload.");
  const frame = new Uint8Array(TRANSFER.headerBytes + payload.length);
  frame.set(TRANSFER.magic, 0);
  frame[4] = TRANSFER.version;
  frame[5] = command;
  new DataView(frame.buffer).setUint16(6, payload.length, true);
  new DataView(frame.buffer).setUint32(8, crc32Ieee(payload), true);
  frame.set(payload, TRANSFER.headerBytes);
  return frame;
}

export class TransferFrameDecoder {
  #buffer = new Uint8Array();

  push(chunk) {
    const input = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    const merged = new Uint8Array(this.#buffer.length + input.length);
    merged.set(this.#buffer);
    merged.set(input, this.#buffer.length);
    this.#buffer = merged;
    const frames = [];
    while (this.#buffer.length >= TRANSFER.headerBytes) {
      if (!TRANSFER.magic.every((byte, index) => this.#buffer[index] === byte)) {
        this.#buffer = this.#buffer.slice(1);
        continue;
      }
      const view = new DataView(this.#buffer.buffer, this.#buffer.byteOffset, this.#buffer.byteLength);
      const payloadLength = view.getUint16(6, true);
      if (this.#buffer[4] !== TRANSFER.version || payloadLength > TRANSFER.maxPacketPayload) {
        this.#buffer = this.#buffer.slice(1);
        continue;
      }
      const frameLength = TRANSFER.headerBytes + payloadLength;
      if (this.#buffer.length < frameLength) break;
      const payload = this.#buffer.slice(TRANSFER.headerBytes, frameLength);
      const expectedCrc = view.getUint32(8, true);
      if (crc32Ieee(payload) === expectedCrc) frames.push({ command: this.#buffer[5], payload });
      this.#buffer = this.#buffer.slice(frameLength);
    }
    return frames;
  }
}
