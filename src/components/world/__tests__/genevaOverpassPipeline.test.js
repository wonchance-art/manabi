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
  new URL('../../../../scripts/data/geneva-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/geneva-osm-v21.json', import.meta.url),
  'utf8',
));

describe('제네바 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [6.105, 46.175, 6.185, 46.24],
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

  it('철도·도로·레만호·론강과 공원 tag를 원본 쿼리에 포함한다', () => {
    const queries = overpassQueries(PARTITIONS.partitions[0].bbox);
    expect(queries.lines).toContain('way["railway"~"^(rail|subway|light_rail|tram)$"]');
    expect(queries.lines).toContain('way["highway"]');
    expect(queries.lines).toContain('way["waterway"~"^(river|canal|stream)$"]');
    expect(queries.areas).toContain('way["natural"="water"]');
    expect(queries.areas).toContain('relation["landuse"~"^(grass|recreation_ground|forest)$"]');
  });

  it('분할 원본 병합은 입력 순서와 무관하게 byte-identical이다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'geneva-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 46.18, lon: 6.11 }] },
      { type: 'node', id: 5, lat: 46.21, lon: 6.15 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: 46.18, lon: 6.11 }, { lat: 46.21, lon: 6.15 }],
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
      geometry: [{ lat: 46.18, lon: 6.11 }, { lat: 46.21, lon: 6.15 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('북쪽을 화면 위로 두는 20m 투영과 CERN 경계 제외를 고정한다', () => {
    const metrics = projectionMetrics(PARTITIONS.bbox, 20);
    const northWest = project(46.24, 6.105, metrics);
    const southEast = project(46.175, 6.185, metrics);
    const cernReference = { lon: 6.05, lat: 46.233 };

    expect(metrics.grid).toEqual({ w: 309, h: 362 });
    expect(northWest.x).toBeCloseTo(0, 10);
    expect(northWest.y).toBeCloseTo(0, 10);
    expect(southEast.x).toBeGreaterThan(northWest.x);
    expect(southEast.y).toBeGreaterThan(northWest.y);
    expect(cernReference.lon).toBeLessThan(PARTITIONS.bbox[0]);
    expect(cernReference.lat).toBeGreaterThanOrEqual(PARTITIONS.bbox[1]);
    expect(cernReference.lat).toBeLessThanOrEqual(PARTITIONS.bbox[3]);
  });

  it('같은 compact 입력의 snapshot 생성은 결정적이며 콘텐츠를 만들지 않는다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildFrenchCitySnapshot('geneva', raw);
    const second = buildFrenchCitySnapshot('geneva', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'geneva',
      bbox: [6.105, 46.175, 6.185, 46.24],
      metersPerTile: 20,
      grid: { w: 309, h: 362 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-18',
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
      city: 'geneva',
      bbox: [6.105, 46.175, 6.185, 46.24],
      metersPerTile: 20,
      grid: { w: 309, h: 362 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-18',
        providers: ['overpass-api.de'],
        rawOverpassSha256: 'c95251f71cc182c4f0098ea18e515a5bf215fe0ceea7ee8063ad403ddc6dedf2',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 27_198,
        roadWays: 30_562,
        waterAreas: 113,
        riverWays: 45,
        parkAreas: 2_458,
        mountainAreas: 0,
        railwayWays: 1_141,
        coastlineWays: 0,
        bridgeWays: 517,
        excludedCoveredWaterways: 11,
        crossingNodes: 3_389,
        crossingTiles: 3_389,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '00c543bf5c9efec23eba401097c117ec314c91d34e72d13a9b57c5f0ddd9893a',
      roadRle: '6256dbd8a1d431abf4405c78db48047305f7d8c5c1444dc90bd8ae203affcff1',
      waterRle: 'dae7824aad3f4ca38757622f3eeb2258e670e410a8a0c434ea424d9f5d4f6fa1',
      riverRle: 'b53432f5070b411181c75d71c89c5d64fb7eaa7b659070c125c89818fa44e89b',
      parkRle: '23926845df13efc5b9d06cd9b8c50180ee593ba7b46d84ccd4b2257c60381897',
      mountainRle: '10ca6a15a04b746aaf474cae2c9abf2b60c654189b7b3ddc9468c1b6c023de7f',
      railwayRle: 'ead7781027f3f5918816e0f3f9e557339d0a9c2a3c980fe98a1b62090a31469d',
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
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(309 * 362);
    }
    expect(SNAPSHOT.waterRle.reduce((sum, [value, count]) => sum + (value ? count : 0), 0))
      .toBe(22_333);
    expect(SNAPSHOT.riverRle.reduce((sum, [value, count]) => sum + (value ? count : 0), 0))
      .toBe(2_667);
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });

  it('레만호·론강·도시 철도 PNG를 결정적으로 렌더링한다', () => {
    const png = renderCitySnapshotPng(SNAPSHOT);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('9d13ebd74dec4a302ac98908e63be9361486b8cb729186f06d5fe704a031d28b');
  });

  it('미니맵 추정 피크 메모리가 24 MiB gate 안이다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;

    expect(cells).toBe(111_858);
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 309,
      sourceHeight: 362,
      width: 927,
      height: 1_086,
      backingBytes: 4_026_888,
    });
    expect(estimatedPeakBytes).toBe(5_257_326);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
