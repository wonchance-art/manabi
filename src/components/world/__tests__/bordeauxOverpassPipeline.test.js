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
  new URL('../../../../scripts/data/bordeaux-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/bordeaux-osm-v21.json', import.meta.url),
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

function widestIntervalAt(y, masks) {
  const intervals = [];
  for (let x = 0; x < SNAPSHOT.grid.w; x += 1) {
    const index = y * SNAPSHOT.grid.w + x;
    if (!masks.some((mask) => mask[index])) continue;
    const previous = intervals.at(-1);
    if (!previous || x > previous[1] + 1) intervals.push([x, x]);
    else previous[1] = x;
  }
  return intervals.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
}

describe('보르도 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [-0.64, 44.79, -0.52, 44.88],
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

  it('가론강·철도·도로와 교량 분류에 필요한 원본 tag를 포함한다', () => {
    const queries = overpassQueries(PARTITIONS.partitions[0].bbox);
    expect(queries.lines).toContain('way["waterway"~"^(river|canal|stream)$"]');
    expect(queries.lines).toContain('way["railway"~"^(rail|subway|light_rail|tram)$"]');
    expect(queries.lines).toContain('way["highway"]');
    expect(queries.areas).toContain('way["natural"="water"]');
  });

  it('분할 원본 병합은 입력 순서와 무관하게 byte-identical이다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bordeaux-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 44.80, lon: -0.63 }] },
      { type: 'node', id: 5, lat: 44.87, lon: -0.53 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way', id: 9, tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: 44.80, lon: -0.63 }, { lat: 44.87, lon: -0.53 }],
      },
      { type: 'relation', id: 2, members: [] },
    ] }));
    mergeOverpassFiles([firstInput, secondInput], firstOutput);
    mergeOverpassFiles([secondInput, firstInput], secondOutput);
    expect(fs.readFileSync(firstOutput)).toEqual(fs.readFileSync(secondOutput));
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('북쪽을 화면 위로 두는 20m 투영과 가론강 범위를 고정한다', () => {
    const metrics = projectionMetrics(PARTITIONS.bbox, 20);
    const northWest = project(44.88, -0.64, metrics);
    const southEast = project(44.79, -0.52, metrics);
    expect(metrics.grid).toEqual({ w: 474, h: 501 });
    expect(northWest.x).toBeCloseTo(0, 10);
    expect(northWest.y).toBeCloseTo(0, 10);
    expect(southEast.x).toBeGreaterThan(northWest.x);
    expect(southEast.y).toBeGreaterThan(northWest.y);
    for (const anchor of [
      { id: 'garonne-north', lon: -0.535, lat: 44.87 },
      { id: 'port-curve', lon: -0.57, lat: 44.845 },
      { id: 'garonne-south', lon: -0.53, lat: 44.80 },
    ]) {
      expect(anchor.lon, anchor.id).toBeGreaterThanOrEqual(PARTITIONS.bbox[0]);
      expect(anchor.lon, anchor.id).toBeLessThanOrEqual(PARTITIONS.bbox[2]);
      expect(anchor.lat, anchor.id).toBeGreaterThanOrEqual(PARTITIONS.bbox[1]);
      expect(anchor.lat, anchor.id).toBeLessThanOrEqual(PARTITIONS.bbox[3]);
    }
  });

  it('같은 compact 입력의 snapshot 생성은 결정적이며 콘텐츠를 만들지 않는다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildFrenchCitySnapshot('bordeaux', raw);
    const second = buildFrenchCitySnapshot('bordeaux', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'bordeaux',
      bbox: [-0.64, 44.79, -0.52, 44.88],
      metersPerTile: 20,
      grid: { w: 474, h: 501 },
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
      city: 'bordeaux',
      bbox: [-0.64, 44.79, -0.52, 44.88],
      metersPerTile: 20,
      grid: { w: 474, h: 501 },
      source: {
        rawOverpassSha256: 'bfec6174d85064d3263109d6c69ae248fa30f72b34434b3a7ee0089f245747e9',
        buildingWays: 181_664,
        roadWays: 35_200,
        waterAreas: 120,
        riverWays: 113,
        parkAreas: 1_768,
        mountainAreas: 0,
        railwayWays: 1_026,
        bridgeWays: 320,
        excludedCoveredWaterways: 77,
        crossingNodes: 9_411,
        crossingTiles: 9_411,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '78ec5e3ec4c771b173f5dcd1bdc8f80bf38164f2637401ac0218e7127691d5e1',
      roadRle: '046bbfeeb0d50fc61f270f14e282948050bf7aab458ea5a0297753b75a776ffd',
      waterRle: '6e4d2ba6896829d4ab1fc9e8279d2ca711ea2242259559d938effb9505908ce3',
      riverRle: '6d664c1bc990c9ace721c054cb265efd8fe92c5270bca868698e4d7f59b564b0',
      parkRle: '0ed96ff1e5d2eb417dd699d1f9d6e48abda598740477bc9d8a9afdcae2cb7b0b',
      mountainRle: '060124bf105a01b3b0fb8951bbef41ee3fd796ccf108cdee1294830520a2a27a',
      railwayRle: 'bd625df0de866e696fecbec9cddc326a2aea0e1d593756ef31bc2be8b0ef9539',
    });
    for (const key of Object.keys(SNAPSHOT.hashes)) {
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(474 * 501);
    }
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });

  it('가론강 초승달 곡류의 서향 굴곡과 남동 회귀를 고정한다', () => {
    const length = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const masks = [decodeRle(SNAPSHOT.waterRle, length), decodeRle(SNAPSHOT.riverRle, length)];
    expect(widestIntervalAt(60, masks)).toEqual([379, 402]);
    expect(widestIntervalAt(120, masks)).toEqual([331, 367]);
    expect(widestIntervalAt(180, masks)).toEqual([277, 295]);
    expect(widestIntervalAt(300, masks)).toEqual([371, 406]);
    expect(widestIntervalAt(360, masks)).toEqual([411, 440]);

    const png = renderCitySnapshotPng(SNAPSHOT);
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('9ac505d39b4a1fd424ba05aa90ce808e96d187adfcde99a3406c19cd173afd47');
  });

  it('미니맵 추정 피크 메모리가 24 MiB gate 안이다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;

    expect(cells).toBe(237_474);
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 474,
      sourceHeight: 501,
      width: 1_422,
      height: 1_503,
      backingBytes: 8_549_064,
    });
    expect(estimatedPeakBytes).toBe(11_161_278);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
