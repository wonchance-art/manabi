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
  new URL('../../../../scripts/data/sydney-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/sydney-osm-v21.json', import.meta.url),
  'utf8',
));

describe('시드니 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [151.17, -33.93, 151.31, -33.79],
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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sydney-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: -33.90, lon: 151.20 }] },
      { type: 'node', id: 5, lat: -33.86, lon: 151.22 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: -33.90, lon: 151.20 }, { lat: -33.86, lon: 151.22 }],
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
      geometry: [{ lat: -33.90, lon: 151.20 }, { lat: -33.86, lon: 151.22 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('남반구 위도를 양의 aspect correction으로 투영하고 북쪽을 화면 위로 둔다', () => {
    const southern = projectionMetrics(PARTITIONS.bbox, 20);
    const mirroredNorthern = projectionMetrics([151.17, 33.79, 151.31, 33.93], 20);
    const northWest = project(-33.79, 151.17, southern);
    const southEast = project(-33.93, 151.31, southern);

    expect(southern.correction).toBeGreaterThan(0);
    expect(southern.correction).toBeCloseTo(mirroredNorthern.correction, 12);
    expect(southern.grid).toEqual({ w: 648, h: 780 });
    expect(northWest.x).toBeCloseTo(0, 10);
    expect(northWest.y).toBeCloseTo(0, 10);
    expect(southEast.x).toBeGreaterThan(northWest.x);
    expect(southEast.y).toBeGreaterThan(northWest.y);
  });

  it('같은 20m 투영·레이어 계약으로 결정적이며 콘텐츠를 만들지 않는다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildEnglishCitySnapshot('sydney', raw);
    const second = buildEnglishCitySnapshot('sydney', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'sydney',
      bbox: [151.17, -33.93, 151.31, -33.79],
      metersPerTile: 20,
      grid: { w: 648, h: 780 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-17',
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
      city: 'sydney',
      bbox: [151.17, -33.93, 151.31, -33.79],
      metersPerTile: 20,
      grid: { w: 648, h: 780 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-17',
        providers: ['overpass-api.de', 'maps.mail.ru'],
        rawOverpassSha256: 'f3dad65b82ed4361cde90b81dc780151f51a135cb72f11e411b3eb495727a39e',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 55_968,
        roadWays: 65_024,
        waterAreas: 269,
        riverWays: 125,
        parkAreas: 3_872,
        mountainAreas: 0,
        railwayWays: 1_437,
        coastlineWays: 37,
        bridgeWays: 1_559,
        tidalFlatAreas: 0,
        excludedCoveredWaterways: 18,
        crossingNodes: 10_003,
        crossingTiles: 10_003,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: 'f554164d6ecca9fb4f7239d0ea3f0a7c576ed03ae7bd848a580b2c5b7f265dbc',
      roadRle: 'ec0468d98a04af9e38b89ff6147f96e3961a22d33df09504a7320aceaaae2997',
      waterRle: '247181909f2724f91c75dc980761fe5b2e39950d22f9d5d34d870e0fbb4f3389',
      riverRle: 'bf2a0f86468f660ae8c3f4b774425fb231f15dfc7805d83950bf6b14acc3e241',
      parkRle: '16b5606fffd8b558a565c3acc9e62ec260e76a56350f4fd7ded761617009b945',
      mountainRle: '859c0024dfd24ff9361444e1b3a55dc2ba24f14c33825624cbc5f98e5df7df26',
      railwayRle: '04f8273606a4dda04e1f2a83b6f38031a36adf2329821c3001555560fc8c1402',
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
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(648 * 780);
    }
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });

  it('미니맵 추정 피크 메모리가 오너 확정 24 MiB gate 안이다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;

    expect(cells).toBe(505_440);
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 648,
      sourceHeight: 780,
      width: 1_944,
      height: 2_340,
      backingBytes: 18_195_840,
    });
    expect(estimatedPeakBytes).toBe(23_755_680);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('외부 config에도 남반구 20m 계약을 동일하게 적용한다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const snapshot = buildSnapshotFromConfig('sydney-probe', {
      bbox: PARTITIONS.bbox,
      metersPerTile: 20,
      forestLayer: 'park',
      oceanSeeds: [],
    }, raw);
    expect(snapshot.grid).toEqual({ w: 648, h: 780 });
  });
});
