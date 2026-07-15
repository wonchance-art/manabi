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

export function buildOverworldChunkV1Fixture({
  cx = TINY_CHUNK_COORDINATE.cx,
  cy = TINY_CHUNK_COORDINATE.cy,
  validBounds = TINY_CHUNK_VALID_BOUNDS,
  regionHash = TINY_CHUNK_REGION_HASH,
  projectionManifestHash = TINY_CHUNK_PROJECTION_HASH,
  defaultCollision = 1,
  defaultViewOnly = 1,
  cells = [],
} = {}) {
  const bytes = new Uint8Array(OVERWORLD_CHUNK_FILE_BYTES);
  const view = new DataView(bytes.buffer);
  bytes.set([0x4d, 0x4f, 0x57, 0x43], 0);
  view.setUint16(4, 1, true);
  view.setUint16(6, 1, true);
  view.setUint16(8, OVERWORLD_CHUNK_HEADER_BYTES, true);
  view.setUint16(10, 0, true);
  view.setInt32(12, cx, true);
  view.setInt32(16, cy, true);
  view.setUint16(20, validBounds.x0, true);
  view.setUint16(22, validBounds.y0, true);
  view.setUint16(24, validBounds.x1, true);
  view.setUint16(26, validBounds.y1, true);
  view.setUint32(28, OVERWORLD_CHUNK_PAYLOAD_BYTES, true);
  writeHash(bytes, 32, regionHash);
  writeHash(bytes, 64, projectionManifestHash);

  const collisionOffset = OVERWORLD_CHUNK_HEADER_BYTES + OVERWORLD_SURFACE_BYTES;
  const viewOnlyOffset = collisionOffset + OVERWORLD_COLLISION_BYTES;
  bytes.fill(defaultCollision ? 0xff : 0x00, collisionOffset, viewOnlyOffset);
  bytes.fill(defaultViewOnly ? 0xff : 0x00, viewOnlyOffset);

  for (const cell of cells) {
    if (cell.surface !== undefined) setSurface(bytes, cell.x, cell.y, cell.surface);
    if (cell.collision !== undefined) {
      setBit(bytes, collisionOffset, cell.x, cell.y, cell.collision);
    }
    if (cell.viewOnly !== undefined) setBit(bytes, viewOnlyOffset, cell.x, cell.y, cell.viewOnly);
  }
  return bytes;
}

export function buildTinyOverworldChunkV1() {
  return buildOverworldChunkV1Fixture({
    cells: [
      { x: 2, y: 1, surface: 3, collision: 0, viewOnly: 0 },
      { x: 3, y: 1, surface: 12, viewOnly: 0 },
      { x: 4, y: 2, surface: 5, collision: 0 },
      { x: 5, y: 4, surface: 15, collision: 0, viewOnly: 0 },
    ],
  });
}
