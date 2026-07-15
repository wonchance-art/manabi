import { describe, expect, it, vi } from 'vitest';
import { decodeOverworldChunkV1 } from '../overworldChunk.js';
import {
  OVERWORLD_RENDER_PAGE_BYTES,
  OVERWORLD_RENDER_PAGE_TILES,
  OverworldRenderPager,
  OverworldRenderPagerStaleError,
  collectRenderPageStorageChunks,
  createOverworldRenderPageSource,
  planOverworldRenderPages,
  renderPageTileBounds,
  renderPageToStorageChunk,
} from '../overworldRenderPages.js';
import {
  TINY_CHUNK_PROJECTION_HASH,
  TINY_CHUNK_REGION_HASH,
  buildOverworldChunkV1Fixture,
} from './fixtures/overworldChunkV1Tiny.js';

const TILE_PIXELS = 16;
const PAGE_PIXELS = OVERWORLD_RENDER_PAGE_TILES * TILE_PIXELS;
const FULL_BOUNDS = Object.freeze({ x0: 0, y0: 0, x1: 256, y1: 256 });
const viewAt = (x, y, width = 320, height = 288) => ({ x, y, width, height });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function decodedFixture(cx, cy, cells = []) {
  return decodeOverworldChunkV1(buildOverworldChunkV1Fixture({
    cx,
    cy,
    validBounds: FULL_BOUNDS,
    regionHash: TINY_CHUNK_REGION_HASH,
    projectionManifestHash: TINY_CHUNK_PROJECTION_HASH,
    defaultCollision: 0,
    defaultViewOnly: 0,
    cells,
  }));
}

function fixtureLoader({ reject = () => false } = {}) {
  const chunks = new Map();
  return {
    generation: 1,
    load: vi.fn(async (cx, cy) => {
      if (reject(cx, cy)) throw new Error(`fixture load failed: ${cx},${cy}`);
      const key = `${cx},${cy}`;
      if (!chunks.has(key)) chunks.set(key, decodedFixture(cx, cy));
      return chunks.get(key);
    }),
  };
}

describe('오버월드 32×32 렌더 페이지 좌표 계약', () => {
  it('16px 원본 기준 페이지 1장은 512×512 RGBA = 1MiB다', () => {
    expect(OVERWORLD_RENDER_PAGE_BYTES).toBe(1024 * 1024);
  });

  it('화면 페이지를 먼저, padding을 다음, 이동 방향 prefetch를 마지막에 결정적으로 정렬한다', () => {
    const pages = planOverworldRenderPages(viewAt(0, 0), {
      tilePixels: TILE_PIXELS,
      padding: 1,
      prefetch: 1,
      direction: { x: 1, y: 0 },
    });
    expect(pages[0]).toMatchObject({ key: '0,0', tier: 0, visible: true });
    expect(pages.filter((page) => page.tier === 0)).toHaveLength(1);
    expect(pages.filter((page) => page.tier === 1)).toHaveLength(8);
    expect(pages.filter((page) => page.tier === 2).map((page) => page.key).sort())
      .toEqual(['2,-1', '2,0', '2,1']);
    expect(pages.map((page) => page.tier)).toEqual([...pages].map((page) => page.tier).sort());
  });

  it('배타적 화면 경계와 음수 페이지를 floor 규칙으로 처리한다', () => {
    const exact = planOverworldRenderPages(viewAt(PAGE_PIXELS, 0, PAGE_PIXELS, PAGE_PIXELS), {
      tilePixels: TILE_PIXELS,
      padding: 0,
      prefetch: 0,
    });
    expect(exact.map((page) => page.key)).toEqual(['1,0']);
    const negative = planOverworldRenderPages(viewAt(-PAGE_PIXELS, -PAGE_PIXELS, PAGE_PIXELS, PAGE_PIXELS), {
      tilePixels: TILE_PIXELS,
      padding: 0,
      prefetch: 0,
    });
    expect(negative.map((page) => page.key)).toEqual(['-1,-1']);
    expect(renderPageTileBounds(-1, -1)).toEqual({ x0: -32, y0: -32, x1: 0, y1: 0 });
  });

  it('저장 청크 경계에서 page 7→8과 page -1→0을 정확히 분해한다', () => {
    expect(renderPageToStorageChunk(7, 7)).toMatchObject({
      cx: 0, cy: 0, localPageX: 7, localPageY: 7, localTileX: 224, localTileY: 224,
    });
    expect(renderPageToStorageChunk(8, 8)).toMatchObject({
      cx: 1, cy: 1, localPageX: 0, localPageY: 0, localTileX: 0, localTileY: 0,
    });
    expect(renderPageToStorageChunk(-1, -1)).toMatchObject({
      cx: -1, cy: -1, localPageX: 7, localPageY: 7, localTileX: 224, localTileY: 224,
    });
  });

  it('여러 페이지가 공유하는 저장 청크 요청을 우선순위 보존 상태로 합친다', () => {
    const pages = [
      { pageX: 8, pageY: 0, tier: 2, distance: 8, directionRank: -8 },
      { pageX: 1, pageY: 0, tier: 1, distance: 1, directionRank: -1 },
      { pageX: 0, pageY: 0, tier: 0, distance: 0, directionRank: 0 },
      { pageX: 7, pageY: 0, tier: 1, distance: 7, directionRank: -7 },
    ];
    const requests = collectRenderPageStorageChunks(pages);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ key: '0,0', cx: 0, cy: 0, tier: 0 });
    expect(requests[1]).toMatchObject({ key: '1,0', cx: 1, cy: 0, tier: 2 });
  });

  it('페이지 source가 복사 없이 저장 청크의 해당 32×32 구간만 조회한다', () => {
    const chunk = decodedFixture(0, 0, [
      { x: 32, y: 64, surface: 7, collision: 1, viewOnly: 0 },
      { x: 63, y: 95, surface: 12, collision: 0, viewOnly: 1 },
    ]);
    const source = createOverworldRenderPageSource(chunk, 1, 2);
    expect(source).toMatchObject({
      key: '1,2', cx: 0, cy: 0, localTileX: 32, localTileY: 64,
      width: 32, height: 32,
    });
    expect(source.surfaceAt(0, 0)).toBe(7);
    expect(source.collisionAt(0, 0)).toBe(1);
    expect(source.surfaceAt(31, 31)).toBe(12);
    expect(source.viewOnlyAt(31, 31)).toBe(1);
    expect(() => source.surfaceAt(32, 0)).toThrow(/between 0 and 31/);
    expect(() => createOverworldRenderPageSource(chunk, 8, 0)).toThrow(/chunk mismatch/);
  });

  it('인접 페이지와 저장 청크 경계에 타일 중복·공백이 없다', () => {
    const leftChunk = decodedFixture(0, 0, [{ x: 255, y: 0, surface: 5 }]);
    const rightChunk = decodedFixture(1, 0, [{ x: 0, y: 0, surface: 6 }]);
    const left = createOverworldRenderPageSource(leftChunk, 7, 0);
    const right = createOverworldRenderPageSource(rightChunk, 8, 0);
    expect(left.bounds.x1).toBe(right.bounds.x0);
    expect(left.surfaceAt(31, 0)).toBe(5);
    expect(right.surfaceAt(0, 0)).toBe(6);
  });
});

describe('OverworldRenderPager', () => {
  it('가시 페이지를 원자 표시한 뒤 padding·방향 prefetch를 백그라운드에서 예열한다', async () => {
    const loader = fixtureLoader();
    const visibility = [];
    const pager = new OverworldRenderPager({
      loader,
      bakePage: vi.fn(async (source) => ({ resource: { key: source.key }, byteLength: 128 })),
      setPageVisible: (resource, visible) => visibility.push(`${resource.key}:${visible}`),
      destroyPage: vi.fn(),
      tilePixels: TILE_PIXELS,
    });
    const result = await pager.update(viewAt(0, 0), { direction: { x: 1, y: 0 } });
    expect(pager.visible).toEqual(['0,0']);
    expect(visibility).toContain('0,0:true');
    const warmed = await result.background;
    expect(warmed).toEqual({ loaded: 11, failed: 0 });
    expect(pager.size).toBe(12);
    expect(new Set(loader.load.mock.calls.map(([cx, cy]) => `${cx},${cy}`))).toEqual(
      new Set(['-1,-1', '0,-1', '-1,0', '0,0']),
    );
  });

  it('순간이동 때 새 화면이 준비될 때까지 이전 화면을 유지하고 새 화면 표시 후 이전 화면을 숨긴다', async () => {
    const loader = fixtureLoader();
    const delayed = deferred();
    const events = [];
    const pager = new OverworldRenderPager({
      loader,
      bakePage: vi.fn(async (source) => {
        if (source.key === '10,0') await delayed.promise;
        return { resource: { key: source.key }, byteLength: 64 };
      }),
      setPageVisible: (resource, visible) => events.push(`${resource.key}:${visible}`),
      destroyPage: vi.fn(),
      tilePixels: TILE_PIXELS,
    });
    const first = await pager.update(viewAt(0, 0), { padding: 0, prefetch: 0 });
    await first.background;
    const eventCountBeforeMove = events.length;
    const moving = pager.update(viewAt(10 * PAGE_PIXELS, 0), { padding: 0, prefetch: 0 });
    await Promise.resolve();
    expect(pager.visible).toEqual(['0,0']);
    expect(events.slice(eventCountBeforeMove)).not.toContain('0,0:false');
    delayed.resolve();
    await moving;
    expect(pager.visible).toEqual(['10,0']);
    expect(events.indexOf('10,0:true')).toBeLessThan(events.lastIndexOf('0,0:false'));
  });

  it('경쟁 카메라 요청과 destroy 뒤 늦은 bake가 페이지를 부활시키지 않는다', async () => {
    const loader = fixtureLoader();
    const oldBake = deferred();
    const oldStarted = deferred();
    const lateBake = deferred();
    const lateStarted = deferred();
    const destroyed = [];
    const pager = new OverworldRenderPager({
      loader,
      bakePage: vi.fn(async (source) => {
        if (source.key === '0,0') {
          oldStarted.resolve();
          return oldBake.promise;
        }
        if (source.key === '20,0') {
          lateStarted.resolve();
          return lateBake.promise;
        }
        return { resource: { key: source.key }, byteLength: 64 };
      }),
      setPageVisible: vi.fn(),
      destroyPage: (resource) => destroyed.push(resource.key),
      tilePixels: TILE_PIXELS,
    });
    const old = pager.update(viewAt(0, 0), { padding: 0, prefetch: 0 });
    await oldStarted.promise;
    const current = pager.update(viewAt(10 * PAGE_PIXELS, 0), { padding: 0, prefetch: 0 });
    oldBake.resolve({ resource: { key: '0,0' }, byteLength: 64 });
    await expect(old).rejects.toBeInstanceOf(OverworldRenderPagerStaleError);
    await current;
    expect(pager.visible).toEqual(['10,0']);
    expect(destroyed).toContain('0,0');

    const late = pager.update(viewAt(20 * PAGE_PIXELS, 0), { padding: 0, prefetch: 0 });
    await lateStarted.promise;
    pager.destroy();
    lateBake.resolve({ resource: { key: '20,0' }, byteLength: 64 });
    await expect(late).rejects.toBeInstanceOf(OverworldRenderPagerStaleError);
    expect(pager.size).toBe(0);
    expect(pager.visible).toEqual([]);
    expect(destroyed).toContain('20,0');
  });

  it('LRU의 entry·byte 상한을 지키되 현재 화면 페이지는 축출하지 않는다', async () => {
    const loader = fixtureLoader();
    const destroyed = [];
    const pager = new OverworldRenderPager({
      loader,
      bakePage: async (source) => ({ resource: { key: source.key }, byteLength: 100 }),
      setPageVisible: vi.fn(),
      destroyPage: (resource) => destroyed.push(resource.key),
      tilePixels: TILE_PIXELS,
      maxPages: 4,
      maxBytes: 400,
    });
    const first = await pager.update(viewAt(0, 0), { direction: { x: 1, y: 0 } });
    await first.background;
    expect(pager.size).toBeLessThanOrEqual(4);
    expect(pager.byteLength).toBeLessThanOrEqual(400);
    expect(pager.has('0,0')).toBe(true);
    expect(destroyed).not.toContain('0,0');

    const second = await pager.update(viewAt(12 * PAGE_PIXELS, 0), { direction: { x: 1, y: 0 } });
    await second.background;
    expect(pager.size).toBeLessThanOrEqual(4);
    expect(pager.byteLength).toBeLessThanOrEqual(400);
    expect(pager.has('12,0')).toBe(true);
  });

  it('방향 prefetch 실패는 현재 화면 commit을 막지 않고 백그라운드 결과로 격리한다', async () => {
    const loader = fixtureLoader({ reject: (cx) => cx === 1 });
    const pager = new OverworldRenderPager({
      loader,
      bakePage: async (source) => ({ resource: { key: source.key }, byteLength: 64 }),
      setPageVisible: vi.fn(),
      destroyPage: vi.fn(),
      tilePixels: TILE_PIXELS,
      maxBytes: OVERWORLD_RENDER_PAGE_BYTES,
    });
    const result = await pager.update(viewAt(7 * PAGE_PIXELS, 0), {
      padding: 0,
      prefetch: 1,
      direction: { x: 1, y: 0 },
    });
    expect(pager.visible).toEqual(['7,0']);
    expect(await result.background).toEqual({ loaded: 0, failed: 1 });
  });

  it('새 화면 저장 청크 로드가 실패하면 이전 화면을 그대로 유지한다', async () => {
    const loader = fixtureLoader({ reject: (cx) => cx === 1 });
    const events = [];
    const pager = new OverworldRenderPager({
      loader,
      bakePage: async (source) => ({ resource: { key: source.key }, byteLength: 64 }),
      setPageVisible: (resource, visible) => events.push(`${resource.key}:${visible}`),
      destroyPage: vi.fn(),
      tilePixels: TILE_PIXELS,
    });
    await pager.update(viewAt(0, 0), { padding: 0, prefetch: 0 });
    const eventCountBeforeMove = events.length;
    await expect(pager.update(viewAt(8 * PAGE_PIXELS, 0), { padding: 0, prefetch: 0 }))
      .rejects.toThrow(/fixture load failed/);
    expect(pager.visible).toEqual(['0,0']);
    expect(events.slice(eventCountBeforeMove)).not.toContain('0,0:false');
  });

  it('loader manifest 세대가 바뀌면 이전 페이지를 파기하고 같은 위치도 새 청크로 다시 굽는다', async () => {
    const loader = fixtureLoader();
    const destroyed = [];
    const bakePage = vi.fn(async (source) => ({
      resource: { key: source.key, generation: loader.generation },
      byteLength: 64,
    }));
    const pager = new OverworldRenderPager({
      loader,
      bakePage,
      setPageVisible: vi.fn(),
      destroyPage: (resource) => destroyed.push(`${resource.key}:${resource.generation}`),
      tilePixels: TILE_PIXELS,
    });
    await pager.update(viewAt(0, 0), { padding: 0, prefetch: 0 });
    expect(pager.page('0,0')).toMatchObject({ generation: 1 });
    loader.generation = 2;
    await pager.update(viewAt(0, 0), { padding: 0, prefetch: 0 });
    expect(destroyed).toContain('0,0:1');
    expect(pager.page('0,0')).toMatchObject({ generation: 2 });
    expect(bakePage).toHaveBeenCalledTimes(2);
  });
});
