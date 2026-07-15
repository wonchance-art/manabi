import {
  OVERWORLD_CHUNK_FILE_BYTES,
  OVERWORLD_CHUNK_FORMAT_VERSION,
  OVERWORLD_CHUNK_HEADER_BYTES,
  OVERWORLD_CHUNK_PAYLOAD_BYTES,
  OVERWORLD_COLLISION_BYTES,
  OVERWORLD_STORAGE_CHUNK_TILES,
  OVERWORLD_SURFACE_BYTES,
} from './overworldChunk.js';

const SHA256_HEX = /^[0-9a-f]{64}$/;

function assertUint16(value, label, { positive = false } = {}) {
  if (!Number.isInteger(value) || value < (positive ? 1 : 0) || value > 0xffff) {
    throw new RangeError(`${label} must be ${positive ? 'a positive' : 'an'} unsigned 16-bit integer`);
  }
}

function assertCoordinate(value, label) {
  if (!Number.isSafeInteger(value) || value < -0x80000000 || value > 0x7fffffff) {
    throw new RangeError(`${label} must be a safe integer in the signed 32-bit range`);
  }
}

function normalizeHash(value, label) {
  if (typeof value !== 'string' || !SHA256_HEX.test(value)) {
    throw new TypeError(`${label} must be a lowercase SHA-256 hex string`);
  }
  return value;
}

function normalizeBounds(bounds) {
  const normalized = {
    x0: bounds?.x0,
    y0: bounds?.y0,
    x1: bounds?.x1,
    y1: bounds?.y1,
  };
  for (const [key, value] of Object.entries(normalized)) assertUint16(value, `validBounds.${key}`);
  if (normalized.x0 >= normalized.x1 || normalized.y0 >= normalized.y1
    || normalized.x1 > OVERWORLD_STORAGE_CHUNK_TILES
    || normalized.y1 > OVERWORLD_STORAGE_CHUNK_TILES) {
    throw new RangeError('validBounds must be a non-empty half-open bbox inside one storage chunk');
  }
  return normalized;
}

function normalizeSurface(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0x0f) {
    throw new RangeError(`${label} must be an integer between 0 and 15`);
  }
  return value;
}

function normalizeBit(value, label) {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  throw new RangeError(`${label} must be 0, 1, false, or true`);
}

function writeHash(bytes, offset, hex) {
  for (let index = 0; index < 32; index += 1) {
    bytes[offset + index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
}

function setBit(bytes, offset, index, value) {
  const byteIndex = offset + (index >> 3);
  const mask = 1 << (index & 7);
  bytes[byteIndex] = value ? bytes[byteIndex] | mask : bytes[byteIndex] & ~mask;
}

export function encodeOverworldChunkV1({
  schemaVersion = 1,
  cx,
  cy,
  validBounds,
  regionHash,
  projectionManifestHash,
  seaSurface = 0,
  surfaceAt,
  collisionAt,
  viewOnlyAt = () => 0,
} = {}) {
  assertUint16(schemaVersion, 'schemaVersion', { positive: true });
  assertCoordinate(cx, 'cx');
  assertCoordinate(cy, 'cy');
  const bounds = normalizeBounds(validBounds);
  const normalizedRegionHash = normalizeHash(regionHash, 'regionHash');
  const normalizedProjectionHash = normalizeHash(projectionManifestHash, 'projectionManifestHash');
  const paddingSurface = normalizeSurface(seaSurface, 'seaSurface');
  if (typeof surfaceAt !== 'function') throw new TypeError('surfaceAt must be a function');
  if (typeof collisionAt !== 'function') throw new TypeError('collisionAt must be a function');
  if (typeof viewOnlyAt !== 'function') throw new TypeError('viewOnlyAt must be a function');

  const bytes = new Uint8Array(OVERWORLD_CHUNK_FILE_BYTES);
  const view = new DataView(bytes.buffer);
  bytes.set([0x4d, 0x4f, 0x57, 0x43], 0);
  view.setUint16(4, OVERWORLD_CHUNK_FORMAT_VERSION, true);
  view.setUint16(6, schemaVersion, true);
  view.setUint16(8, OVERWORLD_CHUNK_HEADER_BYTES, true);
  view.setUint16(10, 0, true);
  view.setInt32(12, cx, true);
  view.setInt32(16, cy, true);
  view.setUint16(20, bounds.x0, true);
  view.setUint16(22, bounds.y0, true);
  view.setUint16(24, bounds.x1, true);
  view.setUint16(26, bounds.y1, true);
  view.setUint32(28, OVERWORLD_CHUNK_PAYLOAD_BYTES, true);
  writeHash(bytes, 32, normalizedRegionHash);
  writeHash(bytes, 64, normalizedProjectionHash);

  const surfaceOffset = OVERWORLD_CHUNK_HEADER_BYTES;
  const collisionOffset = surfaceOffset + OVERWORLD_SURFACE_BYTES;
  const viewOnlyOffset = collisionOffset + OVERWORLD_COLLISION_BYTES;
  bytes.fill(paddingSurface | (paddingSurface << 4), surfaceOffset, collisionOffset);
  bytes.fill(0xff, collisionOffset);

  for (let y = bounds.y0; y < bounds.y1; y += 1) {
    for (let x = bounds.x0; x < bounds.x1; x += 1) {
      const index = y * OVERWORLD_STORAGE_CHUNK_TILES + x;
      const surface = normalizeSurface(surfaceAt(x, y), `surfaceAt(${x}, ${y})`);
      const surfaceByte = surfaceOffset + (index >> 1);
      bytes[surfaceByte] = (index & 1) === 0
        ? (bytes[surfaceByte] & 0xf0) | surface
        : (bytes[surfaceByte] & 0x0f) | (surface << 4);
      setBit(bytes, collisionOffset, index, normalizeBit(collisionAt(x, y), `collisionAt(${x}, ${y})`));
      setBit(bytes, viewOnlyOffset, index, normalizeBit(viewOnlyAt(x, y), `viewOnlyAt(${x}, ${y})`));
    }
  }
  return bytes;
}
