import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFrenchCitySnapshot } from '../../../../scripts/build-french-city-osm-snapshot.mjs';
import { project, projectionMetrics } from '../../../../scripts/build-korean-city-osm-snapshot.mjs';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';
import { mergeOverpassFiles } from '../../../../scripts/merge-overpass-json.mjs';
import { renderCitySnapshotPng } from '../../../../scripts/world/render-city-snapshot.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/strasbourg-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/strasbourg-osm-v21.json', import.meta.url),
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

function intervalsAt(y, masks) {
  const intervals = [];
  for (let x = 0; x < SNAPSHOT.grid.w; x += 1) {
    const index = y * SNAPSHOT.grid.w + x;
    if (!masks.some((mask) => mask[index])) continue;
    const previous = intervals.at(-1);
    if (!previous || x > previous[1] + 1) intervals.push([x, x]);
    else previous[1] = x;
  }
  return intervals;
}

describe('스트라스부르 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [7.70, 48.55, 7.81, 48.63],
      provider: 'overpass-api.de',
      endpoint: 'https://overpass-api.de/api/interpreter',
      fallbacks: [],
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
      expect(Object.keys(overpassQueries(a))).toEqual(['structures', 'lines', 'areas']);
      for (let right = left + 1; right < PARTITIONS.partitions.length; right += 1) {
        const b = PARTITIONS.partitions[right].bbox;
        const overlapWidth = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
        const overlapHeight = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        expect(overlapWidth * overlapHeight).toBe(0);
      }
    }
  });

  it('일강·운하·철도·도로와 교량 분류에 필요한 원본 tag를 포함한다', () => {
    const queries = overpassQueries(PARTITIONS.partitions[0].bbox);
    expect(queries.lines).toContain('way["waterway"~"^(river|canal|stream)$"]');
    expect(queries.lines).toContain('way["railway"~"^(rail|subway|light_rail|tram)$"]');
    expect(queries.lines).toContain('way["highway"]');
    expect(queries.areas).toContain('way["natural"="water"]');
  });

  it('분할 원본 병합은 입력 순서와 무관하게 byte-identical이다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strasbourg-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 48.56, lon: 7.71 }] },
      { type: 'node', id: 5, lat: 48.62, lon: 7.80 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way', id: 9, tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: 48.56, lon: 7.71 }, { lat: 48.62, lon: 7.80 }],
      },
      { type: 'relation', id: 2, members: [] },
    ] }));
    mergeOverpassFiles([firstInput, secondInput], firstOutput);
    mergeOverpassFiles([secondInput, firstInput], secondOutput);
    expect(fs.readFileSync(firstOutput)).toEqual(fs.readFileSync(secondOutput));
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('북쪽을 화면 위로 두는 20m 투영과 그랑딜·라인강 범위를 고정한다', () => {
    const metrics = projectionMetrics(PARTITIONS.bbox, 20);
    const northWest = project(48.63, 7.70, metrics);
    const southEast = project(48.55, 7.81, metrics);
    expect(metrics.grid).toEqual({ w: 405, h: 446 });
    expect(northWest.x).toBeCloseTo(0, 10);
    expect(northWest.y).toBeCloseTo(0, 10);
    expect(southEast.x).toBeGreaterThan(northWest.x);
    expect(southEast.y).toBeGreaterThan(northWest.y);
    for (const anchor of [
      { id: 'grande-ile', lon: 7.75, lat: 48.583 },
      { id: 'ill-west', lon: 7.738, lat: 48.583 },
      { id: 'rhine-east', lon: 7.80, lat: 48.58 },
    ]) {
      expect(anchor.lon, anchor.id).toBeGreaterThanOrEqual(PARTITIONS.bbox[0]);
      expect(anchor.lon, anchor.id).toBeLessThanOrEqual(PARTITIONS.bbox[2]);
      expect(anchor.lat, anchor.id).toBeGreaterThanOrEqual(PARTITIONS.bbox[1]);
      expect(anchor.lat, anchor.id).toBeLessThanOrEqual(PARTITIONS.bbox[3]);
    }
  });

  it('같은 compact 입력의 snapshot 생성은 결정적이며 콘텐츠를 만들지 않는다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildFrenchCitySnapshot('strasbourg', raw);
    const second = buildFrenchCitySnapshot('strasbourg', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'strasbourg',
      bbox: [7.70, 48.55, 7.81, 48.63],
      metersPerTile: 20,
      grid: { w: 405, h: 446 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-22',
        providers: ['overpass-api.de'],
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
      city: 'strasbourg',
      bbox: [7.70, 48.55, 7.81, 48.63],
      metersPerTile: 20,
      grid: { w: 405, h: 446 },
      source: {
        rawOverpassSha256: 'a9601cccf2c5acfc547acfdeca9512ce02b4494ee9b6a96b65f07e6c1072ffc8',
        buildingWays: 62_594,
        roadWays: 27_091,
        waterAreas: 186,
        riverWays: 164,
        parkAreas: 6_377,
        mountainAreas: 0,
        railwayWays: 2_536,
        bridgeWays: 564,
        excludedCoveredWaterways: 4,
        crossingNodes: 5_253,
        crossingTiles: 5_253,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '51d8b75db82c125f52fa4ee6c8673d8e299da1040d75258855d9c0588928ecb7',
      roadRle: '717d17ce36b341fa970b29917a25f9c645aa8ee42c9f799f2d90b7ac0713c2b9',
      waterRle: '00a0897450882a3076ad8987d842ab9ccf5724160d743a544f5726ac96fa42dd',
      riverRle: '3ec8ae7d349c145a1dae1146be672c895f9a5c71c1f51d4178b936dbd2003bb7',
      parkRle: 'd2e8e5ad6a89bddd7355f586a635ca0cd763be2e70a23d9629635a46c1e8a786',
      mountainRle: '92860b36b992d26b5577fd9b309dcabb9814f1742c9b0a2ec1919c5041b0a8d9',
      railwayRle: '9693ff24dafc99bd435e3fdeddf47a64b769b3fe0453fb2b7115a13f7a1483f7',
    });
    for (const key of Object.keys(SNAPSHOT.hashes)) {
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(405 * 446);
    }
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });

  it('일강 분기가 그랑딜을 감싸고 동쪽 라인강·운하망과 분리된다', () => {
    const length = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const water = decodeRle(SNAPSHOT.waterRle, length);
    const river = decodeRle(SNAPSHOT.riverRle, length);
    const channels = intervalsAt(260, [water, river]);

    expect(channels).toContainEqual([143, 144]);
    expect(channels).toContainEqual([210, 213]);
    expect(water[260 * SNAPSHOT.grid.w + 184] || river[260 * SNAPSHOT.grid.w + 184]).toBe(0);
    expect(channels).toContainEqual([364, 375]);
    expect(channels.length).toBeGreaterThanOrEqual(8);

    const png = renderCitySnapshotPng(SNAPSHOT);
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('c15c1b3ac46f54a05951403687018aef11b6c32ff1e29bb578a548e359d45505');
  });

  it('미니맵 추정 피크 메모리가 24 MiB gate 안이다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;

    expect(cells).toBe(180_630);
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 405,
      sourceHeight: 446,
      width: 1_215,
      height: 1_338,
      backingBytes: 6_502_680,
    });
    expect(estimatedPeakBytes).toBe(8_489_610);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
