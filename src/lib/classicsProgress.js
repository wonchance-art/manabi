// 고전 명작 카드의 읽은 자리(DISCOVER-CLASSICS-PROGRESS-001, 목업 8차 ② 오너 「키우니까 훨씬 좋다. 2 ㄱㄱ」 2026-10-23 KST) — 순수 모듈.
//
// 책 카드: 위 오른쪽 가름끈 리본에 퍼센트, 공개 장을 다 읽으면 아래 오른쪽 ✓(둘은 함께 서지 않는다). 그림 카드: 그 장을 다 읽으면 ✓만.
// 정본은 로그인 사용자의 reading_progress(장 = 자료 하나)다. 새 기록 · 새 표를 만들지 않는다 — 뷰어가 이미 쓰는 줄을 읽기만 한다.
// 퍼센트는 장 단위다: 다 읽은 장 + 읽는 중인 장(last_token_idx > 0)은 반 장. 장마다 토큰 수를 서가가 모르므로 쪽 위치 대신 장 수로 센다.
// 반올림해 1–99%(연 적만 있으면 1%, 마지막 장을 덜 읽었으면 99%) — 100%는 ✓가 맡는다.
// 책의 장은 발행 기록 관리자(첫 장 자료의 소유자)의 공개 장만 센다 — 같은 book key를 단 남의 공개 글을 읽은 기록은 이 책이 아니다(fail closed).

const safeId = (value) => (Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null);
const time = (row) => { const at = Date.parse(row?.updated_at || ''); return Number.isFinite(at) ? at : 0; };

/**
 * @param {{ books: {key, chapters, firstMaterialId}[], art: {key, materialId}[],
 *   progress: {material_id, is_completed, last_token_idx, updated_at}[],
 *   materials: {id, owner_id, visibility, key, order}[] }} input
 *   progress = 이 사용자의 reading_progress 줄, materials = 그 줄 · 책 첫 장의 자료(책 key · 장 순서 · 소유자).
 * @returns {{ resume: Record<string, {materialId: number, percent?: number, done?: true}>, read: Set<string> }}
 */
export function classicsProgress({ books = [], art = [], progress = [], materials = [] } = {}) {
  const rowOf = new Map();
  for (const row of progress || []) {
    const id = safeId(row?.material_id);
    if (id) rowOf.set(id, row);
  }
  const read = new Set(art.filter((item) => rowOf.get(item.materialId)?.is_completed === true).map((item) => item.key));

  const materialOf = new Map((materials || []).filter((m) => safeId(m?.id)).map((m) => [Number(m.id), m]));
  const chaptersOf = new Map();
  for (const [id, row] of rowOf) {
    const m = materialOf.get(id);
    const order = Number(m?.order);
    if (!m || m.visibility !== 'public' || typeof m.key !== 'string' || !Number.isSafeInteger(order) || order < 1) continue;
    if (!chaptersOf.has(m.key)) chaptersOf.set(m.key, []);
    chaptersOf.get(m.key).push({ id, order, owner: m.owner_id, row });
  }

  const resume = {};
  for (const book of books) {
    const owner = materialOf.get(book.firstMaterialId)?.owner_id;
    const total = Number(book.chapters);
    if (!owner || !Number.isSafeInteger(total) || total < 1) continue;
    const byOrder = new Map();
    for (const chapter of chaptersOf.get(book.key) || []) {
      if (chapter.owner !== owner || chapter.order > total) continue;
      const seen = byOrder.get(chapter.order);
      if (!seen || time(chapter.row) > time(seen.row)) byOrder.set(chapter.order, chapter);
    }
    if (!byOrder.size) continue;
    const chapters = [...byOrder.values()];
    const done = chapters.filter((chapter) => chapter.row.is_completed === true).length;
    const going = chapters.filter((chapter) => chapter.row.is_completed !== true && Number(chapter.row.last_token_idx) > 0).length;
    // 이어 열 자리 = 가장 최근에 손댄 장(다 읽은 장이면 뷰어 끝의 다음 장 안내로 이어진다).
    const latest = chapters.reduce((a, b) => (time(b.row) > time(a.row) ? b : a));
    if (done >= total) { resume[book.key] = { materialId: latest.id, done: true }; continue; }
    const percent = Math.min(99, Math.max(1, Math.round(((done + going / 2) / total) * 100)));
    resume[book.key] = { materialId: latest.id, percent };
  }
  return { resume, read };
}
