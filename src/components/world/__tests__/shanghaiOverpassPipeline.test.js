import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildChineseCitySnapshot } from '../../../../scripts/build-chinese-city-osm-snapshot.mjs';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';
import { mergeOverpassFiles } from '../../../../scripts/merge-overpass-json.mjs';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/shanghai-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/shanghai-osm-v21.json', import.meta.url),
  'utf8',
));

describe('상하이 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [121.45, 31.19, 121.54, 31.26],
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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shanghai-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 31.20, lon: 121.46 }] },
      { type: 'node', id: 5, lat: 31.21, lon: 121.47 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: 31.20, lon: 121.46 }, { lat: 31.21, lon: 121.47 }],
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
      geometry: [{ lat: 31.20, lon: 121.46 }, { lat: 31.21, lon: 121.47 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('한국 파이프라인과 같은 20m 투영·레이어 계약으로 결정적 스냅샷을 만든다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildChineseCitySnapshot('shanghai', raw);
    const second = buildChineseCitySnapshot('shanghai', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'shanghai',
      bbox: [121.45, 31.19, 121.54, 31.26],
      metersPerTile: 20,
      grid: { w: 429, h: 390 },
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
    expect(Object.keys(first.hashes)).toEqual([
      'buildingRle',
      'roadRle',
      'waterRle',
      'riverRle',
      'parkRle',
      'mountainRle',
      'railwayRle',
    ]);
    expect(first).not.toHaveProperty('pois');
    expect(first).not.toHaveProperty('stations');
    expect(first).not.toHaveProperty('content');
  });

  it('compact 원본과 비콘텐츠 레이어 해시를 고정한다', () => {
    expect(SNAPSHOT).toMatchObject({
      version: 2,
      city: 'shanghai',
      bbox: [121.45, 31.19, 121.54, 31.26],
      metersPerTile: 20,
      grid: { w: 429, h: 390 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-17',
        providers: ['overpass-api.de', 'maps.mail.ru'],
        rawOverpassSha256: '9062c2ad174f48899328994e54fcbc011361c2f0305cce9dd760895d0ca10ef0',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 15_601,
        roadWays: 10_661,
        waterAreas: 99,
        riverWays: 26,
        parkAreas: 495,
        mountainAreas: 151,
        railwayWays: 212,
        coastlineWays: 0,
        bridgeWays: 587,
        tidalFlatAreas: 0,
        excludedCoveredWaterways: 1,
        crossingNodes: 609,
        crossingTiles: 609,
        mountainRelations: 2,
        mountainRelationsWithGeometry: 2,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '0dbd85262d23191734a0631f149995992090af8f02955b09376042923fd5b16d',
      roadRle: '19f058e8002c5b0cfb3876cf037cdc2b13b6a713d6c33be54b1a36574693717d',
      waterRle: '030e786ddc7b4a8361d816f0a9d1d7bce8529abf97f87eab76e2e664448959e4',
      riverRle: '1a66d104673f0ecfcccb02ab293143bf1a9e4850f76b9fb78dfba0b741e88291',
      parkRle: 'de84494efa23b7d56d0e6dd1e2330a4c1b391d28c1292377571df2c5a01eeab5',
      mountainRle: 'ef9dc468ee2954babbe16d7e4eb3f21a945dacffb3ac0e999d3d9d32cd7d90df',
      railwayRle: '993897821780d67bba97483879133866a0659f9698decc3e9b528722449d3297',
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
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(429 * 390);
    }
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });
});
