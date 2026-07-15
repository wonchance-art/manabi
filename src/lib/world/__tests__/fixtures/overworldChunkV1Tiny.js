import {
  OVERWORLD_CHUNK_FILE_BYTES,
  OVERWORLD_CHUNK_HEADER_BYTES,
  OVERWORLD_CHUNK_PAYLOAD_BYTES,
  OVERWORLD_COLLISION_BYTES,
  OVERWORLD_STORAGE_CHUNK_TILES,
  OVERWORLD_SURFACE_BYTES,
} from '../../overworldChunk.js';

export const TINY_CHUNK_REGION_HASH = '11'.repeat(32);
export const TINY_CHUNK_PROJECTION_HASH = 'ab'.repeat(32);
export const TINY_CHUNK_COORDINATE = Object.freeze({ cx: -2, cy: 3 });
export const TINY_CHUNK_VALID_BOUNDS = Object.freeze({ x0: 2, y0: 1, x1: 6, y1: 5 });

function writeHash(bytes, offset, hex) {
  for (let index = 0; index < 32; index += 1) {
    bytes[offset + index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
}

function setSurface(bytes, x, y, surface) {
  const index = y * OVERWORLD_STORAGE_CHUNK_TILES + x;
  const offset = OVERWORLD_CHUNK_HEADER_BYTES + (index >> 1);
  bytes[offset] = (index & 1) === 0
    ? (bytes[offset] & 0xf0) | surface
    : (bytes[offset] & 0x0f) | (surface << 4);
}

function setBit(bytes, layerOffset, x, y, value) {
  const index = y * OVERWORLD_STORAGE_CHUNK_TILES + x;
  const offset = layerOffset + (index >> 3);
  const mask = 1 << (index & 7);
  bytes[offset] = value ? bytes[offset] | mask : bytes[offset] & ~mask;
}

export function buildTinyOverworldChunkV1() {
  const bytes = new Uint8Array(OVERWORLD_CHUNK_FILE_BYTES);
  const view = new DataView(bytes.buffer);
  bytes.set([0x4d, 0x4f, 0x57, 0x43], 0);
  view.setUint16(4, 1, true);
  view.setUint16(6, 1, true);
  view.setUint16(8, OVERWORLD_CHUNK_HEADER_BYTES, true);
  view.setUint16(10, 0, true);
  view.setInt32(12, TINY_CHUNK_COORDINATE.cx, true);
  view.setInt32(16, TINY_CHUNK_COORDINATE.cy, true);
  view.setUint16(20, TINY_CHUNK_VALID_BOUNDS.x0, true);
  view.setUint16(22, TINY_CHUNK_VALID_BOUNDS.y0, true);
  view.setUint16(24, TINY_CHUNK_VALID_BOUNDS.x1, true);
  view.setUint16(26, TINY_CHUNK_VALID_BOUNDS.y1, true);
  view.setUint32(28, OVERWORLD_CHUNK_PAYLOAD_BYTES, true);
  writeHash(bytes, 32, TINY_CHUNK_REGION_HASH);
  writeHash(bytes, 64, TINY_CHUNK_PROJECTION_HASH);

  const collisionOffset = OVERWORLD_CHUNK_HEADER_BYTES + OVERWORLD_SURFACE_BYTES;
  const viewOnlyOffset = collisionOffset + OVERWORLD_COLLISION_BYTES;
  bytes.fill(0xff, collisionOffset, viewOnlyOffset);
  bytes.fill(0xff, viewOnlyOffset);

  setSurface(bytes, 2, 1, 3);
  setBit(bytes, collisionOffset, 2, 1, 0);
  setBit(bytes, viewOnlyOffset, 2, 1, 0);

  setSurface(bytes, 3, 1, 12);
  setBit(bytes, viewOnlyOffset, 3, 1, 0);

  setSurface(bytes, 4, 2, 5);
  setBit(bytes, collisionOffset, 4, 2, 0);

  setSurface(bytes, 5, 4, 15);
  setBit(bytes, collisionOffset, 5, 4, 0);
  setBit(bytes, viewOnlyOffset, 5, 4, 0);
  return bytes;
}
