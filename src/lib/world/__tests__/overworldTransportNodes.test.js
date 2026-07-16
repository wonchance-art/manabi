import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildTransportNodeArtifacts } from '../../../../scripts/world/build-overworld-transport-nodes.mjs';
import { createEquirectangularTileFrame } from '../overworldGeo.js';
import {
  OverworldTransportNodeLoader,
  normalizeOverworldTransportNodeDocument,
  normalizeOverworldTransportNodeManifest,
} from '../overworldTransportNodes.js';

const sha256 = (input) => createHash('sha256').update(input).digest('hex');
const canonicalJson = (value) => new TextEncoder().encode(`${JSON.stringify(value)}\n`);

function baseManifest() {
  return {
    schemaVersion: 1,
    releaseEligible: false,
    generatorGitSha: null,
    regionId: 'node-base',
    bbox: [0, 0, 2, 2],
    earthRadiusMeters: 6371008.8,
    metersPerTile: 1000,
    chunkTiles: 256,
    projection: {
      id: 'node-equirectangular-screen-axis-v1',
      method: 'equirectangular',
      axisMode: 'screen-axis',
      lon0: 0,
      lat0: 0,
      standardLat: 0,
    },
    tileFrame: {
      origin: 'projected-bbox-north-west',
      yAxis: 'south',
      boundary: 'half-open',
      rounding: 'nearest-half-away-from-zero',
    },
    supersampling: { width: 4, height: 4, offsets: [0.125, 0.375, 0.625, 0.875] },
    surfaceClasses: { sea: 0, land: 1 },
    surfacePriority: ['land', 'sea'],
    previewMasks: { collision: 'all-blocked', viewOnly: 'all-view-only' },
    sources: [{
      id: 'natural-earth-land-test',
      cacheFile: 'land.json',
      url: 'https://example.com/land.json',
      version: 'v1',
      sha256: '1'.repeat(64),
      bytes: 1,
      license: 'test',
      role: 'land',
      required: true,
    }],
  };
}

function nodeManifest(overrides = {}) {
  return {
    schemaVersion: 2,
    releaseEligible: false,
    generatorGitSha: null,
    regionId: 'node-preview-v1',
    baseRegion: {
      manifestPath: 'base.json',
      directory: 'base',
      contentManifest: 'content-manifest.json',
      contentManifestSha256: '2'.repeat(64),
      contentManifestBytes: 1,
    },
    nodeRules: { chunkTiles: 256 },
    nodes: [{
      id: 'fixture-transsib',
      type: 'transsib-gate',
      label: '시험 횡단열차역',
      contentLocale: 'ru',
      corridorStopId: 'fixture',
      lon: 1,
      lat: 1,
    }],
    ...overrides,
  };
}

describe('오버월드 교통 노드 계약', () => {
  it('미리보기·청크·게이트 종류 drift와 중복을 거부한다', () => {
    expect(() => normalizeOverworldTransportNodeManifest(nodeManifest({ releaseEligible: true })))
      .toThrow(/releaseEligible=false/);
    expect(() => normalizeOverworldTransportNodeManifest(nodeManifest({ nodeRules: { chunkTiles: 128 } })))
      .toThrow(/256/);
    expect(() => normalizeOverworldTransportNodeManifest(nodeManifest({
      nodes: [nodeManifest().nodes[0], nodeManifest().nodes[0]],
    }))).toThrow(/duplicate/);
  });

  it('문서 미지 필드·범위 밖 좌표·잘못된 청크 소속을 거부한다', () => {
    const valid = {
      formatVersion: 2,
      kind: 'transport-nodes',
      cx: 0,
      cy: 0,
      nodes: [{
        id: 'fixture-transsib',
        type: 'transsib-gate',
        label: '시험 횡단열차역',
        contentLocale: 'ru',
        corridorStopId: 'fixture',
        tile: [12, 34],
      }],
    };
    expect(normalizeOverworldTransportNodeDocument(valid, { cx: 0, cy: 0, width: 512, height: 256 })
      .nodes[0].tile).toEqual([12, 34]);
    expect(() => normalizeOverworldTransportNodeDocument({ ...valid, name: 'unexpected' }, {
      cx: 0, cy: 0, width: 512, height: 256,
    })).toThrow(/exactly/);
    expect(() => normalizeOverworldTransportNodeDocument({
      ...valid,
      nodes: [{ ...valid.nodes[0], tile: [300, 34] }],
    }, { cx: 0, cy: 0, width: 512, height: 256 })).toThrow(/document chunk/);
  });

  it('항공 게이트의 공항 코드·언어 앵커를 타입별로 검증한다', () => {
    const airGate = {
      id: 'fixture-air',
      type: 'air-gate',
      label: '시험 공항',
      contentLocale: 'fr',
      airportCode: 'CDG',
      lon: 1,
      lat: 1,
    };
    expect(normalizeOverworldTransportNodeManifest(nodeManifest({ nodes: [airGate] })).nodes[0])
      .toMatchObject({ type: 'air-gate', airportCode: 'CDG', contentLocale: 'fr' });
    expect(() => normalizeOverworldTransportNodeManifest(nodeManifest({
      nodes: [{ ...airGate, airportCode: 'cdg' }],
    }))).toThrow(/airportCode/);
    expect(() => normalizeOverworldTransportNodeManifest(nodeManifest({
      nodes: [{ ...airGate, contentLocale: 'French' }],
    }))).toThrow(/contentLocale/);
  });

  it('같은 manifest에서 byte-identical 노드 인덱스를 만든다', () => {
    const manifest = nodeManifest();
    const manifestBytes = canonicalJson(manifest);
    const base = baseManifest();
    const frame = createEquirectangularTileFrame(base);
    const args = {
      manifestBytes,
      manifest,
      baseRegionManifest: base,
      baseContent: {
        width: frame.width,
        height: frame.height,
        chunkColumns: frame.chunkColumns,
        chunkRows: frame.chunkRows,
        projectionManifestHash: sha256(canonicalJson(base.projection)),
      },
      checkedInChunks: new Map([['0/0', { isWalkableAt: () => true }]]),
    };
    const first = buildTransportNodeArtifacts(args);
    const second = buildTransportNodeArtifacts(args);
    expect(first.map(({ path }) => path)).toEqual(second.map(({ path }) => path));
    expect(first.map(({ bytes }) => sha256(bytes))).toEqual(second.map(({ bytes }) => sha256(bytes)));
  });
});

describe('OverworldTransportNodeLoader', () => {
  it('manifest에 등록된 청크만 가져오고 타일에서 노드를 찾는다', async () => {
    const source = {
      regionId: 'node-preview-v1',
      regionHash: 'a'.repeat(64),
      projectionManifestHash: 'b'.repeat(64),
      width: 512,
      height: 256,
      pathPrefix: 'nodes',
    };
    const calls = [];
    const loader = new OverworldTransportNodeLoader({
      source,
      fetchImpl: async (url) => {
        calls.push(url);
        if (url.endsWith('content-manifest.json')) return {
          ok: true,
          json: async () => ({ ...source, nodes: [{ path: 'nodes/0/0.json' }] }),
        };
        if (url.endsWith('nodes/0/0.json')) return {
          ok: true,
          json: async () => ({
            formatVersion: 2,
            kind: 'transport-nodes',
            cx: 0,
            cy: 0,
            nodes: [{
              id: 'fixture-transsib',
              type: 'transsib-gate',
              label: '시험 횡단열차역',
              contentLocale: 'ru',
              corridorStopId: 'fixture',
              tile: [12, 34],
            }],
          }),
        };
        return { ok: false, status: 404 };
      },
    });
    expect(await loader.load(1, 0)).toBeNull();
    expect((await loader.loadAtTile(12, 34)).map(({ id }) => id)).toEqual(['fixture-transsib']);
    expect(await loader.loadAtTile(13, 34)).toEqual([]);
    expect(calls.some((url) => url.endsWith('nodes/1/0.json'))).toBe(false);
    loader.destroy();
  });
});
