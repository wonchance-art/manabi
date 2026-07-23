const MAGIC = Object.freeze([0x4d, 0x43, 0x47, 0x52]); // MCGR
const RUN_BYTES = 4;
const RUN_CODE_BITS = 4;
const RUN_CODE_MASK = (1 << RUN_CODE_BITS) - 1;

export const CITY_GEO_RLE_FORMAT_VERSION = 1;
export const CITY_GEO_RLE_HEADER_BYTES = 24;

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bytesFromBase64(value) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    throw new Error('city geo RLE must be canonical base64');
  }

  const NodeBuffer = globalThis.Buffer;
  if (typeof NodeBuffer?.from === 'function') {
    const buffer = NodeBuffer.from(value, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  if (typeof globalThis.atob !== 'function') {
    throw new Error('city geo RLE base64 decoder is unavailable');
  }
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function asBytes(input) {
  if (typeof input === 'string') return bytesFromBase64(input);
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError('city geo RLE must be base64 or an ArrayBuffer view');
}

export function decodeCityGeoRle(input, expectedLength) {
  const bytes = asBytes(input);
  if (bytes.byteLength < CITY_GEO_RLE_HEADER_BYTES) {
    throw new Error(`city geo RLE is truncated: ${bytes.byteLength}`);
  }
  for (let index = 0; index < MAGIC.length; index += 1) {
    if (bytes[index] !== MAGIC[index]) throw new Error('invalid city geo RLE magic');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(4, true);
  const headerBytes = view.getUint16(6, true);
  const decodedLength = view.getUint32(8, true);
  const runCount = view.getUint32(12, true);
  const expectedCrc32 = view.getUint32(16, true);
  const payloadBytes = view.getUint32(20, true);

  if (version !== CITY_GEO_RLE_FORMAT_VERSION) {
    throw new Error(`unsupported city geo RLE version: ${version}`);
  }
  if (headerBytes !== CITY_GEO_RLE_HEADER_BYTES) {
    throw new Error(`city geo RLE header size mismatch: ${headerBytes}`);
  }
  if (expectedLength !== undefined && decodedLength !== expectedLength) {
    throw new Error(`city geo RLE decoded length mismatch: ${decodedLength} !== ${expectedLength}`);
  }
  if (payloadBytes !== runCount * RUN_BYTES) {
    throw new Error(`city geo RLE payload size mismatch: ${payloadBytes}`);
  }
  if (bytes.byteLength !== headerBytes + payloadBytes) {
    throw new Error(`city geo RLE file size mismatch: ${bytes.byteLength}`);
  }

  const terrain = new Uint8Array(decodedLength);
  let offset = 0;
  for (let index = 0; index < runCount; index += 1) {
    const packed = view.getUint32(headerBytes + index * RUN_BYTES, true);
    const code = packed & RUN_CODE_MASK;
    const count = packed >>> RUN_CODE_BITS;
    if (count === 0 || offset + count > decodedLength) {
      throw new Error(`invalid city geo RLE run at ${index}`);
    }
    terrain.fill(code, offset, offset + count);
    offset += count;
  }
  if (offset !== decodedLength) {
    throw new Error(`city geo RLE decoded length mismatch: ${offset} !== ${decodedLength}`);
  }
  const actualCrc32 = crc32(terrain);
  if (actualCrc32 !== expectedCrc32) {
    throw new Error(
      `city geo RLE checksum mismatch: ${actualCrc32.toString(16)} !== ${expectedCrc32.toString(16)}`,
    );
  }
  return terrain;
}
