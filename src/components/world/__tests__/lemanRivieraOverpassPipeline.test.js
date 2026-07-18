import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFrenchCitySnapshot } from '../../../../scripts/build-french-city-osm-snapshot.mjs';
import {
  project,
  projectionMetrics,
} from '../../../../scripts/build-korean-city-osm-snapshot.mjs';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';
import { mergeOverpassFiles } from '../../../../scripts/merge-overpass-json.mjs';
import { renderCitySnapshotPng } from '../../../../scripts/world/render-city-snapshot.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/leman-riviera-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/leman-riviera-osm-v21.json', import.meta.url),
  'utf8',
));

function decodeRle(runs, length) {
  const values = new Uint8Array(length);
  let offset = 0;
  for (const [value, count] of runs) {
    values.fill(value, offset, offset + count);
    offset += count;
  }
  expect(offset).toBe(length);
  return values;
}

describe('레만호 연안 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [6.60, 46.40, 6.95, 46.54],
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

  it('레만호·철도·도로·산지와 교량 분류에 필요한 tag를 원본 쿼리에 포함한다', () => {
    const queries = overpassQueries(PARTITIONS.partitions[0].bbox);
    expect(queries.lines).toContain('way["railway"~"^(rail|subway|light_rail|tram)$"]');
    expect(queries.lines).toContain('way["highway"]');
    expect(queries.lines).toContain('way["waterway"~"^(river|canal|stream)$"]');
    expect(queries.areas).toContain('way["natural"="water"]');
    expect(queries.areas).toContain('relation["landuse"~"^(grass|recreation_ground|forest)$"]');
    expect(queries.areas).toContain('relation["natural"~"^(wood|scrub|heath|grassland)$"]');
  });

  it('분할 원본 병합은 입력 순서와 무관하게 byte-identical이다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'leman-riviera-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 46.41, lon: 6.61 }] },
      { type: 'node', id: 5, lat: 46.52, lon: 6.64 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: 46.41, lon: 6.61 }, { lat: 46.52, lon: 6.64 }],
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
      geometry: [{ lat: 46.41, lon: 6.61 }, { lat: 46.52, lon: 6.64 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('북쪽을 화면 위로 두는 20m 투영과 로잔~시옹성 범위를 고정한다', () => {
    const metrics = projectionMetrics(PARTITIONS.bbox, 20);
    const northWest = project(46.54, 6.60, metrics);
    const southEast = project(46.40, 6.95, metrics);
    const anchors = [
      { id: 'lausanne', lon: 6.6323, lat: 46.5197 },
      { id: 'vevey', lon: 6.8430, lat: 46.4620 },
      { id: 'montreux', lon: 6.9107, lat: 46.4312 },
      { id: 'chillon', lon: 6.9275, lat: 46.4142 },
    ];

    expect(metrics.grid).toEqual({ w: 1342, h: 780 });
    expect(northWest.x).toBeCloseTo(0, 10);
    expect(northWest.y).toBeCloseTo(0, 10);
    expect(southEast.x).toBeGreaterThan(northWest.x);
    expect(southEast.y).toBeGreaterThan(northWest.y);
    for (const anchor of anchors) {
      expect(anchor.lon).toBeGreaterThanOrEqual(PARTITIONS.bbox[0]);
      expect(anchor.lon).toBeLessThanOrEqual(PARTITIONS.bbox[2]);
      expect(anchor.lat).toBeGreaterThanOrEqual(PARTITIONS.bbox[1]);
      expect(anchor.lat).toBeLessThanOrEqual(PARTITIONS.bbox[3]);
    }
    expect(6.59).toBeLessThan(PARTITIONS.bbox[0]);
  });

  it('같은 compact 입력의 snapshot 생성은 결정적이며 콘텐츠를 만들지 않는다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildFrenchCitySnapshot('leman-riviera', raw);
    const second = buildFrenchCitySnapshot('leman-riviera', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'leman-riviera',
      bbox: [6.60, 46.40, 6.95, 46.54],
      metersPerTile: 20,
      grid: { w: 1342, h: 780 },
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
      city: 'leman-riviera',
      bbox: [6.60, 46.40, 6.95, 46.54],
      metersPerTile: 20,
      grid: { w: 1342, h: 780 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-18',
        providers: ['overpass-api.de', 'maps.mail.ru'],
        rawOverpassSha256: '48c729a8768ab4f9a53ad3b4f26884c1f0f364e34b2731971ddad2bf7fa96e61',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 44_344,
        roadWays: 40_382,
        waterAreas: 169,
        riverWays: 819,
        parkAreas: 1_039,
        mountainAreas: 1_346,
        railwayWays: 821,
        coastlineWays: 0,
        bridgeWays: 773,
        excludedCoveredWaterways: 188,
        crossingNodes: 2_801,
        crossingTiles: 2_801,
        mountainRelations: 259,
        mountainRelationsWithGeometry: 259,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '683964dfc29a1da860e1d4ce0218b0e2560a2ccbd0c84e12aa4ad90384080f64',
      roadRle: 'aa34d9d49f7ea0980547692f8ef9088953e01931205f506ada6374020bd2d082',
      waterRle: '76e9d4183e1fe8212c0322585108b83de2c025e4e95ad2d218b9f8eadcb2806f',
      riverRle: 'a35d4208cdd1098ec21a00fbf516784806422abe7b1c32be9171eafc1284f5a1',
      parkRle: 'be3cf5dd42159ea916374b1b891eb37da88e991a247ec308f3aca8e3f305538c',
      mountainRle: '3355bfc6f6c40d174bdb5d49dc4d31b16a5e3973b6a1d7b575ab18480a507038',
      railwayRle: 'ccf17a956407f5ffd3114c4fc3476203014db846f5c45d240be2191936e4cfda',
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
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(1342 * 780);
    }
    expect(SNAPSHOT.waterRle.reduce((sum, [value, count]) => sum + (value ? count : 0), 0))
      .toBe(523_786);
    expect(SNAPSHOT.mountainRle.reduce((sum, [value, count]) => sum + (value ? count : 0), 0))
      .toBe(152_274);
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });

  it('레만호와 북안 산지 실루엣을 결정적 PNG로 고정한다', () => {
    const length = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const water = decodeRle(SNAPSHOT.waterRle, length);
    const river = decodeRle(SNAPSHOT.riverRle, length);
    const mountain = decodeRle(SNAPSHOT.mountainRle, length);
    const park = decodeRle(SNAPSHOT.parkRle, length);
    const profile = (y, masks) => {
      let count = 0;
      for (let x = 0; x < SNAPSHOT.grid.w; x += 1) {
        const index = y * SNAPSHOT.grid.w + x;
        if (masks.some((mask) => mask[index])) count += 1;
      }
      return count;
    };

    expect([0, 200, 400, 600, 779].map((y) => profile(y, [water, river])))
      .toEqual([57, 299, 890, 1_186, 639]);
    expect([0, 200, 400, 600, 779].map((y) => profile(y, [mountain, park])))
      .toEqual([322, 471, 103, 61, 276]);

    const png = renderCitySnapshotPng(SNAPSHOT);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('ead9d38de756d7cf16d03fd201a27e12317d9b0b47c6f672a83334c25e728803');
  });

  it('미니맵 추정 피크 메모리가 24 MiB gate 안이다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;

    expect(cells).toBe(1_046_760);
    expect(layout).toMatchObject({
      factor: 2,
      sourceWidth: 671,
      sourceHeight: 390,
      width: 2_013,
      height: 1_170,
      backingBytes: 9_420_840,
    });
    expect(estimatedPeakBytes).toBe(14_654_640);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
