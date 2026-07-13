import { describe, it, expect } from 'vitest';
import FUKUOKA, {
  buildFukuokaGrid, isCityWalkable, isCityBlocked,
  COLS, ROWS, CITY_TILE, ENTRANCE, ZONES, CITY_NODES, PROPS,
} from '../cities/fukuoka.js';

// 🏙️ 후쿠오카 도시 정밀맵 데이터 무결성 — 순수 그리드 빌더(Phaser 미의존)를 그대로 검증한다.
//   그리드 크기 · 출입구 보행 가능 · NPC/가게 좌표 보행 인접 · 전 보행칸 연결성(입구→가게·출구).

const grid = buildFukuokaGrid();
const at = (x, y) => ((x < 0 || y < 0 || x >= COLS || y >= ROWS) ? -1 : grid[y * COLS + x]);
const adjWalkable = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isCityWalkable(at(x + dx, y + dy)));

describe('그리드 크기·인코딩', () => {
  it('96×72 타일 그리드를 만든다', () => {
    expect(COLS).toBe(96);
    expect(ROWS).toBe(72);
    expect(grid.length).toBe(COLS * ROWS);
  });

  it('모든 셀은 정의된 CITY_TILE 코드', () => {
    const allowed = new Set(Object.values(CITY_TILE));
    for (let i = 0; i < grid.length; i++) expect(allowed.has(grid[i])).toBe(true);
  });

  it('결정적 — 두 번 빌드 결과 동일', () => {
    expect(Array.from(buildFukuokaGrid())).toEqual(Array.from(grid));
  });

  it('메타(default export)가 빌더·구역·노드를 노출한다', () => {
    expect(FUKUOKA.id).toBe('fukuoka');
    expect(FUKUOKA.cols).toBe(COLS);
    expect(typeof FUKUOKA.buildGrid).toBe('function');
    expect(FUKUOKA.returnNode).toBe('fukuoka'); // 전국맵 복귀 노드
  });
});

describe('출입구', () => {
  it('진입 스폰 타일은 보행 가능', () => {
    expect(isCityWalkable(at(ENTRANCE.x, ENTRANCE.y))).toBe(true);
  });

  it('출구(EXIT) 타일이 존재하고 전부 보행 가능', () => {
    let exits = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] === CITY_TILE.EXIT) { exits++; expect(isCityBlocked(grid[i])).toBe(false); }
    expect(exits).toBeGreaterThan(0);
  });
});

describe('가게/NPC 노드', () => {
  it('라멘(fukuoka-ramen)·돈키(fukuoka-donki) 노드가 있다', () => {
    const ramen = CITY_NODES.find((n) => n.id === 'fukuoka-ramen');
    const donki = CITY_NODES.find((n) => n.id === 'fukuoka-donki');
    expect(ramen?.npc).toBe('ramen');               // npcScripts key — 대화 이전
    expect(donki?.noStamp).toBe(true);              // 파사드(실존 노드 아님) — 스탬프 없음
    expect(donki?.desc).toContain('免税');           // 면세 도어 무대 소개
  });

  it('모든 노드 타일은 보행 가능 + 보행 인접(플레이어가 다가설 수 있다)', () => {
    for (const n of CITY_NODES) {
      const [x, y] = n.tile;
      expect(x >= 0 && x < COLS && y >= 0 && y < ROWS).toBe(true);
      expect(isCityWalkable(at(x, y))).toBe(true);
      expect(adjWalkable(x, y)).toBe(true);
    }
  });
});

describe('구역(동네) 라벨', () => {
  it('3구역(하카타항·라멘 골목·텐진)이 라벨·라벨좌표를 갖는다', () => {
    const ids = ZONES.map((z) => z.id);
    expect(ids).toEqual(expect.arrayContaining(['hakata-port', 'ramen-alley', 'tenjin']));
    for (const z of ZONES) {
      expect(typeof z.label).toBe('string');
      expect(z.label.trim().length).toBeGreaterThan(0);
      const [lx, ly] = z.labelTile;
      expect(lx >= 0 && lx < COLS && ly >= 0 && ly < ROWS).toBe(true);
    }
  });
});

describe('프리팹 파사드', () => {
  it('노렌/간판 소품 좌표가 그리드 범위 안', () => {
    for (const p of PROPS) {
      const [x, y] = p.tile;
      expect(x >= 0 && x < COLS && y >= 0 && y < ROWS).toBe(true);
    }
  });
});

describe('연결성 — 입구에서 모든 보행칸(가게·출구)에 도달', () => {
  it('BFS: 입구에서 도달 가능한 보행칸 = 전체 보행칸(고립 지역 없음)', () => {
    const seen = new Uint8Array(grid.length);
    const start = ENTRANCE.y * COLS + ENTRANCE.x;
    const stack = [start]; seen[start] = 1; let reached = 0;
    while (stack.length) {
      const i = stack.pop(); reached++;
      const x = i % COLS, y = (i / COLS) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const j = ny * COLS + nx;
        if (seen[j] || isCityBlocked(grid[j])) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    let walkable = 0;
    for (let i = 0; i < grid.length; i++) if (isCityWalkable(grid[i])) walkable++;
    expect(reached).toBe(walkable);
    // 가게·출구가 실제로 도달 가능한지 명시 확인.
    for (const n of CITY_NODES) expect(seen[n.tile[1] * COLS + n.tile[0]]).toBe(1);
    let exitReached = false;
    for (let i = 0; i < grid.length; i++) if (grid[i] === CITY_TILE.EXIT && seen[i]) exitReached = true;
    expect(exitReached).toBe(true);
  });
});
