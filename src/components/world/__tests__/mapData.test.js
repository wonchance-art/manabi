import { describe, it, expect } from 'vitest';
import {
  MAP_W, MAP_H, GEO, project, unproject, POI, MAP_RLE, decodeMap, isLandAt,
  TERRAIN, isBlocked,
} from '../mapData.js';

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
});
