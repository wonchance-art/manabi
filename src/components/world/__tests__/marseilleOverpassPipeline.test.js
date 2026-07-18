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
  new URL('../../../../scripts/data/marseille-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/marseille-osm-v21.json', import.meta.url),
  'utf8',
));

describe('마르세유 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [5.32, 43.245, 5.42, 43.325],
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

  it('외해·철도·산지와 교량 tag를 원본 쿼리에 포함한다', () => {
    const queries = overpassQueries(PARTITIONS.partitions[0].bbox);
    expect(queries.lines).toContain('way["natural"="coastline"]');
    expect(queries.lines).toContain('way["railway"~"^(rail|subway|light_rail|tram)$"]');
    expect(queries.lines).toContain('way["highway"]');
    expect(queries.areas).toContain('relation["landuse"~"^(grass|recreation_ground|forest)$"]');
    expect(queries.areas).toContain('relation["natural"~"^(wood|scrub|heath|grassland)$"]');
  });

  it('분할 원본 병합은 입력 순서와 무관하게 byte-identical이다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'marseille-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 43.25, lon: 5.33 }] },
      { type: 'node', id: 5, lat: 43.29, lon: 5.37 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: 43.25, lon: 5.33 }, { lat: 43.29, lon: 5.37 }],
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
      geometry: [{ lat: 43.25, lon: 5.33 }, { lat: 43.29, lon: 5.37 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('북쪽을 화면 위로 두는 20m 투영을 고정한다', () => {
    const metrics = projectionMetrics(PARTITIONS.bbox, 20);
    const northWest = project(43.325, 5.32, metrics);
    const southEast = project(43.245, 5.42, metrics);

    expect(metrics.correction).toBeGreaterThan(0);
    expect(metrics.grid).toEqual({ w: 406, h: 446 });
    expect(northWest.x).toBeCloseTo(0, 10);
    expect(northWest.y).toBeCloseTo(0, 10);
    expect(southEast.x).toBeGreaterThan(northWest.x);
    expect(southEast.y).toBeGreaterThan(northWest.y);
  });

  it('같은 compact 입력의 snapshot 생성은 결정적이며 콘텐츠를 만들지 않는다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildFrenchCitySnapshot('marseille', raw);
    const second = buildFrenchCitySnapshot('marseille', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'marseille',
      bbox: [5.32, 43.245, 5.42, 43.325],
      metersPerTile: 20,
      grid: { w: 406, h: 446 },
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
      city: 'marseille',
      bbox: [5.32, 43.245, 5.42, 43.325],
      metersPerTile: 20,
      grid: { w: 406, h: 446 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-18',
        providers: ['overpass-api.de'],
        rawOverpassSha256: 'a674392d79d804ce0d45e6fae2be3c3140aa276f1159663b71de1ff191c7a7d5',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 115_846,
        roadWays: 21_912,
        waterAreas: 139,
        riverWays: 73,
        parkAreas: 631,
        mountainAreas: 119,
        railwayWays: 854,
        coastlineWays: 66,
        bridgeWays: 227,
        excludedCoveredWaterways: 18,
        crossingNodes: 3_933,
        crossingTiles: 3_933,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '3de4ca8d8244399eb5274101ad6e94ff4de4a1c05b81d4bd369afffc080321e2',
      roadRle: 'c2e04b97e3c44c32614637ddafb9bc6e4735f90d8c64e678be369cfc31b10fe6',
      waterRle: '3c2f247c4a548ce4c851f6536296480d7e67675d7a9dcdcb5596ad3b991c4661',
      riverRle: '6baa9b0aad1100cce1fcbe56698358d3a39408f9eb39dbceebced796c4e9a45a',
      parkRle: '6af223b0825d94b7f2fbe799fe509eb408b803d3923d3cd942fa56bb558896ed',
      mountainRle: 'f51cc6d960d67e17744dca04a80ee4557b2513759411ce2b126248af7fea848a',
      railwayRle: '3284cd53090b043d66036699e43cfdac93119020a46af60a5f00811acef51068',
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
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(406 * 446);
    }
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });

  it('해안·외해 섬 지형 PNG를 결정적으로 렌더링한다', () => {
    const png = renderCitySnapshotPng(SNAPSHOT);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('145a308b81f82e18eb8e042a9f907b09db12b807d04f95d67a27bd05a7f08046');
  });

  it('미니맵 추정 피크 메모리가 24 MiB gate 안이다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;

    expect(cells).toBe(181_076);
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 406,
      sourceHeight: 446,
      width: 1_218,
      height: 1_338,
      backingBytes: 6_518_736,
    });
    expect(estimatedPeakBytes).toBe(8_510_572);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
