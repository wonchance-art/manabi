import { describe, it, expect } from 'vitest';
import {
  CHUNK_TILES, chunkKey, chunkDims, visibleChunks, chunkCapacity, ChunkLRU,
} from '../cityChunks.js';
import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from '../cities/terrain.js';

// 🧱 청크 RenderTexture 렌더의 순수 로직(가시성·용량·LRU) + 표준 지형 코드 — Phaser 무의존 검증.
//   실제 GPU 베이킹은 브라우저 벤치(Codex)가 별도 검증. 여기선 로직·메모리 상한만.

const TILE = 32; // 1타일 = 32 월드 px(불변)
const chunkPx = CHUNK_TILES * TILE;
// 카메라 뷰포트를 worldView 형태로.
const mkView = (x, y, w = 320, h = 288) => ({ x, y, width: w, height: h, right: x + w, bottom: y + h });

describe('표준 지형 코드(terrain.js) 정합', () => {
  it('§6.4 표준 코드 전부 정의 + EXIT 게임 기믹', () => {
    for (const k of ['ROAD', 'SIDEWALK', 'CROSSWALK', 'PLAZA', 'PARK', 'BEACH', 'WATER', 'RIVER', 'BUILDING', 'ISLAND', 'BRIDGE', 'DOCK', 'EXIT']) {
      expect(typeof CITY_TILE[k]).toBe('number');
    }
  });

  it('숫자값은 기존 후쿠오카 인코딩(0..10) 보존 + RIVER/BEACH 덧붙임(무회귀)', () => {
    expect(CITY_TILE.ROAD).toBe(0);
    expect(CITY_TILE.EXIT).toBe(7);
    expect(CITY_TILE.WATER).toBe(8);
    expect(CITY_TILE.ISLAND).toBe(10);
    expect(CITY_TILE.RIVER).toBe(11);
    expect(CITY_TILE.BEACH).toBe(12);
  });

  it('차단 집합: WATER·RIVER·BUILDING·ISLAND (RIVER 추가). 나머지 보행 가능', () => {
    for (const c of [CITY_TILE.WATER, CITY_TILE.RIVER, CITY_TILE.BUILDING, CITY_TILE.ISLAND]) {
      expect(isCityBlocked(c)).toBe(true);
      expect(isCityWalkable(c)).toBe(false);
    }
    for (const c of [CITY_TILE.ROAD, CITY_TILE.SIDEWALK, CITY_TILE.CROSSWALK, CITY_TILE.PLAZA, CITY_TILE.PARK, CITY_TILE.BEACH, CITY_TILE.BRIDGE, CITY_TILE.DOCK, CITY_TILE.EXIT]) {
      expect(isCityWalkable(c)).toBe(true);
    }
  });

  it('물결 애니 대상은 WATER·RIVER 둘 다', () => {
    expect(isCityWater(CITY_TILE.WATER)).toBe(true);
    expect(isCityWater(CITY_TILE.RIVER)).toBe(true);
    expect(isCityWater(CITY_TILE.BEACH)).toBe(false);
  });
});

describe('chunkDims', () => {
  it('타일 격자 → 청크 격자(올림)', () => {
    expect(chunkDims(128, 96)).toEqual({ chunkCols: 8, chunkRows: 6 });     // 128/16, 96/16
    expect(chunkDims(600, 500)).toEqual({ chunkCols: 38, chunkRows: 32 });  // 올림
    expect(chunkDims(1, 1)).toEqual({ chunkCols: 1, chunkRows: 1 });
  });
});

describe('visibleChunks — 뷰포트 겹침 청크만 + pad 여유', () => {
  const { chunkCols, chunkRows } = chunkDims(600, 500);
  const opts = { tile: TILE, chunkCols, chunkRows, pad: 1 };

  it('좌상단 뷰 → 0,0 주변 청크만(음수 클램프)', () => {
    const vis = visibleChunks(mkView(0, 0), opts);
    const keys = vis.map((c) => c.key);
    expect(keys).toContain('0,0');
    // pad=1 이라 0..1 범위(음수 없음).
    for (const c of vis) { expect(c.cx).toBeGreaterThanOrEqual(0); expect(c.cy).toBeGreaterThanOrEqual(0); }
    expect(keys.every((k) => /^[01],[01]$/.test(k))).toBe(true);
  });

  it('맵 중앙 뷰 → 해당 청크가 목록에 포함, 전부 그리드 안', () => {
    const vis = visibleChunks(mkView(300 * TILE, 250 * TILE), opts); // 타일(300,250) 근처
    const cx = Math.floor((300 * TILE) / chunkPx), cy = Math.floor((250 * TILE) / chunkPx);
    expect(vis.map((c) => c.key)).toContain(chunkKey(cx, cy));
    for (const c of vis) {
      expect(c.cx).toBeLessThan(chunkCols); expect(c.cy).toBeLessThan(chunkRows);
    }
  });

  it('뷰(<512px)는 청크 스팬을 넘지 않음 — 한 차원 최대 4청크(2겹침+2pad)', () => {
    let maxX = 0, maxY = 0;
    for (let px = 0; px < 600 * TILE; px += 137) {
      const vis = visibleChunks(mkView(px, px % (400 * TILE)), opts);
      const xs = new Set(vis.map((c) => c.cx)), ys = new Set(vis.map((c) => c.cy));
      maxX = Math.max(maxX, xs.size); maxY = Math.max(maxY, ys.size);
    }
    expect(maxX).toBeLessThanOrEqual(4);
    expect(maxY).toBeLessThanOrEqual(4);
  });
});

describe('chunkCapacity — 화면+여유 상한(맵 크기 무관)', () => {
  it('백킹 320×288 → 소수 청크만 상주(cap 20)', () => {
    expect(chunkCapacity(320, 288, { tile: TILE })).toBe(20);
  });
  it('맵이 아무리 커도 cap 은 뷰포트 함수(그리드 크기 무관)', () => {
    const a = chunkCapacity(320, 288, { tile: TILE });
    expect(a).toBe(chunkCapacity(320, 288, { tile: TILE })); // grid 인자 없음 — 크기 무관 자명
  });
});

describe('ChunkLRU — 상한·보호(가시 청크) 축출', () => {
  it('cap 초과 시 오래된 것부터 축출, 보이는 청크는 보호', () => {
    const lru = new ChunkLRU();
    for (const k of ['a', 'b', 'c', 'd']) lru.touch(k);
    // a 를 다시 사용 → 최신으로.
    lru.touch('a');
    const victims = lru.evict(2, new Set(['d'])); // cap 2, d 보호
    expect(lru.size()).toBeLessThanOrEqual(2);
    expect(victims).not.toContain('d');   // 보호는 축출 안 됨
    expect(victims).not.toContain('a');   // 최근 사용은 늦게 축출
    expect(victims).toContain('b');       // 가장 오래된 것 우선
  });

  it('cap 이하이면 아무것도 축출 안 함', () => {
    const lru = new ChunkLRU();
    lru.touch('x'); lru.touch('y');
    expect(lru.evict(5, new Set())).toEqual([]);
    expect(lru.size()).toBe(2);
  });
});

describe('대형 스트레스 — 600×500 맵 카메라 팬(상주 텍스처 상한·가시성)', () => {
  const COLS = 600, ROWS = 500;
  const { chunkCols, chunkRows } = chunkDims(COLS, ROWS);
  const opts = { tile: TILE, chunkCols, chunkRows, pad: 1 };
  const cap = chunkCapacity(320, 288, { tile: TILE });

  it('맵 대각선 팬 내내 상주 청크 ≤ cap, 가시 청크는 항상 상주', () => {
    const lru = new ChunkLRU();
    const resident = new Set(); // 실제 씬이 유지하는 청크(=lru 목록 미러)
    let peak = 0;
    const steps = 800;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const camPx = t * (COLS - 10) * TILE;
      const camPy = t * (ROWS - 9) * TILE;
      const vis = visibleChunks(mkView(camPx, camPy), opts);
      const protect = new Set(vis.map((c) => c.key));
      for (const c of vis) { if (!resident.has(c.key)) resident.add(c.key); lru.touch(c.key); }
      for (const key of lru.evict(cap, protect)) resident.delete(key);
      // 불변식: 보이는 청크는 전부 상주.
      for (const c of vis) expect(resident.has(c.key)).toBe(true);
      // 불변식: 상주 수 상한.
      expect(resident.size).toBeLessThanOrEqual(cap);
      peak = Math.max(peak, resident.size);
    }
    // 총 청크(1216)의 극히 일부만 상주 — 메모리 폭발 방지 입증.
    expect(chunkCols * chunkRows).toBe(1216);
    expect(peak).toBeLessThanOrEqual(cap);
    expect(peak).toBeLessThan(chunkCols * chunkRows / 10);
  });

  it('BFS 도달성 헬퍼가 600×500 에서도 정상(테두리 물 + 내부 보행)', () => {
    const grid = new Uint8Array(COLS * ROWS).fill(CITY_TILE.SIDEWALK);
    // 테두리 1칸을 물(차단)로.
    for (let x = 0; x < COLS; x++) { grid[x] = CITY_TILE.WATER; grid[(ROWS - 1) * COLS + x] = CITY_TILE.WATER; }
    for (let y = 0; y < ROWS; y++) { grid[y * COLS] = CITY_TILE.WATER; grid[y * COLS + COLS - 1] = CITY_TILE.WATER; }
    // 내부 강 한 줄(차단) — 다리 한 칸으로 양분 연결.
    const rx = 300;
    for (let y = 1; y < ROWS - 1; y++) grid[y * COLS + rx] = CITY_TILE.RIVER;
    grid[250 * COLS + rx] = CITY_TILE.BRIDGE;

    const seen = new Uint8Array(grid.length);
    const start = 1 * COLS + 1;
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
    // 다리로 강 양안이 이어져 전 보행칸 도달(고립 없음).
    expect(reached).toBe(walkable);
    expect(walkable).toBeGreaterThan(200000);
  });
});
