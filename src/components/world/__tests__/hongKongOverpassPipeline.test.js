import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildChineseCitySnapshot } from '../../../../scripts/build-chinese-city-osm-snapshot.mjs';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';
import { mergeOverpassFiles } from '../../../../scripts/merge-overpass-json.mjs';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/hong-kong-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/hong-kong-osm-v21.json', import.meta.url),
  'utf8',
));

describe('홍콩 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [114.10, 22.26, 114.22, 22.33],
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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hong-kong-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 22.28, lon: 114.12 }] },
      { type: 'node', id: 5, lat: 22.29, lon: 114.13 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: 22.28, lon: 114.12 }, { lat: 22.29, lon: 114.13 }],
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
      geometry: [{ lat: 22.28, lon: 114.12 }, { lat: 22.29, lon: 114.13 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('한국 파이프라인과 같은 20m 투영·레이어 계약으로 결정적 스냅샷을 만든다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildChineseCitySnapshot('hong-kong', raw);
    const second = buildChineseCitySnapshot('hong-kong', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'hong-kong',
      bbox: [114.10, 22.26, 114.22, 22.33],
      metersPerTile: 20,
      grid: { w: 618, h: 390 },
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
      city: 'hong-kong',
      bbox: [114.10, 22.26, 114.22, 22.33],
      metersPerTile: 20,
      grid: { w: 618, h: 390 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-17',
        providers: ['overpass-api.de', 'maps.mail.ru'],
        rawOverpassSha256: '3c2eb946782a2846cb7c1201db211d7fb13d8c41e3e2a81679658b2ac3e58c8a',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 20_638,
        roadWays: 40_541,
        waterAreas: 134,
        riverWays: 174,
        parkAreas: 644,
        mountainAreas: 1_153,
        railwayWays: 587,
        coastlineWays: 123,
        bridgeWays: 3_958,
        tidalFlatAreas: 0,
        excludedCoveredWaterways: 43,
        crossingNodes: 3_591,
        crossingTiles: 3_591,
        mountainRelations: 37,
        mountainRelationsWithGeometry: 37,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '7d11289f2c986c1d404dd12809cf195f2dd706d9729cdf530942f48d21f5edb0',
      roadRle: '5c0b73bef830904ef8bf1a3ebb56987c9dc9007ce9ede408f8ef8f6fd2029575',
      waterRle: 'a219fe2138d1174e8d1a49f7fe33c08ddb3d9e38bbfdead2ed44a4c85d940467',
      riverRle: '76fbf6d63af93da5fd25d05a69e88a717d1b79e7dfd0467ac9ae355af215acc4',
      parkRle: 'bca167b2a73c17331b8685fa54251a4144dd4ff118ccc24797baf9560d863823',
      mountainRle: '61e3b2d2083922ccbfba4afb5b9fbf84e47238580d18a5bf2e1edf66790b6983',
      railwayRle: 'b03b511c30084af4eee282cb8256ac92460b25cf1400f0dbde0434d99d603c84',
    });
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });
});
