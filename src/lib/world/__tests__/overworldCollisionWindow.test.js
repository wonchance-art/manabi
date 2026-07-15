import { describe, expect, it, vi } from 'vitest';
import {
  OVERWORLD_STORAGE_CHUNK_TILES,
} from '../overworldChunk.js';
import {
  OverworldChunkLoader,
} from '../overworldChunkLoader.js';
import {
  OVERWORLD_COLLISION_WINDOW_CHUNKS,
  OverworldCollisionWindow,
  OverworldCollisionWindowStaleError,
  globalTileToStorageChunk,
  overworldCollisionWindowCoordinates,
} from '../overworldCollisionWindow.js';
import {
  TINY_CHUNK_PROJECTION_HASH,
  TINY_CHUNK_REGION_HASH,
  buildOverworldChunkV1Fixture,
} from './fixtures/overworldChunkV1Tiny.js';

const MANIFEST = Object.freeze({
  regionId: 'apac-fixture',
  schemaVersion: 1,
  regionHash: TINY_CHUNK_REGION_HASH,
  projectionManifestHash: TINY_CHUNK_PROJECTION_HASH,
});
const FULL_BOUNDS = Object.freeze({
  x0: 0, y0: 0, x1: OVERWORLD_STORAGE_CHUNK_TILES, y1: OVERWORLD_STORAGE_CHUNK_TILES,
});

function responseFor(bytes) {
  return {
    ok: true,
    status: 200,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

function coordinateFromUrl(url) {
  const match = url.match(/\/(-?\d+)\/(-?\d+)\.owc$/);
  if (!match) throw new Error(`unexpected fixture URL: ${url}`);
  return { cx: Number(match[1]), cy: Number(match[2]) };
}

function fixtureFetch(cellsForChunk = () => []) {
  return vi.fn(async (url) => {
    const { cx, cy } = coordinateFromUrl(url);
    return responseFor(buildOverworldChunkV1Fixture({
      cx,
      cy,
      validBounds: FULL_BOUNDS,
      cells: cellsForChunk(cx, cy),
    }));
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

describe('전역 타일 좌표 분해', () => {
  it.each([
    [-257, -2, 255],
    [-256, -1, 0],
    [-1, -1, 255],
    [0, 0, 0],
    [255, 0, 255],
    [256, 1, 0],
  ])('%i를 floor 기반 청크 %i / 로컬 %i로 나눈다', (globalX, cx, localX) => {
    expect(globalTileToStorageChunk(globalX, 0)).toEqual({ cx, cy: 0, localX, localY: 0 });
  });

  it('안전한 정수만 받고 중심부터 결정적 순서의 3×3 좌표를 만든다', () => {
    expect(() => globalTileToStorageChunk(0.5, 0)).toThrow(/safe integer/);
    expect(() => globalTileToStorageChunk(Number.MAX_SAFE_INTEGER, 0)).toThrow(/32-bit range/);
    const coordinates = overworldCollisionWindowCoordinates(4, -3);
    expect(coordinates).toHaveLength(OVERWORLD_COLLISION_WINDOW_CHUNKS);
    expect(coordinates[0]).toEqual({ cx: 4, cy: -3, distance: 0 });
    expect(new Set(coordinates.map(({ cx, cy }) => `${cx},${cy}`)).size).toBe(9);
  });
});

describe('OverworldCollisionWindow', () => {
  it('3×3 전체를 로드한 뒤 원자적으로 공개하고 동일 중심 요청을 합친다', async () => {
    const pending = new Map();
    const fetchImpl = vi.fn((url) => {
      const wait = deferred();
      pending.set(url, wait);
      return wait.promise;
    });
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld', manifest: MANIFEST, fetchImpl,
    });
    const window = new OverworldCollisionWindow({ loader });
    const first = window.loadAround(12, 20);
    const second = window.loadAround(12, 20);
    expect(first).toBe(second);
    expect(fetchImpl).toHaveBeenCalledTimes(9);
    expect(window.ready).toBe(false);
    for (const [url, wait] of pending) {
      const { cx, cy } = coordinateFromUrl(url);
      wait.resolve(responseFor(buildOverworldChunkV1Fixture({
        cx, cy, validBounds: FULL_BOUNDS,
      })));
    }
    await first;
    expect(window.ready).toBe(true);
    expect(window.size).toBe(9);
    expect(window.center).toEqual({ cx: 0, cy: 0 });
  });

  it('양수·음수 저장 청크 경계 양쪽에서 표면과 통행을 동일 규칙으로 질의한다', async () => {
    const fetchImpl = fixtureFetch((cx, cy) => {
      if (cy !== 0) return [];
      if (cx === -1) return [{ x: 255, y: 10, surface: 2, collision: 0, viewOnly: 0 }];
      if (cx === 0) return [
        { x: 0, y: 10, surface: 3, collision: 0, viewOnly: 0 },
        { x: 255, y: 10, surface: 4, collision: 0, viewOnly: 1 },
      ];
      if (cx === 1) return [{ x: 0, y: 10, surface: 5, collision: 0, viewOnly: 0 }];
      return [];
    });
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld', manifest: MANIFEST, fetchImpl,
    });
    const window = new OverworldCollisionWindow({ loader });
    await window.loadCenterChunk(0, 0);

    expect(window.cellAt(-1, 10)).toMatchObject({ loaded: true, surface: 2, walkable: true });
    expect(window.cellAt(0, 10)).toMatchObject({ loaded: true, surface: 3, walkable: true });
    expect(window.cellAt(255, 10)).toMatchObject({
      loaded: true, surface: 4, viewOnly: 1, walkable: false,
    });
    expect(window.cellAt(256, 10)).toMatchObject({ loaded: true, surface: 5, walkable: true });
    expect(window.isWalkable(-1, 10)).toBe(true);
    expect(window.isWalkable(255, 10)).toBe(false);
    expect(window.isWalkable(256, 10)).toBe(true);
  });

  it('미로드 셀과 valid bbox 밖 셀을 fail-closed로 처리한다', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const { cx, cy } = coordinateFromUrl(url);
      const validBounds = cx === 0 && cy === 0
        ? { x0: 2, y0: 2, x1: 4, y1: 4 }
        : FULL_BOUNDS;
      return responseFor(buildOverworldChunkV1Fixture({
        cx,
        cy,
        validBounds,
        defaultCollision: 0,
        defaultViewOnly: 0,
      }));
    });
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld', manifest: MANIFEST, fetchImpl,
    });
    const window = new OverworldCollisionWindow({ loader });
    await window.loadCenterChunk(0, 0);

    expect(window.cellAt(0, 0)).toEqual({
      loaded: true,
      valid: false,
      surface: null,
      collision: 1,
      viewOnly: 1,
      walkable: false,
    });
    expect(window.isWalkable(0, 0)).toBe(false);
    expect(window.cellAt(512, 0)).toMatchObject({ loaded: false, walkable: false });
    expect(window.isWalkable(512, 0)).toBe(false);
  });

  it('실패한 새 창은 기존 완성 창을 보존한다', async () => {
    let failCx = null;
    const fetchImpl = vi.fn(async (url) => {
      const { cx, cy } = coordinateFromUrl(url);
      if (cx === failCx) return { ok: false, status: 503 };
      return responseFor(buildOverworldChunkV1Fixture({
        cx,
        cy,
        validBounds: FULL_BOUNDS,
        defaultCollision: 0,
        defaultViewOnly: 0,
      }));
    });
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld', manifest: MANIFEST, fetchImpl,
    });
    const window = new OverworldCollisionWindow({ loader });
    await window.loadCenterChunk(0, 0);
    failCx = 2;
    await expect(window.loadCenterChunk(2, 0)).rejects.toThrow(/503/);
    expect(window.center).toEqual({ cx: 0, cy: 0 });
    expect(window.isWalkable(0, 0)).toBe(true);
  });

  it('나중 중심 요청이 먼저 완료돼도 오래된 요청이 창을 되돌리지 못한다', async () => {
    const pending = new Map();
    const fetchImpl = vi.fn((url) => {
      const wait = deferred();
      pending.set(url, wait);
      return wait.promise;
    });
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld', manifest: MANIFEST, fetchImpl,
    });
    const window = new OverworldCollisionWindow({ loader });
    const oldRequest = window.loadCenterChunk(0, 0);
    const oldUrls = [...pending.keys()];
    const newRequest = window.loadCenterChunk(4, 0);
    const newUrls = [...pending.keys()].filter((url) => !oldUrls.includes(url));

    for (const url of newUrls) {
      const { cx, cy } = coordinateFromUrl(url);
      pending.get(url).resolve(responseFor(buildOverworldChunkV1Fixture({
        cx, cy, validBounds: FULL_BOUNDS,
      })));
    }
    await newRequest;
    expect(window.center).toEqual({ cx: 4, cy: 0 });

    for (const url of oldUrls) {
      const { cx, cy } = coordinateFromUrl(url);
      pending.get(url).resolve(responseFor(buildOverworldChunkV1Fixture({
        cx, cy, validBounds: FULL_BOUNDS,
      })));
    }
    await expect(oldRequest).rejects.toBeInstanceOf(OverworldCollisionWindowStaleError);
    expect(window.center).toEqual({ cx: 4, cy: 0 });
  });

  it('loader 세대 교체와 destroy 뒤 기존 데이터를 노출하지 않는다', async () => {
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld', manifest: MANIFEST, fetchImpl: fixtureFetch(),
    });
    const window = new OverworldCollisionWindow({ loader });
    await window.loadCenterChunk(0, 0);
    expect(window.ready).toBe(true);
    loader.reset();
    expect(window.ready).toBe(false);
    expect(window.cellAt(0, 0)).toMatchObject({ loaded: false, walkable: false });

    window.destroy();
    expect(window.size).toBe(0);
    await expect(window.loadCenterChunk(0, 0)).rejects.toThrow(/destroyed/);
  });

  it('진행 중 destroy 뒤 늦게 끝난 응답이 창을 부활시키지 않는다', async () => {
    const pending = new Map();
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld',
      manifest: MANIFEST,
      fetchImpl: vi.fn((url) => {
        const wait = deferred();
        pending.set(url, wait);
        return wait.promise;
      }),
    });
    const window = new OverworldCollisionWindow({ loader });
    const request = window.loadCenterChunk(0, 0);
    window.destroy();
    for (const [url, wait] of pending) {
      const { cx, cy } = coordinateFromUrl(url);
      wait.resolve(responseFor(buildOverworldChunkV1Fixture({
        cx, cy, validBounds: FULL_BOUNDS,
      })));
    }
    await expect(request).rejects.toBeInstanceOf(OverworldCollisionWindowStaleError);
    expect(window.ready).toBe(false);
    expect(window.size).toBe(0);
  });
});
