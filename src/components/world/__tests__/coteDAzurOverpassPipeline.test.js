import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';
import { buildFrenchCitySnapshot } from '../../../../scripts/build-french-city-osm-snapshot.mjs';
import { mergeOverpassFiles } from '../../../../scripts/merge-overpass-json.mjs';
import { renderCitySnapshotPng } from '../../../../scripts/world/render-city-snapshot.mjs';
import { COTE_DAZUR_GEO } from '../cities/cote-dazur.geo.js';
import { cityMinimapLayout } from '../cityMinimap.js';
import { CITY_TILE } from '../cities/terrain.js';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/cote-dazur-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/cote-dazur-osm-v21.json', import.meta.url),
  'utf8',
));

describe("Côte d'Azur Overpass 분할 계약", () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [7.06, 43.54, 7.45, 43.75],
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

  it('해안선·철도·산지와 교량 tag를 원본 쿼리에 포함한다', () => {
    const queries = overpassQueries(PARTITIONS.partitions[0].bbox);
    expect(queries.lines).toContain('way["natural"="coastline"]');
    expect(queries.lines).toContain('way["railway"~"^(rail|subway|light_rail|tram)$"]');
    expect(queries.lines).toContain('way["highway"]');
    expect(queries.areas).toContain('relation["landuse"~"^(grass|recreation_ground|forest)$"]');
    expect(queries.areas).toContain('relation["natural"~"^(wood|scrub|heath|grassland)$"]');
  });

  it('대형 원본 스트리밍 병합은 입력 순서와 무관하게 byte-identical이다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cote-dazur-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 1, lon: 1 }] },
      { type: 'node', id: 5, lat: 1, lon: 1 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, tags: { highway: 'primary', bridge: 'yes', name: 'dropped' }, geometry: [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }] },
      { type: 'relation', id: 2, members: [] },
    ] }));
    mergeOverpassFiles([firstInput, secondInput], firstOutput);
    mergeOverpassFiles([secondInput, firstInput], secondOutput);
    expect(fs.readFileSync(firstOutput)).toEqual(fs.readFileSync(secondOutput));
    expect(JSON.parse(fs.readFileSync(firstOutput, 'utf8')).elements[1]).toEqual({
      type: 'way', id: 9, tags: { bridge: 'yes', highway: 'primary' },
      geometry: [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('동일 compact 입력의 snapshot 생성은 결정적이다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    expect(buildFrenchCitySnapshot('cote-dazur', raw))
      .toEqual(buildFrenchCitySnapshot('cote-dazur', raw));
  });

  it('compact 원본과 오프라인 레이어 해시를 고정한다', () => {
    expect(SNAPSHOT).toMatchObject({
      city: 'cote-dazur',
      bbox: [7.06, 43.54, 7.45, 43.75],
      metersPerTile: 20,
      grid: { w: 1571, h: 1169 },
      source: {
        geometry: 'OpenStreetMap', license: 'ODbL 1.0', snapshot: '2026-07-17',
        providers: ['overpass-api.de'],
        rawOverpassSha256: 'f2d1924bc4f4bf75fd71a6836e627f42f3095d77c4be296544043e94f7715cfc',
        partitionCount: 16, queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 215_549, roadWays: 49_767, waterAreas: 268, riverWays: 273,
        parkAreas: 1_246, mountainAreas: 652, railwayWays: 857, coastlineWays: 238,
        bridgeWays: 798, excludedCoveredWaterways: 38,
        crossingNodes: 8_223, crossingTiles: 8_223,
        mountainRelations: 73, mountainRelationsWithGeometry: 73,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '1b7847b8c93cb48e249e0dfc7692480da9aa1cbb69b023555a2fad0dfc0b4498',
      roadRle: '5e4cd051f7dc02048c485276b5d4927fa28f7d06c4a304ef3904cc1e1f4b7628',
      waterRle: 'a12ed6acdafe5c39a475a2f4938769d9d39effd26357b056f1be67eaaec07a16',
      riverRle: 'ab46aad6bb507da29e34133e24dfd689c8681d435dc755d1723f649d0d764aa7',
      parkRle: '8567fb8711b3fadf7196dbf2b46e23e7b4524da475abcfef1586994a7f18931d',
      mountainRle: '2a5cb447234e2d58db95d8b7d971bb3071028c616561ae68250c936c364899c8',
      railwayRle: 'c557c7e064726a9e536573bed86caad6620fb5f2f4302883090e52c8618e3104',
    });
  });

  it('해안 수역과 북부 산지 프로필을 고정한다', () => {
    const profile = (y, codes) => {
      let count = 0;
      for (let x = 0; x < COTE_DAZUR_GEO.meta.grid.w; x += 1) {
        if (codes.has(COTE_DAZUR_GEO.terrain[y * COTE_DAZUR_GEO.meta.grid.w + x])) count += 1;
      }
      return count;
    };
    const water = new Set([CITY_TILE.WATER, CITY_TILE.RIVER]);
    const green = new Set([CITY_TILE.PARK, CITY_TILE.MOUNTAIN]);
    expect([0, 250, 550, 850, 1168].map((y) => profile(y, water)))
      .toEqual([55, 505, 1_145, 1_304, 1_571]);
    expect([0, 100, 250, 550, 850].map((y) => profile(y, green)))
      .toEqual([493, 516, 263, 218, 12]);
  });

  it('지형 전용 검수 PNG를 결정적으로 렌더링한다', () => {
    const png = renderCitySnapshotPng(SNAPSHOT);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('f173829edb7a7efcc9b77da1230870f50ce5f01d8b59852fc1dc4b167ae183e1');
  });

  it('핵심 배열·적응형 미니맵 추정치를 고정하고 공유 backing 게이트를 지킨다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes + sourceCanvasBytes * 2;
    expect(cells).toBe(1_836_499);
    expect(layout).toMatchObject({ factor: 2, sourceWidth: 786, sourceHeight: 585, width: 2358, height: 1755 });
    expect(layout.backingBytes).toBe(16_553_160);
    expect(layout.backingBytes).toBeLessThan(16 * 1024 * 1024);
    expect(estimatedPeakBytes).toBe(25_741_137);
  });
});
