import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildPlayabilityArtifacts } from '../../../../scripts/world/build-overworld-playability.mjs';
import { decodeOverworldChunkV1 } from '../overworldChunk.js';
import { createEquirectangularTileFrame } from '../overworldGeo.js';
import {
  classifyPlayabilityComponents,
  derivePlayability,
  labelLandComponents,
  normalizeOverworldPlayabilityManifest,
} from '../overworldPlayability.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../../..');
const CHECKED_IN_DIR = path.join(
  REPO_ROOT,
  'public/assets/overworld/asia-pacific-playability-preview-v1',
);
const CHECKED_IN_EMEA_DIR = path.join(
  REPO_ROOT,
  'public/assets/overworld/europe-mediterranean-middle-east-playability-preview-v1',
);

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function baseManifest() {
  return {
    schemaVersion: 1,
    releaseEligible: false,
    generatorGitSha: null,
    regionId: 'tiny-surface-preview-v1',
    bbox: [0, 0, 0.2, 0.2],
    earthRadiusMeters: 6371008.8,
    metersPerTile: 10000,
    chunkTiles: 256,
    projection: {
      id: 'tiny-equirectangular-screen-axis-v1',
      method: 'equirectangular',
      axisMode: 'screen-axis',
      lon0: 0.1,
      lat0: 0.1,
      standardLat: 0.1,
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
      url: 'https://example.test/land.json',
      version: 'test',
      sha256: '0'.repeat(64),
      bytes: 1,
      license: 'test',
      role: 'land',
      required: true,
    }],
  };
}

function playabilityManifest(baseBytes, overrides = {}) {
  return {
    schemaVersion: 1,
    releaseEligible: false,
    generatorGitSha: null,
    regionId: 'tiny-playability-preview-v1',
    baseTerrain: {
      manifestPath: 'scripts/world/tiny.json',
      directory: 'public/assets/overworld/tiny',
      contentManifest: 'content-manifest.json',
      contentManifestSha256: sha256(baseBytes),
      contentManifestBytes: baseBytes.byteLength,
    },
    terrainClasses: { sea: 0, lowland: 1, highland: 2, mountain: 3, alpine: 4 },
    componentRules: {
      connectivity: 4,
      minimumWalkableTiles: 5,
      seaCollision: 'blocked',
      seaViewOnly: false,
      smallIsland: 'view-only',
      remoteOverride: 'view-only',
      anchorSnapMaxTiles: 2,
    },
    policyAnchors: [],
    ...overrides,
  };
}

describe('overworld playability preview', () => {
  it('알 수 없는 manifest 필드와 출시 가능 표시를 거부한다', () => {
    const bytes = new TextEncoder().encode('{}\n');
    expect(() => normalizeOverworldPlayabilityManifest({
      ...playabilityManifest(bytes),
      surprise: true,
    })).toThrow(/keys must be exactly/);
    expect(() => normalizeOverworldPlayabilityManifest({
      ...playabilityManifest(bytes),
      releaseEligible: true,
    })).toThrow(/releaseEligible=false/);
  });

  it('육지를 4방향 성분으로 결정적으로 분리한다', () => {
    const surfaces = new Uint8Array([
      1, 1, 0, 0, 1,
      1, 1, 0, 1, 1,
      0, 0, 0, 0, 0,
      2, 0, 3, 3, 3,
    ]);
    const first = labelLandComponents({ width: 5, height: 4, surfaces });
    const second = labelLandComponents({ width: 5, height: 4, surfaces });
    expect(first.components.map(({ tileCount }) => tileCount)).toEqual([4, 3, 1, 3]);
    expect([...first.labels]).toEqual([...second.labels]);
    expect(first.labels[0]).toBe(first.labels[6]);
    expect(first.labels[15]).not.toBe(first.labels[17]);
  });

  it('크기 기준·명시 허용·명시 관람 전용을 우선순위대로 적용한다', () => {
    const surfaces = new Uint8Array([
      1, 1, 0, 1, 1, 1,
      1, 1, 0, 1, 1, 1,
      0, 0, 0, 0, 0, 0,
      1, 1, 1, 1, 1, 1,
    ]);
    const frame = { width: 6, height: 4, project: (lon, lat) => ({ x: lon, y: lat }) };
    const baseBytes = new TextEncoder().encode('{}\n');
    const result = derivePlayability({
      frame,
      surfaces,
      manifest: playabilityManifest(baseBytes, {
        policyAnchors: [
          { id: 'small-home', lon: 0, lat: 0, policy: 'walkable', maxSnapTiles: 0 },
          { id: 'large-remote', lon: 4, lat: 3, policy: 'view-only', maxSnapTiles: 0 },
        ],
      }),
    });
    expect(result.components.map(({ tileCount, policy }) => [tileCount, policy])).toEqual([
      [4, 'walkable'],
      [6, 'walkable'],
      [6, 'view-only'],
    ]);
    expect(result.collisionAtIndex(0)).toBe(0);
    expect(result.viewOnlyAtIndex(0)).toBe(0);
    expect(result.collisionAtIndex(2)).toBe(1);
    expect(result.viewOnlyAtIndex(2)).toBe(0);
    expect(result.collisionAtIndex(22)).toBe(1);
    expect(result.viewOnlyAtIndex(22)).toBe(1);
  });

  it('같은 성분의 상충 anchor를 거부한다', () => {
    expect(() => classifyPlayabilityComponents({
      components: [{ id: 1, tileCount: 10, bounds: { x0: 0, y0: 0, x1: 2, y1: 5 } }],
      resolvedAnchors: [
        { id: 'allow', componentId: 1, policy: 'walkable' },
        { id: 'deny', componentId: 1, policy: 'view-only' },
      ],
      minimumWalkableTiles: 5,
    })).toThrow(/conflicting policy anchors/);
  });

  it('sea·walkable·view-only와 청크 패딩 비트를 구분해 byte-identical하게 만든다', () => {
    const baseBytes = new TextEncoder().encode('{"base":true}\n');
    const base = baseManifest();
    const frame = createEquirectangularTileFrame(base);
    const surfaces = new Uint8Array(frame.width * frame.height);
    surfaces[0] = 1;
    surfaces[1] = 1;
    surfaces[frame.width] = 1;
    surfaces[frame.width + 1] = 1;
    surfaces[surfaces.length - 1] = 1;
    const manifest = playabilityManifest(baseBytes, {
      componentRules: {
        ...playabilityManifest(baseBytes).componentRules,
        minimumWalkableTiles: 4,
      },
    });
    const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest)}\n`);
    const args = {
      manifestBytes,
      manifest,
      baseManifest: base,
      baseContentManifestBytes: baseBytes,
      surfaces,
    };
    const first = buildPlayabilityArtifacts(args);
    const second = buildPlayabilityArtifacts(args);
    first.forEach((artifact, index) => {
      expect(artifact.path).toBe(second[index].path);
      expect(Buffer.compare(Buffer.from(artifact.bytes), Buffer.from(second[index].bytes))).toBe(0);
    });
    const chunk = decodeOverworldChunkV1(first.find(({ path: entry }) => entry === '0/0.owc').bytes);
    expect(chunk.cellAt(0, 0)).toMatchObject({ surface: 1, collision: 0, viewOnly: 0 });
    expect(chunk.cellAt(2, 0)).toMatchObject({ surface: 0, collision: 1, viewOnly: 0 });
    expect(chunk.cellAt(frame.width - 1, frame.height - 1)).toMatchObject({
      surface: 1,
      collision: 1,
      viewOnly: 1,
    });
    expect(chunk.cellAt(255, 255)).toMatchObject({ collision: 1, viewOnly: 1 });
  });

  it.runIf(existsSync(path.join(CHECKED_IN_DIR, 'content-manifest.json')))(
    '체크인된 지역 ① 이동 마스크·대표 섬 정책을 검증한다',
    () => {
    const base = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'scripts/world/overworld-region-apac-v1.json',
    ), 'utf8'));
    const frame = createEquirectangularTileFrame(base);
    const content = JSON.parse(readFileSync(path.join(CHECKED_IN_DIR, 'content-manifest.json'), 'utf8'));
    expect(content).toMatchObject({
      releaseEligible: false,
      width: 2631,
      height: 2669,
      chunkColumns: 11,
      chunkRows: 11,
      componentRules: { connectivity: 4, minimumWalkableTiles: 256 },
    });
    expect(content.chunks).toHaveLength(121);
    for (const entry of [content.report, ...content.chunks]) {
      const bytes = readFileSync(path.join(CHECKED_IN_DIR, entry.path));
      expect(bytes.byteLength, entry.path).toBe(entry.bytes);
      expect(sha256(bytes), entry.path).toBe(entry.sha256);
    }
    const cellAtTile = (tileX, tileY) => {
      const { cx, cy } = frame.tileToChunk(tileX, tileY);
      const chunk = decodeOverworldChunkV1(readFileSync(path.join(CHECKED_IN_DIR, `${cx}/${cy}.owc`)));
      return chunk.cellAt(tileX - cx * 256, tileY - cy * 256);
    };
    const cellAtGeo = (lon, lat) => {
      const point = frame.project(lon, lat);
      return cellAtTile(Math.floor(point.x), Math.floor(point.y));
    };
    const report = JSON.parse(readFileSync(path.join(CHECKED_IN_DIR, content.report.path), 'utf8'));
    const guam = report.resolvedAnchors.find(({ id }) => id === 'guam');
    expect(cellAtGeo(139.692, 35.69)).toMatchObject({ collision: 0, viewOnly: 0 });
    expect(cellAtGeo(126.53, 33.36)).toMatchObject({ collision: 0, viewOnly: 0 });
    expect(cellAtTile(guam.tileX, guam.tileY)).toMatchObject({ collision: 1, viewOnly: 1 });
    expect(cellAtGeo(150, 0)).toMatchObject({ surface: 0, collision: 1, viewOnly: 0 });
    },
  );

  it.runIf(existsSync(path.join(CHECKED_IN_EMEA_DIR, 'content-manifest.json')))(
    '체크인된 지역 ② 이동 마스크·대표 섬 정책을 검증한다',
    () => {
    const base = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'scripts/world/overworld-region-emea-v1.json',
    ), 'utf8'));
    const frame = createEquirectangularTileFrame(base);
    const content = JSON.parse(readFileSync(
      path.join(CHECKED_IN_EMEA_DIR, 'content-manifest.json'),
      'utf8',
    ));
    expect(content).toMatchObject({
      releaseEligible: false,
      width: 964,
      height: 1137,
      chunkColumns: 4,
      chunkRows: 5,
      componentRules: { connectivity: 4, minimumWalkableTiles: 256 },
    });
    expect(content.chunks).toHaveLength(20);
    for (const entry of [content.report, ...content.chunks]) {
      const bytes = readFileSync(path.join(CHECKED_IN_EMEA_DIR, entry.path));
      expect(bytes.byteLength, entry.path).toBe(entry.bytes);
      expect(sha256(bytes), entry.path).toBe(entry.sha256);
    }
    const cellAtTile = (tileX, tileY) => {
      const { cx, cy } = frame.tileToChunk(tileX, tileY);
      const chunk = decodeOverworldChunkV1(readFileSync(
        path.join(CHECKED_IN_EMEA_DIR, `${cx}/${cy}.owc`),
      ));
      return chunk.cellAt(tileX - cx * 256, tileY - cy * 256);
    };
    const cellAtGeo = (lon, lat) => {
      const point = frame.project(lon, lat);
      return cellAtTile(Math.floor(point.x), Math.floor(point.y));
    };
    const report = JSON.parse(readFileSync(
      path.join(CHECKED_IN_EMEA_DIR, content.report.path),
      'utf8',
    ));
    const faroe = report.resolvedAnchors.find(({ id }) => id === 'faroe');
    expect(cellAtGeo(-0.1276, 51.5072)).toMatchObject({ collision: 0, viewOnly: 0 });
    expect(cellAtGeo(2.99, 39.6)).toMatchObject({ collision: 0, viewOnly: 0 });
    expect(cellAtTile(faroe.tileX, faroe.tileY)).toMatchObject({ collision: 1, viewOnly: 1 });
    expect(cellAtGeo(15, 35)).toMatchObject({ surface: 0, collision: 1, viewOnly: 0 });
    },
  );
});
