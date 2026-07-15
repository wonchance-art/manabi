import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildRiverOverlayArtifacts,
  buildTerrainArtifacts,
} from '../../../../scripts/world/build-overworld-terrain.mjs';
import { decodeOverworldChunkV1 } from '../overworldChunk.js';
import { createEquirectangularTileFrame } from '../overworldGeo.js';
import {
  classifyTerrainElevation,
  meanElevationMeters,
  normalizeOverworldTerrainManifest,
} from '../overworldTerrain.js';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const CHECKED_IN_TERRAIN_DIR = path.join(
  REPO_ROOT,
  'public/assets/overworld/asia-pacific-terrain-preview-v1',
);
const CHECKED_IN_EMEA_TERRAIN_DIR = path.join(
  REPO_ROOT,
  'public/assets/overworld/europe-mediterranean-middle-east-terrain-preview-v1',
);

function baseManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    releaseEligible: false,
    generatorGitSha: null,
    regionId: 'test-surface-preview-v1',
    bbox: [0, 0, 0.1, 0.1],
    earthRadiusMeters: 6371008.8,
    metersPerTile: 5000,
    chunkTiles: 256,
    projection: {
      id: 'test-equirectangular-screen-axis-v1',
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
    supersampling: {
      width: 4,
      height: 4,
      offsets: [0.125, 0.375, 0.625, 0.875],
    },
    surfaceClasses: { sea: 0, land: 1 },
    surfacePriority: ['land', 'sea'],
    previewMasks: { collision: 'all-blocked', viewOnly: 'all-view-only' },
    sources: [{
      id: 'natural-earth-land-test',
      cacheFile: 'land.geojson',
      url: 'https://example.com/land.geojson',
      version: 'test-v1',
      sha256: '1'.repeat(64),
      bytes: 1,
      license: 'public domain test fixture',
      role: 'land',
      required: true,
    }],
    ...overrides,
  };
}

function terrainManifest(baseContentBytes, overrides = {}) {
  return {
    schemaVersion: 1,
    releaseEligible: false,
    generatorGitSha: null,
    regionId: 'test-terrain-preview-v1',
    baseSurface: {
      manifestPath: 'scripts/world/test-base.json',
      directory: 'public/assets/overworld/test-base',
      contentManifest: 'content-manifest.json',
      contentManifestSha256: sha256(baseContentBytes),
      contentManifestBytes: baseContentBytes.byteLength,
    },
    elevationSource: {
      id: 'etopo-test',
      cacheFile: 'etopo.tif',
      url: 'https://example.com/etopo.tif',
      version: 'test-v1',
      sha256: '2'.repeat(64),
      bytes: 1,
      license: 'CC0 test fixture',
      role: 'elevation',
      required: true,
      width: 4,
      height: 4,
      pixelSizeDegrees: 1,
      originCenterLon: -1.5,
      originCenterLat: 1.5,
      dataType: 'float32',
      crop: { left: 0, top: 0, width: 4, height: 4 },
    },
    riverSource: {
      id: 'river-test',
      cacheFile: 'rivers.geojson',
      url: 'https://example.com/rivers.geojson',
      version: 'test-v1',
      sha256: '3'.repeat(64),
      bytes: 1,
      license: 'public domain test fixture',
      role: 'river-centerlines',
      required: true,
    },
    terrainClasses: { sea: 0, lowland: 1, highland: 2, mountain: 3, alpine: 4 },
    terrainThresholdsMeters: { highland: 300, mountain: 1000, alpine: 2500 },
    elevationSampling: {
      method: 'nearest-native-mean-4x4',
      offsets: [0.125, 0.375, 0.625, 0.875],
      rounding: 'nearest-half-away-from-zero',
      edgeHandling: 'clamp-to-source-edge',
    },
    riverRules: { maxScaleRank: 5, quantization: 1024, haloTiles: 1, simplification: 'none' },
    previewMasks: { collision: 'all-blocked', viewOnly: 'all-view-only' },
    ...overrides,
  };
}

const RIVER = Object.freeze({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { scalerank: 1, name: 'Test River' },
    geometry: { type: 'MultiLineString', coordinates: [[[0, 0.05], [0.1, 0.05]]] },
  }],
});

describe('오버월드 terrain manifest와 고도 분류', () => {
  it('임계값과 16표본 평균 반올림을 고정한다', () => {
    const classes = { sea: 0, lowland: 1, highland: 2, mountain: 3, alpine: 4 };
    const thresholds = { highland: 300, mountain: 1000, alpine: 2500 };
    expect([299, 300, 999, 1000, 2499, 2500].map((value) => (
      classifyTerrainElevation(value, classes, thresholds)
    ))).toEqual([1, 2, 2, 3, 3, 4]);
    expect(meanElevationMeters(Array(16).fill(10.5))).toBe(11);
    expect(meanElevationMeters(Array(16).fill(-10.5))).toBe(-11);
  });

  it('출시 가능 표기·샘플링·강 오버레이 규칙 drift를 거부한다', () => {
    const bytes = new TextEncoder().encode('{}\n');
    expect(() => normalizeOverworldTerrainManifest(terrainManifest(bytes, { releaseEligible: true })))
      .toThrow(/releaseEligible=false/);
    expect(() => normalizeOverworldTerrainManifest(terrainManifest(bytes, {
      riverRules: { maxScaleRank: 5, quantization: 1000, haloTiles: 1, simplification: 'none' },
    }))).toThrow(/riverRules/);
  });
});

describe('오버월드 terrain 생성', () => {
  it('바다는 보존하고 지형 등급·강·차단 마스크를 byte-identical하게 생성한다', () => {
    const baseContentBytes = new TextEncoder().encode('{"base":true}\n');
    const input = terrainManifest(baseContentBytes);
    const manifestBytes = new TextEncoder().encode(`${JSON.stringify(input)}\n`);
    const args = {
      manifestBytes,
      manifest: input,
      baseManifest: baseManifest(),
      baseContentManifestBytes: baseContentBytes,
      baseSurfaceAt: (x, y) => (x === 0 && y === 0 ? 0 : 1),
      meanElevationAtTile: (x, y) => [100, 500, 1500, 3000][Math.min(3, x + y)],
      riverGeojson: RIVER,
    };
    const first = buildTerrainArtifacts(args);
    const second = buildTerrainArtifacts(args);
    expect(first.map(({ path }) => path)).toEqual(second.map(({ path }) => path));
    first.forEach((artifact, index) => {
      expect(Buffer.compare(Buffer.from(artifact.bytes), Buffer.from(second[index].bytes))).toBe(0);
    });
    const chunk = decodeOverworldChunkV1(first.find(({ path }) => path === '0/0.owc').bytes);
    expect(chunk.surfaceAt(0, 0)).toBe(0);
    expect(chunk.surfaceAt(1, 0)).toBe(2);
    expect(chunk.surfaceAt(2, 0)).toBe(3);
    expect(chunk.collisionAt(1, 0)).toBe(1);
    expect(chunk.viewOnlyAt(1, 0)).toBe(1);
    expect(first.some(({ path }) => path.startsWith('rivers/'))).toBe(true);
  });

  it('256 청크 경계 양쪽 river 파일이 같은 전역 양자화 endpoint를 가진다', () => {
    const manifest = baseManifest({
      bbox: [0, 0, 3, 0.1],
      metersPerTile: 1000,
    });
    const frame = createEquirectangularTileFrame(manifest);
    const start = frame.unproject(255, 4);
    const end = frame.unproject(257, 4);
    const river = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { scalerank: 1, name: 'Seam River' },
        geometry: { type: 'MultiLineString', coordinates: [[
          [start.lon, start.lat],
          [end.lon, end.lat],
        ]] },
      }],
    };
    const result = buildRiverOverlayArtifacts({
      frame,
      geojson: river,
      rules: { maxScaleRank: 5, quantization: 1024, haloTiles: 1, simplification: 'none' },
    });
    const left = JSON.parse(new TextDecoder().decode(
      result.artifacts.find(({ path }) => path === 'rivers/0/0.json').bytes,
    ));
    const right = JSON.parse(new TextDecoder().decode(
      result.artifacts.find(({ path }) => path === 'rivers/1/0.json').bytes,
    ));
    expect(left.segments[0].start).toEqual(right.segments[0].start);
    expect(left.segments[0].end).toEqual(right.segments[0].end);
  });

  it('체크인된 지역 ① terrain 121청크·강 overlay·대표 산지를 검증한다', () => {
    const base = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'scripts/world/overworld-region-apac-v1.json',
    ), 'utf8'));
    const frame = createEquirectangularTileFrame(base);
    const content = JSON.parse(readFileSync(path.join(CHECKED_IN_TERRAIN_DIR, 'content-manifest.json'), 'utf8'));
    expect(content).toMatchObject({
      releaseEligible: false,
      width: 2631,
      height: 2669,
      chunkColumns: 11,
      chunkRows: 11,
      previewMasks: { collision: 'all-blocked', viewOnly: 'all-view-only' },
      elevationSampling: { edgeHandling: 'clamp-to-source-edge' },
    });
    expect(content.chunks).toHaveLength(121);
    expect(content.overlays).toHaveLength(32);
    for (const entry of [content.report, ...content.chunks, ...content.overlays]) {
      const bytes = readFileSync(path.join(CHECKED_IN_TERRAIN_DIR, entry.path));
      expect(bytes.byteLength, entry.path).toBe(entry.bytes);
      expect(sha256(bytes), entry.path).toBe(entry.sha256);
    }

    const surfaceAtGeo = (lon, lat) => {
      const point = frame.project(lon, lat);
      const tileX = Math.floor(point.x);
      const tileY = Math.floor(point.y);
      const { cx, cy } = frame.tileToChunk(tileX, tileY);
      const chunk = decodeOverworldChunkV1(readFileSync(path.join(
        CHECKED_IN_TERRAIN_DIR,
        `${cx}/${cy}.owc`,
      )));
      const localX = tileX - cx * 256;
      const localY = tileY - cy * 256;
      expect(chunk.collisionAt(localX, localY)).toBe(1);
      expect(chunk.viewOnlyAt(localX, localY)).toBe(1);
      return chunk.surfaceAt(localX, localY);
    };
    expect(surfaceAtGeo(86.925, 27.988)).toBe(content.terrainClasses.alpine);
    expect(surfaceAtGeo(138.727, 35.361)).toBe(content.terrainClasses.alpine);
    expect(surfaceAtGeo(103.85, 46.86)).toBe(content.terrainClasses.mountain);
    expect(surfaceAtGeo(139.692, 35.69)).toBe(content.terrainClasses.lowland);
    expect(surfaceAtGeo(150, 0)).toBe(content.terrainClasses.sea);
  });

  it('체크인된 지역 ② terrain 20청크·강 overlay·대표 산지를 검증한다', () => {
    const base = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'scripts/world/overworld-region-emea-v1.json',
    ), 'utf8'));
    const frame = createEquirectangularTileFrame(base);
    const content = JSON.parse(readFileSync(
      path.join(CHECKED_IN_EMEA_TERRAIN_DIR, 'content-manifest.json'),
      'utf8',
    ));
    expect(content).toMatchObject({
      releaseEligible: false,
      width: 964,
      height: 1137,
      chunkColumns: 4,
      chunkRows: 5,
      previewMasks: { collision: 'all-blocked', viewOnly: 'all-view-only' },
      elevationSampling: { edgeHandling: 'clamp-to-source-edge' },
    });
    expect(content.chunks).toHaveLength(20);
    expect(content.overlays).toHaveLength(13);
    for (const entry of [content.report, ...content.chunks, ...content.overlays]) {
      const bytes = readFileSync(path.join(CHECKED_IN_EMEA_TERRAIN_DIR, entry.path));
      expect(bytes.byteLength, entry.path).toBe(entry.bytes);
      expect(sha256(bytes), entry.path).toBe(entry.sha256);
    }

    const surfaceAtGeo = (lon, lat) => {
      const point = frame.project(lon, lat);
      const tileX = Math.floor(point.x);
      const tileY = Math.floor(point.y);
      const { cx, cy } = frame.tileToChunk(tileX, tileY);
      const chunk = decodeOverworldChunkV1(readFileSync(path.join(
        CHECKED_IN_EMEA_TERRAIN_DIR,
        `${cx}/${cy}.owc`,
      )));
      const localX = tileX - cx * 256;
      const localY = tileY - cy * 256;
      expect(chunk.collisionAt(localX, localY)).toBe(1);
      expect(chunk.viewOnlyAt(localX, localY)).toBe(1);
      return chunk.surfaceAt(localX, localY);
    };
    expect(surfaceAtGeo(6.865, 45.832)).toBe(content.terrainClasses.alpine);
    expect(surfaceAtGeo(42.44, 43.35)).toBe(content.terrainClasses.alpine);
    expect(surfaceAtGeo(-0.1276, 51.5072)).toBe(content.terrainClasses.lowland);
    expect(surfaceAtGeo(31.2357, 30.0444)).toBe(content.terrainClasses.lowland);
    expect(surfaceAtGeo(15, 35)).toBe(content.terrainClasses.sea);
  });
});
