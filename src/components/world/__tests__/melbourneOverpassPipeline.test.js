import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEnglishCitySnapshot } from '../../../../scripts/build-english-city-osm-snapshot.mjs';
import {
  buildSnapshotFromConfig,
  project,
  projectionMetrics,
} from '../../../../scripts/build-korean-city-osm-snapshot.mjs';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';
import { mergeOverpassFiles } from '../../../../scripts/merge-overpass-json.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/melbourne-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/melbourne-osm-v21.json', import.meta.url),
  'utf8',
));

describe('멜버른 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [144.90, -37.88, 145.01, -37.78],
      provider: 'overpass-api.de',
      endpoint: 'https://overpass-api.de/api/interpreter',
      fallbacks: [{
        provider: 'maps.mail.ru',
        endpoint: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      }],
    });
    expect(PARTITIONS.partitions).toHaveLength(16);
    expect(new Set(PARTITIONS.partitions.map(({ id }) => id)).size).toBe(16);

    const [minLon, minLat, maxLon, maxLat] = PARTITIONS.bbox;
    const expectedArea = (maxLon - minLon) * (maxLat - minLat);
    const partitionArea = PARTITIONS.partitions.reduce((sum, { bbox }) => (
      sum + (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
    ), 0);
    expect(partitionArea).toBeCloseTo(expectedArea, 12);

    for (let left = 0; left < PARTITIONS.partitions.length; left += 1) {
      const a = PARTITIONS.partitions[left].bbox;
      expect(a[0]).toBeGreaterThanOrEqual(minLon);
      expect(a[1]).toBeGreaterThanOrEqual(minLat);
      expect(a[2]).toBeLessThanOrEqual(maxLon);
      expect(a[3]).toBeLessThanOrEqual(maxLat);
      expect(Object.keys(overpassQueries(a))).toEqual(['structures', 'lines', 'areas']);
      for (let right = left + 1; right < PARTITIONS.partitions.length; right += 1) {
        const b = PARTITIONS.partitions[right].bbox;
        const overlapWidth = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
        const overlapHeight = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        expect(overlapWidth * overlapHeight).toBe(0);
      }
    }
  });

  it('분할 원본 병합은 입력 순서와 무관하게 byte-identical이다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'melbourne-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: -37.86, lon: 144.93 }] },
      { type: 'node', id: 5, lat: -37.82, lon: 144.97 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: -37.86, lon: 144.93 }, { lat: -37.82, lon: 144.97 }],
      },
      { type: 'relation', id: 2, members: [] },
    ] }));
    mergeOverpassFiles([firstInput, secondInput], firstOutput);
    mergeOverpassFiles([secondInput, firstInput], secondOutput);
    expect(fs.readFileSync(firstOutput)).toEqual(fs.readFileSync(secondOutput));
    expect(JSON.parse(fs.readFileSync(firstOutput, 'utf8')).elements[1]).toEqual({
      type: 'way',
      id: 9,
      tags: { bridge: 'yes', highway: 'primary' },
      geometry: [{ lat: -37.86, lon: 144.93 }, { lat: -37.82, lon: 144.97 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('남반구 위도를 양의 aspect correction으로 투영하고 북쪽을 화면 위로 둔다', () => {
    const southern = projectionMetrics(PARTITIONS.bbox, 20);
    const mirroredNorthern = projectionMetrics([144.90, 37.78, 145.01, 37.88], 20);
    const northWest = project(-37.78, 144.90, southern);
    const southEast = project(-37.88, 145.01, southern);

    expect(southern.correction).toBeGreaterThan(0);
    expect(southern.correction).toBeCloseTo(mirroredNorthern.correction, 12);
    expect(southern.grid).toEqual({ w: 484, h: 557 });
    expect(northWest.x).toBeCloseTo(0, 10);
    expect(northWest.y).toBeCloseTo(0, 10);
    expect(southEast.x).toBeGreaterThan(northWest.x);
    expect(southEast.y).toBeGreaterThan(northWest.y);
  });

  it('같은 20m 투영·레이어 계약으로 결정적이며 콘텐츠를 만들지 않는다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildEnglishCitySnapshot('melbourne', raw);
    const second = buildEnglishCitySnapshot('melbourne', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'melbourne',
      bbox: [144.90, -37.88, 145.01, -37.78],
      metersPerTile: 20,
      grid: { w: 484, h: 557 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-18',
        providers: ['overpass-api.de', 'maps.mail.ru'],
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
      },
    });
    expect(first).not.toHaveProperty('pois');
    expect(first).not.toHaveProperty('stations');
    expect(first).not.toHaveProperty('content');
  });

  it('compact 원본과 비콘텐츠 레이어 해시를 고정한다', () => {
    expect(SNAPSHOT).toMatchObject({
      version: 2,
      city: 'melbourne',
      bbox: [144.90, -37.88, 145.01, -37.78],
      metersPerTile: 20,
      grid: { w: 484, h: 557 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-18',
        providers: ['overpass-api.de', 'maps.mail.ru'],
        rawOverpassSha256: '47467758025ccd49504604933fb779cc3d8c74f191277398271ab4ea5c439bc8',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 70_465,
        roadWays: 52_722,
        waterAreas: 114,
        riverWays: 40,
        parkAreas: 3_160,
        mountainAreas: 0,
        railwayWays: 2_154,
        coastlineWays: 5,
        bridgeWays: 1_006,
        tidalFlatAreas: 0,
        excludedCoveredWaterways: 8,
        crossingNodes: 9_838,
        crossingTiles: 9_838,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '76794bc02647dc91088323920d6abf1c2a18a7988c63cd661c86f6734a947eab',
      roadRle: 'f864657e45953cdab0cfa196554b49b62bea8da884ea56da872d436c3f3b6955',
      waterRle: 'a66c754b9acd191a3da020b5f37f558b12b7024bd05338f10f506d9f30a4853d',
      riverRle: '7ed790d81c07b6d07da290222ff07ddb31028783696b79cb2ac8a1b6b9eb82b2',
      parkRle: '09895988c0540ea14ce2666772b06c6a41e2892b6a77c9b5bee4c39dfaa4531d',
      mountainRle: '4f28704bf99991b2ba32c86f16adb6147bed46ea4a46aa1eb7afdff0df15c307',
      railwayRle: '0514977258db24d9eabdddeb73a35a8721a859456b8920c4c7404106c092ded7',
    });
    for (const key of [
      'buildingRle',
      'roadRle',
      'waterRle',
      'riverRle',
      'parkRle',
      'mountainRle',
      'railwayRle',
    ]) {
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(484 * 557);
    }
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });

  it('미니맵 추정 피크 메모리가 24 MiB gate 안이다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;

    expect(cells).toBe(269_588);
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 484,
      sourceHeight: 557,
      width: 1_452,
      height: 1_671,
      backingBytes: 9_705_168,
    });
    expect(estimatedPeakBytes).toBe(12_670_636);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('외부 config에도 남반구 20m 계약을 동일하게 적용한다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const snapshot = buildSnapshotFromConfig('melbourne-probe', {
      bbox: PARTITIONS.bbox,
      metersPerTile: 20,
      forestLayer: 'park',
      oceanSeeds: [],
    }, raw);
    expect(snapshot.grid).toEqual({ w: 484, h: 557 });
  });
});
