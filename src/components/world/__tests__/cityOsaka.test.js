import { describe, expect, it } from 'vitest';
import OSAKA, { CITY_NODES, COLS, ENTRANCE, ROWS, STATIONS, TRANSIT, buildOsakaGrid } from '../cities/osaka.js';
import { OSAKA_GEO } from '../cities/osaka.geo.js';
import { CITY_TILE, isCityBlocked, isCityWalkable } from '../cities/terrain.js';

const grid = buildOsakaGrid();
const at = (x, y) => grid[y * COLS + x];

describe('오사카 플레이 도시 계약', () => {
  it('geo 641×668·20m 격자를 EXIT 두 칸 외 그대로 쓴다', () => {
    expect([COLS, ROWS]).toEqual([641, 668]);
    expect(OSAKA_GEO.meta.metersPerTile).toBe(20);
    expect(grid).toHaveLength(COLS * ROWS);
    let diffs = 0;
    for (let index = 0; index < grid.length; index += 1) {
      if (grid[index] !== OSAKA_GEO.terrain[index]) {
        diffs += 1;
        expect(grid[index]).toBe(CITY_TILE.EXIT);
      }
    }
    expect(diffs).toBe(2);
  });

  it('오사카역에서 북쪽 EXIT까지 세로 보행 회랑이 열린다', () => {
    expect(ENTRANCE).toEqual({ x: 414, y: 187, facing: 'down' });
    for (let y = 177; y <= 187; y += 1) expect(isCityWalkable(at(414, y))).toBe(true);
  });

  it('모든 geo POI·역을 요미와 함께 배선하고 마커 간격을 유지한다', () => {
    // geo POI 1:1 은 spot 노드에만 적용 — NPC 대화 노드(가공 무대)는 별도 케이스에서 검증한다.
    expect(CITY_NODES.filter((node) => node.kind !== 'npc')).toHaveLength(OSAKA_GEO.pois.length);
    expect(STATIONS).toHaveLength(OSAKA_GEO.stations.length);
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
    expect(npcs.map((node) => node.id)).toEqual(['osaka-izakaya', 'osaka-konbini']);
    for (const node of npcs) {
      expect(typeof node.npc).toBe('string');
      expect(node.chapter).toMatch(/^ot-\d{2}-/);
      expect(node.noStamp).toBe(true);
    }
  });

  it('환경선·신오사카 연결선과 OSM 철도를 노출한다', () => {
    expect(TRANSIT.map((line) => line.id)).toEqual(['osaka-loop', 'osaka-shin-osaka-link']);
    expect(OSAKA.railways.tileCount).toBe(25_206);
    const stationIds = new Set(STATIONS.map((station) => station.id));
    for (const line of TRANSIT) for (const stopId of line.stopIds) expect(stationIds.has(stopId)).toBe(true);
  });
});
