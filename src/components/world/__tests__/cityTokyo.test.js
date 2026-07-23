import { describe, expect, it } from 'vitest';
import TOKYO, {
  buildTokyoGrid, isCityBlocked, isCityWalkable,
  COLS, ROWS, CITY_TILE, ENTRANCE, ZONES, CITY_NODES, PROPS, STATIONS,
} from '../cities/tokyo.js';
import { TOKYO_GEO } from '../cities/tokyo.geo.js';
import { fastTravelDestinations, resolveArrivalTile, resolveRespawnTile } from '../cities/terrain.js';
import { directTransitDestinations } from '../../../lib/world/transit.js';

const grid = buildTokyoGrid();
const at = (x, y) => ((x < 0 || y < 0 || x >= COLS || y >= ROWS) ? -1 : grid[y * COLS + x]);
const adjacentWalkable = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
  .some(([dx, dy]) => isCityWalkable(at(x + dx, y + dy)));

function reachableFrom([startX, startY]) {
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  const start = startY * COLS + startX;
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    const x = index % COLS;
    const y = Math.floor(index / COLS);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const next = ny * COLS + nx;
      if (seen[next] || isCityBlocked(grid[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

describe('도쿄 CityScene 데이터 계약', () => {
  it('geo v2.2의 824×1086 단일 격자와 20m 축척을 그대로 쓴다', () => {
    expect([COLS, ROWS]).toEqual([824, 1086]);
    expect([COLS, ROWS]).toEqual([TOKYO_GEO.meta.grid.w, TOKYO_GEO.meta.grid.h]);
    expect(TOKYO_GEO.meta.metersPerTile).toBe(20);
    expect(grid).toBeInstanceOf(Uint8Array);
    expect(grid.length).toBe(COLS * ROWS);
  });

  it('결정적이며 EXIT 두 칸 외에는 geo terrain과 같다', () => {
    const rebuilt = buildTokyoGrid();
    const allowed = new Set(Object.values(CITY_TILE));
    let mismatches = 0;
    let invalid = 0;
    let diffs = 0;
    for (let index = 0; index < grid.length; index += 1) {
      mismatches += Number(rebuilt[index] !== grid[index]);
      invalid += Number(!allowed.has(grid[index]));
      if (grid[index] === TOKYO_GEO.terrain[index]) continue;
      diffs += 1;
      invalid += Number(grid[index] !== CITY_TILE.EXIT);
      invalid += Number(!isCityWalkable(TOKYO_GEO.terrain[index]));
    }
    expect(mismatches).toBe(0);
    expect(invalid).toBe(0);
    expect(diffs).toBe(2);
  });

  it('기본 export가 플레이 가능한 도시 계약을 노출한다', () => {
    expect(TOKYO).toMatchObject({
      id: 'tokyo', name: '도쿄', cols: COLS, rows: ROWS,
      entrance: ENTRANCE, returnNode: 'tokyo',
    });
    expect(TOKYO.nodes).toBe(CITY_NODES);
    expect(TOKYO.stations).toBe(STATIONS);
    expect(TOKYO.props).toBe(PROPS);
    expect(TOKYO.buildGrid).toBe(buildTokyoGrid);
  });
});

describe('출입구 세로 회랑', () => {
  it('ENTRANCE와 EXIT가 보행 가능하고 위로 직진해 복귀할 수 있다', () => {
    expect(ENTRANCE).toEqual({ x: 543, y: 1040, facing: 'down' });
    expect(isCityWalkable(at(ENTRANCE.x, ENTRANCE.y))).toBe(true);
    const exits = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (at(x, y) === CITY_TILE.EXIT) exits.push([x, y]);
      }
    }
    expect(exits).toEqual([[543, 1031], [543, 1032]]);
    for (const [x, y] of exits) {
      expect(x).toBe(ENTRANCE.x);
      expect(y).toBeLessThan(ENTRANCE.y);
      expect(isCityWalkable(at(x, y))).toBe(true);
    }
    for (let y = 1031; y <= ENTRANCE.y; y += 1) {
      expect(isCityWalkable(at(ENTRANCE.x, y))).toBe(true);
    }
  });
});

describe('geo POI·山手線 fast-travel 배선', () => {
  it('POI를 노드 또는 중복 없는 品川駅 마커로 모두 배선한다', () => {
    const represented = new Set([
      // NPC 대화 노드는 geo POI 가 아니라 가공 무대 — geo 대표성 집합에서 제외.
      ...CITY_NODES.filter((node) => node.kind !== 'npc').map((node) => node.id),
      ...STATIONS.map((station) => station.poiId).filter(Boolean),
    ]);
    expect(represented).toEqual(new Set(TOKYO_GEO.pois.map((poi) => poi.id)));
    expect(STATIONS.find((station) => station.id === 'shinagawa')?.poiId).toBe('shinagawa-station');
    expect(CITY_NODES.some((node) => node.id === 'shinagawa-station')).toBe(false);
  });

  it('모든 POI 노드는 geo tile을 갖는다(name·desc는 일반화 가능)', () => {
    // geo 1:1 계약은 spot 노드에만 — NPC 대화 노드(가공 무대)는 아래 별도 케이스에서 검증한다.
    for (const node of CITY_NODES.filter((entry) => entry.kind !== 'npc')) {
      const source = TOKYO_GEO.pois.find((poi) => poi.id === node.id);
      expect(source).toBeTruthy();
      expect(node.tile).toEqual(source.tile);
      // name은 사용자 노출 카피로 일반화될 수 있음
      expect(typeof node.name).toBe('string');
      expect(node.name.length).toBeGreaterThan(0);
      // desc는 일반화될 수 있지만 존재해야 함
      expect(typeof node.desc).toBe('string');
      expect(node.desc.length).toBeGreaterThan(0);
      expect(node.noStamp).toBe(true);
      expect(isCityWalkable(at(node.tile[0], node.tile[1]))).toBe(true);
      expect(adjacentWalkable(node.tile[0], node.tile[1])).toBe(true);
    }
  });

  it('NPC 노드는 스크립트 키·챕터를 갖고 보행 가능 타일에 선다(스탬프 미대상)', () => {
    const npcs = CITY_NODES.filter((node) => node.kind === 'npc');
    expect(npcs.map((node) => node.id)).toEqual(['tokyo-ekiin', 'tokyo-menzei', 'tokyo-konbini', 'tokyo-yamanote-west-cafe', 'tokyo-central-east-bookstore']);
    for (const node of npcs) {
      expect(typeof node.npc).toBe('string');
      expect(node.chapter).toMatch(/^ot-\d{2}-/);
      expect(node.noStamp).toBe(true);
      expect(isCityWalkable(at(node.tile[0], node.tile[1]))).toBe(true);
      expect(adjacentWalkable(node.tile[0], node.tile[1])).toBe(true);
    }
  });

  it('山手線 전 30역은 geo tile·일본어 읽기를 그대로 잇는다', () => {
    expect(STATIONS).toHaveLength(30);
    for (const station of STATIONS) {
      const source = TOKYO_GEO.stations.find((entry) => entry.id === station.id);
      expect(source).toBeTruthy();
      expect(station.tile).toEqual(source.tile);
      expect(station.nameJa).toBe(`${source.nameJa}駅`);
      expect(station.yomi).toBe(`${source.yomi}えき`);
      expect(station.line).toBe('山手線');
      expect(isCityWalkable(at(station.tile[0], station.tile[1]))).toBe(true);
      expect(adjacentWalkable(station.tile[0], station.tile[1])).toBe(true);
    }
  });

  it('렌더 마커는 서로 3타일 이상 떨어져 A 상호작용이 겹치지 않는다', () => {
    const markers = [
      ...CITY_NODES.map((node) => ({ id: node.id, tile: node.tile })),
      ...STATIONS.map((station) => ({ id: `station:${station.id}`, tile: station.tile })),
    ];
    for (let left = 0; left < markers.length; left += 1) {
      for (let right = left + 1; right < markers.length; right += 1) {
        const a = markers[left];
        const b = markers[right];
        expect(Math.hypot(a.tile[0] - b.tile[0], a.tile[1] - b.tile[1]), `${a.id}/${b.id}`)
          .toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('fast-travel 행선지는 현재 역을 빼고, 도착점은 그대로 쓸 수 있다', () => {
    for (const station of STATIONS) {
      expect(fastTravelDestinations(STATIONS, station.id)).toHaveLength(STATIONS.length - 1);
      expect(resolveArrivalTile(grid, COLS, ROWS, station.tile)).toEqual(station.tile);
    }
  });
});

describe('구역·연결성·재접속 안전', () => {
  it('구역과 라벨 좌표가 모두 격자 안에 있다', () => {
    expect(ZONES.map((zone) => zone.id)).toEqual([
      'shibuya', 'ebisu-meguro', 'shinagawa', 'shiba', 'tokyo-bay', 'haneda',
    ]);
    for (const zone of ZONES) {
      const [x0, y0, x1, y1] = zone.bounds;
      const [labelX, labelY] = zone.labelTile;
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(y0).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThan(COLS);
      expect(y1).toBeLessThan(ROWS);
      expect(labelX).toBeGreaterThanOrEqual(x0);
      expect(labelX).toBeLessThanOrEqual(x1);
      expect(labelY).toBeGreaterThanOrEqual(y0);
      expect(labelY).toBeLessThanOrEqual(y1);
    }
  });

  it('ENTRANCE에서 모든 보행 타일·POI·역·EXIT에 도달한다', () => {
    const seen = reachableFrom([ENTRANCE.x, ENTRANCE.y]);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < grid.length; index += 1) {
      if (isCityBlocked(grid[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    // v2.4 동네 키워드 14곳 앵커 보정(+5 타일 — 재생성 실측).
    expect(walkable).toBe(655_994);
    expect(reached).toBe(walkable);
    for (const marker of [...CITY_NODES, ...STATIONS]) {
      expect(seen[marker.tile[1] * COLS + marker.tile[0]], marker.id).toBe(1);
    }
    expect(seen[619 * COLS + 402]).toBe(1);
  });

  it('유효 저장 위치는 수용하고 차단·범위 밖 위치는 입구 폴백 대상이다', () => {
    const shibuya = STATIONS.find((station) => station.id === 'shibuya');
    expect(resolveRespawnTile(grid, COLS, ROWS, ENTRANCE, { x: shibuya.tile[0], y: shibuya.tile[1] }))
      .toEqual(shibuya.tile);
    expect(resolveRespawnTile(grid, COLS, ROWS, ENTRANCE, { x: -1, y: 0 })).toBeNull();
    const buildingIndex = grid.findIndex((code) => code === CITY_TILE.BUILDING);
    expect(buildingIndex).toBeGreaterThanOrEqual(0);
    expect(resolveRespawnTile(grid, COLS, ROWS, ENTRANCE, {
      x: buildingIndex % COLS,
      y: Math.floor(buildingIndex / COLS),
    })).toBeNull();
  });
});

describe('세계시 교통 배선', () => {
  it('山手線과 하네다 접근선을 OSM 철도 위에 함께 노출한다', () => {
    expect(TOKYO.transit.map((line) => line.id)).toEqual(['tokyo-yamanote', 'tokyo-haneda-access']);
    expect(TOKYO.railways.tileCount).toBe(53_798);
    expect(directTransitDestinations(TOKYO.transit, STATIONS, 'shinagawa').map((station) => station.id))
      .toEqual(expect.arrayContaining(['shibuya', 'hamamatsucho']));
  });
});
