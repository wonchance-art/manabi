import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildRailOverlayArtifacts,
  buildTransportArtifacts,
} from '../../../../scripts/world/build-overworld-transport.mjs';
import { createEquirectangularTileFrame } from '../overworldGeo.js';
import {
  normalizeOverworldTransportManifest,
  simplifyQuantizedLine,
} from '../overworldTransport.js';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const CHECKED_IN_TRANSPORT_DIR = path.join(
  REPO_ROOT,
  'public/assets/overworld/asia-pacific-transport-preview-v1',
);
const CHECKED_IN_EMEA_TRANSPORT_DIR = path.join(
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

function baseManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    releaseEligible: false,
    generatorGitSha: null,
    regionId: 'transport-base',
    bbox: [0, 0, 3, 0.1],
    earthRadiusMeters: 6371008.8,
    metersPerTile: 1000,
    chunkTiles: 256,
    projection: {
      id: 'transport-equirectangular-screen-axis-v1',
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
    ...overrides,
  };
}

function transportManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    releaseEligible: false,
    generatorGitSha: null,
    regionId: 'transport-preview-v1',
    baseTerrain: {
      manifestPath: 'base.json',
      directory: 'base',
      contentManifest: 'content-manifest.json',
      contentManifestSha256: '2'.repeat(64),
      contentManifestBytes: 1,
    },
    railSource: {
      id: 'rail',
      cacheFile: 'rail.json',
      url: 'https://example.com/rail.json',
      version: 'v1',
      sha256: '3'.repeat(64),
      bytes: 1,
      license: 'test',
      role: 'rail-centerlines',
      required: true,
    },
    railRules: {
      maxScaleRank: 5,
      quantization: 1024,
      haloTiles: 1,
      simplification: { method: 'rdp-global-quantized', toleranceQuantized: 128 },
    },
    ...overrides,
  };
}

describe('오버월드 transport 계약', () => {
  it('출시 표기·양자화·단순화 drift를 거부한다', () => {
    expect(() => normalizeOverworldTransportManifest(transportManifest({ releaseEligible: true })))
      .toThrow(/releaseEligible=false/);
    expect(() => normalizeOverworldTransportManifest(transportManifest({
      railRules: {
        maxScaleRank: 5,
        quantization: 1000,
        haloTiles: 1,
        simplification: { method: 'rdp-global-quantized', toleranceQuantized: 128 },
      },
    }))).toThrow(/quantization/);
  });

  it('전역 양자화 좌표에서 RDP를 결정적으로 수행하고 끝점을 보존한다', () => {
    const points = [[0, 0], [10, 1], [20, -1], [30, 0], [40, 20], [50, 20]];
    expect(simplifyQuantizedLine(points, 2)).toEqual([[0, 0], [30, 0], [40, 20], [50, 20]]);
    expect(simplifyQuantizedLine(points, 2)).toEqual(simplifyQuantizedLine(points, 2));
  });
});

describe('오버월드 rail overlay 생성', () => {
  it('256 경계 양쪽 파일이 같은 전역 endpoint와 route id를 가진다', () => {
    const frame = createEquirectangularTileFrame(baseManifest());
    const start = frame.unproject(255, 4);
    const end = frame.unproject(257, 4);
    const geojson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { scalerank: 4, category: 1, electric: 2, mult_track: 1 },
        geometry: { type: 'LineString', coordinates: [[start.lon, start.lat], [end.lon, end.lat]] },
      }],
    };
    const result = buildRailOverlayArtifacts({
      frame,
      geojson,
      rules: transportManifest().railRules,
    });
    const left = JSON.parse(new TextDecoder().decode(
      result.artifacts.find(({ path }) => path === 'rail/0/0.json').bytes,
    ));
    const right = JSON.parse(new TextDecoder().decode(
      result.artifacts.find(({ path }) => path === 'rail/1/0.json').bytes,
    ));
    expect(left.segments[0]).toEqual(right.segments[0]);
  });

  it('반복 생성 결과와 content hash가 byte-identical이다', () => {
    const manifest = transportManifest();
    const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest)}\n`);
    const geojson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { scalerank: 4, category: 1, electric: 2, mult_track: 1 },
        geometry: { type: 'LineString', coordinates: [[0, 0.05], [1, 0.05], [2, 0.05]] },
      }],
    };
    const args = { manifestBytes, manifest, baseRegionManifest: baseManifest(), railGeojson: geojson };
    const first = buildTransportArtifacts(args);
    const second = buildTransportArtifacts(args);
    expect(first.map(({ path }) => path)).toEqual(second.map(({ path }) => path));
    first.forEach((artifact, index) => {
      expect(sha256(artifact.bytes)).toBe(sha256(second[index].bytes));
    });
  });

  it('체크인된 지역 ① rail overlay와 대표 철도권 표본을 검증한다', () => {
    const base = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'scripts/world/overworld-region-apac-v1.json',
    ), 'utf8'));
    const frame = createEquirectangularTileFrame(base);
    const content = JSON.parse(readFileSync(path.join(CHECKED_IN_TRANSPORT_DIR, 'content-manifest.json'), 'utf8'));
    expect(content).toMatchObject({
      releaseEligible: false,
      width: 2631,
      height: 2669,
      chunkColumns: 11,
      chunkRows: 11,
      railRules: {
        maxScaleRank: 5,
        quantization: 1024,
        haloTiles: 1,
        simplification: { method: 'rdp-global-quantized', toleranceQuantized: 128 },
      },
    });
    expect(content.overlays).toHaveLength(41);
    for (const entry of [content.report, ...content.overlays]) {
      const bytes = readFileSync(path.join(CHECKED_IN_TRANSPORT_DIR, entry.path));
      expect(bytes.byteLength, entry.path).toBe(entry.bytes);
      expect(sha256(bytes), entry.path).toBe(entry.sha256);
    }

    const nearestRailTiles = (lon, lat) => {
      const point = frame.project(lon, lat);
      const cx = Math.floor(point.x / 256);
      const cy = Math.floor(point.y / 256);
      const entry = content.overlays.find(({ path: overlayPath }) => overlayPath === `rail/${cx}/${cy}.json`);
      expect(entry, `${lon},${lat}`).toBeDefined();
      const overlay = JSON.parse(readFileSync(path.join(CHECKED_IN_TRANSPORT_DIR, entry.path), 'utf8'));
      const quantization = content.railRules.quantization;
      const pointQ = [point.x * quantization, point.y * quantization];
      return Math.min(...overlay.segments.map((segment) => (
        distanceToSegment(pointQ, segment.start, segment.end) / quantization
      )));
    };
    for (const coordinate of [
      [139.692, 35.69],
      [126.978, 37.566],
      [131.885, 43.115],
      [151.209, -33.869],
    ]) {
      expect(nearestRailTiles(...coordinate), coordinate.join(',')).toBeLessThan(5);
    }
  });

  it('체크인된 지역 ② rail overlay와 대표 철도권 표본을 검증한다', () => {
    const base = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'scripts/world/overworld-region-emea-v1.json',
    ), 'utf8'));
    const frame = createEquirectangularTileFrame(base);
    const content = JSON.parse(readFileSync(
      path.join(CHECKED_IN_EMEA_TRANSPORT_DIR, 'content-manifest.json'),
      'utf8',
    ));
    expect(content).toMatchObject({
      releaseEligible: false,
      width: 964,
      height: 1137,
      chunkColumns: 4,
      chunkRows: 5,
      railRules: {
        maxScaleRank: 5,
        quantization: 1024,
        haloTiles: 1,
        simplification: { method: 'rdp-global-quantized', toleranceQuantized: 128 },
      },
    });
    expect(content.overlays).toHaveLength(16);
    for (const entry of [content.report, ...content.overlays]) {
      const bytes = readFileSync(path.join(CHECKED_IN_EMEA_TRANSPORT_DIR, entry.path));
      expect(bytes.byteLength, entry.path).toBe(entry.bytes);
      expect(sha256(bytes), entry.path).toBe(entry.sha256);
    }

    const nearestRailTiles = (lon, lat) => {
      const point = frame.project(lon, lat);
      const cx = Math.floor(point.x / 256);
      const cy = Math.floor(point.y / 256);
      const entry = content.overlays.find(({ path: overlayPath }) => (
        overlayPath === `rail/${cx}/${cy}.json`
      ));
      expect(entry, `${lon},${lat}`).toBeDefined();
      const overlay = JSON.parse(readFileSync(
        path.join(CHECKED_IN_EMEA_TRANSPORT_DIR, entry.path),
        'utf8',
      ));
      const quantization = content.railRules.quantization;
      const pointQ = [point.x * quantization, point.y * quantization];
      return Math.min(...overlay.segments.map((segment) => (
        distanceToSegment(pointQ, segment.start, segment.end) / quantization
      )));
    };
    for (const coordinate of [
      [-0.1276, 51.5072],
      [2.3522, 48.8566],
      [13.405, 52.52],
      [12.4964, 41.9028],
      [37.6173, 55.7558],
      [31.2357, 30.0444],
    ]) {
      expect(nearestRailTiles(...coordinate), coordinate.join(',')).toBeLessThan(2);
    }
  });
});
