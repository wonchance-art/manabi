import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildJapaneseCitySnapshot } from '../../../../scripts/build-japanese-city-osm-snapshot.mjs';
import {
  project,
  projectionMetrics,
} from '../../../../scripts/build-korean-city-osm-snapshot.mjs';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';
import { mergeOverpassFiles } from '../../../../scripts/merge-overpass-json.mjs';
import { renderCitySnapshotPng } from '../../../../scripts/world/render-city-snapshot.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/kawaguchiko-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/kawaguchiko-osm-v21.json', import.meta.url),
  'utf8',
));

describe('가와구치코/후지 비콘텐츠 Overpass 선행 수집 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [138.725, 35.395, 138.85, 35.55],
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

  it('철도·도로·호수·산지와 교량 tag를 원본 쿼리에 포함한다', () => {
    const queries = overpassQueries(PARTITIONS.partitions[0].bbox);
    expect(queries.lines).toContain('way["railway"~"^(rail|subway|light_rail|tram)$"]');
    expect(queries.lines).toContain('way["highway"]');
    expect(queries.areas).toContain('way["natural"="water"]');
    expect(queries.areas).toContain('relation["natural"~"^(wood|scrub|heath|grassland)$"]');
  });

  it('분할 원본 병합은 입력 순서와 무관하게 byte-identical이다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaguchiko-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 35.40, lon: 138.73 }] },
      { type: 'node', id: 5, lat: 35.50, lon: 138.80 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      {
        type: 'way',
        id: 9,
        tags: { highway: 'primary', bridge: 'yes', name: 'excluded' },
        geometry: [{ lat: 35.40, lon: 138.73 }, { lat: 35.50, lon: 138.80 }],
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
      geometry: [{ lat: 35.40, lon: 138.73 }, { lat: 35.50, lon: 138.80 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('북쪽을 화면 위로 두는 20m 투영과 후지 5합목 포함을 고정한다', () => {
    const metrics = projectionMetrics(PARTITIONS.bbox, 20);
    const northWest = project(35.55, 138.725, metrics);
    const southEast = project(35.395, 138.85, metrics);
    const subaruFifthStation = project(35.3966, 138.7327, metrics);

    expect(metrics.grid).toEqual({ w: 567, h: 863 });
    expect(northWest.x).toBeCloseTo(0, 10);
    expect(northWest.y).toBeCloseTo(0, 10);
    expect(southEast.x).toBeGreaterThan(northWest.x);
    expect(southEast.y).toBeGreaterThan(northWest.y);
    expect(subaruFifthStation.x).toBeGreaterThanOrEqual(0);
    expect(subaruFifthStation.x).toBeLessThan(metrics.grid.w);
    expect(subaruFifthStation.y).toBeGreaterThanOrEqual(0);
    expect(subaruFifthStation.y).toBeLessThan(metrics.grid.h);
  });

  it('아오키가하라 민감 지역 기준점은 확정 경계 밖이다', () => {
    const [minLon, minLat, maxLon, maxLat] = PARTITIONS.bbox;
    const aokigaharaReference = { lon: 138.68, lat: 35.47 };
    expect(aokigaharaReference.lon).toBeLessThan(minLon);
    expect(aokigaharaReference.lat).toBeGreaterThanOrEqual(minLat);
    expect(aokigaharaReference.lat).toBeLessThanOrEqual(maxLat);
    expect(maxLon).toBe(138.85);
  });

  it('같은 compact 입력의 snapshot 생성은 결정적이며 콘텐츠를 만들지 않는다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    const first = buildJapaneseCitySnapshot('kawaguchiko', raw);
    const second = buildJapaneseCitySnapshot('kawaguchiko', raw);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 2,
      city: 'kawaguchiko',
      bbox: [138.725, 35.395, 138.85, 35.55],
      metersPerTile: 20,
      grid: { w: 567, h: 863 },
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
      city: 'kawaguchiko',
      bbox: [138.725, 35.395, 138.85, 35.55],
      metersPerTile: 20,
      grid: { w: 567, h: 863 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-18',
        providers: ['overpass-api.de', 'maps.mail.ru'],
        rawOverpassSha256: '10ab0bd5d0484c47013298d9bd0331e2420a27822090dd2397369d2b79e961b1',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 45_083,
        roadWays: 6_820,
        waterAreas: 116,
        riverWays: 367,
        parkAreas: 38,
        mountainAreas: 51,
        railwayWays: 81,
        coastlineWays: 0,
        bridgeWays: 339,
        tidalFlatAreas: 0,
        excludedCoveredWaterways: 113,
        crossingNodes: 86,
        crossingTiles: 86,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: 'fa586a3306c09c43dae9b973e854b8302700975a3d8a078ae99666d8bc9a504d',
      roadRle: '052cdf1957b17552e9d9884b85bedcccbf447b88275d9569ea4cb9eec25b1173',
      waterRle: 'ed3eb770fe13b882a7b369caaa3d46f730566100549dab3f7203e9f8fb3b1fcb',
      riverRle: 'efc0909506d6242b6370fb5e9b6d632e7b42d1576327b48ee2f9fb77e775d391',
      parkRle: '7ae7cf400ca9dcb2d8b31c29fce5e292b4c90dca4f4e293d2e52c574f2f123e2',
      mountainRle: '668679f8df7dfee5f1f7bd6c59f205dde799b034f2f4f0cc217a368b08243eaa',
      railwayRle: '137d2382ce6acdf325fa6842d9f83e7892597a85cd2f558b40a4054e6af3f24f',
    });
    const cells = 567 * 863;
    for (const key of [
      'buildingRle',
      'roadRle',
      'waterRle',
      'riverRle',
      'parkRle',
      'mountainRle',
      'railwayRle',
    ]) {
      expect(SNAPSHOT[key].reduce((sum, [, count]) => sum + count, 0)).toBe(cells);
    }
    const mountainCells = SNAPSHOT.mountainRle
      .reduce((sum, [value, count]) => sum + (value ? count : 0), 0);
    expect(mountainCells).toBe(322_605);
    expect(mountainCells / cells).toBeGreaterThan(0.65);
    expect(SNAPSHOT).not.toHaveProperty('pois');
    expect(SNAPSHOT).not.toHaveProperty('stations');
    expect(SNAPSHOT).not.toHaveProperty('content');
  });

  it('호수·도시·철도·후지 사면 PNG를 결정적으로 렌더링한다', () => {
    const png = renderCitySnapshotPng(SNAPSHOT);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('fa620634c290eda066b443fc5061129e67a3605354f0cb8dcf4a84a33d9de32b');
  });

  it('미니맵 추정 피크 메모리가 24 MiB gate 안이다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;

    expect(cells).toBe(489_321);
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 567,
      sourceHeight: 863,
      width: 1_701,
      height: 2_589,
      backingBytes: 17_615_556,
    });
    expect(estimatedPeakBytes).toBe(22_998_087);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
