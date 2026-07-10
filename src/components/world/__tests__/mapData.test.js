import { describe, it, expect } from 'vitest';
import {
  MAP_W, MAP_H, GEO, project, unproject, POI, MAP_RLE, decodeMap, isLandAt,
  TERRAIN, isBlocked,
} from '../mapData.js';
// 🏙️ 광장 변환의 단일 진실원 — GameCanvas 런타임이 실제로 쓰는 순수 함수. 테스트가 로직을
// 재구현하지 않고 이 실함수를 import 해 계약을 게이트한다(P2-6 — 런타임 회귀 실검출).
import { buildPlayableGrid, plazaBounds, PLAZA_R } from '../../../lib/world/mapGeo.js';

// 🗺️ 광장 맵(한반도+일본 실비율 도트 맵 + 수계·DMZ·교량) 무결성.
// build-map.mjs 가 구운 mapData.js 를 검증한다: 투영·다치 RLE 왕복·지형 계약·주요 지점.

describe('등장방형 투영 (위도 고정 cos38°)', () => {
  it('상수: LON0=123.5, LAT0=46.0, KX=19.5, KY=24.7', () => {
    expect(GEO).toEqual({ LON0: 123.5, LAT0: 46.0, KX: 19.5, KY: 24.7 });
  });
  it('서울(126.98E, 37.57N) → (68, 208)', () => {
    expect(project(126.98, 37.57)).toEqual({ x: 68, y: 208 });
  });
  it('도쿄(139.69E, 35.68N) → (316, 255)', () => {
    expect(project(139.69, 35.68)).toEqual({ x: 316, y: 255 });
  });
  it('부산(129.07E, 35.18N) → (109, 267)', () => {
    expect(project(129.07, 35.18)).toEqual({ x: 109, y: 267 });
  });
  it('project ↔ unproject 왕복(반올림 오차 이내)', () => {
    for (const { x, y } of [{ x: 68, y: 208 }, { x: 316, y: 255 }, { x: 0, y: 0 }]) {
      const { lon, lat } = unproject(x, y);
      const back = project(lon, lat);
      expect(back.x).toBeCloseTo(x, 0);
      expect(back.y).toBeCloseTo(y, 0);
    }
  });
  it('POI 주요 지점이 투영값과 일치', () => {
    expect(POI.SEOUL).toEqual({ x: 68, y: 208 });
    expect(POI.TOKYO).toEqual({ x: 316, y: 255 });
    expect(POI.BUSAN).toEqual({ x: 109, y: 267 });
    // 인천공항(영종도)은 서울 서쪽.
    expect(POI.INCHEON.x).toBeLessThan(POI.SEOUL.x);
    expect(POI.INCHEON).toEqual({ x: 57, y: 211 });
    // 신규 POI — 김해공항·부산여객터미널·후쿠오카항.
    expect(POI.GIMHAE_AIR).toEqual({ x: 106, y: 267 });
    expect(POI.BUSAN_TERMINAL).toEqual({ x: 108, y: 269 });
    expect(POI.FUKUOKA_PORT).toBeTruthy();
    // 랜드마크 고봉 — 백두산(128.056E/42.006N)·후지산(138.727E/35.361N).
    expect(POI.BAEKDU).toEqual(project(128.056, 42.006));
    expect(POI.FUJI).toEqual(project(138.727, 35.361));
  });
});

describe('지형 코드 계약', () => {
  it('TERRAIN 코드 고정값 (0~5 불변 + 시각 질감 6·7·8)', () => {
    expect(TERRAIN).toEqual({
      SEA: 0, LAND: 1, RIVER: 2, LAKE: 3, FENCE: 4, BRIDGE: 5,
      MOUNTAIN: 6, PEAK: 7, PLAIN: 8,
    });
  });
  it('isBlocked 는 sea·fence 만 true (river·lake·bridge·land·mountain·peak·plain 는 통행 가능)', () => {
    expect(isBlocked(TERRAIN.SEA)).toBe(true);
    expect(isBlocked(TERRAIN.FENCE)).toBe(true);
    expect(isBlocked(TERRAIN.LAND)).toBe(false);
    expect(isBlocked(TERRAIN.RIVER)).toBe(false);
    expect(isBlocked(TERRAIN.LAKE)).toBe(false);
    expect(isBlocked(TERRAIN.BRIDGE)).toBe(false);
    // 지형 질감 레이어(순수 시각) — 통행 규칙 무변경.
    expect(isBlocked(TERRAIN.MOUNTAIN)).toBe(false);
    expect(isBlocked(TERRAIN.PEAK)).toBe(false);
    expect(isBlocked(TERRAIN.PLAIN)).toBe(false);
  });
});

describe('다치 RLE 디코더 왕복', () => {
  const grid = decodeMap();

  it('디코드 격자는 MAP_W×MAP_H 길이의 0~8 코드 배열', () => {
    expect(grid.length).toBe(MAP_W * MAP_H);
    for (let i = 0; i < grid.length; i++) expect(grid[i] >= 0 && grid[i] <= 8).toBe(true);
  });

  it('디코드는 결정적(두 번 호출 결과 동일)', () => {
    const g2 = decodeMap();
    expect(Array.from(g2)).toEqual(Array.from(grid));
  });

  it('격자 → RLE 재인코딩이 MAP_RLE 와 완전 일치(왕복 무손실)', () => {
    // 디코더와 대칭인 다치 인코더로 되감아 원본 문자열과 비교한다.
    const rows = [];
    for (let y = 0; y < MAP_H; y++) {
      const runs = [];
      let val = grid[y * MAP_W], count = 0;
      for (let x = 0; x < MAP_W; x++) {
        const v = grid[y * MAP_W + x];
        if (v === val) count++;
        else { runs.push(String(val) + count.toString(36)); val = v; count = 1; }
      }
      runs.push(String(val) + count.toString(36));
      rows.push(runs.join(','));
    }
    expect(rows.join(';')).toBe(MAP_RLE);
  });
});

describe('데이터 무결성 (주요 지점 land / 해협 sea / 제주 존재)', () => {
  const grid = decodeMap();
  const land = (p) => isLandAt(grid, p.x, p.y);
  const code = (x, y) => grid[y * MAP_W + x];
  // land 계열(육지·산지·설산·평야) — 질감 레이어를 포함한 "걸을 수 있는 육지".
  const isLandFam = (x, y) => {
    const c = grid[y * MAP_W + x];
    return c === TERRAIN.LAND || c === TERRAIN.MOUNTAIN || c === TERRAIN.PEAK || c === TERRAIN.PLAIN;
  };

  it('서울·도쿄·부산·후쿠오카는 land', () => {
    expect(land(POI.SEOUL)).toBe(true);
    expect(land(POI.TOKYO)).toBe(true);
    expect(land(POI.BUSAN)).toBe(true);
    expect(land(POI.FUKUOKA)).toBe(true);
  });

  it('김해공항·부산여객터미널은 land', () => {
    expect(land(POI.GIMHAE_AIR)).toBe(true);
    expect(land(POI.BUSAN_TERMINAL)).toBe(true);
  });

  it('인천공항(영종도)은 land', () => {
    expect(land(POI.INCHEON)).toBe(true);
  });

  it('대한해협 중간(117, 260)은 sea', () => {
    expect(code(117, 260)).toBe(TERRAIN.SEA);
  });

  it('제주 존재 — 중심부(59, 312) land 계열 + 주변 덩어리 확인', () => {
    // 제주 중심부는 저지대라 질감 분류에서 PLAIN 이 될 수 있다 → land 계열(걸을 수 있는 육지)로 확인.
    expect(isLandFam(59, 312)).toBe(true);
    let n = 0;
    for (let y = 308; y <= 318; y++) for (let x = 54; x <= 66; x++) if (isLandFam(x, y)) n++;
    expect(n).toBeGreaterThan(30);
  });

  it('범위 밖은 sea 취급', () => {
    expect(isLandAt(grid, -1, 0)).toBe(false);
    expect(isLandAt(grid, MAP_W, 0)).toBe(false);
    expect(isLandAt(grid, 0, MAP_H)).toBe(false);
  });

  it('바다가 대부분(실비율 맵 — land 계열 비율 30% 미만)', () => {
    let landN = 0;
    for (let i = 0; i < grid.length; i++) {
      const c = grid[i];
      if (c === TERRAIN.LAND || c === TERRAIN.MOUNTAIN || c === TERRAIN.PEAK || c === TERRAIN.PLAIN) landN++;
    }
    expect(landN).toBeGreaterThan(1000);
    expect(landN / grid.length).toBeLessThan(0.3);
  });
});

describe('지형 질감 레이어 (산지·고산·평야 — 순수 시각)', () => {
  const grid = decodeMap();
  const code = (x, y) => grid[y * MAP_W + x];

  it('MOUNTAIN·PEAK·PLAIN 타일이 모두 존재한다', () => {
    let m = 0, pk = 0, pl = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === TERRAIN.MOUNTAIN) m++;
      else if (grid[i] === TERRAIN.PEAK) pk++;
      else if (grid[i] === TERRAIN.PLAIN) pl++;
    }
    expect(m).toBeGreaterThan(0);
    expect(pk).toBeGreaterThan(0);
    expect(pl).toBeGreaterThan(0);
  });

  it('백두산·후지산 타일은 PEAK (POI 좌표)', () => {
    expect(code(POI.BAEKDU.x, POI.BAEKDU.y)).toBe(TERRAIN.PEAK);
    expect(code(POI.FUJI.x, POI.FUJI.y)).toBe(TERRAIN.PEAK);
  });

  it('태백산맥 표본(설악산 38.12N/128.47E · 지리산 35.34N/127.73E)은 MOUNTAIN 이상', () => {
    for (const [lon, lat] of [[128.47, 38.12], [127.73, 35.34]]) {
      const p = project(lon, lat);
      const c = code(p.x, p.y);
      expect(c === TERRAIN.MOUNTAIN || c === TERRAIN.PEAK).toBe(true);
    }
  });

  it('질감 코드는 전부 통행 가능(isBlocked false)', () => {
    expect(isBlocked(TERRAIN.MOUNTAIN)).toBe(false);
    expect(isBlocked(TERRAIN.PEAK)).toBe(false);
    expect(isBlocked(TERRAIN.PLAIN)).toBe(false);
  });
});

describe('수계 — 강·호수(통행 가능 물)', () => {
  const grid = decodeMap();
  const code = (x, y) => grid[y * MAP_W + x];

  it('한강이 서울 부근(±3타일)에 river 로 존재', () => {
    let found = false;
    for (let dy = -3; dy <= 3 && !found; dy++)
      for (let dx = -3; dx <= 3 && !found; dx++)
        if (code(POI.SEOUL.x + dx, POI.SEOUL.y + dy) === TERRAIN.RIVER) found = true;
    expect(found).toBe(true);
  });

  it('비와호(琵琶湖, ≈136.1E/35.3N) 부근에 lake 존재', () => {
    const c = project(136.1, 35.3);
    let found = false;
    for (let dy = -4; dy <= 4 && !found; dy++)
      for (let dx = -4; dx <= 4 && !found; dx++)
        if (code(c.x + dx, c.y + dy) === TERRAIN.LAKE) found = true;
    expect(found).toBe(true);
  });

  it('river·lake 는 isBlocked 아님(걸어서 통과 가능)', () => {
    let rN = 0, lN = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === TERRAIN.RIVER) rN++;
      else if (grid[i] === TERRAIN.LAKE) lN++;
    }
    expect(rN).toBeGreaterThan(0);
    expect(lN).toBeGreaterThan(0);
    expect(isBlocked(TERRAIN.RIVER)).toBe(false);
    expect(isBlocked(TERRAIN.LAKE)).toBe(false);
  });
});

describe('DMZ 철조망 — 서해~동해 연속 차단벽', () => {
  const grid = decodeMap();

  it('fence 타일이 다수 존재하고 isBlocked', () => {
    let n = 0; for (let i = 0; i < grid.length; i++) if (grid[i] === TERRAIN.FENCE) n++;
    expect(n).toBeGreaterThan(40);
    expect(isBlocked(TERRAIN.FENCE)).toBe(true);
  });

  it('fence 는 서(최좌측)에서 동(최우측)까지 4-연결로 이어져 구멍이 없다', () => {
    const fs = [];
    for (let i = 0; i < grid.length; i++) if (grid[i] === TERRAIN.FENCE) fs.push(i);
    let minx = Infinity, maxx = -Infinity;
    for (const i of fs) { const x = i % MAP_W; if (x < minx) minx = x; if (x > maxx) maxx = x; }
    // 최좌측 열의 fence 에서 4-연결 BFS.
    const seen = new Set();
    const stack = [];
    for (const i of fs) if (i % MAP_W === minx) { stack.push(i); seen.add(i); }
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % MAP_W, y = (idx / MAP_W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const ni = ny * MAP_W + nx;
        if (grid[ni] === TERRAIN.FENCE && !seen.has(ni)) { seen.add(ni); stack.push(ni); }
      }
    }
    let reachedEast = false;
    for (const i of seen) if (i % MAP_W === maxx) reachedEast = true;
    expect(reachedEast).toBe(true);
    // 서-동 폭이 충분히 넓다(반도를 가로지른다).
    expect(maxx - minx).toBeGreaterThan(40);
  });

  it('서울에서 북쪽으로 걸으면 fence 에 막힌다(같은 열에 fence 존재)', () => {
    let hit = false;
    for (let y = POI.SEOUL.y; y >= 0; y--) if (grid[y * MAP_W + POI.SEOUL.x] === TERRAIN.FENCE) { hit = true; break; }
    expect(hit).toBe(true);
  });
});

describe('영종도 — 본토와 비연결, 영종대교로만 도달', () => {
  const grid = decodeMap();
  // 통행 가능(!isBlocked) 타일 — land 계열(육지·산지·설산·평야) + 물(강·호수) + 교량.
  const WALK = new Set([
    TERRAIN.LAND, TERRAIN.RIVER, TERRAIN.LAKE, TERRAIN.BRIDGE,
    TERRAIN.MOUNTAIN, TERRAIN.PEAK, TERRAIN.PLAIN,
  ]);

  // 통행 가능 타일 4-연결 BFS 로 (sx,sy) 에서 도달 가능한 집합.
  function reachable(g) {
    const seen = new Uint8Array(g.length);
    const start = POI.INCHEON.y * MAP_W + POI.INCHEON.x;
    const stack = [start]; seen[start] = 1;
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % MAP_W, y = (idx / MAP_W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const ni = ny * MAP_W + nx;
        if (!seen[ni] && WALK.has(g[ni])) { seen[ni] = 1; stack.push(ni); }
      }
    }
    return seen;
  }

  it('bridge 포함 시 영종도(인천공항)에서 본토(서울)로 도달 가능', () => {
    const seen = reachable(grid);
    expect(seen[POI.SEOUL.y * MAP_W + POI.SEOUL.x]).toBe(1);
  });

  it('bridge 제거 시 영종도는 본토와 단절(서울에 도달 불가)', () => {
    const g = Uint8Array.from(grid);
    for (let i = 0; i < g.length; i++) if (g[i] === TERRAIN.BRIDGE) g[i] = TERRAIN.SEA;
    const seen = reachable(g);
    expect(seen[POI.SEOUL.y * MAP_W + POI.SEOUL.x]).toBe(0);
  });

  it('영종대교 BRIDGE 타일이 잔존한다(수도권 오버레이에 지워지지 않음)', () => {
    let n = 0; for (let i = 0; i < grid.length; i++) if (grid[i] === TERRAIN.BRIDGE) n++;
    expect(n).toBeGreaterThan(0);
    // 다리는 인천공항(영종도) 인근 바다 위에 놓인다.
    let nearIncheon = false;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] !== TERRAIN.BRIDGE) continue;
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      if (Math.abs(x - POI.INCHEON.x) <= 8 && Math.abs(y - POI.INCHEON.y) <= 8) nearIncheon = true;
    }
    expect(nearIncheon).toBe(true);
  });
});

// 🚧 국경 도달성 — 진짜 게이트. 펜스 연속성만으론 양끝 우회를 못 잡으므로,
// 통행 규칙(isBlocked: sea·fence 차단)으로 서울에서 BFS 해 북측 도시 도달 불가를 직접 확인한다.
describe('국경 도달성 (서울 BFS → 개성·평양 도달 불가)', () => {
  const grid = decodeMap();
  // isBlocked 규칙으로 서울에서 4-연결 도달 가능 집합.
  const reachFromSeoul = (g) => {
    const seen = new Uint8Array(g.length);
    const start = POI.SEOUL.y * MAP_W + POI.SEOUL.x;
    const stack = [start]; seen[start] = 1;
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % MAP_W, y = (idx / MAP_W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const ni = ny * MAP_W + nx;
        if (!seen[ni] && !isBlocked(g[ni])) { seen[ni] = 1; stack.push(ni); }
      }
    }
    return seen;
  };
  const KAESONG = project(126.55, 37.97);   // 개성
  const PYONGYANG = project(125.75, 39.03);  // 평양

  it('서울에서 개성·평양에 도달할 수 없다(철조망이 반도를 완전 봉인)', () => {
    const seen = reachFromSeoul(grid);
    expect(seen[KAESONG.y * MAP_W + KAESONG.x]).toBe(0);
    expect(seen[PYONGYANG.y * MAP_W + PYONGYANG.x]).toBe(0);
  });

  it('서울 도달 영역의 최북단이 철조망 남쪽에 머문다', () => {
    const seen = reachFromSeoul(grid);
    // 철조망 최북단 행.
    let fenceMinY = MAP_H;
    for (let i = 0; i < grid.length; i++) if (grid[i] === TERRAIN.FENCE) { const y = (i / MAP_W) | 0; if (y < fenceMinY) fenceMinY = y; }
    let reachMinY = MAP_H;
    for (let i = 0; i < grid.length; i++) if (seen[i]) { const y = (i / MAP_W) | 0; if (y < reachMinY) reachMinY = y; }
    // 도달 최북단은 철조망 최북단보다 남쪽(값이 큼)이어야 한다 — 북측으로 새지 않음.
    expect(reachMinY).toBeGreaterThan(fenceMinY);
  });

  it('철조망 양끝이 실제 바다에 앵커된다(양끝 sea 인접) + 단일 4-연결 성분', () => {
    const fs = [];
    for (let i = 0; i < grid.length; i++) if (grid[i] === TERRAIN.FENCE) fs.push(i);
    let minx = MAP_W, maxx = -1;
    for (const i of fs) { const x = i % MAP_W; if (x < minx) minx = x; if (x > maxx) maxx = x; }
    const seaAdj = (idx) => {
      const x = idx % MAP_W, y = (idx / MAP_W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) return true; // 맵 밖 = 바다
        if (grid[ny * MAP_W + nx] === TERRAIN.SEA) return true;
      }
      return false;
    };
    const westEnd = fs.filter((i) => i % MAP_W === minx).some(seaAdj);
    const eastEnd = fs.filter((i) => i % MAP_W === maxx).some(seaAdj);
    expect(westEnd).toBe(true);
    expect(eastEnd).toBe(true);
    // 단일 4-연결 성분(구멍 없음).
    const set = new Set(fs);
    const seen = new Set([fs[0]]); const stack = [fs[0]];
    while (stack.length) {
      const idx = stack.pop(); const x = idx % MAP_W, y = (idx / MAP_W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = (y + dy) * MAP_W + (x + dx);
        if (set.has(ni) && !seen.has(ni)) { seen.add(ni); stack.push(ni); }
      }
    }
    expect(seen.size).toBe(fs.length);
  });
});

// 🏙️ 수도권 스폰 광장 "land 강제" 계약 — GameCanvas 런타임 오버레이가 지켜야 할 불변식.
// 광장 보장은 SEA 타일에만 적용해야 한다. RIVER·LAKE·FENCE·BRIDGE 를 LAND 로 덮으면
// 한강이 사라지고(#1) 영종대교가 지워지며(#1) 철조망에 구멍이 뚫려 국경이 뚫린다(#2).
describe('수도권 광장 land 강제 계약 (SEA 타일에만 · 실함수 buildPlayableGrid)', () => {
  const grid = decodeMap();
  // 실함수(GameCanvas 런타임·미니맵·관리자 뷰가 공유)가 산출하는 플레이 격자.
  const playable = buildPlayableGrid(grid);
  const { x0: px0, x1: px1, y0: py0, y1: py1 } = plazaBounds();
  const countAll = (g, code) => {
    let n = 0; for (let i = 0; i < g.length; i++) if (g[i] === code) n++;
    return n;
  };
  const countIn = (g, code) => {
    let n = 0; for (let y = py0; y <= py1; y++) for (let x = px0; x <= px1; x++) if (g[y * MAP_W + x] === code) n++;
    return n;
  };
  const reachNorth = (g) => {
    const seen = new Uint8Array(g.length);
    const start = POI.SEOUL.y * MAP_W + POI.SEOUL.x; const stack = [start]; seen[start] = 1;
    while (stack.length) {
      const idx = stack.pop(); const x = idx % MAP_W, y = (idx / MAP_W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const ni = ny * MAP_W + nx;
        if (!seen[ni] && !isBlocked(g[ni])) { seen[ni] = 1; stack.push(ni); }
      }
    }
    const k = project(126.55, 37.97);
    return !!seen[k.y * MAP_W + k.x]; // 개성 도달?
  };

  it('plazaBounds 는 PLAZA_R·POI 로 결정되는 광장 사각형', () => {
    expect(px0).toBe(Math.min(POI.INCHEON.x, POI.SEOUL.x) - 1);
    expect(px1).toBe(POI.SEOUL.x + PLAZA_R + 1);
    expect(py0).toBe(POI.SEOUL.y - PLAZA_R - 1);
    expect(py1).toBe(POI.SEOUL.y + PLAZA_R + 1);
  });

  it('광장 사각형 안에 RIVER·FENCE·BRIDGE 타일이 실재한다(맹목적 land 강제의 피해 대상)', () => {
    expect(countIn(grid, TERRAIN.RIVER)).toBeGreaterThan(0);
    expect(countIn(grid, TERRAIN.FENCE)).toBeGreaterThan(0);
    expect(countIn(grid, TERRAIN.BRIDGE)).toBeGreaterThan(0);
  });

  it('buildPlayableGrid 는 입력 격자를 변형하지 않는다(순수 · 복사본 반환)', () => {
    const before = Uint8Array.from(grid);
    buildPlayableGrid(grid);
    expect(Array.from(grid)).toEqual(Array.from(before));
  });

  it('실함수: 광장 안 SEA 를 LAND 로 메꾼다(≥1타일) · 사각형 밖은 불변', () => {
    // 광장 안에서 SEA 는 사라지고 그만큼 LAND 가 늘어난다.
    expect(countIn(playable, TERRAIN.SEA)).toBeLessThan(countIn(grid, TERRAIN.SEA));
    // 사각형 밖 타일은 한 개도 바뀌지 않는다.
    let outsideChanged = 0;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const inRect = x >= px0 && x <= px1 && y >= py0 && y <= py1;
      if (!inRect && playable[y * MAP_W + x] !== grid[y * MAP_W + x]) outsideChanged++;
    }
    expect(outsideChanged).toBe(0);
  });

  it('실함수 계약: 한강(RIVER)·영종대교(BRIDGE)·철조망(FENCE) 전량 보존 + 국경 봉인 유지', () => {
    // 전 격자 기준으로 수계·다리·펜스 타일 총량이 그대로여야 한다(SEA 한정 강제의 증명).
    expect(countAll(playable, TERRAIN.RIVER)).toBe(countAll(grid, TERRAIN.RIVER));
    expect(countAll(playable, TERRAIN.BRIDGE)).toBe(countAll(grid, TERRAIN.BRIDGE));
    expect(countAll(playable, TERRAIN.FENCE)).toBe(countAll(grid, TERRAIN.FENCE));
    // 국경 봉인: 플레이 격자에서 서울 BFS → 개성 도달 불가.
    expect(reachNorth(playable)).toBe(false);
  });

  it('맹목적 land 강제(전 타일 → LAND)는 국경을 뚫는다 — 그래서 SEA 한정이 필요', () => {
    const g = Uint8Array.from(grid);
    for (let y = py0; y <= py1; y++) for (let x = px0; x <= px1; x++) g[y * MAP_W + x] = TERRAIN.LAND;
    expect(reachNorth(g)).toBe(true); // 철조망 구멍 → 개성 도달(뚫림) — 회귀 방지 문서화
  });
});

// 🌊 전라도 서해안 자연화 — 각진 사각 돌출 스무딩. 실제 섬은 훼손 금지(오너 피드백 #3).
describe('해안 스무딩 (전북 서해안) — 각진 돌출 제거 + 실섬 보존', () => {
  const grid = decodeMap();
  const isLandFam = (x, y) => {
    const c = grid[y * MAP_W + x];
    return c === TERRAIN.LAND || c === TERRAIN.MOUNTAIN || c === TERRAIN.PEAK || c === TERRAIN.PLAIN;
  };
  const bigLandSea = (x, y) => { // land-family 이웃 아님 = 바다측(수계/펜스 없는 서해안 기준)
    let n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || !isLandFam(nx, ny)) n++;
    }
    return n;
  };

  it('실제 섬 보존 — 강화도·영종도·제주·쓰시마는 여전히 육지', () => {
    for (const [lon, lat] of [[126.44, 37.74], [126.53, 37.49], [126.53, 33.38], [129.30, 34.40]]) {
      const p = project(lon, lat);
      expect(isLandFam(p.x, p.y)).toBe(true);
    }
  });

  it('전북 서해안 bbox 안 대륙(큰 육지)에 ≥3면이 바다인 고립 돌출(각진 사각)이 남아있지 않다', () => {
    // land-family 연결요소 크기 라벨링 — 소도서(작은 성분)는 스무딩 보호 대상이므로 제외.
    const comp = new Int32Array(grid.length).fill(-1); const size = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      if (!isLandFam(x, y) || comp[i] !== -1) continue;
      const id = size.length; let cnt = 0; const st = [i]; comp[i] = id;
      while (st.length) {
        const idx = st.pop(); cnt++; const cx = idx % MAP_W, cy = (idx / MAP_W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
          const ni = ny * MAP_W + nx;
          if (isLandFam(nx, ny) && comp[ni] === -1) { comp[ni] = id; st.push(ni); }
        }
      }
      size.push(cnt);
    }
    let spikes = 0;
    for (let y = 242; y <= 280; y++) for (let x = 48; x <= 68; x++) {
      if (isLandFam(x, y) && size[comp[y * MAP_W + x]] >= 300 && bigLandSea(x, y) >= 3) spikes++;
    }
    expect(spikes).toBe(0);
  });
});
