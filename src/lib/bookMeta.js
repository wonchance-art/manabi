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
 * 책 묶음 식별 — (소유자 + 책 key). 공개 metadata는 누구나 꾸밀 수 있으므로 key만으로
 * 묶으면 남의 행이 같은 key를 달아 다른 사람의 책(정본 문학책 포함)에 끼어든다.
 * 뷰어의 형제 장 정의(ViewerPage: key + 같은 owner_id)와 같은 경계다.
 * owner_id가 없는 행(로컬·테스트)은 빈 소유자로 한 묶음이 된다.
 */
export const bookGroupKey = (ownerId, key) => `${ownerId ?? ''}\u0000${key}`;

/**
 * 자료 목록을 책 그룹과 단독 자료로 분리.
 * @returns {{ books: Array<{key, ownerId, groupKey, title, chapters: object[]}>, singles: object[] }}
 *   key는 책 key(정본 대조표·「다음 과 적기」 링크용), groupKey는 소유자까지 포함한 묶음 식별(React key).
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
    const ownerId = m?.owner_id ?? null;
    const groupKey = bookGroupKey(ownerId, book.key);
    if (!map.has(groupKey)) map.set(groupKey, { key: book.key, ownerId, groupKey, title: book.title, chapters: [] });
    map.get(groupKey).chapters.push({ ...m, _bookOrder: book.order });
  }
  const books = [...map.values()].map((b) => ({
    ...b,
    chapters: b.chapters.sort((a, x) => a._bookOrder - x._bookOrder),
  }));
  return { books, singles };
}
