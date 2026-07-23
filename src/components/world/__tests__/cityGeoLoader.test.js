import { describe, expect, it, vi } from 'vitest';
import {
  CITY_GEO_RLE_FORMAT_VERSION,
  CITY_GEO_RLE_HEADER_BYTES,
  decodeCityGeoRle,
} from '../cities/cityGeoLoader.js';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function packedFixture(runs) {
  const decoded = Uint8Array.from(runs.flatMap(([code, count]) => Array(count).fill(code)));
  const bytes = Buffer.alloc(CITY_GEO_RLE_HEADER_BYTES + runs.length * 4);
  bytes.write('MCGR', 0, 4, 'ascii');
  bytes.writeUInt16LE(CITY_GEO_RLE_FORMAT_VERSION, 4);
  bytes.writeUInt16LE(CITY_GEO_RLE_HEADER_BYTES, 6);
  bytes.writeUInt32LE(decoded.length, 8);
  bytes.writeUInt32LE(runs.length, 12);
  bytes.writeUInt32LE(crc32(decoded), 16);
  bytes.writeUInt32LE(runs.length * 4, 20);
  runs.forEach(([code, count], index) => {
    bytes.writeUInt32LE(count * 16 + code, CITY_GEO_RLE_HEADER_BYTES + index * 4);
  });
  return { bytes, decoded };
}

describe('cityGeo packed RLE loader', () => {
  it('base64와 byte view가 같은 exact terrain을 한 번에 복원한다', () => {
    const fixture = packedFixture([[1, 3], [13, 2], [0, 5], [9, 1]]);
    const base64 = fixture.bytes.toString('base64');
    expect(decodeCityGeoRle(base64, fixture.decoded.length)).toEqual(fixture.decoded);
    expect(decodeCityGeoRle(fixture.bytes, fixture.decoded.length)).toEqual(fixture.decoded);
  });

  it('Buffer가 없는 브라우저에서는 atob 경로로 같은 bytes를 복원한다', () => {
    const fixture = packedFixture([[4, 7], [11, 2]]);
    const base64 = fixture.bytes.toString('base64');
    vi.stubGlobal('Buffer', undefined);
    try {
      expect(decodeCityGeoRle(base64, fixture.decoded.length)).toEqual(fixture.decoded);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('magic·version·길이·checksum drift를 fail-closed 처리한다', () => {
    const fixture = packedFixture([[2, 4], [8, 3]]);
    const wrongMagic = Buffer.from(fixture.bytes);
    wrongMagic[0] = 0;
    expect(() => decodeCityGeoRle(wrongMagic)).toThrow(/magic/);

    const wrongVersion = Buffer.from(fixture.bytes);
    wrongVersion.writeUInt16LE(CITY_GEO_RLE_FORMAT_VERSION + 1, 4);
    expect(() => decodeCityGeoRle(wrongVersion)).toThrow(/version/);

    expect(() => decodeCityGeoRle(fixture.bytes, fixture.decoded.length + 1)).toThrow(
      /decoded length/,
    );

    const wrongChecksum = Buffer.from(fixture.bytes);
    wrongChecksum.writeUInt32LE(0, 16);
    expect(() => decodeCityGeoRle(wrongChecksum)).toThrow(/checksum/);
    expect(() => decodeCityGeoRle(fixture.bytes.subarray(0, -1))).toThrow(/file size/);
  });

  it('빈 run·overflow·비정규 base64를 거부한다', () => {
    const fixture = packedFixture([[3, 2]]);
    const emptyRun = Buffer.from(fixture.bytes);
    emptyRun.writeUInt32LE(3, CITY_GEO_RLE_HEADER_BYTES);
    expect(() => decodeCityGeoRle(emptyRun)).toThrow(/invalid.*run/);

    const overflow = Buffer.from(fixture.bytes);
    overflow.writeUInt32LE(3 * 16 + 3, CITY_GEO_RLE_HEADER_BYTES);
    expect(() => decodeCityGeoRle(overflow)).toThrow(/invalid.*run/);
    expect(() => decodeCityGeoRle('not base64')).toThrow(/canonical base64/);
  });
});
