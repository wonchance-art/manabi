import { describe, expect, it } from 'vitest';
import KYOTO, { CITY_NODES, COLS, ENTRANCE, ROWS, STATIONS, TRANSIT, buildKyotoGrid } from '../cities/kyoto.js';
import { KYOTO_GEO } from '../cities/kyoto.geo.js';
import { CITY_TILE, isCityBlocked, isCityWalkable } from '../cities/terrain.js';

const grid = buildKyotoGrid();
const at = (x, y) => grid[y * COLS + x];

describe('교토 플레이 도시 계약', () => {
  it('geo 639×668·20m 격자를 EXIT 두 칸 외 그대로 쓴다', () => {
    expect([COLS, ROWS]).toEqual([639, 668]);
    expect(KYOTO_GEO.meta.metersPerTile).toBe(20);
    expect(grid).toHaveLength(COLS * ROWS);
    let diffs = 0;
    for (let index = 0; index < grid.length; index += 1) {
      if (grid[index] !== KYOTO_GEO.terrain[index]) {
        diffs += 1;
        expect(grid[index]).toBe(CITY_TILE.EXIT);
      }
    }
    expect(diffs).toBe(2);
  });

  it('교토역에서 북쪽 EXIT까지 세로 보행 회랑이 열린다', () => {
    expect(ENTRANCE).toEqual({ x: 404, y: 422, facing: 'down' });
    for (let y = 412; y <= 422; y += 1) expect(isCityWalkable(at(404, y))).toBe(true);
  });

  it('모든 geo POI·역을 요미와 함께 배선하고 마커 간격을 유지한다', () => {
    // geo POI 1:1 은 spot 노드에만 적용 — NPC 대화 노드(가공 무대)는 별도 케이스에서 검증한다.
    expect(CITY_NODES.filter((node) => node.kind !== 'npc')).toHaveLength(KYOTO_GEO.pois.length);
    expect(STATIONS).toHaveLength(KYOTO_GEO.stations.length);
    const markers = [...CITY_NODES, ...STATIONS];
    for (const marker of markers) {
      expect(isCityBlocked(at(marker.tile[0], marker.tile[1]))).toBe(false);
      expect(marker.desc || marker.yomi).toMatch(/[ぁ-んァ-ヶ]/);
    }
    for (let a = 0; a < markers.length; a += 1) for (let b = a + 1; b < markers.length; b += 1) {
      expect(Math.max(Math.abs(markers[a].tile[0] - markers[b].tile[0]), Math.abs(markers[a].tile[1] - markers[b].tile[1])))
        .toBeGreaterThanOrEqual(3);
    }
  });

  it('NPC 노드는 스크립트 키·챕터를 갖고 스탬프 미대상이다', () => {
    const npcs = CITY_NODES.filter((node) => node.kind === 'npc');
    expect(npcs.map((node) => node.id)).toEqual(['kyoto-shrine']);
    for (const node of npcs) {
      expect(typeof node.npc).toBe('string');
      expect(node.chapter).toMatch(/^ot-\d{2}-/);
      expect(node.noStamp).toBe(true);
    }
  });

  it('산인선·나라선·시내버스와 OSM 철도를 노출한다', () => {
    expect(TRANSIT.map((line) => line.id)).toEqual(['kyoto-sanin', 'kyoto-nara', 'kyoto-city-bus']);
    expect(KYOTO.railways.tileCount).toBe(12_157);
    const stationIds = new Set(STATIONS.map((station) => station.id));
    for (const line of TRANSIT) for (const stopId of line.stopIds) expect(stationIds.has(stopId)).toBe(true);
  });
});
