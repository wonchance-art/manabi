import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';
import { buildFrenchCitySnapshot } from '../../../../scripts/build-french-city-osm-snapshot.mjs';
import { renderCitySnapshotPng } from '../../../../scripts/world/render-city-snapshot.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/london-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/london-osm-v21.json', import.meta.url),
  'utf8',
));

describe('London Overpass 분할 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 덮고 48개 쿼리를 만든다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [-0.30, 51.42, 0.05, 51.60],
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
      expect(Object.keys(overpassQueries(a))).toEqual(['structures', 'lines', 'areas']);
      for (let right = left + 1; right < PARTITIONS.partitions.length; right += 1) {
        const b = PARTITIONS.partitions[right].bbox;
        const overlapWidth = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
        const overlapHeight = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        expect(overlapWidth * overlapHeight).toBe(0);
      }
    }
  });

  it('도로·철도·템스 수계·교량 tag를 고정 원본 쿼리에 포함한다', () => {
    const queries = overpassQueries(PARTITIONS.partitions[0].bbox);
    expect(queries.lines).toContain('way["highway"]');
    expect(queries.lines).toContain('way["waterway"~"^(river|canal|stream)$"]');
    expect(queries.lines).toContain('way["railway"~"^(rail|subway|light_rail|tram)$"]');
    expect(queries.areas).toContain('relation["natural"="water"]');
  });

  it('동일 compact 입력의 snapshot 생성은 결정적이다', () => {
    const raw = JSON.stringify({ version: 0.6, elements: [] });
    expect(buildFrenchCitySnapshot('london', raw))
      .toEqual(buildFrenchCitySnapshot('london', raw));
  });

  it('48개 원본의 canonical merge SHA와 오프라인 레이어 해시를 고정한다', () => {
    expect(SNAPSHOT).toMatchObject({
      version: 2,
      city: 'london',
      bbox: [-0.30, 51.42, 0.05, 51.60],
      metersPerTile: 20,
      grid: { w: 1213, h: 1002 },
      source: {
        geometry: 'OpenStreetMap', license: 'ODbL 1.0', snapshot: '2026-07-17',
        providers: ['overpass-api.de'],
        rawOverpassSha256: '1edf81d8bc8e2d1da0aefc1ff197571233c4055a482499188e167d5eaa1b38f6',
        partitionCount: 16, queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 547_464, roadWays: 317_281, waterAreas: 1_045, riverWays: 872,
        parkAreas: 19_797, railwayWays: 10_397, bridgeWays: 5_341,
        excludedCoveredWaterways: 265, crossingNodes: 34_792, crossingTiles: 34_792,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: 'f82e340e0e539f7ad75ae9d8cd7a22e250c8b412b4df2e9a3c320a637831a2e5',
      roadRle: 'd263d9d42a406d5ca22eb79553e6e6a4b1f68633a0d85813b8933d037f4975c4',
      waterRle: '7fd91da05ba97ec29e56bb189df8a7bc914a27d9e02444a149e4aaef58ef1014',
      riverRle: 'e1d3c1ef93b36255790328dc58c98741b47ae7f90885c1f2431ddb497b66c04b',
      parkRle: '59ff8199d45a5515858fbfda9be23c4ee6e0bc36113039875ed5542b94094c92',
      mountainRle: 'ca4b69178c7e7c466d7e211c05686892a937dffd8ef9518248c4f357d7832d6b',
      railwayRle: 'd09afe4084bf90d6d672aed95826e9822783b89c95cfe633f135485266626e5a',
    });
  });

  // 1213×1002 대형 렌더 — 병렬 전체 실행 시 5초 기본 timeout을 넘는 부하 의존 flaky 관측
  // (#240 검수·clean main 재현) → kyotoGeo/parisDoors 선례대로 명시 확장.
  it('지형 전용 검수 PNG를 결정적으로 렌더링한다', { timeout: 120000 }, () => {
    const png = renderCitySnapshotPng(SNAPSHOT);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('c2c5f745d3301d1c526dae8e1697df9b8793b4f7d36a9f540452e34f017f796d');
  });

  it('핵심 배열·미니맵 추정치가 24 MiB gate 안이다', () => {
    const cells = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const layout = cityMinimapLayout(SNAPSHOT.grid.w, SNAPSHOT.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;
    expect(cells).toBe(1_215_426);
    expect(layout).toMatchObject({
      factor: 2, sourceWidth: 607, sourceHeight: 501,
      width: 1821, height: 1503, backingBytes: 10_947_852,
    });
    expect(estimatedPeakBytes).toBe(17_026_986);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
