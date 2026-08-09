import { readFileSync } from "node:fs";
import { basename } from "node:path";

const UF2_BLOCK_BYTES = 512;
const MAGIC_START_0 = 0x0a324655;
const MAGIC_START_1 = 0x9e5d5157;
const MAGIC_END = 0x0ab16f30;
const FLAG_FAMILY_ID = 0x00002000;
const NRF52840_FAMILY_ID = 0xada52840;

if (!process.argv[2]) throw new Error("Pass at least one UF2 file.");

for (const path of process.argv.slice(2)) {
  const bytes = readFileSync(path);
  if (!bytes.length || bytes.length % UF2_BLOCK_BYTES !== 0) throw new Error(`${path} is not a complete UF2 image.`);

  const addresses = [];
  let declaredBlocks = null;
  for (let offset = 0; offset < bytes.length; offset += UF2_BLOCK_BYTES) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, UF2_BLOCK_BYTES);
    if (view.getUint32(0, true) !== MAGIC_START_0 || view.getUint32(4, true) !== MAGIC_START_1 || view.getUint32(508, true) !== MAGIC_END) {
      throw new Error(`${path} contains an invalid UF2 block at byte ${offset}.`);
    }
    if (!(view.getUint32(8, true) & FLAG_FAMILY_ID) || view.getUint32(28, true) !== NRF52840_FAMILY_ID) {
      throw new Error(`${path} is not an nRF52840-family UF2 image.`);
    }
    const totalBlocks = view.getUint32(24, true);
    if (declaredBlocks === null) declaredBlocks = totalBlocks;
    if (totalBlocks !== declaredBlocks || view.getUint32(20, true) !== offset / UF2_BLOCK_BYTES) {
      throw new Error(`${path} has inconsistent UF2 block numbering.`);
    }
    addresses.push(view.getUint32(12, true));
  }
  if (declaredBlocks !== bytes.length / UF2_BLOCK_BYTES) throw new Error(`${path} is missing UF2 blocks.`);
  const minimumAddress = Math.min(...addresses);
  if (minimumAddress !== 0x00026000) throw new Error(`${path} starts at unexpected address 0x${minimumAddress.toString(16)}.`);
  console.log(`${basename(path)}: nRF52840 UF2, ${declaredBlocks} blocks, minimum address 0x${minimumAddress.toString(16)}`);
}
