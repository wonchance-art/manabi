import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildBoundaryArtifacts,
  buildBoundaryOverlayArtifacts,
} from '../../../../scripts/world/build-overworld-boundary.mjs';
import {
  classifyBoundaryFeature,
  normalizeOverworldBoundaryManifest,
} from '../overworldBoundary.js';
import { createEquirectangularTileFrame } from '../overworldGeo.js';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const CHECKED_IN_BOUNDARY_DIR = path.join(
  REPO_ROOT,
  'public/assets/overworld/europe-mediterranean-middle-east-boundary-preview-v1',
);

function baseManifest() {
  return {
    schemaVersion: 1,
    releaseEligible: false,
    generatorGitSha: null,
    regionId: 'boundary-base',
    bbox: [0, 0, 3, 0.1],
    earthRadiusMeters: 6371008.8,
    metersPerTile: 1000,
    chunkTiles: 256,
    projection: {
      id: 'boundary-equirectangular-screen-axis-v1',
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
      sha256: '4'.repeat(64),
      bytes: 1,
      license: 'test',
      role: 'land',
      required: true,
    }],
  };
}

function boundaryManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    releaseEligible: false,
    generatorGitSha: null,
    regionId: 'boundary-preview-v1',
    baseTerrain: {
      manifestPath: 'base.json',
      directory: 'base',
      contentManifest: 'content-manifest.json',
      contentManifestSha256: '1'.repeat(64),
      contentManifestBytes: 1,
    },
    boundarySources: [
      {
        id: 'land',
        cacheFile: 'land.json',
        url: 'https://example.com/land.json',
        version: 'v1',
        sha256: '2'.repeat(64),
        bytes: 1,
        license: 'test',
        role: 'admin0-boundary-lines',
        required: true,
        sourceKind: 'land',
      },
      {
        id: 'disputed',
        cacheFile: 'disputed.json',
        url: 'https://example.com/disputed.json',
        version: 'v1',
        sha256: '3'.repeat(64),
        bytes: 1,
        license: 'test',
        role: 'admin0-disputed-boundary-lines',
        required: true,
        sourceKind: 'disputed',
      },
    ],
    boundaryRules: {
      quantization: 1024,
      haloTiles: 1,
      simplification: 'none',
      defaultScaleRank: 10,
    },
    policy: {
      id: 'neutral-boundary-policy-v1',
      solidFeatureClasses: ['International boundary (verify)'],
      neutralFeatureClasses: ['Claim boundary', 'Disputed (please verify)'],
      countryFill: 'none',
      ownershipLabels: 'forbidden',
      sourceProperties: 'discard-all',
      disclaimer: 'neutral disclaimer',
    },
    ...overrides,
  };
}

function feature(featureClass, coordinates, scalerank = 1) {
  return {
    type: 'Feature',
    properties: { FEATURECLA: featureClass, SCALERANK: scalerank, NAME: 'must-not-leak' },
    geometry: { type: 'LineString', coordinates },
  };
}

describe('오버월드 중립 경계 계약', () => {
  it('비 boolean 출시·소유권 표현 drift와 미분류 원본 분류를 거부한다', () => {
    expect(normalizeOverworldBoundaryManifest(
      boundaryManifest({ releaseEligible: true }),
    ).releaseEligible).toBe(true);
    expect(() => normalizeOverworldBoundaryManifest(boundaryManifest({ releaseEligible: 'yes' })))
      .toThrow(/must be boolean/);
    expect(() => normalizeOverworldBoundaryManifest(boundaryManifest({
      policy: { ...boundaryManifest().policy, countryFill: 'countries' },
    }))).toThrow(/forbid ownership/);
    const policy = normalizeOverworldBoundaryManifest(boundaryManifest()).policy;
    expect(classifyBoundaryFeature('land', 'International boundary (verify)', policy)).toBe('de-facto');
    expect(classifyBoundaryFeature('disputed', 'Claim boundary', policy)).toBe('neutral-disputed');
    expect(() => classifyBoundaryFeature('land', 'Unknown boundary', policy)).toThrow(/unclassified/);
  });
});

describe('오버월드 중립 경계 생성', () => {
  it('일반 경계는 실선, 민감 경계는 동일 중립 분류로 만들고 원본 속성을 버린다', () => {
    const manifest = normalizeOverworldBoundaryManifest(boundaryManifest());
    const result = buildBoundaryOverlayArtifacts({
      frame: createEquirectangularTileFrame(baseManifest()),
      sources: [
        { sourceKind: 'land', geojson: { type: 'FeatureCollection', features: [
          feature('International boundary (verify)', [[0, 0.05], [1, 0.05]]),
          feature('Disputed (please verify)', [[1, 0.05], [2, 0.05]]),
        ] } },
        { sourceKind: 'disputed', geojson: { type: 'FeatureCollection', features: [
          feature('Claim boundary', [[2, 0.05], [3, 0.05]]),
        ] } },
      ],
      rules: manifest.boundaryRules,
      policy: manifest.policy,
    });
    const segments = result.artifacts.flatMap(({ bytes }) => (
      JSON.parse(new TextDecoder().decode(bytes)).segments
    ));
    expect(new Set(segments.map(({ boundaryClass }) => boundaryClass)))
      .toEqual(new Set(['de-facto', 'neutral-disputed']));
    expect(segments.every((segment) => !Object.hasOwn(segment, 'name') && !Object.hasOwn(segment, 'claim')))
      .toBe(true);
  });

  it('256 경계 양쪽에 같은 전역 endpoint와 ID를 기록하고 반복 생성은 byte-identical이다', () => {
    const manifest = boundaryManifest();
    const normalized = normalizeOverworldBoundaryManifest(manifest);
    const frame = createEquirectangularTileFrame(baseManifest());
    const start = frame.unproject(255, 4);
    const end = frame.unproject(257, 4);
    const sourceGeojson = {
      land: { type: 'FeatureCollection', features: [
        feature('International boundary (verify)', [[start.lon, start.lat], [end.lon, end.lat]]),
      ] },
      disputed: { type: 'FeatureCollection', features: [
        feature('Claim boundary', [[0, 0.05], [1, 0.05]]),
      ] },
    };
    const overlays = buildBoundaryOverlayArtifacts({
      frame,
      sources: normalized.boundarySources.map(({ sourceKind }) => ({
        sourceKind,
        geojson: sourceGeojson[sourceKind],
      })),
      rules: normalized.boundaryRules,
      policy: normalized.policy,
    });
    const left = JSON.parse(new TextDecoder().decode(
      overlays.artifacts.find(({ path }) => path === 'boundaries/0/0.json').bytes,
    ));
    const right = JSON.parse(new TextDecoder().decode(
      overlays.artifacts.find(({ path }) => path === 'boundaries/1/0.json').bytes,
    ));
    const sharedId = left.segments.find(({ id }) => right.segments.some((segment) => segment.id === id)).id;
    expect(left.segments.find(({ id }) => id === sharedId))
      .toEqual(right.segments.find(({ id }) => id === sharedId));

    const args = {
      manifestBytes: new TextEncoder().encode(`${JSON.stringify(manifest)}\n`),
      manifest,
      baseRegionManifest: baseManifest(),
      sourceGeojson,
    };
    const first = buildBoundaryArtifacts(args);
    const second = buildBoundaryArtifacts(args);
    expect(first.map(({ path }) => path)).toEqual(second.map(({ path }) => path));
    first.forEach((artifact, index) => {
      expect(sha256(artifact.bytes)).toBe(sha256(second[index].bytes));
    });
  });

  it('체크인된 EMEA 경계는 정책·해시·무지명·중립 분류를 고정한다', () => {
    const content = JSON.parse(readFileSync(path.join(CHECKED_IN_BOUNDARY_DIR, 'content-manifest.json'), 'utf8'));
    expect(content).toMatchObject({
      releaseEligible: true,
      width: 964,
      height: 1137,
      chunkColumns: 4,
      chunkRows: 5,
      boundaryRules: {
        quantization: 1024,
        haloTiles: 1,
        simplification: 'none',
        defaultScaleRank: 10,
      },
      policy: {
        id: 'neutral-boundary-policy-v1',
        countryFill: 'none',
        ownershipLabels: 'forbidden',
        sourceProperties: 'discard-all',
      },
    });
    expect(content.overlays).toHaveLength(17);
    const classes = new Set();
    for (const entry of [content.report, ...content.overlays]) {
      const bytes = readFileSync(path.join(CHECKED_IN_BOUNDARY_DIR, entry.path));
      expect(bytes.byteLength, entry.path).toBe(entry.bytes);
      expect(sha256(bytes), entry.path).toBe(entry.sha256);
      if (entry.role !== 'boundary-overlay') continue;
      const overlay = JSON.parse(bytes.toString('utf8'));
      for (const segment of overlay.segments) {
        classes.add(segment.boundaryClass);
        for (const forbidden of ['name', 'claim', 'comment', 'country', 'admin', 'left', 'right']) {
          expect(Object.hasOwn(segment, forbidden), `${entry.path}:${segment.id}:${forbidden}`).toBe(false);
        }
      }
    }
    expect(classes).toEqual(new Set(['de-facto', 'neutral-disputed']));
  });
});
