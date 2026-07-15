import { describe, expect, it, vi } from 'vitest';
import {
  OVERWORLD_CHUNK_FILE_BYTES,
  OVERWORLD_CHUNK_HEADER_BYTES,
} from '../overworldChunk.js';
import {
  OverworldChunkLoader,
  OverworldChunkStaleError,
  PackedChunkCache,
  overworldChunkUrl,
} from '../overworldChunkLoader.js';
import {
  TINY_CHUNK_COORDINATE,
  TINY_CHUNK_PROJECTION_HASH,
  TINY_CHUNK_REGION_HASH,
  buildTinyOverworldChunkV1,
} from './fixtures/overworldChunkV1Tiny.js';

const MANIFEST = Object.freeze({
  regionId: 'apac-fixture',
  schemaVersion: 1,
  regionHash: TINY_CHUNK_REGION_HASH,
  projectionManifestHash: TINY_CHUNK_PROJECTION_HASH,
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('PackedChunkCache', () => {
  it('조회한 항목을 최근으로 옮기고 entry 상한에서 가장 오래된 항목을 제거한다', () => {
    const cache = new PackedChunkCache({ maxEntries: 2, maxBytes: 100 });
    cache.set('a', { id: 'a' }, 10);
    cache.set('b', { id: 'b' }, 10);
    expect(cache.get('a')).toEqual({ id: 'a' });
    cache.set('c', { id: 'c' }, 10);
    expect(cache.keys()).toEqual(['a', 'c']);
    expect(cache.has('b')).toBe(false);
  });

  it('byte 상한과 교체·삭제의 총량을 정확히 유지한다', () => {
    const cache = new PackedChunkCache({ maxEntries: 5, maxBytes: 20 });
    cache.set('a', 1, 12);
    cache.set('b', 2, 12);
    expect(cache.keys()).toEqual(['b']);
    expect(cache.byteLength).toBe(12);
    cache.set('b', 3, 7);
    expect(cache.byteLength).toBe(7);
    expect(cache.delete('b')).toBe(true);
    expect(cache.byteLength).toBe(0);
  });
});

describe('OverworldChunkLoader', () => {
  it('안전한 canonical URL만 만든다', () => {
    expect(overworldChunkUrl('/assets/overworld/', 'apac-fixture', -2, 3))
      .toBe('/assets/overworld/apac-fixture/-2/3.owc');
    expect(() => overworldChunkUrl('/assets', '../secret', 0, 0)).toThrow(/region id/);
    expect(() => overworldChunkUrl('/assets', 'apac', 1.5, 0)).toThrow(/safe integer/);
  });

  it('브라우저 기본 fetch를 Window에 바인딩해 illegal invocation을 막는다', async () => {
    const bytes = buildTinyOverworldChunkV1();
    const fetchImpl = vi.fn(function fetchWithReceiver() {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(responseFor(bytes));
    });
    vi.stubGlobal('fetch', fetchImpl);
    try {
      const loader = new OverworldChunkLoader({
        baseUrl: '/assets/overworld',
        manifest: MANIFEST,
      });
      const chunk = await loader.load(TINY_CHUNK_COORDINATE.cx, TINY_CHUNK_COORDINATE.cy);
      expect(chunk.surfaceAt(2, 1)).toBe(3);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('동일 세대·좌표 요청을 같은 Promise와 단일 fetch로 합치고 결과를 cache한다', async () => {
    const pending = deferred();
    const fetchImpl = vi.fn(() => pending.promise);
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld', manifest: MANIFEST, fetchImpl,
    });
    const first = loader.load(TINY_CHUNK_COORDINATE.cx, TINY_CHUNK_COORDINATE.cy);
    const second = loader.load(TINY_CHUNK_COORDINATE.cx, TINY_CHUNK_COORDINATE.cy);
    expect(first).toBe(second);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('/assets/overworld/apac-fixture/-2/3.owc');
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    pending.resolve(responseFor(buildTinyOverworldChunkV1()));
    const decoded = await first;
    expect(decoded.surfaceAt(2, 1)).toBe(3);
    expect(loader.pendingCount).toBe(0);
    expect(loader.cacheSize).toBe(1);
    expect(loader.cacheBytes).toBe(OVERWORLD_CHUNK_FILE_BYTES);
    expect(await loader.load(-2, 3)).toBe(decoded);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('HTTP 오류와 헤더 기대값 불일치를 cache하지 않고 재시도할 수 있다', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(responseFor(buildTinyOverworldChunkV1()));
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld',
      manifest: { ...MANIFEST, regionHash: '00'.repeat(32) },
      fetchImpl,
    });
    await expect(loader.load(-2, 3)).rejects.toThrow(/503/);
    await expect(loader.load(-2, 3)).rejects.toThrow(/regionHash mismatch/);
    expect(loader.cacheSize).toBe(0);
    expect(loader.pendingCount).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('reset이 요청을 abort하고 신호를 무시한 늦은 응답도 stale로 폐기한다', async () => {
    const pending = deferred();
    let signal;
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld',
      manifest: MANIFEST,
      fetchImpl: vi.fn((url, init) => {
        signal = init.signal;
        return pending.promise;
      }),
    });
    const request = loader.load(-2, 3);
    const firstGeneration = loader.generation;
    expect(loader.reset()).toBe(firstGeneration + 1);
    expect(signal.aborted).toBe(true);
    pending.resolve(responseFor(buildTinyOverworldChunkV1()));
    await expect(request).rejects.toBeInstanceOf(OverworldChunkStaleError);
    expect(loader.cacheSize).toBe(0);
    expect(loader.pendingCount).toBe(0);
  });

  it('destroy가 진행 중 요청과 cache를 폐기하고 재사용을 막는다', async () => {
    const firstPending = deferred();
    const secondPending = deferred();
    const fetchImpl = vi.fn()
      .mockReturnValueOnce(firstPending.promise)
      .mockReturnValueOnce(secondPending.promise);
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld', manifest: MANIFEST, fetchImpl,
    });
    const first = loader.load(-2, 3);
    firstPending.resolve(responseFor(buildTinyOverworldChunkV1()));
    await first;

    const second = loader.load(-1, 3);
    loader.destroy();
    const mismatched = buildTinyOverworldChunkV1();
    new DataView(mismatched.buffer).setInt32(12, -1, true);
    secondPending.resolve(responseFor(mismatched));
    await expect(second).rejects.toBeInstanceOf(OverworldChunkStaleError);
    expect(loader.cacheSize).toBe(0);
    expect(loader.pendingCount).toBe(0);
    await expect(loader.load(-2, 3)).rejects.toThrow(/destroyed/);
  });

  it('cache 상한을 loader 결과에도 적용한다', async () => {
    const fixtures = [-2, -1].map((cx) => {
      const bytes = buildTinyOverworldChunkV1();
      new DataView(bytes.buffer).setInt32(12, cx, true);
      return bytes;
    });
    const cache = new PackedChunkCache({
      maxEntries: 1,
      maxBytes: OVERWORLD_CHUNK_FILE_BYTES + OVERWORLD_CHUNK_HEADER_BYTES,
    });
    const loader = new OverworldChunkLoader({
      baseUrl: '/assets/overworld',
      manifest: MANIFEST,
      cache,
      fetchImpl: vi.fn()
        .mockResolvedValueOnce(responseFor(fixtures[0]))
        .mockResolvedValueOnce(responseFor(fixtures[1])),
    });
    await loader.load(-2, 3);
    await loader.load(-1, 3);
    expect(cache.size).toBe(1);
    expect(cache.keys()).toEqual([`${loader.generation}:-1,3`]);
  });
});
