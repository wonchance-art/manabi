import { describe, it, expect } from 'vitest';
import FUKUOKA, {
  buildFukuokaGrid, isCityWalkable, isCityBlocked,
  COLS, ROWS, CITY_TILE, ENTRANCE, ZONES, CITY_NODES, PROPS, STATIONS,
} from '../cities/fukuoka.js';
import { FUKUOKA_GEO } from '../cities/fukuoka.geo.js';
import { fastTravelDestinations, resolveArrivalTile, resolveRespawnTile } from '../cities/terrain.js';
import { directTransitDestinations } from '../../../lib/world/transit.js';

// 🏙️ 후쿠오카 도시 정밀맵 — **실지형 geo 격상판(388×254)** 데이터 무결성.
//   지형은 cities/fukuoka.geo.js(§6.4 계약)가 단일 진실원. buildGrid 는 geo terrain(디코드된 표준
//   지형 코드 Uint8Array)을 복사해 EXIT 게임 기믹만 얹는다. 순수 그리드 빌더(Phaser 미의존)를 그대로
//   검증한다: 크기·geo terrain 정합·출입구 보행·NPC/역 좌표 보행 인접·BFS 도달성·라멘 nodeId 유지.

const grid = buildFukuokaGrid();
const at = (x, y) => ((x < 0 || y < 0 || x >= COLS || y >= ROWS) ? -1 : grid[y * COLS + x]);
const adjWalkable = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isCityWalkable(at(x + dx, y + dy)));

// geo terrain 에서 차단 타일(WATER/BUILDING) 표본을 찾아 resolveArrivalTile 테스트에 쓴다(하드코딩 회피).
const firstTile = (code) => {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y * COLS + x] === code) return [x, y];
  return null;
};

describe('그리드 크기·인코딩 (geo 388×254)', () => {
  it('geo grid.w/h(388×254) 타일 그리드를 만든다', () => {
    expect(COLS).toBe(388);
    expect(ROWS).toBe(254);
    expect(COLS).toBe(FUKUOKA_GEO.meta.grid.w);
    expect(ROWS).toBe(FUKUOKA_GEO.meta.grid.h);
    expect(grid.length).toBe(COLS * ROWS);
  });

  it('모든 셀은 정의된 CITY_TILE 코드', { timeout: 30_000 }, () => {
    const allowed = new Set(Object.values(CITY_TILE));
    for (let i = 0; i < grid.length; i++) expect(allowed.has(grid[i])).toBe(true);
  });

  it('결정적 — 두 번 빌드 결과 동일', () => {
    expect(Array.from(buildFukuokaGrid())).toEqual(Array.from(grid));
  });

  it('geo terrain 을 그대로 소비한다(EXIT 얹은 칸만 제외하고 geo 와 동일)', () => {
    const geo = FUKUOKA_GEO.terrain;
    expect(grid.length).toBe(geo.length);
    let diffs = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] !== geo[i]) {
        diffs++;
        // 유일한 차이는 EXIT 승격 — 원래 geo 값은 보행 가능(부두 데크)이었다.
        expect(grid[i]).toBe(CITY_TILE.EXIT);
        expect(isCityBlocked(geo[i])).toBe(false);
      }
    }
    expect(diffs).toBeGreaterThan(0);         // EXIT 를 실제로 얹었다
    expect(diffs).toBeLessThanOrEqual(8);     // 게임 기믹은 소수 칸만
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

  // e2e 스모크(전국맵→시내→EXIT 복귀)는 스폰 후 '위로 직진'만으로 EXIT 를 밟는다. 그 계약이 성립하려면
  //   EXIT 가 ENTRANCE 와 같은 x열의 북쪽이고, 그 사이 세로 회랑이 전부 보행 가능해야 한다(끊기면 e2e 가
  //   30초 타임아웃 — 느리게 실패). 이 불변식을 단위에서 빠르게 고정한다(Codex #93 P1).
  it('EXIT 는 ENTRANCE 와 같은 x열 북쪽 + 사이 세로 회랑이 전부 보행 가능(스모크 위-직진 계약)', () => {
    const exitTiles = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y * COLS + x] === CITY_TILE.EXIT) exitTiles.push([x, y]);
    expect(exitTiles.length).toBeGreaterThan(0);
    for (const [ex, ey] of exitTiles) {
      expect(ex).toBe(ENTRANCE.x);          // 같은 x열
      expect(ey).toBeLessThan(ENTRANCE.y);  // ENTRANCE 북쪽(위)
    }
    const topExitY = Math.min(...exitTiles.map(([, y]) => y));
    // ENTRANCE 에서 최북단 EXIT 까지 같은 열의 모든 칸이 보행 가능(위-직진으로 도달).
    for (let y = topExitY; y <= ENTRANCE.y; y++) {
      expect(isCityWalkable(at(ENTRANCE.x, y))).toBe(true);
    }
  });
});

describe('가게/NPC 노드 (geo POI 매핑)', () => {
  it('라멘(fukuoka-ramen) NPC 가 유지된다(스탬프 연속성)', () => {
    const ramen = CITY_NODES.find((n) => n.id === 'fukuoka-ramen');
    expect(ramen?.npc).toBe('ramen');               // npcScripts key — 대화 이전
    expect(ramen?.kind).toBe('npc');
  });

  it('돈키 中洲店(免税 도어 무대)이 中洲 노드로 계승된다', () => {
    const nakasu = CITY_NODES.find((n) => n.id === 'nakasu');
    expect(nakasu?.noStamp).toBe(true);             // 파사드(실존 노드 아님) — 스탬프 없음
    expect(nakasu?.facade).toBe('donki');           // 노란 돈키 간판 마커
    expect(nakasu?.desc).toContain('免税');          // 면세 도어 무대 소개
    expect(nakasu?.name).toContain('中洲');          // 돈키 中洲店(실지리 부합)
  });

  it('一風堂는 반드시 大名本店(総本店 아님 — 리서치 정정)', () => {
    const ippudo = CITY_NODES.find((n) => n.id === 'fukuoka-ippudo');
    expect(ippudo?.name).toBe('一風堂 大名本店');
    expect(CITY_NODES.every((n) => !/総本店/.test(n.name || ''))).toBe(true);
  });

  it('편의점·이자카야 NPC 가 도시맵에 추가된다(대화 도어, 스탬프 우주 밖 → noStamp)', () => {
    const konbini = CITY_NODES.find((n) => n.id === 'fukuoka-konbini');
    expect(konbini?.kind).toBe('npc');
    expect(konbini?.npc).toBe('konbini');     // npcScripts key
    expect(konbini?.noStamp).toBe(true);      // WORLD_NODES 밖 — 서버 미검증(유령 스탬프 방지)
    const izakaya = CITY_NODES.find((n) => n.id === 'fukuoka-izakaya');
    expect(izakaya?.kind).toBe('npc');
    expect(izakaya?.npc).toBe('izakaya');
    expect(izakaya?.noStamp).toBe(true);
    // 스탬프 대상(WORLD_NODES) NPC 는 fukuoka-ramen 하나뿐 — 도시 학습 NPC 는 스탬프 우주를 넓히지 않는다.
    const stampNpc = CITY_NODES.filter((n) => n.kind === 'npc' && !n.noStamp).map((n) => n.id);
    expect(stampNpc).toEqual(['fukuoka-ramen']);
  });

  it('네 문화 도어가 지정된 문법 챕터에 정확히 연결된다', () => {
    expect(Object.fromEntries(
      CITY_NODES.filter((n) => n.chapter).map((n) => [n.id, n.chapter]),
    )).toEqual({
      'fukuoka-konbini': 'ot-07-konbini',
      nakasu: 'ot-12-menzei',
      'fukuoka-izakaya': 'ot-08-izakaya',
      'fukuoka-ramen': 'ot-10-ramen',
    });
  });

  it('전 geo POI(국제선 터미널 포함)가 노드로 매핑된다', () => {
    const nodeIds = new Set(CITY_NODES.map((n) => n.id));
    for (const poi of FUKUOKA_GEO.pois) expect(nodeIds.has(poi.id)).toBe(true);
    // geo POI(14·국제선 터미널 포함) + 라멘 NPC + 一風堂 + 편의점 NPC + 이자카야 NPC = 18
    expect(CITY_NODES.length).toBe(FUKUOKA_GEO.pois.length + 4);
  });

  it('모든 노드 타일은 보행 가능 + 보행 인접(플레이어가 다가설 수 있다)', () => {
    for (const n of CITY_NODES) {
      const [x, y] = n.tile;
      expect(x >= 0 && x < COLS && y >= 0 && y < ROWS).toBe(true);
      expect(isCityWalkable(at(x, y))).toBe(true);
      expect(adjWalkable(x, y)).toBe(true);
    }
  });

  it('노드 id 는 유일', () => {
    const ids = CITY_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('구역(동네) 라벨', () => {
  it('7구역이 라벨·라벨좌표를 갖는다(geo 실좌표 재배치)', () => {
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
  it('바다(하카타만)·세 강·다리·부두·해변을 갖는다', () => {
    expect(has(CITY_TILE.WATER)).toBe(true);       // 하카타만
    expect(has(CITY_TILE.RIVER)).toBe(true);       // 나카강·하카타강·미카사강
    expect(has(CITY_TILE.BRIDGE)).toBe(true);      // 강을 잇는 다리
    expect(has(CITY_TILE.DOCK)).toBe(true);        // 페리 부두
    expect(has(CITY_TILE.BEACH)).toBe(true);       // 모모치 해변
    expect(has(CITY_TILE.PARK)).toBe(true);        // 오호리·성터 녹지
    expect(has(CITY_TILE.BUILDING)).toBe(true);
  });

  it('geo terrain 은 강 코드를 넉넉히 담는다(세 강)', () => {
    let river = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] === CITY_TILE.RIVER) river++;
    expect(river).toBeGreaterThan(500);
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

describe('🚃 전철 fast-travel 역(STATIONS = geo.stations 11)', () => {
  it('11개 역이 필수 필드(id·nameJa·yomi·tile)를 갖는다', () => {
    expect(STATIONS.length).toBe(11);
    for (const s of STATIONS) {
      expect(typeof s.id).toBe('string');
      expect(s.nameJa.trim().length).toBeGreaterThan(0);
      expect(s.yomi.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(s.tile) && s.tile.length === 2).toBe(true);
    }
    // 실제 후쿠오카 역명이 들어 있다.
    const names = STATIONS.map((s) => s.nameJa);
    expect(names).toEqual(expect.arrayContaining(['博多駅', '天神駅', '中洲川端駅', '大濠公園駅']));
  });

  it('역 tile 은 geo.stations 좌표를 그대로 계승한다', () => {
    for (const s of STATIONS) {
      const geo = FUKUOKA_GEO.stations.find((g) => g.id === s.id);
      expect(geo).toBeTruthy();
      expect(s.tile).toEqual([geo.tile[0], geo.tile[1]]);
    }
  });

  it('역 id 는 유일 + CITY_NODES id 와 충돌하지 않는다', () => {
    const ids = STATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const nodeIds = new Set(CITY_NODES.map((n) => n.id));
    for (const id of ids) expect(nodeIds.has(id)).toBe(false);
  });

  it('모든 역 도착 tile 은 보행 가능 + 보행 인접', () => {
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

  it('FUKUOKA.stations 가 STATIONS 를 노출한다(stations 계약)', () => {
    expect(FUKUOKA.stations).toBe(STATIONS);
  });
});

describe('세계시 교통 배선', () => {
  it('공항선·나나쿠마선과 국내/국제 페리가 분리되어 있다', () => {
    expect(FUKUOKA.transit.map((line) => line.id)).toEqual([
      'fukuoka-airport-line', 'fukuoka-nanakuma-line', 'fukuoka-hakozaki-line', 'tenjin-transfer',
      'hakata-domestic-ferry', 'hakata-international-ferry',
    ]);
    expect(FUKUOKA.transit.filter((line) => line.mode === 'ferry')).toHaveLength(2);
    expect(directTransitDestinations(FUKUOKA.transit, STATIONS, 'tenjin').map((station) => station.id))
      .toContain('hakata');
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
  const usableAt = (g, cols, rows, x, y) => {
    const cell = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows && isCityWalkable(g[cy * cols + cx]);
    return cell(x, y) && (cell(x + 1, y) || cell(x - 1, y) || cell(x, y + 1) || cell(x, y - 1));
  };

  it('정확 tile 이 유효(보행+인접)하면 그대로 반환', () => {
    for (const s of STATIONS) {
      expect(resolveArrivalTile(grid, COLS, ROWS, s.tile)).toEqual(s.tile);
    }
  });

  it('차단 tile(WATER)이면 인근 유효칸으로 결정적 재배치(재배치 결과도 보행 인접)', () => {
    const water = firstTile(CITY_TILE.WATER);
    expect(water).not.toBeNull();
    expect(isCityBlocked(at(water[0], water[1]))).toBe(true);
    const r = resolveArrivalTile(grid, COLS, ROWS, water);
    expect(r).not.toBeNull();
    expect(walkableAt(r[0], r[1])).toBe(true);
    expect(usableAt(grid, COLS, ROWS, r[0], r[1])).toBe(true);      // 걸어서 벗어날 수 있음
    expect(resolveArrivalTile(grid, COLS, ROWS, water)).toEqual(r); // 결정적(재호출 동일)
  });

  it('차단 tile(BUILDING)이면 인근 유효칸으로 재배치(보행 인접 보강)', () => {
    const bldg = firstTile(CITY_TILE.BUILDING);
    expect(bldg).not.toBeNull();
    expect(isCityBlocked(at(bldg[0], bldg[1]))).toBe(true);
    const r = resolveArrivalTile(grid, COLS, ROWS, bldg);
    expect(r).not.toBeNull();
    expect(walkableAt(r[0], r[1])).toBe(true);
    expect(usableAt(grid, COLS, ROWS, r[0], r[1])).toBe(true);
  });

  it('범위 밖·비정수 tile 은 취소(null) 또는 인근 재배치 — 소프트락 없음', () => {
    expect(resolveArrivalTile(grid, COLS, ROWS, [99999, 99999])).toBeNull(); // 완전 범위 밖 → 취소
    expect(resolveArrivalTile(grid, COLS, ROWS, [1.5, 2])).toBeNull();       // 비정수 → 취소
    expect(resolveArrivalTile(grid, COLS, ROWS, null)).toBeNull();
    const near = resolveArrivalTile(grid, COLS, ROWS, [-1, 130]);            // 살짝 밖 → 인근 유효칸
    if (near) expect(usableAt(grid, COLS, ROWS, near[0], near[1])).toBe(true);
  });

  it('고립 보행칸(5×5 건물 한가운데 SIDEWALK 1칸)은 도착점으로 채택 안 함', () => {
    const C = 5, Rw = 5;
    const g = new Uint8Array(C * Rw).fill(CITY_TILE.BUILDING);
    g[2 * C + 2] = CITY_TILE.SIDEWALK; // 중앙만 보행 가능(고립)
    expect(resolveArrivalTile(g, C, Rw, [2, 2])).toBeNull();

    const g2 = new Uint8Array(C * Rw).fill(CITY_TILE.BUILDING);
    g2[2 * C + 2] = CITY_TILE.SIDEWALK;
    g2[2 * C + 3] = CITY_TILE.SIDEWALK; // 오른쪽 이웃 개통
    const r2 = resolveArrivalTile(g2, C, Rw, [2, 2]);
    expect(r2).toEqual([2, 2]);
    expect(usableAt(g2, C, Rw, r2[0], r2[1])).toBe(true);
  });
});

describe('연결성 — 입구에서 노드·역·출구에 도달', () => {
  it('BFS: 입구에서 노드·역·EXIT 전부 도달 가능(메인 보행 성분)', () => {
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
    // 실지형이라 미세한 고립 보행 포켓(방파제·소섬 등)이 소수 존재 — 99% 이상이 메인 성분에 연결.
    expect(reached / walkable).toBeGreaterThan(0.99);
    // 노드·역·출구가 실제로 도달 가능한지 명시 확인.
    for (const n of CITY_NODES) expect(seen[n.tile[1] * COLS + n.tile[0]]).toBe(1);
    for (const s of STATIONS) expect(seen[s.tile[1] * COLS + s.tile[0]]).toBe(1);
    let exitReached = false;
    for (let i = 0; i < grid.length; i++) if (grid[i] === CITY_TILE.EXIT && seen[i]) exitReached = true;
    expect(exitReached).toBe(true);
  });
});

describe('🏠 재접속 spawn 연결성(resolveRespawnTile) — 구 좌표 소프트락 방지', () => {
  // geo v2.1(건물 실 래스터) 재생성으로, 이전 맵 버전에서 유효했던 저장 좌표가 이제 건물 안(차단)이
  //   될 수 있다. 예: 구 ENTRANCE [237,70]·구 EXIT [237,63]·구 konbini [247,137] 는 v2.1 에서 BUILDING.
  //   이런 좌표로 직행 재접속하면 resolveRespawnTile 이 null 을 반환해 CityScene 이 ENTRANCE 로 폴백한다.
  //   (v2.1 은 전 보행 타일이 단일 BFS 성분이라, 고립-포켓 경로는 합성 그리드 테스트로 따로 검증한다.)
  it('맵 버전 교체로 차단 타일이 된 구 저장 좌표 → null(입구 폴백)', () => {
    for (const [x, y] of [[237, 70], [237, 63], [247, 137]]) {
      expect(isCityWalkable(at(x, y))).toBe(false); // 전제: v2.1 에서 차단(건물)
      expect(resolveRespawnTile(grid, COLS, ROWS, ENTRANCE, { x, y })).toBeNull();
    }
  });

  it('ENTRANCE·메인 성분 노드/역 좌표는 그대로 수용', () => {
    expect(resolveRespawnTile(grid, COLS, ROWS, ENTRANCE, { x: ENTRANCE.x, y: ENTRANCE.y }))
      .toEqual([ENTRANCE.x, ENTRANCE.y]);
    for (const s of STATIONS) {
      expect(resolveRespawnTile(grid, COLS, ROWS, ENTRANCE, { x: s.tile[0], y: s.tile[1] }))
        .toEqual([s.tile[0], s.tile[1]]);
    }
    for (const n of CITY_NODES) {
      expect(resolveRespawnTile(grid, COLS, ROWS, ENTRANCE, { x: n.tile[0], y: n.tile[1] }))
        .toEqual([n.tile[0], n.tile[1]]);
    }
  });

  it('차단·범위 밖·비정수·null spawn 은 거부(null)', () => {
    const water = firstTile(CITY_TILE.WATER);
    expect(resolveRespawnTile(grid, COLS, ROWS, ENTRANCE, { x: water[0], y: water[1] })).toBeNull();
    expect(resolveRespawnTile(grid, COLS, ROWS, ENTRANCE, { x: -1, y: 10 })).toBeNull();
    expect(resolveRespawnTile(grid, COLS, ROWS, ENTRANCE, { x: 1.5, y: 2 })).toBeNull();
    expect(resolveRespawnTile(grid, COLS, ROWS, ENTRANCE, null)).toBeNull();
  });

  it('고립 포켓은 거부, 개통된 이웃은 수용(합성 그리드)', () => {
    const C = 5, Rw = 5;
    const g = new Uint8Array(C * Rw).fill(CITY_TILE.BUILDING);
    g[0] = CITY_TILE.SIDEWALK;          // (0,0) = 입구 성분
    g[2 * C + 2] = CITY_TILE.SIDEWALK;  // (2,2) = 끊긴 고립 포켓
    const ent = { x: 0, y: 0 };
    expect(resolveRespawnTile(g, C, Rw, ent, { x: 2, y: 2 })).toBeNull();
    // (0,0)→(1,0) 개통하면 (1,0) 은 입구 성분 → 수용.
    g[1] = CITY_TILE.SIDEWALK;
    expect(resolveRespawnTile(g, C, Rw, ent, { x: 1, y: 0 })).toEqual([1, 0]);
  });
});
