// 정본 문학책 관리자 게시 계획(AOZORA-P0-2) — 저장·네트워크 없는 순수 함수. API(/api/admin/literature)가 쓴다.
//
// 게시 = 빌드 산출물(chapters.json)의 장마다 공개 reading_materials 행 하나(기존 책 등록과 같은 모양: status 'pending',
// metadata.book). 관리자가 뷰어에서 장마다 「이 챕터 분석하기」로 1회 분석하면 저자 루비 잠금이 분석 말미에 걸린다.
// 멱등 기준은 **book key + 장 순서**다: 이미 있는 장은 다시 넣지 않고, 정본과 원문이 다른 장·같은 순서가 둘인 장·
// 정본에 없는 순서가 하나라도 있으면 아무것도 넣지 않는다(덮어쓰기·삭제 없음 — 사람이 확인한다).
import { aozoraRightsPublishable } from './aozoraRights.js';
import { countAppliedRubyLocks } from './aozoraRuby.js';

export const LITERATURE_PUBLISH_STATE = Object.freeze({
  UNPUBLISHED: 'unpublished',
  PARTIAL: 'partial',
  PUBLISHED: 'published',
  CONFLICT: 'conflict',
});

/** 빌드 산출물이 여전히 공개 가능한 기록인가 — 게시 직전에 한 번 더(fail-closed). */
export function literatureBookPublishable(book) {
  const literature = book?.chapters?.[0]?.metadata?.literature;
  return Array.isArray(book?.chapters) && book.chapters.length > 0 && literature?.provider === 'aozora'
    && aozoraRightsPublishable(literature.rights, literature.attribution, literature);
}

/** 기존 행(같은 소유자·같은 book key) → 게시 계획. rows: [{id, raw_text, order}] */
export function planLiteraturePublish(book, rows = []) {
  const byOrder = new Map(book.chapters.map((chapter) => [chapter.order, chapter]));
  const seen = new Map();
  const conflicts = [];
  for (const row of rows) {
    const order = Number(row.order);
    const chapter = byOrder.get(order);
    if (!chapter) { conflicts.push({ order: row.order ?? null, id: row.id, reason: 'unknown-order' }); continue; }
    if (seen.has(order)) { conflicts.push({ order, id: row.id, reason: 'duplicate-order' }); continue; }
    seen.set(order, row);
    if (row.raw_text !== chapter.rawText) conflicts.push({ order, id: row.id, reason: 'text-differs' });
  }
  const insert = book.chapters.filter((chapter) => !seen.has(chapter.order)).map((chapter) => chapter.order);
  const state = conflicts.length ? LITERATURE_PUBLISH_STATE.CONFLICT
    : insert.length === 0 ? LITERATURE_PUBLISH_STATE.PUBLISHED
      : seen.size === 0 ? LITERATURE_PUBLISH_STATE.UNPUBLISHED : LITERATURE_PUBLISH_STATE.PARTIAL;
  return { state, insert, conflicts };
}

/** 넣을 장 → reading_materials 행(기존 책 등록과 같은 모양 + metadata.literature). */
export function literaturePublishRows(book, orders, ownerId, now = new Date().toISOString()) {
  const wanted = new Set(orders);
  return book.chapters.filter((chapter) => wanted.has(chapter.order)).map((chapter) => ({
    title: chapter.materialTitle,
    raw_text: chapter.rawText,
    visibility: 'public',
    owner_id: ownerId,
    processed_json: {
      sequence: [], dictionary: {}, last_idx: -1,
      status: 'pending', // 미분석 — 관리자가 뷰어에서 장마다 1회 분석한다
      metadata: { ...chapter.metadata, updated_at: now },
    },
  }));
}

/** 관리자 화면용 요약 — 권리 근거·장별 게시/분석 상태. 원문은 싣지 않는다. */
export function literatureBookSummary(book, rows = []) {
  const literature = book.chapters[0].metadata.literature;
  const plan = planLiteraturePublish(book, rows);
  const rowByOrder = new Map();
  for (const row of rows) if (!rowByOrder.has(Number(row.order))) rowByOrder.set(Number(row.order), row);
  return {
    key: book.book.key,
    title: book.book.title,
    author: book.book.author,
    level: book.book.level,
    total: book.book.total,
    publishable: literatureBookPublishable(book),
    rights: {
      basis: literature.rights.basis,
      reviewedBy: literature.rights.reviewedBy,
      reviewedAt: literature.rights.reviewedAt,
      reviewedJurisdictions: literature.rights.reviewedJurisdictions,
      evidenceUrl: literature.rights.evidenceUrl,
      publishedYear: literature.publishedYear,
      authorDeathYear: literature.authorDeathYear,
      charset: literature.charset,
    },
    plan,
    chapters: book.chapters.map((chapter) => {
      const row = rowByOrder.get(chapter.order);
      return {
        order: chapter.order,
        title: chapter.title,
        chars: chapter.rawText.length,
        rubyLocks: chapter.metadata.literature.rubyLocks.length,
        material: row ? { id: row.id, status: row.status || 'idle', visibility: row.visibility } : null,
      };
    }),
  };
}

/** 분석된 장의 저자 루비 적용 수(적용률 검수) — rows: [{order, processed_json}] */
export function literatureRubyCoverage(book, rows = []) {
  const byOrder = new Map(rows.map((row) => [Number(row.order), row]));
  return book.chapters.map((chapter) => {
    const json = byOrder.get(chapter.order)?.processed_json;
    const analyzed = Array.isArray(json?.sequence) && json.sequence.length > 0;
    return { order: chapter.order, rubyLocks: chapter.metadata.literature.rubyLocks.length, applied: analyzed ? countAppliedRubyLocks(json) : null };
  });
}
