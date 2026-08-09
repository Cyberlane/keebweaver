import { DISPLAY_ART_BYTES, TRANSFER, TransferFrameDecoder, createTransferFrame, crc32Ieee } from "./display-art.js";

const responseNames = Object.freeze({
  [TRANSFER.status.badFrame]: "invalid frame",
  [TRANSFER.status.badCommand]: "unsupported command",
  [TRANSFER.status.badLength]: "invalid artwork length",
  [TRANSFER.status.badCrc]: "checksum mismatch",
  [TRANSFER.status.badOffset]: "unexpected upload chunk",
  [TRANSFER.status.flashError]: "flash write failed",
});

function uint32Payload(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function requireOk(response, action) {
  if (!response.payload.length || response.payload[0] !== TRANSFER.status.ok) {
    const status = response.payload[0];
    throw new Error(`${action} failed: ${responseNames[status] ?? `device status ${status}`}.`);
  }
}

export class DisplayArtTransfer {
  static isSupported() {
    return Boolean(globalThis.navigator?.serial);
  }

  #port;
  #reader;
  #writer;
  #decoder = new TransferFrameDecoder();
  #pending = [];
  #readLoopPromise;
  #closed = false;
  device;

  constructor(port) {
    this.#port = port;
  }

  static async connect() {
    if (!DisplayArtTransfer.isSupported()) {
      throw new Error("USB artwork upload needs Chrome or another browser with Web Serial on localhost or HTTPS.");
    }
    const port = await navigator.serial.requestPort();
    const transfer = new DisplayArtTransfer(port);
    try {
      await transfer.#open();
      return transfer;
    } catch (error) {
      await transfer.close().catch(() => {});
      throw error;
    }
  }

  async #open() {
    await this.#port.open({ baudRate: 115200, bufferSize: 1024 });
    this.#reader = this.#port.readable.getReader();
    this.#writer = this.#port.writable.getWriter();
    this.#readLoopPromise = this.#readLoop();
    const hello = await this.request(TRANSFER.command.hello);
    requireOk(hello, "Device handshake");
    if (hello.payload.length !== 9) throw new Error("The connected device returned an incomplete display-art handshake.");
    const view = new DataView(hello.payload.buffer, hello.payload.byteOffset, hello.payload.byteLength);
    const width = view.getUint16(3, true);
    const height = view.getUint16(5, true);
    const artworkBytes = view.getUint16(7, true);
    if (width !== 160 || height !== 68 || artworkBytes !== DISPLAY_ART_BYTES) {
      throw new Error("The connected device does not expose a compatible KeebWeaver 160x68 artwork endpoint.");
    }
    this.device = Object.freeze({ side: String.fromCharCode(hello.payload[1]), protocolVersion: hello.payload[2], width, height, artworkBytes });
  }

  async #readLoop() {
    try {
      while (!this.#closed) {
        const { value, done } = await this.#reader.read();
        if (done) break;
        for (const frame of this.#decoder.push(value)) this.#resolveFrame(frame);
      }
    } catch (error) {
      if (!this.#closed) this.#rejectPending(error);
    } finally {
      if (!this.#closed) this.#rejectPending(new Error("The USB artwork connection closed."));
    }
  }

  #resolveFrame(frame) {
    const pendingIndex = this.#pending.findIndex((pending) => pending.command === frame.command);
    if (pendingIndex < 0) return;
    const [pending] = this.#pending.splice(pendingIndex, 1);
    clearTimeout(pending.timeout);
    pending.resolve(frame);
  }

  #rejectPending(error) {
    this.#pending.splice(0).forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(error);
    });
  }

  async request(command, payload = new Uint8Array()) {
    if (this.#closed) throw new Error("The USB artwork connection is closed.");
    const responseCommand = command | 0x80;
    const response = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending = this.#pending.filter((pending) => pending.timeout !== timeout);
        reject(new Error("The keyboard did not acknowledge the artwork transfer. Check that the art-enabled firmware is installed and reconnect the USB cable."));
      }, 2500);
      this.#pending.push({ command: responseCommand, resolve, reject, timeout });
    });
    await this.#writer.write(createTransferFrame(command, payload));
    return response;
  }

  async upload(artwork, onProgress = () => {}) {
    if (!(artwork instanceof Uint8Array) || artwork.length !== DISPLAY_ART_BYTES) {
      throw new Error(`Artwork must be a ${DISPLAY_ART_BYTES}-byte 160x68 bitmap.`);
    }
    const begin = await this.request(TRANSFER.command.begin, uint32Payload(artwork.length));
    requireOk(begin, "Artwork upload setup");
    const chunkSize = 96;
    for (let offset = 0; offset < artwork.length; offset += chunkSize) {
      const chunk = artwork.slice(offset, Math.min(offset + chunkSize, artwork.length));
      const payload = new Uint8Array(2 + chunk.length);
      new DataView(payload.buffer).setUint16(0, offset, true);
      payload.set(chunk, 2);
      const response = await this.request(TRANSFER.command.chunk, payload);
      requireOk(response, "Artwork upload");
      onProgress(Math.min(1, (offset + chunk.length) / artwork.length));
    }
    const commit = await this.request(TRANSFER.command.commit, uint32Payload(crc32Ieee(artwork)));
    requireOk(commit, "Artwork save");
  }

  async close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#rejectPending(new Error("The USB artwork connection was closed."));
    try { await this.#reader?.cancel(); } catch { /* already closed */ }
    this.#reader?.releaseLock();
    this.#writer?.releaseLock();
    try { await this.#port.close(); } catch { /* opening may have failed */ }
    await this.#readLoopPromise?.catch(() => {});
  }
}
