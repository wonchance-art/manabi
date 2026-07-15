import { describe, expect, it } from 'vitest';
import {
  OVERWORLD_CHUNK_FILE_BYTES,
  OVERWORLD_CHUNK_HEADER_BYTES,
  OVERWORLD_CHUNK_PAYLOAD_BYTES,
  OVERWORLD_COLLISION_BYTES,
  OVERWORLD_SURFACE_BYTES,
  OVERWORLD_VIEW_ONLY_BYTES,
  decodeOverworldChunkV1,
} from '../overworldChunk.js';
import { encodeOverworldChunkV1 } from '../overworldChunkEncoder.js';
import {
  TINY_CHUNK_COORDINATE,
  TINY_CHUNK_PROJECTION_HASH,
  TINY_CHUNK_REGION_HASH,
  TINY_CHUNK_VALID_BOUNDS,
  buildTinyOverworldChunkV1,
} from './fixtures/overworldChunkV1Tiny.js';

describe('오버월드 청크 포맷 v1', () => {
  it('canonical encoder가 동일한 헤더·nibble·LSB-first 바이트를 재현한다', () => {
    const cells = new Map([
      ['2,1', { surface: 3, collision: 0, viewOnly: 0 }],
      ['3,1', { surface: 12, collision: 1, viewOnly: 0 }],
      ['4,2', { surface: 5, collision: 0, viewOnly: 1 }],
      ['5,4', { surface: 15, collision: 0, viewOnly: 0 }],
    ]);
    const read = (x, y) => cells.get(`${x},${y}`);
    const encoded = encodeOverworldChunkV1({
      schemaVersion: 1,
      ...TINY_CHUNK_COORDINATE,
      validBounds: TINY_CHUNK_VALID_BOUNDS,
      regionHash: TINY_CHUNK_REGION_HASH,
      projectionManifestHash: TINY_CHUNK_PROJECTION_HASH,
      surfaceAt: (x, y) => read(x, y)?.surface ?? 0,
      collisionAt: (x, y) => read(x, y)?.collision ?? 1,
      viewOnlyAt: (x, y) => read(x, y)?.viewOnly ?? 1,
    });
    expect(encoded).toEqual(buildTinyOverworldChunkV1());
  });

  it('96바이트 헤더와 canonical 4+1+1bit payload를 읽는다', () => {
    const decoded = decodeOverworldChunkV1(buildTinyOverworldChunkV1());
    expect(decoded.header).toEqual({
      magic: 'MOWC',
      formatVersion: 1,
      schemaVersion: 1,
      headerBytes: OVERWORLD_CHUNK_HEADER_BYTES,
      flags: 0,
      ...TINY_CHUNK_COORDINATE,
      validBounds: TINY_CHUNK_VALID_BOUNDS,
      payloadBytes: OVERWORLD_CHUNK_PAYLOAD_BYTES,
      regionHash: TINY_CHUNK_REGION_HASH,
      projectionManifestHash: TINY_CHUNK_PROJECTION_HASH,
    });
    expect(decoded.surfacePacked).toHaveLength(OVERWORLD_SURFACE_BYTES);
    expect(decoded.collisionPacked).toHaveLength(OVERWORLD_COLLISION_BYTES);
    expect(decoded.viewOnlyPacked).toHaveLength(OVERWORLD_VIEW_ONLY_BYTES);
  });

  it('짝수=하위 nibble·홀수=상위 nibble과 LSB-first 비트를 해석한다', () => {
    const decoded = decodeOverworldChunkV1(buildTinyOverworldChunkV1());
    expect(decoded.cellAt(2, 1)).toEqual({ valid: true, surface: 3, collision: 0, viewOnly: 0 });
    expect(decoded.cellAt(3, 1)).toEqual({ valid: true, surface: 12, collision: 1, viewOnly: 0 });
    expect(decoded.cellAt(4, 2)).toEqual({ valid: true, surface: 5, collision: 0, viewOnly: 1 });
    expect(decoded.cellAt(5, 4)).toEqual({ valid: true, surface: 15, collision: 0, viewOnly: 0 });
  });

  it('valid half-open bbox와 충돌·view-only를 독립 적용한다', () => {
    const decoded = decodeOverworldChunkV1(buildTinyOverworldChunkV1());
    expect(decoded.isWalkableAt(2, 1)).toBe(true);
    expect(decoded.isWalkableAt(3, 1)).toBe(false);
    expect(decoded.isWalkableAt(4, 2)).toBe(false);
    expect(decoded.isWalkableAt(5, 4)).toBe(true);
    expect(decoded.isValidAt(6, 4)).toBe(false);
    expect(decoded.isWalkableAt(6, 4)).toBe(false);
  });

  it('비영점 byteOffset typed-array도 복사 없이 올바르게 읽는다', () => {
    const fixture = buildTinyOverworldChunkV1();
    const container = new Uint8Array(fixture.length + 9);
    container.set(fixture, 5);
    const slice = container.subarray(5, 5 + fixture.length);
    const decoded = decodeOverworldChunkV1(slice);
    expect(decoded.header.cx).toBe(-2);
    expect(decoded.surfaceAt(3, 1)).toBe(12);
    expect(decoded.surfacePacked.buffer).toBe(container.buffer);
  });

  it('loader가 기대하는 좌표·schema·해시를 검증한다', () => {
    const fixture = buildTinyOverworldChunkV1();
    expect(() => decodeOverworldChunkV1(fixture, {
      expected: {
        schemaVersion: 1,
        ...TINY_CHUNK_COORDINATE,
        regionHash: TINY_CHUNK_REGION_HASH,
        projectionManifestHash: TINY_CHUNK_PROJECTION_HASH,
      },
    })).not.toThrow();
    expect(() => decodeOverworldChunkV1(fixture, { expected: { cx: -1 } }))
      .toThrow(/cx mismatch/);
    expect(() => decodeOverworldChunkV1(fixture, { expected: { regionHash: '00'.repeat(32) } }))
      .toThrow(/regionHash mismatch/);
  });

  it('손상·미지원 헤더와 정확하지 않은 파일 길이를 거부한다', () => {
    const corrupt = (mutate) => {
      const bytes = buildTinyOverworldChunkV1();
      mutate(bytes, new DataView(bytes.buffer));
      return bytes;
    };
    expect(() => decodeOverworldChunkV1(new Uint8Array(20))).toThrow(/truncated/);
    expect(() => decodeOverworldChunkV1(corrupt((bytes) => { bytes[0] = 0; }))).toThrow(/magic/);
    expect(() => decodeOverworldChunkV1(corrupt((bytes, view) => view.setUint16(4, 2, true))))
      .toThrow(/unsupported.*format/);
    expect(() => decodeOverworldChunkV1(corrupt((bytes, view) => view.setUint16(10, 1, true))))
      .toThrow(/flags/);
    expect(() => decodeOverworldChunkV1(corrupt((bytes, view) => view.setUint32(28, 1, true))))
      .toThrow(/payload size/);
    expect(() => decodeOverworldChunkV1(buildTinyOverworldChunkV1().subarray(0, OVERWORLD_CHUNK_FILE_BYTES - 1)))
      .toThrow(/file size/);
  });

  it('잘못된 valid bbox와 로컬 좌표를 거부한다', () => {
    const fixture = buildTinyOverworldChunkV1();
    new DataView(fixture.buffer).setUint16(24, 257, true);
    expect(() => decodeOverworldChunkV1(fixture)).toThrow(/valid bbox/);

    const decoded = decodeOverworldChunkV1(buildTinyOverworldChunkV1());
    expect(() => decoded.surfaceAt(-1, 0)).toThrow(/x must be between/);
    expect(() => decoded.collisionAt(0, 256)).toThrow(/y must be between/);
    expect(() => decoded.viewOnlyAt(1.5, 0)).toThrow(/x must be an integer/);
  });

  it('encoder가 범위·해시·레이어 값을 fail-closed 검증한다', () => {
    const valid = {
      cx: 0,
      cy: 0,
      validBounds: { x0: 0, y0: 0, x1: 1, y1: 1 },
      regionHash: TINY_CHUNK_REGION_HASH,
      projectionManifestHash: TINY_CHUNK_PROJECTION_HASH,
      surfaceAt: () => 0,
      collisionAt: () => 0,
    };
    expect(() => encodeOverworldChunkV1({ ...valid, validBounds: { x0: 0, y0: 0, x1: 257, y1: 1 } }))
      .toThrow(/validBounds/);
    expect(() => encodeOverworldChunkV1({ ...valid, regionHash: 'ABC' })).toThrow(/regionHash/);
    expect(() => encodeOverworldChunkV1({ ...valid, surfaceAt: () => 16 })).toThrow(/surfaceAt/);
    expect(() => encodeOverworldChunkV1({ ...valid, collisionAt: () => 2 })).toThrow(/collisionAt/);
  });
});
