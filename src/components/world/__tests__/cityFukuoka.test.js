import { describe, it, expect } from 'vitest';
import FUKUOKA, {
  buildFukuokaGrid, isCityWalkable, isCityBlocked,
  COLS, ROWS, CITY_TILE, ENTRANCE, ZONES, CITY_NODES, PROPS, STATIONS,
} from '../cities/fukuoka.js';
import { fastTravelDestinations, resolveArrivalTile } from '../cities/terrain.js';

// 🏙️ 후쿠오카 도시 정밀맵 데이터 무결성 — 순수 그리드 빌더(Phaser 미의존)를 그대로 검증한다.
//   그리드 크기 · 출입구 보행 가능 · NPC/가게 좌표 보행 인접 · 전 보행칸 연결성(입구→가게·출구).

const grid = buildFukuokaGrid();
const at = (x, y) => ((x < 0 || y < 0 || x >= COLS || y >= ROWS) ? -1 : grid[y * COLS + x]);
const adjWalkable = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isCityWalkable(at(x + dx, y + dy)));

describe('그리드 크기·인코딩', () => {
  it('128×96 타일 그리드를 만든다(7구역 확장판)', () => {
    expect(COLS).toBe(128);
    expect(ROWS).toBe(96);
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
    expect(donki?.name).toContain('中洲');           // 돈키 텐진→나카스 이전(실지리 부합)
  });

  it('一風堂는 반드시 大名本店(総本店 아님 — 리서치 정정)', () => {
    const ippudo = CITY_NODES.find((n) => n.id === 'fukuoka-ippudo');
    expect(ippudo?.name).toBe('一風堂 大名本店');
    expect(CITY_NODES.every((n) => !/総本店/.test(n.name || '') || n.id !== 'fukuoka-ippudo')).toBe(true);
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
  it('7구역(리서치 §조사3)이 라벨·라벨좌표를 갖는다', () => {
    const ids = ZONES.map((z) => z.id);
    expect(ZONES.length).toBe(7);
    expect(ids).toEqual(expect.arrayContaining([
      'hakata-port', 'tenjin', 'nakasu', 'canalcity', 'hakata-sta', 'daimyo-ramen', 'ohori',
    ]));
    for (const z of ZONES) {
      expect(typeof z.label).toBe('string');
      expect(z.label.trim().length).toBeGreaterThan(0);
      const [lx, ly] = z.labelTile;
      expect(lx >= 0 && lx < COLS && ly >= 0 && ly < ROWS).toBe(true);
      const [bx0, by0, bx1, by1] = z.bounds;
      expect(bx0 >= 0 && by0 >= 0 && bx1 < COLS && by1 < ROWS && bx0 <= bx1 && by0 <= by1).toBe(true);
    }
  });
});

describe('지형(실지리 반영)', () => {
  const has = (code) => grid.includes(code);
  it('바다(하카타만)·섬 실루엣·강·다리를 갖는다', () => {
    expect(has(CITY_TILE.WATER)).toBe(true);       // 만·강·연못
    expect(has(CITY_TILE.ISLAND)).toBe(true);      // 노코노시마/시카노시마·연못 섬
    expect(has(CITY_TILE.BRIDGE)).toBe(true);      // 강·연못을 잇는 다리
    expect(has(CITY_TILE.DOCK)).toBe(true);        // 페리 부두
  });

  it('섬 타일은 전부 차단(도달 불가 배경)', () => {
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === CITY_TILE.ISLAND) expect(isCityBlocked(grid[i])).toBe(true);
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

describe('🚃 전철 fast-travel 역(STATIONS)', () => {
  it('3~4개 역이 필수 필드(id·nameJa·yomi·tile)를 갖는다', () => {
    expect(STATIONS.length).toBeGreaterThanOrEqual(3);
    expect(STATIONS.length).toBeLessThanOrEqual(4);
    for (const s of STATIONS) {
      expect(typeof s.id).toBe('string');
      expect(s.nameJa.trim().length).toBeGreaterThan(0);
      expect(s.yomi.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(s.tile) && s.tile.length === 2).toBe(true);
    }
    // 실제 후쿠오카 역명(데모 4곳)이 들어 있다.
    const names = STATIONS.map((s) => s.nameJa);
    expect(names).toEqual(expect.arrayContaining(['博多駅', '天神駅', '中洲川端駅', '大濠公園駅']));
  });

  it('역 id 는 유일 + CITY_NODES id 와 충돌하지 않는다', () => {
    const ids = STATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const nodeIds = new Set(CITY_NODES.map((n) => n.id));
    for (const id of ids) expect(nodeIds.has(id)).toBe(false);
  });

  it('모든 역 도착 tile 은 보행 가능 + 보행 인접 + 입구에서 도달 가능', () => {
    for (const s of STATIONS) {
      const [x, y] = s.tile;
      expect(x >= 0 && x < COLS && y >= 0 && y < ROWS).toBe(true);
      expect(isCityWalkable(at(x, y))).toBe(true);
      expect(adjWalkable(x, y)).toBe(true);
    }
  });

  it('역은 노드로부터 A버튼 근접반경(2.75타일=88px) 밖 — A 상호작용 모호성 없음', () => {
    for (const s of STATIONS) {
      for (const n of CITY_NODES) {
        const d = Math.hypot(s.tile[0] - n.tile[0], s.tile[1] - n.tile[1]);
        expect(d).toBeGreaterThan(2.75);
      }
    }
  });

  it('FUKUOKA.stations 가 STATIONS 를 노출한다(stations 계약 — geo 통합 대상)', () => {
    expect(FUKUOKA.stations).toBe(STATIONS);
  });
});

describe('🚃 행선지 목록 순수 로직(fastTravelDestinations)', () => {
  it('행선지 = 전체 역 − 현재 역', () => {
    for (const cur of STATIONS) {
      const dests = fastTravelDestinations(STATIONS, cur.id);
      expect(dests.length).toBe(STATIONS.length - 1);
      expect(dests.find((s) => s.id === cur.id)).toBeUndefined();
      expect(new Set(dests.map((s) => s.id))).toEqual(
        new Set(STATIONS.filter((s) => s.id !== cur.id).map((s) => s.id)),
      );
    }
  });

  it('빈/누락 입력에 안전(빈 배열 반환)', () => {
    expect(fastTravelDestinations(undefined, 'x')).toEqual([]);
    expect(fastTravelDestinations(null, 'x')).toEqual([]);
    expect(fastTravelDestinations([], 'x')).toEqual([]);
  });
});

describe('🚃 도착 tile 해석(resolveArrivalTile) — 소프트락 방지 게이트', () => {
  const walkableAt = (x, y) => isCityWalkable(at(x, y));

  it('정확 tile 이 보행 가능하면 그대로 반환', () => {
    for (const s of STATIONS) {
      expect(resolveArrivalTile(grid, COLS, ROWS, s.tile)).toEqual(s.tile);
    }
  });

  it('차단 tile(WATER)이면 인근 보행칸으로 결정적 재배치', () => {
    // [10,2]는 하카타만 수면(WATER·차단).
    expect(isCityBlocked(at(10, 2))).toBe(true);
    const r = resolveArrivalTile(grid, COLS, ROWS, [10, 2]);
    expect(r).not.toBeNull();
    expect(walkableAt(r[0], r[1])).toBe(true);
    expect(resolveArrivalTile(grid, COLS, ROWS, [10, 2])).toEqual(r); // 결정적(재호출 동일)
  });

  it('차단 tile(BUILDING)이면 인근 보행칸으로 재배치', () => {
    // [90,62]는 하카타역 건물 블록(BUILDING·차단).
    expect(isCityBlocked(at(90, 62))).toBe(true);
    const r = resolveArrivalTile(grid, COLS, ROWS, [90, 62]);
    expect(r).not.toBeNull();
    expect(walkableAt(r[0], r[1])).toBe(true);
  });

  it('범위 밖·비정수 tile 은 취소(null) 또는 인근 재배치 — 소프트락 없음', () => {
    expect(resolveArrivalTile(grid, COLS, ROWS, [99999, 99999])).toBeNull(); // 완전 범위 밖 → 취소
    expect(resolveArrivalTile(grid, COLS, ROWS, [1.5, 2])).toBeNull();       // 비정수 → 취소
    expect(resolveArrivalTile(grid, COLS, ROWS, null)).toBeNull();
    const near = resolveArrivalTile(grid, COLS, ROWS, [-1, 40]);             // 살짝 밖 → 인근 보행칸
    if (near) expect(walkableAt(near[0], near[1])).toBe(true);
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
