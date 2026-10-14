// 정본 문학책 관리자 게시 계획(AOZORA-P0-2 · P0-3) — 저장·네트워크 없는 순수 함수. API(/api/admin/literature)가 쓴다.
//
// 게시 흐름(P0-3, 오너 확정 2026-10-14 「분석을 마치고 배포」): 준비 → 분석 → 공개.
//   ① 준비: 빌드 산출물(chapters.json)의 장마다 **비공개** reading_materials 행 하나(기존 책 등록과 같은 모양: status 'pending',
//      metadata.book). 산책·공용 목록에 아직 보이지 않는다.
//   ② 분석: 관리자 화면이 장마다 뷰어와 같은 경로(runPreservedReanalysis)로 한 번 분석한다 — 분석 결과는 행 하나에 저장돼
//      모든 사용자가 같이 쓰고, 단어 상태(저장·아는 단어·복습)만 사람마다 따로 얹힌다. 저자 루비 잠금은 분석 말미에 걸린다.
//   ③ 공개: 모든 장이 분석 완료일 때만 visibility를 public으로 바꾼다 — 사용자는 「분석 전」 장을 보지 않는다.
// 멱등 기준은 **book key + 장 순서**다: 이미 있는 장은 다시 넣지 않고, 정본과 원문이 다른 장·같은 순서가 둘인 장·
// 정본에 없는 순서가 하나라도 있으면 아무것도 넣거나 공개하지 않는다(덮어쓰기·삭제 없음 — 사람이 확인한다).
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

/** 넣을 장 → reading_materials 행(기존 책 등록과 같은 모양 + metadata.literature). 공개는 분석이 끝난 뒤 따로(planLiteratureRelease). */
export function literaturePublishRows(book, orders, ownerId, now = new Date().toISOString()) {
  const wanted = new Set(orders);
  return book.chapters.filter((chapter) => wanted.has(chapter.order)).map((chapter) => ({
    title: chapter.materialTitle,
    raw_text: chapter.rawText,
    visibility: 'private',
    owner_id: ownerId,
    processed_json: {
      sequence: [], dictionary: {}, last_idx: -1,
      status: 'pending', // 미분석 — 관리자 화면이 장마다 1회 분석한 뒤 공개한다
      metadata: { ...chapter.metadata, updated_at: now },
    },
  }));
}

/**
 * 공개 계획 — 모든 장이 있고(충돌 없음) 모두 분석 완료일 때만, 아직 비공개인 장들을 공개한다.
 * rows: [{id, raw_text, order, status, visibility}]
 * @returns {{ok: boolean, reason: null|'conflict'|'incomplete'|'not-analyzed', ids: Array}}
 */
export function planLiteratureRelease(book, rows = []) {
  const plan = planLiteraturePublish(book, rows);
  if (plan.conflicts.length) return { ok: false, reason: 'conflict', ids: [] };
  if (plan.insert.length) return { ok: false, reason: 'incomplete', ids: [] };
  if (rows.some((row) => row.status !== 'completed')) return { ok: false, reason: 'not-analyzed', ids: [] };
  return { ok: true, reason: null, ids: rows.filter((row) => row.visibility !== 'public').map((row) => row.id) };
}

/** 작품 단계 — unpublished(행 없음) · preparing(준비·분석 중) · ready(분석 완료·비공개) · released(전 장 공개) · conflict */
export function literatureStage(book, rows = []) {
  const plan = planLiteraturePublish(book, rows);
  if (plan.conflicts.length) return 'conflict';
  if (rows.length === 0) return 'unpublished';
  if (plan.insert.length || rows.some((row) => row.status !== 'completed')) return 'preparing';
  return rows.every((row) => row.visibility === 'public') ? 'released' : 'ready';
}

/** 관리자 화면용 요약 — 권리 근거·단계·장별 상태. 원문은 싣지 않는다. */
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
    stage: literatureStage(book, rows),
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
