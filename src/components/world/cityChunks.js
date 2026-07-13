// 🧱 도시 정밀맵 — **청크 RenderTexture 렌더**의 순수 로직(docs/world-city-maps.md §6.3).
//
// 지형 grid 를 N×N 타일 청크로 나눠 각 청크를 오프스크린 RenderTexture 1장에 한 번 굽고,
// **카메라 뷰포트에 겹치는 청크만** 표시한다. 여기 함수들은 Phaser 무의존(순수)라
// vitest(node)에서 가시성 계산·상한(LRU)·용량을 대형 맵(600²+)까지 그대로 검증한다.
//
// 스케일: 1타일 = 32 월드 px(TILE). 청크 = CHUNK_TILES 타일 정사각 → 16×32 = 512 월드 px.
//   1000²+ 맵도 상주 텍스처를 화면+여유로 제한(LRU)해 프레임·메모리 비용이 일정하다.

export const CHUNK_TILES = 16; // 청크 한 변 타일 수(= 512 월드 px @ TILE 32)

export function chunkKey(cx, cy) { return `${cx},${cy}`; }

// 그리드(타일 cols×rows) → 청크 격자 크기.
export function chunkDims(cols, rows, chunkTiles = CHUNK_TILES) {
  return {
    chunkCols: Math.max(1, Math.ceil(cols / chunkTiles)),
    chunkRows: Math.max(1, Math.ceil(rows / chunkTiles)),
  };
}

// 카메라 뷰포트(월드 px 사각)에 겹치는 청크 목록 — pad 청크만큼 경계 여유(스크롤 튐 방지).
//   view: { x, y, right, bottom } (Phaser cameras.main.worldView 형태). 그리드 밖은 클램프.
export function visibleChunks(view, {
  tile, chunkTiles = CHUNK_TILES, chunkCols, chunkRows, pad = 1,
}) {
  const chunkPx = tile * chunkTiles;
  let cx0 = Math.floor(view.x / chunkPx) - pad;
  let cy0 = Math.floor(view.y / chunkPx) - pad;
  // right/bottom 은 배타적 경계라 미세 감산 후 floor(경계에 딱 걸친 빈 청크 제외).
  let cx1 = Math.floor((view.right - 1e-4) / chunkPx) + pad;
  let cy1 = Math.floor((view.bottom - 1e-4) / chunkPx) + pad;
  cx0 = Math.max(0, cx0); cy0 = Math.max(0, cy0);
  cx1 = Math.min(chunkCols - 1, cx1); cy1 = Math.min(chunkRows - 1, cy1);
  const out = [];
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) out.push({ cx, cy, key: chunkKey(cx, cy) });
  }
  return out;
}

// 뷰포트+pad 가 걸칠 수 있는 청크 최대 개수 + margin → LRU 상한.
//   화면이 커도(백킹 320×288 고정) 소수의 청크만 상주 → 맵 크기 무관하게 텍스처 수 제한.
export function chunkCapacity(viewW, viewH, {
  tile, chunkTiles = CHUNK_TILES, pad = 1, margin = 4,
} = {}) {
  const chunkPx = tile * chunkTiles;
  const spanX = Math.ceil(viewW / chunkPx) + 1 + pad * 2;
  const spanY = Math.ceil(viewH / chunkPx) + 1 + pad * 2;
  return spanX * spanY + margin;
}

// 청크 텍스처 LRU — 순수(Phaser 무의존). 상주 키의 최근 사용 순서만 관리.
//   씬은 evict() 가 돌려준 키의 실제 RenderTexture 를 destroy 해 메모리를 회수한다.
export class ChunkLRU {
  constructor() {
    this.used = new Map(); // key → tick(최근 사용 시각). Map 은 삽입 순서 보존.
    this.tick = 0;
  }

  has(key) { return this.used.has(key); }

  size() { return this.used.size; }

  // 사용 표시(최근으로 갱신) — 존재하지 않으면 신규 등록.
  touch(key) { this.used.set(key, ++this.tick); }

  delete(key) { this.used.delete(key); }

  // 상주 수를 cap 이하로 줄이는 축출 대상 키(가장 오래된 것부터). protect(보이는 청크)는 제외.
  //   protect 는 Set 또는 iterable. 반환 키들은 내부 목록에서도 제거된다.
  evict(cap, protect = new Set()) {
    const prot = protect instanceof Set ? protect : new Set(protect);
    const victims = [];
    if (this.used.size <= cap) return victims;
    // 오래된 순 정렬(tick 오름차순).
    const order = [...this.used.entries()].sort((a, b) => a[1] - b[1]);
    for (const [key] of order) {
      if (this.used.size <= cap) break;
      if (prot.has(key)) continue;
      this.used.delete(key);
      victims.push(key);
    }
    return victims;
  }
}
