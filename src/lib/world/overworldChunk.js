const MAGIC_BYTES = Object.freeze([0x4d, 0x4f, 0x57, 0x43]); // MOWC
const HASH_BYTES = 32;

export const OVERWORLD_CHUNK_MAGIC = 'MOWC';
export const OVERWORLD_CHUNK_FORMAT_VERSION = 1;
export const OVERWORLD_CHUNK_HEADER_BYTES = 96;
export const OVERWORLD_STORAGE_CHUNK_TILES = 256;
export const OVERWORLD_CHUNK_CELL_COUNT = OVERWORLD_STORAGE_CHUNK_TILES ** 2;
export const OVERWORLD_SURFACE_BYTES = OVERWORLD_CHUNK_CELL_COUNT / 2;
export const OVERWORLD_COLLISION_BYTES = OVERWORLD_CHUNK_CELL_COUNT / 8;
export const OVERWORLD_VIEW_ONLY_BYTES = OVERWORLD_CHUNK_CELL_COUNT / 8;
export const OVERWORLD_CHUNK_PAYLOAD_BYTES = OVERWORLD_SURFACE_BYTES
  + OVERWORLD_COLLISION_BYTES
  + OVERWORLD_VIEW_ONLY_BYTES;
export const OVERWORLD_CHUNK_FILE_BYTES = OVERWORLD_CHUNK_HEADER_BYTES
  + OVERWORLD_CHUNK_PAYLOAD_BYTES;

function asBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError('overworld chunk must be an ArrayBuffer or typed-array view');
}

function hashHex(bytes, offset) {
  let value = '';
  for (let index = offset; index < offset + HASH_BYTES; index += 1) {
    value += bytes[index].toString(16).padStart(2, '0');
  }
  return value;
}

function assertInteger(value, label) {
  if (!Number.isInteger(value)) throw new RangeError(`${label} must be an integer`);
}

function assertLocalCoordinate(value, label) {
  assertInteger(value, label);
  if (value < 0 || value >= OVERWORLD_STORAGE_CHUNK_TILES) {
    throw new RangeError(`${label} must be between 0 and ${OVERWORLD_STORAGE_CHUNK_TILES - 1}`);
  }
}

function assertExpected(header, expected = {}) {
  for (const key of ['schemaVersion', 'cx', 'cy', 'regionHash', 'projectionManifestHash']) {
    if (expected[key] !== undefined && header[key] !== expected[key]) {
      throw new Error(`overworld chunk ${key} mismatch: ${header[key]} !== ${expected[key]}`);
    }
  }
}

export function decodeOverworldChunkV1(input, { expected } = {}) {
  const bytes = asBytes(input);
  if (bytes.byteLength < OVERWORLD_CHUNK_HEADER_BYTES) {
    throw new Error(`overworld chunk is truncated: ${bytes.byteLength} < ${OVERWORLD_CHUNK_HEADER_BYTES}`);
  }
  for (let index = 0; index < MAGIC_BYTES.length; index += 1) {
    if (bytes[index] !== MAGIC_BYTES[index]) throw new Error('invalid overworld chunk magic');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const formatVersion = view.getUint16(4, true);
  const schemaVersion = view.getUint16(6, true);
  const headerBytes = view.getUint16(8, true);
  const flags = view.getUint16(10, true);
  const cx = view.getInt32(12, true);
  const cy = view.getInt32(16, true);
  const validX0 = view.getUint16(20, true);
  const validY0 = view.getUint16(22, true);
  const validX1 = view.getUint16(24, true);
  const validY1 = view.getUint16(26, true);
  const payloadBytes = view.getUint32(28, true);

  if (formatVersion !== OVERWORLD_CHUNK_FORMAT_VERSION) {
    throw new Error(`unsupported overworld chunk format: ${formatVersion}`);
  }
  if (schemaVersion < 1) throw new Error(`invalid overworld chunk schema: ${schemaVersion}`);
  if (headerBytes !== OVERWORLD_CHUNK_HEADER_BYTES) {
    throw new Error(`overworld chunk header size mismatch: ${headerBytes}`);
  }
  if (flags !== 0) throw new Error(`unsupported overworld chunk flags: ${flags}`);
  if (payloadBytes !== OVERWORLD_CHUNK_PAYLOAD_BYTES) {
    throw new Error(`overworld chunk payload size mismatch: ${payloadBytes}`);
  }
  if (bytes.byteLength !== headerBytes + payloadBytes) {
    throw new Error(`overworld chunk file size mismatch: ${bytes.byteLength} !== ${headerBytes + payloadBytes}`);
  }
  if (validX0 >= validX1 || validY0 >= validY1
    || validX1 > OVERWORLD_STORAGE_CHUNK_TILES || validY1 > OVERWORLD_STORAGE_CHUNK_TILES) {
    throw new Error(`invalid overworld chunk valid bbox: ${validX0},${validY0},${validX1},${validY1}`);
  }

  const header = Object.freeze({
    magic: OVERWORLD_CHUNK_MAGIC,
    formatVersion,
    schemaVersion,
    headerBytes,
    flags,
    cx,
    cy,
    validBounds: Object.freeze({ x0: validX0, y0: validY0, x1: validX1, y1: validY1 }),
    payloadBytes,
    regionHash: hashHex(bytes, 32),
    projectionManifestHash: hashHex(bytes, 64),
  });
  assertExpected(header, expected);

  const surfaceOffset = headerBytes;
  const collisionOffset = surfaceOffset + OVERWORLD_SURFACE_BYTES;
  const viewOnlyOffset = collisionOffset + OVERWORLD_COLLISION_BYTES;
  const surfacePacked = bytes.subarray(surfaceOffset, collisionOffset);
  const collisionPacked = bytes.subarray(collisionOffset, viewOnlyOffset);
  const viewOnlyPacked = bytes.subarray(viewOnlyOffset, viewOnlyOffset + OVERWORLD_VIEW_ONLY_BYTES);

  const cellIndex = (x, y) => {
    assertLocalCoordinate(x, 'x');
    assertLocalCoordinate(y, 'y');
    return y * OVERWORLD_STORAGE_CHUNK_TILES + x;
  };
  const bitAt = (packed, index) => (packed[index >> 3] >> (index & 7)) & 1;
  const isValidAt = (x, y) => {
    cellIndex(x, y);
    return x >= validX0 && x < validX1 && y >= validY0 && y < validY1;
  };
  const surfaceAt = (x, y) => {
    const index = cellIndex(x, y);
    const packed = surfacePacked[index >> 1];
    return (index & 1) === 0 ? packed & 0x0f : packed >> 4;
  };
  const collisionAt = (x, y) => bitAt(collisionPacked, cellIndex(x, y));
  const viewOnlyAt = (x, y) => bitAt(viewOnlyPacked, cellIndex(x, y));
  const isWalkableAt = (x, y) => isValidAt(x, y)
    && collisionAt(x, y) === 0
    && viewOnlyAt(x, y) === 0;

  return Object.freeze({
    header,
    surfacePacked,
    collisionPacked,
    viewOnlyPacked,
    isValidAt,
    surfaceAt,
    collisionAt,
    viewOnlyAt,
    isWalkableAt,
    cellAt(x, y) {
      return Object.freeze({
        valid: isValidAt(x, y),
        surface: surfaceAt(x, y),
        collision: collisionAt(x, y),
        viewOnly: viewOnlyAt(x, y),
      });
    },
  });
}
