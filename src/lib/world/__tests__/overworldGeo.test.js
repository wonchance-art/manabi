import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildRegionArtifacts,
  rasterizeNaturalEarthLand,
} from '../../../../scripts/world/build-overworld-region.mjs';
import { decodeOverworldChunkV1 } from '../overworldChunk.js';
import {
  createEquirectangularTileFrame,
  normalizeOverworldRegionManifest,
  roundHalfAwayFromZero,
} from '../overworldGeo.js';

const SOURCE = Object.freeze({
  id: 'natural-earth-land-test',
  cacheFile: 'land.geojson',
  url: 'https://example.com/land.geojson',
  version: 'test-v1',
  sha256: '1'.repeat(64),
  bytes: 1,
  license: 'public domain test fixture',
  role: 'land',
  required: true,
});

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const CHECKED_IN_REGION_DIR = path.join(
  REPO_ROOT,
  'public/assets/overworld/asia-pacific-surface-preview-v1',
);
const CHECKED_IN_EMEA_REGION_DIR = path.join(
  REPO_ROOT,
  'public/assets/overworld/europe-mediterranean-middle-east-surface-preview-v1',
);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function manifest(overrides = {}) {
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
    sources: [SOURCE],
    ...overrides,
  };
}

const LAND = Object.freeze({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [0, 0],
        [0.1, 0],
        [0.1, 0.1],
        [0, 0.1],
        [0, 0],
      ]],
    },
  }],
});

describe('지역 ① geo 입력·투영 계약', () => {
  it('확정 등장방형 격자를 2631×2669와 11×11 청크로 고정한다', () => {
    const apac = manifest({
      regionId: 'asia-pacific-surface-preview-v1',
      bbox: [60, -47, 180, 61],
      metersPerTile: 4500,
      projection: {
        id: 'apac-equirectangular-screen-axis-v1',
        method: 'equirectangular',
        axisMode: 'screen-axis',
        lon0: 125,
        lat0: 27.5,
        standardLat: 27.5,
      },
    });
    const frame = createEquirectangularTileFrame(apac);
    expect(frame).toMatchObject({ width: 2631, height: 2669, chunkColumns: 11, chunkRows: 11 });
    for (const point of [
      { lon: 126.978, lat: 37.5665 },
      { lon: 139.6917, lat: 35.6895 },
      { lon: 174.7645, lat: -36.8509 },
      { lon: 131.885, lat: 43.115 },
    ]) {
      const tile = frame.project(point.lon, point.lat);
      const restored = frame.unproject(tile.x, tile.y);
      expect(restored.lon).toBeCloseTo(point.lon, 10);
      expect(restored.lat).toBeCloseTo(point.lat, 10);
      expect(frame.tileToChunk(tile.x, tile.y)).toEqual({
        cx: Math.floor(tile.x / 256),
        cy: Math.floor(tile.y / 256),
      });
    }
  });

  it('지역 ② preview v1 확정 투영 격자를 964×1137과 4×5 청크로 고정한다', () => {
    const emea = manifest({
      regionId: 'europe-mediterranean-middle-east-surface-preview-v1',
      bbox: [-11, 20, 50, 66],
      metersPerTile: 4500,
      projection: {
        id: 'emea-equirectangular-screen-axis-v1',
        method: 'equirectangular',
        axisMode: 'screen-axis',
        lon0: 25,
        lat0: 45,
        standardLat: 50.25,
      },
    });
    const frame = createEquirectangularTileFrame(emea);
    expect(frame).toMatchObject({ width: 964, height: 1137, chunkColumns: 4, chunkRows: 5 });
    for (const point of [
      { lon: -0.1276, lat: 51.5072 },
      { lon: 12.4964, lat: 41.9028 },
      { lon: 31.2357, lat: 30.0444 },
      { lon: 37.6173, lat: 55.7558 },
    ]) {
      const tile = frame.project(point.lon, point.lat);
      const restored = frame.unproject(tile.x, tile.y);
      expect(restored.lon).toBeCloseTo(point.lon, 10);
      expect(restored.lat).toBeCloseTo(point.lat, 10);
    }
  });

  it('unknown field·투영 drift·비 boolean 출시 표기를 fail closed로 거부한다', () => {
    expect(() => normalizeOverworldRegionManifest({ ...manifest(), unknown: true })).toThrow(/keys must be exactly/);
    expect(normalizeOverworldRegionManifest(manifest({ releaseEligible: true })).releaseEligible).toBe(true);
    expect(() => normalizeOverworldRegionManifest(manifest({ releaseEligible: 'yes' }))).toThrow(/must be boolean/);
    expect(() => normalizeOverworldRegionManifest(manifest({
      projection: { ...manifest().projection, method: 'sinusoidal' },
    }))).toThrow(/equirectangular \+ screen-axis/);
  });

  it('half-away-from-zero 반올림을 양·음수 대칭으로 유지한다', () => {
    expect([-1.5, -0.5, 0.5, 1.5].map(roundHalfAwayFromZero)).toEqual([-2, -1, 1, 2]);
  });
});

describe('지역 surface preview 생성', () => {
  it('투영 절단선 밖 대륙 링이 지역 안을 가로질러 채우지 않는다', () => {
    const input = manifest({
      bbox: [60, -25, 110, -15],
      metersPerTile: 1_000_000,
      projection: {
        ...manifest().projection,
        lon0: 125,
        standardLat: 0,
      },
    });
    const outsideLand = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[-80, -30], [-30, -30], [-30, 0], [-80, 0], [-80, -30]]],
        },
      }],
    };
    expect(rasterizeNaturalEarthLand({ manifest: input, geojson: outsideLand }).landTileCount).toBe(0);
  });

  it('반복 생성이 byte-identical이고 모든 이동 마스크를 차단한다', () => {
    const input = manifest();
    const manifestBytes = new TextEncoder().encode(`${JSON.stringify(input)}\n`);
    const first = buildRegionArtifacts({ manifestBytes, manifest: input, geojson: LAND });
    const second = buildRegionArtifacts({ manifestBytes, manifest: input, geojson: LAND });
    expect(first.map(({ path }) => path)).toEqual(['0/0.owc', 'build-report.json', 'content-manifest.json']);
    for (let index = 0; index < first.length; index += 1) {
      expect(Buffer.compare(Buffer.from(first[index].bytes), Buffer.from(second[index].bytes))).toBe(0);
    }
    const chunk = decodeOverworldChunkV1(first[0].bytes);
    expect(chunk.header.validBounds).toEqual({ x0: 0, y0: 0, x1: 3, y1: 3 });
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        expect(chunk.collisionAt(x, y)).toBe(1);
        expect(chunk.viewOnlyAt(x, y)).toBe(1);
      }
    }
    const content = JSON.parse(new TextDecoder().decode(first.at(-1).bytes));
    expect(content).toMatchObject({
      releaseEligible: false,
      width: 3,
      height: 3,
      chunkColumns: 1,
      chunkRows: 1,
      previewMasks: { collision: 'all-blocked', viewOnly: 'all-view-only' },
    });
  });

  it('체크인된 지역 ① 121청크와 대표 육지·바다 표본이 manifest와 일치한다', () => {
    const input = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'scripts/world/overworld-region-apac-v1.json',
    ), 'utf8'));
    const frame = createEquirectangularTileFrame(input);
    const content = JSON.parse(readFileSync(path.join(CHECKED_IN_REGION_DIR, 'content-manifest.json'), 'utf8'));
    expect(content).toMatchObject({
      releaseEligible: false,
      width: 2631,
      height: 2669,
      chunkColumns: 11,
      chunkRows: 11,
    });
    expect(content.chunks).toHaveLength(121);
    for (const entry of [content.report, ...content.chunks]) {
      const bytes = readFileSync(path.join(CHECKED_IN_REGION_DIR, entry.path));
      expect(bytes.byteLength, entry.path).toBe(entry.bytes);
      expect(sha256(bytes), entry.path).toBe(entry.sha256);
    }

    const surfaceAtGeo = (lon, lat) => {
      const point = frame.project(lon, lat);
      const tileX = Math.floor(point.x);
      const tileY = Math.floor(point.y);
      const { cx, cy } = frame.tileToChunk(tileX, tileY);
      const chunk = decodeOverworldChunkV1(readFileSync(path.join(CHECKED_IN_REGION_DIR, `${cx}/${cy}.owc`)));
      expect(chunk.collisionAt(tileX - cx * 256, tileY - cy * 256)).toBe(1);
      expect(chunk.viewOnlyAt(tileX - cx * 256, tileY - cy * 256)).toBe(1);
      return chunk.surfaceAt(tileX - cx * 256, tileY - cy * 256);
    };
    for (const [lon, lat] of [[139.6917, 35.6895], [126.978, 37.5665], [106.9057, 47.8864], [133.8807, -23.698]]) {
      expect(surfaceAtGeo(lon, lat), `${lon},${lat}`).toBe(input.surfaceClasses.land);
    }
    for (const [lon, lat] of [[100, -20], [150, 0]]) {
      expect(surfaceAtGeo(lon, lat), `${lon},${lat}`).toBe(input.surfaceClasses.sea);
    }
  });

  it('체크인된 지역 ② 20청크와 대표 육지·바다 표본이 manifest와 일치한다', () => {
    const input = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'scripts/world/overworld-region-emea-v1.json',
    ), 'utf8'));
    const frame = createEquirectangularTileFrame(input);
    const content = JSON.parse(readFileSync(
      path.join(CHECKED_IN_EMEA_REGION_DIR, 'content-manifest.json'),
      'utf8',
    ));
    expect(content).toMatchObject({
      releaseEligible: true,
      width: 964,
      height: 1137,
      chunkColumns: 4,
      chunkRows: 5,
    });
    expect(content.chunks).toHaveLength(20);
    for (const entry of [content.report, ...content.chunks]) {
      const bytes = readFileSync(path.join(CHECKED_IN_EMEA_REGION_DIR, entry.path));
      expect(bytes.byteLength, entry.path).toBe(entry.bytes);
      expect(sha256(bytes), entry.path).toBe(entry.sha256);
    }

    const surfaceAtGeo = (lon, lat) => {
      const point = frame.project(lon, lat);
      const tileX = Math.floor(point.x);
      const tileY = Math.floor(point.y);
      const { cx, cy } = frame.tileToChunk(tileX, tileY);
      const chunk = decodeOverworldChunkV1(readFileSync(
        path.join(CHECKED_IN_EMEA_REGION_DIR, `${cx}/${cy}.owc`),
      ));
      expect(chunk.collisionAt(tileX - cx * 256, tileY - cy * 256)).toBe(1);
      expect(chunk.viewOnlyAt(tileX - cx * 256, tileY - cy * 256)).toBe(1);
      return chunk.surfaceAt(tileX - cx * 256, tileY - cy * 256);
    };
    for (const [lon, lat] of [[-0.1276, 51.5072], [12.4964, 41.9028], [31.2357, 30.0444], [37.6173, 55.7558]]) {
      expect(surfaceAtGeo(lon, lat), `${lon},${lat}`).toBe(input.surfaceClasses.land);
    }
    for (const [lon, lat] of [[-10, 30], [15, 35]]) {
      expect(surfaceAtGeo(lon, lat), `${lon},${lat}`).toBe(input.surfaceClasses.sea);
    }
  });
});
