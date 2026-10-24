/**
 * 관리자 정본 책 게시 API 공용 처리(AOZORA-P0-2 · P0-3 · P0-4 「분석 → 검수·편집 → 공개」 · ART-P0-3).
 * 정본 문학책(/api/admin/literature)과 「그림 한 장 읽기」 큐레이션 책(/api/admin/art-books)이 같은 책·장 모양이라
 * 한 처리를 같이 쓴다 — 라우트마다 다른 것은 정본 책 목록(getBooks)과 게시 불가 안내 문구뿐이다.
 *
 *  GET                → { books: 요약[] }  근거(rights | provenance) · 단계(stage) · 장별 게시/분석 상태(원문 없음)
 *  GET ?ruby=<key>    → { key, coverage }   장별 저자 루비 적용 수 · 검수 힌트 수 · 남은 「뜻 확인 필요」 수 · 쪼개진 루비 낱말
 *  POST { action:'prepare', key }
 *                     → 정본 장 중 아직 없는 장만 **비공개** reading_materials로 넣는다(book key + 장 순서 멱등).
 *                       원문이 다른 장·중복 장이 있으면 409로 아무것도 넣지 않는다(덮어쓰기·삭제 없음).
 *                       분석은 관리자 화면이 장마다 뷰어와 같은 경로로 한다(이 API는 분석하지 않는다).
 *                       이미 준비한 분석 전(pending) 장은 metadata를 정본에 맞춘다(경계 기록·검수 힌트 — AOZORA-P1-12, {synced}).
 *  POST { action:'review', key, order, acceptBoundaries? }
 *                     → 그 장의 「검수 완료」(AOZORA-P0-4). 분석 완료이고 남은 「뜻 확인 필요」가 0일 때만
 *                       metadata.literatureReview {reviewedAt, viewerRevision}을 쓴다(그 revision일 때만 — 동시 재분석이면 409).
 *                       쪼개진 저자 루비 낱말(AOZORA-P1-10)이 남은 장은 acceptBoundaries: true(검수자 확인)일 때만 받는다.
 *  POST { action:'reviewMany', key, orders }
 *                     → 묶음 검수 — 장마다 같은 판정을 다시 하되 쪼개진 낱말이 하나라도 있으면 넘긴다. {reviewed, skipped}.
 *  POST { action:'release', key }
 *                     → 모든 장이 있고 모두 분석·검수 완료일 때만 발행 기록(canonical_book_releases)을 남기고 비공개 장을 공개로 바꾼다.
 *                       아니면 409. 다른 관리자가 먼저 발행한 key도 409(공개하지 않는다).
 *
 * 원문은 요청이 아니라 리포 정본(getBooks)에서만 온다 — 클라이언트가 장 내용을 보낼 수 없다.
 * 인증: requireAdmin()(쿠키 세션 + profiles.role='admin'). 쓰기는 사용자 세션 클라이언트로 해 RLS(소유자 쓰기)가
 * 최종 방어다. service_role 키는 쓰지 않는다. 행 소유자는 게시한 관리자 본인이다.
 * 라우트 파일은 runtime·dynamic을 직접 export하고(Next가 라우트 모듈의 리터럴 export만 읽는다) GET·POST만 이 처리로 넘긴다.
 */
import { requireAdmin } from '@/lib/supabaseServer';
import {
  chapterReviewed, literatureBookPublishable, literatureBoundaryIssues, planLiteratureMetadataSync, literatureBookSummary, literaturePublishRows, literatureReviewRemaining, literatureRubyCoverage,
  planLiteraturePublish, planLiteratureRelease,
} from '@/lib/literaturePublish';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const respond = (body, status = 200) => Response.json(body, { status, headers: NO_STORE });
const KEY_PATH = 'processed_json->metadata->book->>key';
const ORDER_PATH = 'processed_json->metadata->book->>order';
const ROW_COLUMNS = `id, raw_text, visibility, status:processed_json->>status, key:${KEY_PATH}, order:${ORDER_PATH}, `
  + 'review:processed_json->metadata->literatureReview, revision:processed_json->metadata->>viewerRevision';

async function publishedRows(supabase, ownerId, keys, columns = ROW_COLUMNS) {
  if (keys.length === 0) return [];
  const { data, error } = await supabase.from('reading_materials').select(columns).eq('owner_id', ownerId).in(KEY_PATH, keys);
  if (error) throw error;
  return data || [];
}

/**
 * 정본 발행 기록 남기기(CANON-RELEASE-001, supabase/migrations/20261022081000_canonical_book_releases.sql) — 관리자 본인 이름으로만
 * 쓸 수 있다(RLS). 이미 있으면 그대로 두고(on conflict do nothing), 기록의 소유자가 이 관리자인지 다시 읽어 확인한다.
 * @returns {Promise<{error?: string, status?: number}>}
 */
async function recordCanonicalRelease(supabase, ownerId, bookKey) {
  const releases = supabase.from('canonical_book_releases');
  const { error } = await releases.upsert({ book_key: bookKey, owner_id: ownerId }, { onConflict: 'book_key', ignoreDuplicates: true });
  if (error) return { error: '발행 기록을 남기지 못해 공개하지 않았어요. 잠시 후 다시 시도해 주세요.', status: 503 };
  const { data, error: readError } = await supabase.from('canonical_book_releases').select('owner_id').eq('book_key', bookKey).maybeSingle();
  if (readError || !data) return { error: '발행 기록을 확인하지 못해 공개하지 않았어요. 잠시 후 다시 시도해 주세요.', status: 503 };
  if (data.owner_id !== ownerId) return { error: '다른 관리자 계정이 이미 정본으로 발행한 책이에요. 그 계정에서 관리해 주세요.', status: 409 };
  return {};
}

const DEFAULT_NOT_PUBLISHABLE = '권리 기록이 공개 기준을 통과하지 못한 책이에요.';
/** 정본 책 목록 자체를 만들지 못했을 때(깨진 카탈로그 등 — getBooks가 throw) 목록 조회 안내. DB 장애(503)와 구분한다. */
const BOOK_SOURCE_BROKEN = '정본 책 목록을 만들지 못했어요. 리포의 원본 기록을 확인해 주세요.';

/**
 * 게시 API 처리 만들기 — getBooks: () => 정본 책 배열(literaturePublish.js가 받는 모양). 요청마다 부른다.
 * getBooks가 throw하면(깨진 정본 — 예: 카탈로그 계약 위반으로 createArtBook 실패) 아무것도 읽거나 쓰지 않는다:
 * POST는 422 + notPublishableError, GET은 500 + 원본 확인 안내(DB 장애 503과 구분). throw하지 않으면 동작은 그대로다.
 * @param {{notPublishableError?: string}} [options] 게시 가능 판정(literatureBookPublishable)에 걸렸을 때 422 안내
 * @returns {{GET: (request: Request) => Promise<Response>, POST: (request: Request) => Promise<Response>}}
 */
export function createBookPublishHandlers(getBooks, { notPublishableError = DEFAULT_NOT_PUBLISHABLE } = {}) {
  /** 정본 책 목록 — 만들지 못하면 null(throw를 라우트 밖으로 내보내지 않는다). */
  const loadBooks = () => {
    try { return getBooks(); } catch { return null; }
  };

  async function GET(request) {
    const auth = await requireAdmin();
    if (auth.error) return respond({ error: auth.error }, auth.status);
    const { supabase, user } = auth;
    const rubyKey = new URL(request.url).searchParams.get('ruby');
    const books = loadBooks();
    if (!books) return respond({ error: BOOK_SOURCE_BROKEN }, 500);
    try {
      if (rubyKey != null) {
        const book = books.find((item) => item.book.key === rubyKey);
        if (!book) return respond({ error: '정본 책을 찾지 못했어요.' }, 404);
        const rows = await publishedRows(supabase, user.id, [rubyKey], `id, key:${KEY_PATH}, order:${ORDER_PATH}, processed_json`);
        return respond({ key: rubyKey, coverage: literatureRubyCoverage(book, rows) });
      }
      const rows = await publishedRows(supabase, user.id, books.map((book) => book.book.key));
      return respond({ books: books.map((book) => literatureBookSummary(book, rows.filter((row) => row.key === book.book.key))) });
    } catch {
      return respond({ error: '게시 상태를 확인하지 못했어요. 잠시 후 다시 불러와 주세요.' }, 503);
    }
  }

  async function POST(request) {
    const auth = await requireAdmin();
    if (auth.error) return respond({ error: auth.error }, auth.status);
    let body;
    try { body = await request.json(); } catch { return respond({ error: '입력 형식을 확인해 주세요.' }, 400); }
    if (!body || typeof body !== 'object' || !['prepare', 'review', 'reviewMany', 'release'].includes(body.action) || typeof body.key !== 'string') {
      return respond({ error: '작업할 책을 선택해 주세요.' }, 400);
    }
    const books = loadBooks();
    if (!books) return respond({ error: notPublishableError }, 422);
    const book = books.find((item) => item.book.key === body.key);
    if (!book) return respond({ error: '정본 책을 찾지 못했어요.' }, 404);
    if (!literatureBookPublishable(book)) return respond({ error: notPublishableError }, 422);

    const { supabase, user } = auth;
    if (body.action === 'review') return reviewChapter(supabase, user, book, body.order, body.acceptBoundaries);
    if (body.action === 'reviewMany') return reviewChapters(supabase, user, book, body.orders);
    if (body.action === 'prepare') {
      const { status, body: result } = await prepareCanonicalBook(supabase, user.id, book);
      return respond(result, status);
    }
    let rows;
    try {
      rows = await publishedRows(supabase, user.id, [book.book.key]);
    } catch {
      return respond({ error: '게시 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
    }

    if (body.action === 'release') {
      const release = planLiteratureRelease(book, rows);
      if (!release.ok) {
        const error = release.reason === 'not-analyzed' ? '아직 분석하지 않은 장이 있어 공개하지 않았어요. 분석을 마친 뒤 공개해 주세요.'
          : release.reason === 'not-reviewed' ? '아직 검수하지 않은 장이 있어 공개하지 않았어요. 장마다 검수를 마친 뒤 공개해 주세요.'
          : release.reason === 'incomplete' ? '준비하지 않은 장이 있어 공개하지 않았어요.'
            : '정본과 다른 장이 있어 공개하지 않았어요. 자료 관리에서 확인해 주세요.';
        return respond({ error, release }, 409);
      }
      // 발행 기록(CANON-RELEASE-001)을 장 공개보다 먼저 — 기록이 있어야 산책 「고전 명작」 · 정본 표지가 이 책을 정본으로 본다.
      // 이미 모두 공개한 책(ids 0)도 기록이 없으면 여기서 채운다(멱등). 다른 관리자가 먼저 발행한 key면 공개하지 않는다.
      const recorded = await recordCanonicalRelease(supabase, user.id, book.book.key);
      if (recorded.error) return respond({ error: recorded.error }, recorded.status);
      if (release.ids.length === 0) return respond({ ok: true, released: [] });
      const { data, error } = await supabase.from('reading_materials').update({ visibility: 'public' })
        .in('id', release.ids).eq('owner_id', user.id).eq('visibility', 'private').select('id');
      if (error) return respond({ error: '책을 공개하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
      return respond({ ok: true, released: data || [] });
    }

    return respond({ error: '작업할 책을 선택해 주세요.' }, 400);
  }

  return { GET, POST };
}

/**
 * 「게시」(준비) 한 권 → {status, body}. 관리자 화면(사용자 세션 · RLS 소유자 쓰기)과 서버 분석 작업(CANON-SERVER-ANALYSIS-001 —
 * service role · 작업을 시작한 관리자 ownerId)이 같이 쓴다. 정본 장 중 없는 장만 비공개로 넣고, 분석 전 장은 정본 metadata에 맞춘다(멱등).
 */
export async function prepareCanonicalBook(supabase, ownerId, book) {
  let rows;
  try {
    rows = await publishedRows(supabase, ownerId, [book.book.key]);
  } catch {
    return { status: 503, body: { error: '게시 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' } };
  }
  const plan = planLiteraturePublish(book, rows);
  if (plan.conflicts.length) {
    return { status: 409, body: { error: '이미 준비된 장 중 정본과 다른 장이 있어 넣지 않았어요. 자료 관리에서 확인해 주세요.', plan } };
  }
  const synced = await syncPendingMetadata(supabase, { id: ownerId }, book, rows);
  if (synced.error) return { status: 503, body: { error: '준비한 장을 정본에 맞추지 못했어요. 잠시 후 다시 시도해 주세요.' } };
  if (plan.insert.length === 0) return { status: 200, body: { ok: true, inserted: [], synced: synced.ids, plan } };

  const { data, error } = await supabase.from('reading_materials')
    .insert(literaturePublishRows(book, plan.insert, ownerId))
    .select('id, order:processed_json->metadata->book->>order');
  if (error) return { status: 503, body: { error: '책을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.' } };
  return { status: 200, body: { ok: true, inserted: data || [], synced: synced.ids, plan } };
}

/**
 * 분석 전 장의 metadata를 정본에 맞춘다(AOZORA-P1-12, planLiteratureMetadataSync) — 준비 뒤 빌드가 늘린 경계 기록·검수 힌트가
 * 분석 요청에 실리게. status 'pending'인 장만, 그 상태일 때만 쓴다(그사이 분석이 시작됐으면 건드리지 않는다). → {ids} | {error}
 */
async function syncPendingMetadata(supabase, user, book, rows) {
  const pending = rows.filter((row) => row.status === 'pending');
  if (pending.length === 0) return { ids: [] };
  const { data, error } = await supabase.from('reading_materials').select(`id, order:${ORDER_PATH}, raw_text, processed_json`)
    .eq('owner_id', user.id).in('id', pending.map((row) => row.id));
  if (error) return { error };
  const full = (data || []).map((row) => ({ ...row, status: row.processed_json?.status, metadata: row.processed_json?.metadata }));
  const ids = [];
  for (const { id, metadata } of planLiteratureMetadataSync(book, full)) {
    const current = full.find((row) => row.id === id).processed_json;
    const { data: saved, error: saveError } = await supabase.from('reading_materials').update({ processed_json: { ...current, metadata } })
      .eq('id', id).eq('owner_id', user.id).eq('processed_json->>status', 'pending').select('id');
    if (saveError) return { error: saveError };
    if (saved?.length) ids.push(id);
  }
  return { ids };
}

/**
 * 장 하나 「검수 완료」 판정·저장 → {status, body}. 분석 완료 · 정본 원문 · 남은 「뜻 확인 필요」 0 · 쪼개진 저자 루비 낱말
 * (literatureBoundaryIssues — 苦沙弥 → 苦|沙弥 같은 자리, AOZORA-P1-10)은 검수자가 확인했다고 밝힐 때만(acceptBoundaries) ·
 * 그 분석 revision에 기록(재분석하면 다시 검수). strict(묶음 검수)면 경계를 셀 수 없거나 한 곳이라도 있는 장은 넘기지 않는다.
 */
async function reviewOne(supabase, user, book, order, { acceptBoundaries = false, strict = false } = {}) {
  const fail = (status, body) => ({ status, body });
  if (!Number.isInteger(order) || !book.chapters.some((chapter) => chapter.order === order)) {
    return fail(400, { error: '검수할 장을 선택해 주세요.' });
  }
  const chapter = book.chapters.find((item) => item.order === order);
  const { data, error } = await supabase.from('reading_materials')
    .select(`id, raw_text, order:${ORDER_PATH}, processed_json`)
    .eq('owner_id', user.id).eq(KEY_PATH, book.book.key).eq(ORDER_PATH, String(order));
  if (error) return fail(503, { error: '장 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  if (!data || data.length !== 1) return fail(409, { error: '준비한 장을 찾지 못했어요. 게시 상태를 확인해 주세요.' });
  const row = data[0];
  const json = row.processed_json || {};
  const revision = json.metadata?.viewerRevision;
  if (json.status !== 'completed' || typeof revision !== 'string') return fail(409, { error: '분석을 마친 장만 검수 완료로 표시할 수 있어요.' });
  if (row.raw_text !== chapter.rawText) return fail(409, { error: '정본과 원문이 다른 장이에요. 자료 관리에서 확인해 주세요.' });
  const remaining = literatureReviewRemaining(json);
  if (remaining > 0) return fail(409, { error: `「뜻 확인 필요」가 ${remaining}개 남아 있어요. 모두 확인한 뒤 검수 완료로 표시해 주세요.`, remaining });
  const issues = literatureBoundaryIssues(chapter, json);
  if (strict && !issues) return fail(409, { error: '단어 경계를 확인하지 못한 장이에요. 장을 열어 확인해 주세요.' });
  if (issues?.count > 0 && (strict || !acceptBoundaries)) {
    const words = issues.words.slice(0, 5).join('·');
    return fail(409, { error: `쪼개진 낱말이 ${issues.count}곳 있어요(${words}). 뷰어에서 묶거나 그대로 둘지 확인해 주세요.`, boundary: issues.count, boundaryWords: issues.words.slice(0, 5) });
  }
  const next = { ...json, metadata: { ...json.metadata, literatureReview: { reviewedAt: new Date().toISOString(), viewerRevision: revision } } };
  const { data: saved, error: saveError } = await supabase.from('reading_materials').update({ processed_json: next })
    .eq('id', row.id).eq('owner_id', user.id).eq('processed_json->metadata->>viewerRevision', revision).select('id');
  if (saveError) return fail(503, { error: '검수 완료를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  if (!saved?.length) return fail(409, { error: '그사이 장이 다시 분석됐어요. 다시 확인해 주세요.' });
  return { status: 200, body: { ok: true, reviewed: { id: row.id, order } } };
}

/** 장 「검수 완료」 — reviewOne 그대로. */
async function reviewChapter(supabase, user, book, order, acceptBoundaries) {
  const { status, body } = await reviewOne(supabase, user, book, order, { acceptBoundaries: acceptBoundaries === true });
  return respond(body, status);
}

/**
 * 묶음 검수(「N장 검수 완료」) — 사람이 누른 장 목록을 장마다 reviewOne(strict)으로 **다시** 판정한다. 화면이 낡았거나
 * 그사이 바뀐 장은 건너뛰고 이유를 돌려준다(부분 성공 — 저장한 장은 저장된 채). 이미 검수 완료인 장은 다시 쓰지 않는다.
 */
async function reviewChapters(supabase, user, book, orders) {
  if (!Array.isArray(orders) || orders.length === 0 || orders.length > book.chapters.length
    || new Set(orders).size !== orders.length || !orders.every((order) => book.chapters.some((chapter) => chapter.order === order))) {
    return respond({ error: '검수할 장을 선택해 주세요.' }, 400);
  }
  let rows;
  try {
    rows = await publishedRows(supabase, user.id, [book.book.key]);
  } catch {
    return respond({ error: '게시 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
  }
  const reviewed = [], skipped = [];
  for (const order of orders) {
    const row = rows.find((item) => Number(item.order) === order);
    if (row && chapterReviewed(row)) { skipped.push({ order, error: '이미 검수 완료인 장이에요.' }); continue; }
    const { status, body } = await reviewOne(supabase, user, book, order, { strict: true });
    if (status === 200) reviewed.push(body.reviewed);
    else skipped.push({ order, error: body.error });
  }
  return respond({ ok: true, reviewed, skipped });
}
