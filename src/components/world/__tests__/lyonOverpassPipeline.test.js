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
  new URL('../../../../scripts/data/lyon-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/lyon-osm-v21.json', import.meta.url),
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

function wideIntervalsAt(y, masks) {
  const intervals = [];
  for (let x = 0; x < SNAPSHOT.grid.w; x += 1) {
    const index = y * SNAPSHOT.grid.w + x;
    if (!masks.some((mask) => mask[index])) continue;
    const previous = intervals.at(-1);
    if (!previous || x > previous[1] + 1) intervals.push([x, x]);
    else previous[1] = x;
  }
  return intervals.filter(([start, end]) => end - start >= 2);
}

describe('리옹 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [4.79, 45.71, 4.90, 45.80],
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

  it('두 강·철도·도로·언덕과 교량 분류에 필요한 원본 tag를 포함한다', () => {
    const queries = overpassQueries(PARTITIONS.partitions[0].bbox);
    expect(queries.lines).toContain('way["waterway"~"^(river|canal|stream)$"]');
    expect(queries.lines).toContain('way["railway"~"^(rail|subway|light_rail|tram)$"]');
    expect(queries.lines).toContain('way["highway"]');
    expect(queries.areas).toContain('way["natural"="water"]');
    expect(queries.areas).toContain('relation["natural"~"^(wood|scrub|heath|grassland)$"]');
  });

  it('분할 원본 병합은 입력 순서와 무관하게 byte-identical이다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lyon-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 45.72, lon: 4.80 }] },
      { type: 'node', id: 5, lat: 45.79, lon: 4.89 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way', id: 9, tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: 45.72, lon: 4.80 }, { lat: 45.79, lon: 4.89 }],
      },
      { type: 'relation', id: 2, members: [] },
    ] }));
    mergeOverpassFiles([firstInput, secondInput], firstOutput);
    mergeOverpassFiles([secondInput, firstInput], secondOutput);
    expect(fs.readFileSync(firstOutput)).toEqual(fs.readFileSync(secondOutput));
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('북쪽을 화면 위로 두는 20m 투영과 주요 지리 앵커를 고정한다', () => {
    const metrics = projectionMetrics(PARTITIONS.bbox, 20);
    const northWest = project(45.80, 4.79, metrics);
    const southEast = project(45.71, 4.90, metrics);
    expect(metrics.grid).toEqual({ w: 428, h: 501 });
    expect(northWest.x).toBeCloseTo(0, 10);
    expect(northWest.y).toBeCloseTo(0, 10);
    expect(southEast.x).toBeGreaterThan(northWest.x);
    expect(southEast.y).toBeGreaterThan(northWest.y);
    for (const anchor of [
      { id: 'saone-north', lon: 4.819, lat: 45.79 },
      { id: 'rhone-north', lon: 4.857, lat: 45.79 },
      { id: 'confluence', lon: 4.818, lat: 45.733 },
      { id: 'fourviere', lon: 4.8220, lat: 45.7623 },
    ]) {
      expect(anchor.lon, anchor.id).toBeGreaterThanOrEqual(PARTITIONS.bbox[0]);
      expect(anchor.lon, anchor.id).toBeLessThanOrEqual(PARTITIONS.bbox[2]);
      expect(anchor.lat, anchor.id).toBeGreaterThanOrEqual(PARTITIONS.bbox[1]);
      expect(anchor.lat, anchor.id).toBeLessThanOrEqual(PARTITIONS.bbox[3]);
    }
  });

  it('같은 compact 입력의 snapshot 생성은 결정적이며 콘텐츠를 만들지 않는다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildFrenchCitySnapshot('lyon', raw);
    const second = buildFrenchCitySnapshot('lyon', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'lyon',
      bbox: [4.79, 45.71, 4.90, 45.80],
      metersPerTile: 20,
      grid: { w: 428, h: 501 },
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
      city: 'lyon',
      bbox: [4.79, 45.71, 4.90, 45.80],
      metersPerTile: 20,
      grid: { w: 428, h: 501 },
      source: {
        rawOverpassSha256: '6f3511956d95e2cfd3e5de183a34110234027c3226336027b94be5f38f3e3147',
        buildingWays: 82_696,
        roadWays: 74_980,
        waterAreas: 142,
        riverWays: 95,
        parkAreas: 4_985,
        mountainAreas: 520,
        railwayWays: 2_385,
        bridgeWays: 695,
        excludedCoveredWaterways: 20,
        crossingNodes: 9_624,
        crossingTiles: 9_624,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '857fc5d4b2fee43714939cd4d5ae424bfeff5014123fff8f46ceddaf787c8794',
      roadRle: 'f2dd5719a0fb956e3cfe52373705237e76a6cd9d0a4a70d5778c01a73e122ae6',
      waterRle: 'dd169cc2055ac3a50f146d2c44865a3b4e9aedd082780f2e4d7da113efe1150a',
      riverRle: '3daa60b62f264b2869cdbade426b45a33ea3264700481c9291c001f9140a9d15',
      parkRle: '9d5d5967f5dacb2142a88571f2241097cc9bbb6422ddd5d0dfd7e10e5f8772f8',
      mountainRle: 'f34f4731a430eb86ac39e7a9b6fff437ab3a4a15f48a31abeb02cdaad246c85a',
      railwayRle: '86682638531715ef89e1b3396f45b5666324acd5e567f9a885cefbf39eb13a78',
    });
    for (const key of Object.keys(SNAPSHOT.hashes)) {
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(428 * 501);
    }
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });

  it('론강·손강은 북부에서 분리되고 남부 콘플루앙스에서 합류한다', () => {
    const length = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const water = decodeRle(SNAPSHOT.waterRle, length);
    const river = decodeRle(SNAPSHOT.riverRle, length);
    const north = wideIntervalsAt(56, [water, river]);
    const confluence = wideIntervalsAt(400, [water, river]);

    expect(north).toContainEqual([107, 118]);
    expect(north).toContainEqual([313, 341]);
    expect(313 - 118).toBeGreaterThan(150);
    expect(confluence).toContainEqual([104, 119]);

    const png = renderCitySnapshotPng(SNAPSHOT);
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('374d1f65d44f8fd4c70281ac5e35ab6b15f401a33e7c88f0c22df6a06856babf');
  });

  it('미니맵 추정 피크 메모리가 24 MiB gate 안이다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;

    expect(cells).toBe(214_428);
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 428,
      sourceHeight: 501,
      width: 1_284,
      height: 1_503,
      backingBytes: 7_719_408,
    });
    expect(estimatedPeakBytes).toBe(10_078_116);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
