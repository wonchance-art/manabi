// 책 묶음 메타(오너 승인 P1) — 스키마 무변경: processed_json.metadata.book = {key, title,
// order, total}로 챕터 자료들을 한 권으로 묶는다. 챕터=자료 단위는 유지(진도·FSRS·교정·
// 재분석 전부 기존 설계 그대로)하고 위에 껍데기만 씌우는 구조.

/** 책 식별키 — 등록 시 1회 생성, 같은 책의 모든 챕터가 공유. */
export function makeBookKey() {
  return `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** metadata에서 book 메타 추출(형식 검증) — 아니면 null. */
export function getBook(metadata) {
  const b = metadata?.book;
  if (!b || typeof b !== 'object') return null;
  if (typeof b.key !== 'string' || !b.key) return null;
  const order = Number(b.order);
  if (!Number.isFinite(order)) return null;
  return {
    key: b.key,
    title: typeof b.title === 'string' ? b.title : '',
    order,
    total: Number.isFinite(Number(b.total)) ? Number(b.total) : null,
  };
}

/** 자료의 분석 상태 — 'pending'(미분석)을 포함한 단일 판정. */
export function analysisStateOf(material) {
  return material?.processed_json?.status || 'idle';
}

/**
 * 자료 목록을 책 그룹과 단독 자료로 분리.
 * @returns {{ books: Array<{key, title, chapters: object[]}>, singles: object[] }}
 *   books는 첫 등장 순, chapters는 book.order 오름차순.
 */
export function groupByBook(materials) {
  const map = new Map();
  const singles = [];
  for (const m of materials || []) {
    const book = getBook(m?.processed_json?.metadata);
    if (!book) {
      singles.push(m);
      continue;
    }
    if (!map.has(book.key)) map.set(book.key, { key: book.key, title: book.title, chapters: [] });
    map.get(book.key).chapters.push({ ...m, _bookOrder: book.order });
  }
  const books = [...map.values()].map((b) => ({
    ...b,
    chapters: b.chapters.sort((a, x) => a._bookOrder - x._bookOrder),
  }));
  return { books, singles };
}
