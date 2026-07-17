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
  new URL('../../../../scripts/data/canberra-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/canberra-osm-v21.json', import.meta.url),
  'utf8',
));

describe('캔버라 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [149.06, -35.33, 149.18, -35.24],
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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canberra-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: -35.31, lon: 149.09 }] },
      { type: 'node', id: 5, lat: -35.28, lon: 149.12 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: -35.31, lon: 149.09 }, { lat: -35.28, lon: 149.12 }],
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
      geometry: [{ lat: -35.31, lon: 149.09 }, { lat: -35.28, lon: 149.12 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('남반구 위도를 양의 aspect correction으로 투영하고 북쪽을 화면 위로 둔다', () => {
    const southern = projectionMetrics(PARTITIONS.bbox, 20);
    const mirroredNorthern = projectionMetrics([149.06, 35.24, 149.18, 35.33], 20);
    const northWest = project(-35.24, 149.06, southern);
    const southEast = project(-35.33, 149.18, southern);

    expect(southern.correction).toBeGreaterThan(0);
    expect(southern.correction).toBeCloseTo(mirroredNorthern.correction, 12);
    expect(southern.grid).toEqual({ w: 546, h: 501 });
    expect(northWest.x).toBeCloseTo(0, 10);
    expect(northWest.y).toBeCloseTo(0, 10);
    expect(southEast.x).toBeGreaterThan(northWest.x);
    expect(southEast.y).toBeGreaterThan(northWest.y);
  });

  it('같은 20m 투영·레이어 계약으로 결정적이며 콘텐츠를 만들지 않는다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildEnglishCitySnapshot('canberra', raw);
    const second = buildEnglishCitySnapshot('canberra', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'canberra',
      bbox: [149.06, -35.33, 149.18, -35.24],
      metersPerTile: 20,
      grid: { w: 546, h: 501 },
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
      city: 'canberra',
      bbox: [149.06, -35.33, 149.18, -35.24],
      metersPerTile: 20,
      grid: { w: 546, h: 501 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-17',
        providers: ['overpass-api.de', 'maps.mail.ru'],
        rawOverpassSha256: '80df8d0f2d8ee26ffca7f90067204414266b589fc54f683e9d93afefa422ed30',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 23_607,
        roadWays: 27_781,
        waterAreas: 183,
        riverWays: 270,
        parkAreas: 2_144,
        mountainAreas: 0,
        railwayWays: 87,
        coastlineWays: 0,
        bridgeWays: 444,
        tidalFlatAreas: 0,
        excludedCoveredWaterways: 86,
        crossingNodes: 5_103,
        crossingTiles: 5_103,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: 'e91f92c9a49b6a8f7ba5daa54e7f8eebf6ec36a18d34b6b5aaf8442263d74873',
      roadRle: 'fec4f2949d2954943153ae3a7658653895adc50be738b66dbd70cf4441e2f27d',
      waterRle: '5f8fd5d638bf68383ae7c0bb89745060933989b1ca922df4815e9d17f2ba42ed',
      riverRle: 'c1102bdd330f100ef844ccad9588bfda5c4913abdb69bae6e85db276f49cfc35',
      parkRle: 'b3273bb50da2d503a2292b76b05e39dd215f953728aa08e4685ccb09156cca6c',
      mountainRle: '3ea3ef79a838c20a61e3b7f1259fc096363d160f762ee08621708a6e90313624',
      railwayRle: 'd9820e4e01baf086688ce32f039585c55bb517cd5f5a4865d43553d6b86359ea',
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
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(546 * 501);
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

    expect(cells).toBe(273_546);
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 546,
      sourceHeight: 501,
      width: 1_638,
      height: 1_503,
      backingBytes: 9_847_656,
    });
    expect(estimatedPeakBytes).toBe(12_856_662);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('외부 config에도 남반구 20m 계약을 동일하게 적용한다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const snapshot = buildSnapshotFromConfig('canberra-probe', {
      bbox: PARTITIONS.bbox,
      metersPerTile: 20,
      forestLayer: 'park',
      oceanSeeds: [],
    }, raw);
    expect(snapshot.grid).toEqual({ w: 546, h: 501 });
  });
});
