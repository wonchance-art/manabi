import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildChineseCitySnapshot } from '../../../../scripts/build-chinese-city-osm-snapshot.mjs';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';
import { mergeOverpassFiles } from '../../../../scripts/merge-overpass-json.mjs';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/taipei-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/taipei-osm-v21.json', import.meta.url),
  'utf8',
));

describe('타이베이 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [121.49, 25.02, 121.58, 25.11],
      provider: 'overpass-api.de',
      endpoint: 'https://overpass-api.de/api/interpreter',
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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'taipei-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 25.03, lon: 121.50 }] },
      { type: 'node', id: 5, lat: 25.04, lon: 121.51 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: 25.03, lon: 121.50 }, { lat: 25.04, lon: 121.51 }],
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
      geometry: [{ lat: 25.03, lon: 121.50 }, { lat: 25.04, lon: 121.51 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('한국 파이프라인과 같은 20m 투영·레이어 계약으로 결정적 스냅샷을 만든다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildChineseCitySnapshot('taipei', raw);
    const second = buildChineseCitySnapshot('taipei', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'taipei',
      bbox: [121.49, 25.02, 121.58, 25.11],
      metersPerTile: 20,
      grid: { w: 454, h: 501 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-17',
        providers: ['overpass-api.de'],
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
      city: 'taipei',
      bbox: [121.49, 25.02, 121.58, 25.11],
      metersPerTile: 20,
      grid: { w: 454, h: 501 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-17',
        providers: ['overpass-api.de'],
        rawOverpassSha256: 'eb200f5c37289af93785f103eaff5c5dddce9faefd44c9c20cd67fa98d987674',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 50_488,
        roadWays: 36_155,
        waterAreas: 264,
        riverWays: 84,
        parkAreas: 2_252,
        mountainAreas: 349,
        railwayWays: 330,
        coastlineWays: 0,
        bridgeWays: 1_485,
        tidalFlatAreas: 0,
        excludedCoveredWaterways: 7,
        crossingNodes: 8_231,
        crossingTiles: 8_231,
        mountainRelations: 15,
        mountainRelationsWithGeometry: 15,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '61f1ae61c8dfec224239d342d90ff49c04fd7444bcafff309bd702f2b17023b7',
      roadRle: '9403285fe9b1c176b06a25c49baa47f9d7202b8cc68bca16e28112dcb9eadd35',
      waterRle: 'ec0c458214e9cdd687e5c72f8b475e1bec951742675edf1dabc4cae9e1773d96',
      riverRle: '68cf53bde1bf7f2c6992f86d9f70f859541ce6228e3d8561edb793b3d6f02cd2',
      parkRle: 'fd6ad78a69f4cb051278a6db992bbff609aef18f8c25e96e9a102fa3ad4acf79',
      mountainRle: '891cebaaa13fe22178e52a5bb32bfece9a2d490fa8dd209e925e33e23f4ea6ac',
      railwayRle: '58727b78f440676a146c7f59a9fa37b69f1f2a1c2a3169636e9313f661bc99e5',
    });
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });
});
