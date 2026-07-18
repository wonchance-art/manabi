import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const EMEA_NODE_DIR = path.join(
  REPO_ROOT,
  'public/assets/overworld/europe-mediterranean-middle-east-transport-nodes-preview-v1',
);
const EMEA_RAIL_DIR = path.join(
  REPO_ROOT,
  'public/assets/overworld/europe-mediterranean-middle-east-transport-preview-v1',
);

function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = Math.max(0, Math.min(1, (
    (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
  ) / (dx * dx + dy * dy)));
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

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
  it('출시 표기·청크·게이트 종류 drift와 중복을 거부한다', () => {
    expect(normalizeOverworldTransportNodeManifest(
      nodeManifest({ releaseEligible: true }),
    ).releaseEligible).toBe(true);
    expect(() => normalizeOverworldTransportNodeManifest(nodeManifest({ releaseEligible: 'yes' })))
      .toThrow(/must be boolean/);
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

  it('유럽 철도 허브는 별도 노선 키 없이 지리·언어 앵커만 허용한다', () => {
    const railHub = {
      id: 'fixture-rail-hub',
      type: 'rail-hub',
      label: '시험 철도 허브',
      contentLocale: 'de',
      arrivalOffset: [0, 0],
      lon: 1,
      lat: 1,
    };
    expect(normalizeOverworldTransportNodeManifest(nodeManifest({ nodes: [railHub] })).nodes[0])
      .toEqual(railHub);
    expect(() => normalizeOverworldTransportNodeManifest(nodeManifest({
      nodes: [{ ...railHub, routeId: 'invented' }],
    }))).toThrow(/exactly/);
    expect(() => normalizeOverworldTransportNodeManifest(nodeManifest({
      nodes: [{ ...railHub, arrivalOffset: [0.5, 0] }],
    }))).toThrow(/arrivalOffset/);
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

  it('체크인된 유럽 7개 철도 허브가 보행 셀과 철도 오버레이를 함께 따른다', () => {
    const nodeContent = JSON.parse(readFileSync(path.join(EMEA_NODE_DIR, 'content-manifest.json'), 'utf8'));
    const railContent = JSON.parse(readFileSync(path.join(EMEA_RAIL_DIR, 'content-manifest.json'), 'utf8'));
    const nodes = nodeContent.nodes.flatMap((entry) => (
      JSON.parse(readFileSync(path.join(EMEA_NODE_DIR, entry.path), 'utf8')).nodes
    ));
    const hubs = nodes.filter(({ type }) => type === 'rail-hub');
    expect(hubs.map(({ id }) => id).sort()).toEqual([
      'berlin-rail-hub',
      'istanbul-rail-hub',
      'london-rail-hub',
      'madrid-rail-hub',
      'paris-rail-hub',
      'rome-rail-hub',
      'vienna-rail-hub',
    ]);
    expect(JSON.parse(readFileSync(path.join(EMEA_NODE_DIR, 'build-report.json'), 'utf8')))
      .toEqual({
        releaseEligible: true,
        nodeCount: 9,
        chunkCount: 6,
        nodeTypes: ['air-gate', 'rail-hub', 'transsib-gate'],
      });

    const quantization = railContent.railRules.quantization;
    for (const hub of hubs) {
      const [x, y] = hub.tile;
      const railPath = `rail/${Math.floor(x / 256)}/${Math.floor(y / 256)}.json`;
      expect(railContent.overlays.some(({ path: entry }) => entry === railPath), hub.id).toBe(true);
      const overlay = JSON.parse(readFileSync(path.join(EMEA_RAIL_DIR, railPath), 'utf8'));
      const point = [x * quantization, y * quantization];
      const nearest = Math.min(...overlay.segments.map(({ start, end }) => (
        distanceToSegment(point, start, end) / quantization
      )));
      expect(nearest, hub.id).toBeLessThan(2);
      expect(Object.isFrozen(normalizeOverworldTransportNodeDocument({
        formatVersion: 2,
        kind: 'transport-nodes',
        cx: Math.floor(x / 256),
        cy: Math.floor(y / 256),
        nodes: [hub],
      }, {
        cx: Math.floor(x / 256),
        cy: Math.floor(y / 256),
        width: nodeContent.width,
        height: nodeContent.height,
      }).nodes[0].arrivalOffset)).toBe(true);
    }
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
