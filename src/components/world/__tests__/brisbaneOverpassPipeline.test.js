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

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/brisbane-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/brisbane-osm-v21.json', import.meta.url),
  'utf8',
));

describe('브리즈번 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [152.98, -27.52, 153.09, -27.42],
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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'brisbane-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: -27.50, lon: 153.01 }] },
      { type: 'node', id: 5, lat: -27.48, lon: 153.02 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: -27.50, lon: 153.01 }, { lat: -27.48, lon: 153.02 }],
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
      geometry: [{ lat: -27.50, lon: 153.01 }, { lat: -27.48, lon: 153.02 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('남반구 위도를 양의 aspect correction으로 투영하고 북쪽을 화면 위로 둔다', () => {
    const southern = projectionMetrics(PARTITIONS.bbox, 20);
    const mirroredNorthern = projectionMetrics([152.98, 27.42, 153.09, 27.52], 20);
    const northWest = project(-27.42, 152.98, southern);
    const southEast = project(-27.52, 153.09, southern);

    expect(southern.correction).toBeGreaterThan(0);
    expect(southern.correction).toBeCloseTo(mirroredNorthern.correction, 12);
    expect(southern.grid).toEqual({ w: 544, h: 557 });
    expect(northWest.x).toBeCloseTo(0, 10);
    expect(northWest.y).toBeCloseTo(0, 10);
    expect(southEast.x).toBeGreaterThan(northWest.x);
    expect(southEast.y).toBeGreaterThan(northWest.y);
  });

  it('같은 20m 투영·레이어 계약으로 결정적이며 콘텐츠를 만들지 않는다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildEnglishCitySnapshot('brisbane', raw);
    const second = buildEnglishCitySnapshot('brisbane', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'brisbane',
      bbox: [152.98, -27.52, 153.09, -27.42],
      metersPerTile: 20,
      grid: { w: 544, h: 557 },
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
      city: 'brisbane',
      bbox: [152.98, -27.52, 153.09, -27.42],
      metersPerTile: 20,
      grid: { w: 544, h: 557 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-17',
        providers: ['overpass-api.de', 'maps.mail.ru'],
        rawOverpassSha256: '3ff46eb930643139266250260ec536749842de9e3b1b89925fcfa551897e6fa5',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 58_784,
        roadWays: 49_806,
        waterAreas: 109,
        riverWays: 147,
        parkAreas: 1_712,
        mountainAreas: 0,
        railwayWays: 897,
        coastlineWays: 0,
        bridgeWays: 1_062,
        tidalFlatAreas: 0,
        excludedCoveredWaterways: 19,
        crossingNodes: 7_487,
        crossingTiles: 7_487,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: 'a9e3a2f5b99bf655620470318576ef155b29f7edbcc35b2355c2bdbfecdd30c2',
      roadRle: 'e942c187bbb6d8c81d4d6c364f09b3dd0b3744663800c4db470050a32c9cd390',
      waterRle: 'e6265a7b744b3cad096a78c99ab4338f6b6f129889d1f41f6ef718b8ec6bc6a7',
      riverRle: '83ce45439db7fc5fd85d7d66cb6e5a3d4c15cd201034d693a22a3831b494b732',
      parkRle: '54a30d11305e8b760ee4d426db2d671a5af9a4b622379e01ab62f8e6e45f65dd',
      mountainRle: '3446b1c51af81863a186b9cf14f540f391d1f47de3ee3ef15e0cb430e28810df',
      railwayRle: '756546df8d9fe45c77bd7aeea1a9084e9c0470f275cf618365a3d68193dac50c',
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
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(544 * 557);
    }
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });

  it('외부 config에도 남반구 20m 계약을 동일하게 적용한다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const snapshot = buildSnapshotFromConfig('brisbane-probe', {
      bbox: PARTITIONS.bbox,
      metersPerTile: 20,
      forestLayer: 'park',
      oceanSeeds: [],
    }, raw);
    expect(snapshot.grid).toEqual({ w: 544, h: 557 });
  });
});
