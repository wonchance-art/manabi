import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildChineseCitySnapshot } from '../../../../scripts/build-chinese-city-osm-snapshot.mjs';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';
import { mergeOverpassFiles } from '../../../../scripts/merge-overpass-json.mjs';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/beijing-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/beijing-osm-v21.json', import.meta.url),
  'utf8',
));

describe('베이징 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [116.35, 39.88, 116.43, 39.95],
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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'beijing-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 39.89, lon: 116.36 }] },
      { type: 'node', id: 5, lat: 39.90, lon: 116.37 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: 39.89, lon: 116.36 }, { lat: 39.90, lon: 116.37 }],
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
      geometry: [{ lat: 39.89, lon: 116.36 }, { lat: 39.90, lon: 116.37 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('한국 파이프라인과 같은 20m 투영·레이어 계약으로 결정적 스냅샷을 만든다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildChineseCitySnapshot('beijing', raw);
    const second = buildChineseCitySnapshot('beijing', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'beijing',
      bbox: [116.35, 39.88, 116.43, 39.95],
      metersPerTile: 20,
      grid: { w: 342, h: 390 },
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
      city: 'beijing',
      bbox: [116.35, 39.88, 116.43, 39.95],
      metersPerTile: 20,
      grid: { w: 342, h: 390 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-17',
        providers: ['overpass-api.de', 'maps.mail.ru'],
        rawOverpassSha256: '5a81f47f5821260a1392c68525965af13e55d4aff1434b44b96c7882783b2e88',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 13_109,
        roadWays: 8_986,
        waterAreas: 55,
        riverWays: 16,
        parkAreas: 378,
        mountainAreas: 119,
        railwayWays: 249,
        coastlineWays: 0,
        bridgeWays: 436,
        tidalFlatAreas: 0,
        excludedCoveredWaterways: 8,
        crossingNodes: 849,
        crossingTiles: 849,
        mountainRelations: 1,
        mountainRelationsWithGeometry: 1,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: 'e6aeac893e775a85658bc93b9b480dc48898f6e90b2ee21ae062575509b1f7b4',
      roadRle: 'ce395a99a58bcbfa6b08d268fc8d95bed6cf91e0d21608487e9f97231bc3dcd2',
      waterRle: '02f5de1d4886560f048f0c20b4a95f07598a99d9f3858957b393777c9c56f477',
      riverRle: '115455d1794876acdcbc7440e4f84133a616fca5e9c3e2e421f07fe0fde2d4b9',
      parkRle: 'fe2a535c03daeba6daf982c3adf6ddb285ca6bff48f178946005e37e06ab48ec',
      mountainRle: 'bd8f4c483406a3707b0a7a1538f3088e3569dc17da4fda07195d63c9986219da',
      railwayRle: '6a47860bdd902571f62fc0cefefaea8c66b5bcb5e9207d0002fb83af03f9290d',
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
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(342 * 390);
    }
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });
});
