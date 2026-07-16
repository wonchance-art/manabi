import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildProjectionSweepArtifacts } from '../../../../scripts/world/build-projection-emea-sweep.mjs';
import {
  buildEmeaProjectionSweep,
  evaluateEquirectangularStandardLatitude,
  linearPercentile,
  normalizeProjectionSweepManifest,
} from '../overworldProjectionSweep.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../../..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'scripts/world/projection-emea-standard-lat-sweep.json');
const OUTPUT_DIR = path.join(REPO_ROOT, 'docs/generated/world-projection-emea-sweep');

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

describe('EMEA equirectangular standard-latitude sweep', () => {
  it('고정 선형 보간 percentile을 계산한다', () => {
    expect(linearPercentile([0, 10, 20, 30], 0.5)).toBe(15);
    expect(linearPercentile([0, 10, 20, 30], 0.95)).toBeCloseTo(28.5, 12);
  });

  it('알 수 없는 필드·7개가 아닌 fixture·screen-axis 누락을 거부한다', () => {
    const manifest = loadManifest();
    expect(() => normalizeProjectionSweepManifest({ ...manifest, surprise: true })).toThrow(/keys must be exactly/);
    expect(() => normalizeProjectionSweepManifest({ ...manifest, fixtures: manifest.fixtures.slice(0, 6) }))
      .toThrow(/exactly seven/);
    expect(() => normalizeProjectionSweepManifest({ ...manifest, axisModes: ['geo-axis'] }))
      .toThrow(/axisModes/);
    expect(() => normalizeProjectionSweepManifest({
      ...manifest,
      fixtures: manifest.fixtures.map((fixture, index) => (
        index === 0 ? { ...fixture, weight: 2 } : fixture
      )),
    })).toThrow(/must remain 1/);
  });

  it('등장방형은 screen·geo 방향 오차를 0으로 유지한다', () => {
    const manifest = normalizeProjectionSweepManifest(loadManifest());
    const result = evaluateEquirectangularStandardLatitude({
      standardLat: 50,
      bbox: manifest.bbox,
      sampleGrid: manifest.sampleGrid,
      scoreWeights: manifest.scoreWeights,
      earthRadiusMeters: manifest.earthRadiusMeters,
      metersPerTile: manifest.metersPerTile,
    });
    expect(result.metrics.screenNorthErrorDeg.max).toBe(0);
    expect(result.metrics.geoAxisHorizontalShare.max).toBe(0);
    expect(result.widthTiles).toBe(969);
    expect(result.heightTiles).toBe(1137);
  });

  it('7권역 균등 점수로 50°N을 결정적으로 추천한다', () => {
    const first = buildEmeaProjectionSweep(loadManifest());
    const second = buildEmeaProjectionSweep(loadManifest());
    expect(first.recommendation.standardLat).toBe(50.25);
    expect(first.recommendation.uniformFixtureScore).toBeCloseTo(12.8683, 4);
    expect(first.ranking.map(({ standardLat }) => standardLat))
      .toEqual(second.ranking.map(({ standardLat }) => standardLat));
    expect(first.recommendation.region.metrics.eastScaleErrorPct.p95).toBeLessThan(41);
  });

  it('보고서·CSV·SVG·manifest를 byte-identical하게 만든다', () => {
    const manifestBytes = readFileSync(MANIFEST_PATH);
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    const first = buildProjectionSweepArtifacts({ manifestBytes, manifest });
    const second = buildProjectionSweepArtifacts({ manifestBytes, manifest });
    expect(first.map(({ path: artifactPath }) => artifactPath)).toEqual([
      'metrics.csv', 'report.md', 'results.json', 'sweep.svg', 'content-manifest.json',
    ]);
    first.forEach((artifact, index) => {
      expect(Buffer.compare(Buffer.from(artifact.bytes), Buffer.from(second[index].bytes))).toBe(0);
    });
    const results = JSON.parse(new TextDecoder().decode(
      first.find(({ path: artifactPath }) => artifactPath === 'results.json').bytes,
    ));
    expect(results.recommendation).toMatchObject({
      projection: 'equirectangular', axisMode: 'screen-axis', standardLat: 50.25,
    });
  });

  it.runIf(existsSync(path.join(OUTPUT_DIR, 'content-manifest.json')))(
    '체크인된 스윕 파일의 크기와 해시를 검증한다',
    () => {
      const content = JSON.parse(readFileSync(path.join(OUTPUT_DIR, 'content-manifest.json'), 'utf8'));
      expect(content.recommendation).toEqual({
        projection: 'equirectangular', axisMode: 'screen-axis', standardLat: 50.25,
      });
      for (const entry of content.files) {
        const bytes = readFileSync(path.join(OUTPUT_DIR, entry.path));
        expect(bytes.byteLength, entry.path).toBe(entry.bytes);
        expect(sha256(bytes), entry.path).toBe(entry.sha256);
      }
    },
  );
});
