import { describe, expect, it } from 'vitest';
import SEOUL, { CITY_NODES, COLS, ENTRANCE, ROWS, SEOUL_COPY, STATIONS, TRANSIT, buildSeoulGrid } from '../cities/seoul.js';
import { SEOUL_GEO } from '../cities/seoul.geo.js';
import { cityMinimapLayout } from '../cityMinimap.js';
import { CITY_TILE, isCityBlocked, isCityWalkable } from '../cities/terrain.js';

const grid = buildSeoulGrid();
const at = (x, y) => grid[y * COLS + x];

describe('서울 플레이 도시 계약', () => {
  it('1721×1448·20m geo 격자를 EXIT 두 칸 외 그대로 쓴다', () => {
    expect([COLS, ROWS]).toEqual([1721, 1448]);
    expect(SEOUL_GEO.meta.metersPerTile).toBe(20);
    expect(grid).toHaveLength(COLS * ROWS);
    let diffs = 0;
    for (let index = 0; index < grid.length; index += 1) {
      if (grid[index] === SEOUL_GEO.terrain[index]) continue;
      diffs += 1;
      expect(grid[index]).toBe(CITY_TILE.EXIT);
    }
    expect(diffs).toBe(2);
  });

  it('서울역에서 북쪽 EXIT까지 세로 보행 회랑이 열린다', () => {
    expect(ENTRANCE).toEqual({ x: 797, y: 753, facing: 'down' });
    for (let y = 743; y <= 753; y += 1) expect(isCityWalkable(at(797, y))).toBe(true);
  });

  it('한국 source exact-key와 중앙 locale 슬롯을 유지한다', () => {
    expect(SEOUL_GEO.meta).toMatchObject({
      contentLocale: 'ko', schema: { nameField: 'nameKo', localeSlots: 'central-lookup-expandable' },
    });
    for (const poi of SEOUL_GEO.pois) {
      expect(typeof poi.nameKo).toBe('string');
      expect(poi).not.toHaveProperty('yomi');
      expect(poi.contentLocale).toBe('ko');
      expect(CITY_NODES.find((node) => node.id === poi.id)?.name).toBe(poi.nameKo);
      expect(CITY_NODES.find((node) => node.id === poi.id)?.desc).toContain(poi.nameKo);
      expect(SEOUL_COPY.ko[poi.id].name).toBe(poi.nameKo);
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

  it('서울역 전국맵 복귀와 두 도시철도 축을 배선한다', () => {
    expect(SEOUL.returnNode).toBe('seoul');
    expect(TRANSIT.map((line) => line.id)).toEqual(['seoul-line-1', 'seoul-line-2']);
    const stationIds = new Set(STATIONS.map((station) => station.id));
    for (const line of TRANSIT) for (const stopId of line.stopIds) expect(stationIds.has(stopId)).toBe(true);
    expect(SEOUL.railways.tileCount).toBe(50_983);
  });

  it('핵심 배열과 적응형 미니맵을 합쳐 24 MiB 모바일 게이트 안에 둔다', () => {
    const layout = cityMinimapLayout(COLS, ROWS);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const coreArrayBytes = SEOUL_GEO.terrain.byteLength + SEOUL_GEO.railways.mask.byteLength + grid.byteLength;
    const estimatedPeakBytes = coreArrayBytes + layout.backingBytes + sourceCanvasBytes * 2;
    expect(coreArrayBytes).toBe(7_476_024);
    expect(layout).toMatchObject({ factor: 3, width: 1722, height: 1449 });
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
