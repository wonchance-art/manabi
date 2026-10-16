// 정본 문학책 관리자 게시 계획(AOZORA-P0-2 · P0-3) — 저장·네트워크 없는 순수 함수. API(/api/admin/literature)가 쓴다.
// 「그림 한 장 읽기」 큐레이션 책(ART-P0-3, /api/admin/art-books)도 같은 책·장 모양이라 같은 계획을 쓴다 — 출처(provider)에 따라
// 달라지는 것은 게시 가능 판정(literatureBookPublishable)과 요약의 근거 칸(rights | provenance)뿐이다.
//
// 게시 흐름(P0-3·P0-4, 오너 확정 2026-10-14 「분석 → 검수·편집 → 공개」): 준비 → 분석 → 검수 → 공개.
//   ① 준비: 빌드 산출물(chapters.json)의 장마다 **비공개** reading_materials 행 하나(기존 책 등록과 같은 모양: status 'pending',
//      metadata.book). 산책·공용 목록에 아직 보이지 않는다.
//   ② 분석: 관리자 화면이 장마다 뷰어와 같은 경로(runPreservedReanalysis)로 한 번 분석한다 — 분석 결과는 행 하나에 저장돼
//      모든 사용자가 같이 쓰고, 단어 상태(저장·아는 단어·복습)만 사람마다 따로 얹힌다. 저자 루비 잠금은 분석 말미에 걸린다.
//   ③ 검수: 관리자가 장을 열어 「뜻 확인 필요」(검수 힌트·문맥 뜻 제안 — literatureReviewHints)를 모두 확정하고 단어 경계를
//      맞춘 뒤 장마다 「검수 완료」 — metadata.literatureReview {reviewedAt, viewerRevision}. 재분석하면 revision이 바뀌어 다시 검수.
//   ④ 공개: 모든 장이 분석·검수 완료일 때만 visibility를 public으로 바꾼다 — 사용자는 「분석 전」·「검수 전」 장을 보지 않는다.
// 멱등 기준은 **book key + 장 순서**다: 이미 있는 장은 다시 넣지 않고, 정본과 원문이 다른 장·같은 순서가 둘인 장·
// 정본에 없는 순서가 하나라도 있으면 아무것도 넣거나 공개하지 않는다(덮어쓰기·삭제 없음 — 사람이 확인한다).
import { aozoraRightsPublishable } from './aozoraRights.js';
import { countAppliedRubyLocks, indexAozoraTokenSpans } from './aozoraRuby.js';
import { ART_BOOK_PROVIDER, artBookPublishable } from './artBook.js';
import { ART_TEXT_LICENSE_LABEL } from './artCatalog.js';
import { countAttachedReviewHints, reviewHintCoverage } from './literatureReviewHints.js';
import { senseReviewItems } from './viewerSenseReview.js';

/** 분석 전이거나 검수 기록이 한 번도 없는데 공개된 장 — 사용자에게 「분석 전」·「검수 전」 장이 보이는 상태. rows: {visibility, status, review} */
export const literatureExposedRows = (rows = []) => rows.filter((row) => row.visibility === 'public' && (row.status !== 'completed' || !row.review));

/** 장 검수 완료인가 — 검수 때의 분석 revision이 지금과 같아야 한다(재분석하면 다시 검수). rows: {review, revision} */
export const chapterReviewed = (row) => typeof row?.review?.viewerRevision === 'string' && row.review.viewerRevision === row.revision;

/** 이 장에 남은 「뜻 확인 필요」 수(검수 힌트 표식 + 경계 후보) — 0이어야 검수 완료를 받는다. */
export const literatureReviewRemaining = (json) => senseReviewItems(json, 'Japanese').length;

export const LITERATURE_PUBLISH_STATE = Object.freeze({
  UNPUBLISHED: 'unpublished',
  PARTIAL: 'partial',
  PUBLISHED: 'published',
  CONFLICT: 'conflict',
});

/**
 * 빌드 산출물이 여전히 공개 가능한 기록인가 — 게시 직전에 한 번 더(fail-closed). 출처별 판정:
 * 'aozora' → 권리 기록(aozoraRightsPublishable) · 'art' → 카탈로그 대조(artBookPublishable) · 그 밖 → 불가.
 */
export function literatureBookPublishable(book) {
  if (!Array.isArray(book?.chapters) || book.chapters.length === 0) return false;
  const literature = book.chapters[0]?.metadata?.literature;
  switch (literature?.provider) {
    case 'aozora': return aozoraRightsPublishable(literature.rights, literature.attribution, literature);
    case ART_BOOK_PROVIDER: return artBookPublishable(book);
    default: return false;
  }
}

/** 저자 루비 잠금 — 큐레이션 책(현대 해설문)처럼 키가 없는 장은 빈 목록. */
const rubyLocksOf = (chapter) => chapter.metadata.literature?.rubyLocks ?? [];

/** 아오조라 권리 근거 — 관리자 화면 「권리 근거」 칸. */
function aozoraRightsSummary(literature) {
  return {
    basis: literature.rights.basis,
    reviewedBy: literature.rights.reviewedBy,
    reviewedAt: literature.rights.reviewedAt,
    reviewedJurisdictions: literature.rights.reviewedJurisdictions,
    evidenceUrl: literature.rights.evidenceUrl,
    publishedYear: literature.publishedYear,
    authorDeathYear: literature.authorDeathYear,
    charset: literature.charset,
  };
}

/** 큐레이션 책 출처 — 관리자 화면 「출처·라이선스」 칸. 장마다 해설 출처·라이선스 이름·원문 링크·크레딧(원문은 싣지 않는다). */
function artProvenanceSummary(book) {
  const literature = book.chapters[0].metadata.literature;
  return {
    provider: ART_BOOK_PROVIDER,
    curation: literature.curation,
    chapters: book.chapters.map((chapter) => {
      const item = chapter.metadata.literature;
      return { order: chapter.order, source: item.source, license: ART_TEXT_LICENSE_LABEL[item.license] ?? null, sourceUrl: item.sourceUrl, credit: item.credit };
    }),
  };
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

/** 키 순서와 무관한 JSON 비교(jsonb는 키 순서를 바꿔 돌려준다). */
const stableJson = (value) => (Array.isArray(value) ? `[${value.map(stableJson).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
    : JSON.stringify(value));
const withoutStamp = ({ updated_at: _stamp, ...metadata } = {}) => metadata;

/**
 * 준비만 하고 아직 분석하지 않은 장의 metadata 맞추기(AOZORA-P1-12) — 준비 뒤에 정본 빌드가 늘린 칸(단어 경계 미리 묶기
 * viewerBoundaries · 검수 힌트 reviewHints 등)이 그 장의 분석 요청에 실리게 한다. 운영 실측(2026-10-16 KST): 10-14·15에 준비한
 * 6편 40장에 경계 기록·힌트가 없어 분석해도 미리 묶기가 걸리지 않을 상태였다.
 * 대상은 status 'pending'(분석 전 — 단어·교정·경계 기록이 아직 없다)이고 원문이 정본과 같은 장뿐 — 분석한 장은 건드리지 않는다
 * (거기 쌓인 경계 정산·교정을 덮지 않게, 바꾸려면 다시 분석). rows: [{id, order, raw_text, status, metadata}]
 * @returns {Array<{id, order, metadata}>} 정본 metadata로 바꿀 장(같으면 빈 배열 — 멱등)
 */
export function planLiteratureMetadataSync(book, rows = [], now = new Date().toISOString()) {
  const byOrder = new Map(book.chapters.map((chapter) => [chapter.order, chapter]));
  return rows.flatMap((row) => {
    const chapter = byOrder.get(Number(row.order));
    if (!chapter || row.status !== 'pending' || row.raw_text !== chapter.rawText) return [];
    if (stableJson(withoutStamp(row.metadata)) === stableJson(withoutStamp(chapter.metadata))) return [];
    return [{ id: row.id, order: chapter.order, metadata: { ...chapter.metadata, updated_at: now } }];
  });
}

/**
 * 공개 계획 — 모든 장이 있고(충돌 없음) 모두 분석·검수 완료일 때만, 아직 비공개인 장들을 공개한다.
 * rows: [{id, raw_text, order, status, visibility, review, revision}]
 * @returns {{ok: boolean, reason: null|'conflict'|'incomplete'|'not-analyzed'|'not-reviewed', ids: Array}}
 */
export function planLiteratureRelease(book, rows = []) {
  const plan = planLiteraturePublish(book, rows);
  if (plan.conflicts.length) return { ok: false, reason: 'conflict', ids: [] };
  if (plan.insert.length) return { ok: false, reason: 'incomplete', ids: [] };
  if (rows.some((row) => row.status !== 'completed')) return { ok: false, reason: 'not-analyzed', ids: [] };
  if (rows.some((row) => !chapterReviewed(row))) return { ok: false, reason: 'not-reviewed', ids: [] };
  return { ok: true, reason: null, ids: rows.filter((row) => row.visibility !== 'public').map((row) => row.id) };
}

/**
 * 작품 단계 — unpublished(행 없음) · preparing(준비·분석 중) · reviewing(분석 완료·검수 중) · ready(검수 완료·비공개)
 * · released(전 장 공개) · conflict. 이미 공개된 책은 재분석으로 검수가 낡아도 released로 둔다(공개 상태가 사실).
 * exposed: 분석 전이거나 한 번도 검수하지 않은 장이 공개돼 있다 — 「비공개 준비 → 분석·검수 → 공개」(P0-3) 이전 방식으로
 * 바로 공개된 장(운영 실측 2026-10-16 KST 5편 15장, 비공개로 되돌림). 화면은 경고만 하고 분석·공개를 이어 가지 않는다 —
 * 공개 상태로 분석하면 검수 없이 「공개됨」이 되므로(사람이 비공개로 돌린 뒤 정상 흐름으로).
 */
export function literatureStage(book, rows = []) {
  const plan = planLiteraturePublish(book, rows);
  if (plan.conflicts.length) return 'conflict';
  if (rows.length === 0) return 'unpublished';
  if (literatureExposedRows(rows).length) return 'exposed';
  if (plan.insert.length || rows.some((row) => row.status !== 'completed')) return 'preparing';
  if (rows.every((row) => row.visibility === 'public')) return 'released';
  return rows.every(chapterReviewed) ? 'ready' : 'reviewing';
}

/**
 * 일괄 게시·분석 대상(설계 docs/literature-pipeline.md §4.1) — 관리자 요약(literatureBookSummary) 중 게시할 수 있고,
 * 아직 준비·분석이 남았고(unpublished·preparing), 정본과 다른 장(충돌)이 없는 작품. 검수·공개 단계는 넣지 않는다(사람 확인 지점).
 */
export function literatureBatchTargets(summaries = []) {
  return summaries.filter((book) => book.publishable && book.plan.conflicts.length === 0
    && (book.stage === 'unpublished' || book.stage === 'preparing'));
}

/**
 * 분석 이어하기 대상(AOZORA-P1-10) — 모든 장을 준비했는데 분석이 멈춘 작품(화면을 닫았거나 멈춤). 관리자 화면이 열릴 때 한 번
 * 자동으로 이어 분석한다. 아직 넣지 않은 장이 있는 작품(준비 자체가 끊김)은 넣지 않는다 — 쓰기(prepare)는 사람이 누를 때만.
 */
export function literatureResumeTargets(summaries = []) {
  return literatureBatchTargets(summaries).filter((book) => book.stage === 'preparing' && book.plan.insert.length === 0);
}

/**
 * 관리자 화면용 요약 — 근거·단계·장별 상태. 원문은 싣지 않는다.
 * 근거 칸은 출처별로 하나: 아오조라는 rights(권리 근거), 큐레이션 책은 provenance(장별 출처·라이선스·원문 링크·크레딧).
 */
export function literatureBookSummary(book, rows = []) {
  const literature = book.chapters[0].metadata.literature;
  const provider = literature?.provider;
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
    ...(provider === 'aozora' ? { rights: aozoraRightsSummary(literature) } : {}),
    ...(provider === ART_BOOK_PROVIDER ? { provenance: artProvenanceSummary(book) } : {}),
    plan,
    stage: literatureStage(book, rows),
    chapters: book.chapters.map((chapter) => {
      const row = rowByOrder.get(chapter.order);
      return {
        order: chapter.order,
        title: chapter.title,
        chars: chapter.rawText.length,
        rubyLocks: rubyLocksOf(chapter).length,
        material: row ? { id: row.id, status: row.status || 'idle', visibility: row.visibility, reviewed: chapterReviewed(row) } : null,
      };
    }),
  };
}

/**
 * 장별 검수 보조 — 저자 루비 적용 수(적용률), 검수 힌트 수·붙은 수, 남은 「뜻 확인 필요」 수. 분석 전 장은 null.
 * rows: [{order, processed_json}]
 */
/**
 * 분석 뒤에도 쪼개진 저자 루비 낱말(AOZORA-P1-10) — 2자 이상 루비 기준이 분석 토큰 둘 이상에 걸친 자리. 빌드가 미리 실은
 * 「한 단어로 묶기」 기록으로도 못 묶은 곳(양 끝이 분석기 토큰 안쪽)이라 검수자가 뷰어에서 직접 묶거나 그대로 둘지 정한다.
 * 고유명사(苦沙弥 → 苦|沙弥)가 형태소로 갈리면 뜻·저자 루비가 모두 어긋나므로 「검수 완료」 전에 보여 준다.
 * 토큰을 원문 자리에 잇지 못하면(원문과 다른 분석) null — 셀 수 없음을 0으로 속이지 않는다.
 */
export function literatureBoundaryIssues(chapter, json) {
  if (!Array.isArray(json?.sequence) || !json.sequence.length) return null;
  const locks = rubyLocksOf(chapter).filter((lock) => lock.base.length >= 2).sort((a, b) => a.start - b.start);
  if (!locks.length) return { count: 0, words: [] };
  let spans;
  try {
    spans = indexAozoraTokenSpans(chapter.rawText, json.sequence, json.dictionary || {}).filter((span) => span.text !== '\n');
  } catch {
    return null;
  }
  const split = [];
  let k = 0;
  for (const lock of locks) {
    while (k < spans.length && spans[k].end <= lock.start) k += 1;
    let covering = 0;
    for (let j = k; j < spans.length && spans[j].start < lock.end; j += 1) covering += 1;
    if (covering >= 2) split.push(lock.base);
  }
  return { count: split.length, words: [...new Set(split)] };
}

export function literatureRubyCoverage(book, rows = []) {
  const byOrder = new Map(rows.map((row) => [Number(row.order), row]));
  return book.chapters.map((chapter) => {
    const json = byOrder.get(chapter.order)?.processed_json;
    const analyzed = Array.isArray(json?.sequence) && json.sequence.length > 0;
    return {
      order: chapter.order,
      rubyLocks: rubyLocksOf(chapter).length,
      applied: analyzed ? countAppliedRubyLocks(json) : null,
      hints: (chapter.metadata.literature?.reviewHints || []).length,
      hintsAttached: analyzed ? countAttachedReviewHints(json) : null,
      // 분석기 경계 때문에 붙지 못한 제안의 글자 — 검수자가 그 자리를 직접 본다(분석 전·힌트 없음은 []).
      hintsMissed: analyzed ? reviewHintCoverage(chapter.rawText, json, chapter.metadata.literature?.reviewHints).missed : [],
      remaining: analyzed ? literatureReviewRemaining(json) : null,
      ...boundaryFields(analyzed ? literatureBoundaryIssues(chapter, json) : null),
    };
  });
}

/** 검수 칸: boundary = 쪼개진 루비 낱말 자리 수(분석 전·셀 수 없음은 null) · boundaryWords = 그 낱말(중복 없이 앞 5개). */
const boundaryFields = (issues) => ({ boundary: issues ? issues.count : null, boundaryWords: issues ? issues.words.slice(0, 5) : [] });
