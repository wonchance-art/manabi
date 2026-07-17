import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';
import { buildFrenchCitySnapshot } from '../../../../scripts/build-french-city-osm-snapshot.mjs';
import { renderCitySnapshotPng } from '../../../../scripts/world/render-city-snapshot.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/brussels-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/brussels-osm-v21.json', import.meta.url),
  'utf8',
));

describe('Brussels Overpass 분할 계약', () => {
  it('확정 bbox를 2×2 무중복 격자로 덮고 12개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [4.32, 50.79, 4.42, 50.90],
      provider: 'overpass-api.de',
      endpoint: 'https://overpass-api.de/api/interpreter',
    });
    expect(PARTITIONS.partitions).toHaveLength(4);
    expect(new Set(PARTITIONS.partitions.map(({ id }) => id)).size).toBe(4);
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

  it('운하·복개 수로·도로·철도를 고정 원본 쿼리에 포함한다', () => {
    const queries = overpassQueries(PARTITIONS.partitions[0].bbox);
    expect(queries.lines).toContain('way["highway"]');
    expect(queries.lines).toContain('way["waterway"~"^(river|canal|stream)$"]');
    expect(queries.lines).toContain('way["railway"~"^(rail|subway|light_rail|tram)$"]');
    expect(queries.areas).toContain('relation["natural"="water"]');
  });

  it('동일 compact 입력의 snapshot 생성은 결정적이다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    expect(buildFrenchCitySnapshot('brussels', raw))
      .toEqual(buildFrenchCitySnapshot('brussels', raw));
  });

  it('12개 원본의 canonical merge SHA와 오프라인 레이어 해시를 고정한다', () => {
    expect(SNAPSHOT).toMatchObject({
      version: 2,
      city: 'brussels',
      bbox: [4.32, 50.79, 4.42, 50.90],
      metersPerTile: 20,
      grid: { w: 352, h: 613 },
      source: {
        geometry: 'OpenStreetMap', license: 'ODbL 1.0', snapshot: '2026-07-17',
        providers: ['overpass-api.de'],
        rawOverpassSha256: '9fcd3201533be93087f42152c2246cb483703ecdf59051feabe07fee629f5a48',
        partitionCount: 4, queryCount: 12,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 172_275, roadWays: 71_107, waterAreas: 327, riverWays: 150,
        parkAreas: 4_248, railwayWays: 3_788, bridgeWays: 518,
        excludedCoveredWaterways: 134, crossingNodes: 12_310, crossingTiles: 12_310,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '6808a83dbc8fab58292f57deec6b93c031d97eec0a6647192db9163e3ffc0264',
      roadRle: '10b4ac7a82b227a1772dbae97c4139f7b83ff049f55fc55748221d10e7dcf7d9',
      waterRle: 'd319b7fe2036d8ae78c1d47d2b0b5ae9b9994ebc52f158003e8386a9931520dc',
      riverRle: '0bcf165d5e1e119c87fa6f0657b9462a9944e31172bf8e47f76c983a4c53c2cc',
      parkRle: '20ce02e907127ad5cefef6b3554dc5d8a10edcf20fbf09b7f1929e328b33b3a3',
      mountainRle: '710868880d2592ff30a834e409fabe45dd2f5363c7adffc5310b8bf327f5fdad',
      railwayRle: 'bf6212230eec9a15b2b557b443126cb3ea0f860fe78f9cd3e061dbe923f593ac',
    });
  });

  it('지형 전용 검수 PNG를 결정적으로 렌더링한다', () => {
    const png = renderCitySnapshotPng(SNAPSHOT);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('900a5b7ac81feaf36431159bc362397bacde692aa810d149c7a3326de6ae1dc5');
  });

  it('핵심 배열·미니맵 추정치가 24 MiB gate 안이다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;
    expect(cells).toBe(215_776);
    expect(layout).toMatchObject({
      factor: 1, sourceWidth: 352, sourceHeight: 613,
      width: 1_056, height: 1_839, backingBytes: 7_767_936,
    });
    expect(estimatedPeakBytes).toBe(10_141_472);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
