import { describe, expect, it } from 'vitest';
import BUSAN, { BUSAN_COPY, CITY_NODES, COLS, ENTRANCE, ROWS, STATIONS, TRANSIT, buildBusanGrid } from '../cities/busan.js';
import { BUSAN_GEO } from '../cities/busan.geo.js';
import { CITY_TILE, isCityBlocked, isCityWalkable } from '../cities/terrain.js';

const grid = buildBusanGrid();
const at = (x, y) => grid[y * COLS + x];

describe('부산 플레이 도시 계약', () => {
  it('1320×1114·20m geo 격자를 EXIT 두 칸 외 그대로 쓴다', () => {
    expect([COLS, ROWS]).toEqual([1320, 1114]);
    expect(BUSAN_GEO.meta.metersPerTile).toBe(20);
    expect(grid).toHaveLength(COLS * ROWS);
    let diffs = 0;
    for (let index = 0; index < grid.length; index += 1) {
      if (grid[index] === BUSAN_GEO.terrain[index]) continue;
      diffs += 1;
      expect(grid[index]).toBe(CITY_TILE.EXIT);
    }
    expect(diffs).toBe(2);
  });

  it('부산역에서 북쪽 EXIT까지 세로 보행 회랑이 열린다', () => {
    expect(ENTRANCE).toEqual({ x: 684, y: 695, facing: 'down' });
    for (let y = 685; y <= 695; y += 1) expect(isCityWalkable(at(684, y))).toBe(true);
  });

  it('한국 source exact-key와 중앙 locale 슬롯을 유지한다', () => {
    expect(BUSAN_GEO.meta).toMatchObject({ contentLocale: 'ko', schema: { nameField: 'nameKo', localeSlots: 'central-lookup-expandable' } });
    for (const poi of BUSAN_GEO.pois) {
      expect(typeof poi.nameKo).toBe('string');
      expect(poi).not.toHaveProperty('yomi');
      expect(poi.contentLocale).toBe('ko');
      expect(CITY_NODES.find((node) => node.id === poi.id)?.name).toBe(poi.nameKo);
      expect(CITY_NODES.find((node) => node.id === poi.id)?.desc).toContain(poi.nameKo);
      expect(BUSAN_COPY.ko[poi.id].name).toBe(poi.nameKo);
    }
  });

  it('모든 POI·역이 보행 가능하고 마커끼리 3타일 이상 떨어진다', () => {
    const markers = [...CITY_NODES, ...STATIONS];
    for (const marker of markers) {
      const [x, y] = marker.tile;
      expect(isCityBlocked(at(x, y)), marker.id).toBe(false);
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !isCityBlocked(at(x + dx, y + dy))), marker.id).toBe(true);
    }
    for (let first = 0; first < markers.length; first += 1) {
      for (let second = first + 1; second < markers.length; second += 1) {
        const dx = Math.abs(markers[first].tile[0] - markers[second].tile[0]);
        const dy = Math.abs(markers[first].tile[1] - markers[second].tile[1]);
        expect(Math.max(dx, dy), `${markers[first].id}/${markers[second].id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('부산항 페리 접점과 두 도시철도 축을 배선한다', () => {
    expect(BUSAN.returnNode).toBe('busan');
    expect(BUSAN_GEO.pois.find((poi) => poi.id === 'busan-port-intl')).toMatchObject({
      nameKo: '부산항국제여객터미널', lon: 129.0403, lat: 35.1194, tile: [684, 671],
    });
    expect(TRANSIT.map((line) => line.id)).toEqual(['busan-line-1', 'busan-line-2']);
    const stationIds = new Set(STATIONS.map((station) => station.id));
    for (const line of TRANSIT) for (const stopId of line.stopIds) expect(stationIds.has(stopId)).toBe(true);
    expect(BUSAN.railways.tileCount).toBe(13_315);
  });
});
