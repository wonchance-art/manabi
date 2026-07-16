import { describe, expect, it } from 'vitest';
import {
  OverworldFeatureOverlayLoader,
  normalizeOverworldOverlayDocument,
  overlayChunkCoordinatesForWorldView,
  visibleOverworldOverlaySegments,
} from '../overworldFeatureOverlay.js';

const SOURCE = Object.freeze({
  regionId: 'test-terrain-v1',
  regionHash: 'aa'.repeat(32),
  projectionManifestHash: 'bb'.repeat(32),
  width: 512,
  height: 256,
  kind: 'river-segments',
  pathPrefix: 'rivers',
});

const segment = (id, start, end, scaleRank = 3) => ({ id, routeId: id, scaleRank, start, end });
const document = (cx, segments) => ({
  formatVersion: 1,
  kind: 'river-segments',
  cx,
  cy: 0,
  quantization: 1024,
  haloTiles: 1,
  segments,
});

const response = (value, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => value });

describe('오버월드 피처 오버레이 문서', () => {
  it('고정 포맷과 예상 청크를 검증한다', () => {
    const normalized = normalizeOverworldOverlayDocument(document(0, [
      segment('river:0', [1024, 2048], [3072, 4096]),
    ]), { kind: 'river-segments', cx: 0, cy: 0 });
    expect(normalized.segments).toHaveLength(1);
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it('잘못된 포맷·좌표·중복·영길이 선분을 거부한다', () => {
    expect(() => normalizeOverworldOverlayDocument({ ...document(0, []), quantization: 10 })).toThrow(/contract/);
    expect(() => normalizeOverworldOverlayDocument(document(0, [segment('x', [0.5, 0], [1, 1])]))).toThrow(/safe-integer/);
    expect(() => normalizeOverworldOverlayDocument(document(0, [
      segment('x', [0, 0], [1, 1]), segment('x', [1, 1], [2, 2]),
    ]))).toThrow(/unique/);
    expect(() => normalizeOverworldOverlayDocument(document(0, [segment('x', [1, 1], [1, 1])]))).toThrow(/zero length/);
  });

  it('문서와 선분의 미지 필드를 거부해 무지명 계약을 강제한다', () => {
    expect(() => normalizeOverworldOverlayDocument({ ...document(0, []), name: 'unexpected' }))
      .toThrow(/unsupported field: name/);
    expect(() => normalizeOverworldOverlayDocument(document(0, [
      { ...segment('river:0', [0, 0], [1024, 0]), name: 'unexpected' },
    ]))).toThrow(/unsupported field: name/);
  });

  it('경계 선분은 고정된 중립 분류만 허용한다', () => {
    const boundary = {
      ...document(0, []),
      kind: 'boundary-segments',
      segments: [{
        id: 'boundary:0',
        routeId: 'boundary',
        sourceKind: 'disputed',
        sourceFeatureIndex: 0,
        partIndex: 0,
        segmentIndex: 0,
        scaleRank: 1,
        boundaryClass: 'neutral-disputed',
        start: [0, 0],
        end: [1024, 0],
      }],
    };
    expect(normalizeOverworldOverlayDocument(boundary).segments[0].boundaryClass)
      .toBe('neutral-disputed');
    expect(() => normalizeOverworldOverlayDocument({
      ...boundary,
      segments: [{ ...boundary.segments[0], boundaryClass: 'claimed-by-a-country' }],
    })).toThrow(/boundaryClass is unsupported/);
  });
});

describe('오버월드 피처 오버레이 가시 범위', () => {
  it('카메라가 걸친 저장 청크만 행 우선으로 고른다', () => {
    expect(overlayChunkCoordinatesForWorldView({ x: 255 * 32, y: 0, width: 64, height: 288 }, {
      width: 512, height: 256,
    })).toEqual([{ cx: 0, cy: 0 }, { cx: 1, cy: 0 }]);
  });

  it('카메라 밖 선분을 버리고 halo 중복 id를 한 번만 남긴다', () => {
    const duplicate = segment('shared', [9 * 1024, 2 * 1024], [11 * 1024, 2 * 1024]);
    const documents = [
      document(0, [duplicate, segment('outside', [100 * 1024, 100 * 1024], [101 * 1024, 101 * 1024])]),
      document(1, [duplicate]),
    ];
    expect(visibleOverworldOverlaySegments(documents, { x: 9 * 32, y: 0, width: 64, height: 96 })
      .map(({ id }) => id)).toEqual(['shared']);
  });
});

describe('OverworldFeatureOverlayLoader', () => {
  it('content manifest에 등록된 문서만 가져오고 LRU 상한을 지킨다', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      if (url.endsWith('content-manifest.json')) return response({
        ...SOURCE,
        overlays: [
          { path: 'rivers/0/0.json' },
          { path: 'rivers/1/0.json' },
        ],
      });
      if (url.endsWith('rivers/0/0.json')) return response(document(0, [segment('a', [0, 0], [1024, 0])]));
      if (url.endsWith('rivers/1/0.json')) return response(document(1, [segment('b', [256 * 1024, 0], [257 * 1024, 0])]));
      return response(null, false);
    };
    const loader = new OverworldFeatureOverlayLoader({ source: SOURCE, fetchImpl, maxDocuments: 1 });
    expect(await loader.load(0, 1)).toBeNull();
    expect((await loader.load(0, 0)).segments[0].id).toBe('a');
    expect((await loader.load(1, 0)).segments[0].id).toBe('b');
    expect(loader.documents.size).toBe(1);
    expect(calls.filter((url) => url.endsWith('content-manifest.json'))).toHaveLength(1);
    expect(calls.some((url) => url.endsWith('rivers/0/1.json'))).toBe(false);
    loader.destroy();
  });

  it('매니페스트 지역 식별자 drift를 거부한다', async () => {
    const loader = new OverworldFeatureOverlayLoader({
      source: SOURCE,
      fetchImpl: async () => response({ ...SOURCE, regionHash: 'wrong', overlays: [] }),
    });
    await expect(loader.load(0, 0)).rejects.toThrow(/regionHash mismatch/);
    loader.destroy();
  });

  it('전체 오버레이 문서를 경로순으로 한 번 로드하고 LRU와 별도로 고정한다', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      if (url.endsWith('content-manifest.json')) return response({
        ...SOURCE,
        overlays: [
          { path: 'rivers/1/0.json' },
          { path: 'rivers/0/0.json' },
        ],
      });
      if (url.endsWith('rivers/0/0.json')) return response(document(0, [segment('a', [0, 0], [1024, 0])]));
      if (url.endsWith('rivers/1/0.json')) return response(document(1, [segment('b', [256 * 1024, 0], [257 * 1024, 0])]));
      return response(null, false);
    };
    const loader = new OverworldFeatureOverlayLoader({ source: SOURCE, fetchImpl, maxDocuments: 1 });
    const [first, concurrent] = await Promise.all([loader.loadAll(), loader.loadAll()]);
    expect(first).toBe(concurrent);
    expect(first.map(({ segments }) => segments[0].id)).toEqual(['a', 'b']);
    expect(Object.isFrozen(first)).toBe(true);
    expect(loader.documents.size).toBe(1);
    expect(await loader.loadAll()).toBe(first);
    expect(calls.filter((url) => url.endsWith('.json'))).toHaveLength(3);
    loader.destroy();
    await expect(loader.loadAll()).rejects.toThrow(/destroyed/);
  });

  it('전체 로드에서 청크가 아닌 매니페스트 경로를 거부한다', async () => {
    const loader = new OverworldFeatureOverlayLoader({
      source: SOURCE,
      fetchImpl: async () => response({ ...SOURCE, overlays: [{ path: 'rivers/not-a-chunk.json' }] }),
    });
    await expect(loader.loadAll()).rejects.toThrow(/not a chunk/);
    loader.destroy();
  });
});
