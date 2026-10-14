/**
 * 관리자 정본 책 게시 API 공용 처리(AOZORA-P0-2 · P0-3 · P0-4 「분석 → 검수·편집 → 공개」 · ART-P0-3).
 * 정본 문학책(/api/admin/literature)과 「그림 한 장 읽기」 큐레이션 책(/api/admin/art-books)이 같은 책·장 모양이라
 * 한 처리를 같이 쓴다 — 라우트마다 다른 것은 정본 책 목록(getBooks)과 게시 불가 안내 문구뿐이다.
 *
 *  GET                → { books: 요약[] }  근거(rights | provenance) · 단계(stage) · 장별 게시/분석 상태(원문 없음)
 *  GET ?ruby=<key>    → { key, coverage }   장별 저자 루비 적용 수 · 검수 힌트 수 · 남은 「뜻 확인 필요」 수
 *  POST { action:'prepare', key }
 *                     → 정본 장 중 아직 없는 장만 **비공개** reading_materials로 넣는다(book key + 장 순서 멱등).
 *                       원문이 다른 장·중복 장이 있으면 409로 아무것도 넣지 않는다(덮어쓰기·삭제 없음).
 *                       분석은 관리자 화면이 장마다 뷰어와 같은 경로로 한다(이 API는 분석하지 않는다).
 *  POST { action:'review', key, order }
 *                     → 그 장의 「검수 완료」(AOZORA-P0-4). 분석 완료이고 남은 「뜻 확인 필요」가 0일 때만
 *                       metadata.literatureReview {reviewedAt, viewerRevision}을 쓴다(그 revision일 때만 — 동시 재분석이면 409).
 *  POST { action:'release', key }
 *                     → 모든 장이 있고 모두 분석·검수 완료일 때만 비공개 장을 공개로 바꾼다. 아니면 409.
 *
 * 원문은 요청이 아니라 리포 정본(getBooks)에서만 온다 — 클라이언트가 장 내용을 보낼 수 없다.
 * 인증: requireAdmin()(쿠키 세션 + profiles.role='admin'). 쓰기는 사용자 세션 클라이언트로 해 RLS(소유자 쓰기)가
 * 최종 방어다. service_role 키는 쓰지 않는다. 행 소유자는 게시한 관리자 본인이다.
 * 라우트 파일은 runtime·dynamic을 직접 export하고(Next가 라우트 모듈의 리터럴 export만 읽는다) GET·POST만 이 처리로 넘긴다.
 */
import { requireAdmin } from '@/lib/supabaseServer';
import {
  literatureBookPublishable, literatureBookSummary, literaturePublishRows, literatureReviewRemaining, literatureRubyCoverage,
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

const DEFAULT_NOT_PUBLISHABLE = '권리 기록이 공개 기준을 통과하지 못한 책이에요.';

/**
 * 게시 API 처리 만들기 — getBooks: () => 정본 책 배열(literaturePublish.js가 받는 모양). 요청마다 부른다.
 * @param {{notPublishableError?: string}} [options] 게시 가능 판정(literatureBookPublishable)에 걸렸을 때 422 안내
 * @returns {{GET: (request: Request) => Promise<Response>, POST: (request: Request) => Promise<Response>}}
 */
export function createBookPublishHandlers(getBooks, { notPublishableError = DEFAULT_NOT_PUBLISHABLE } = {}) {
  const findBook = (key) => getBooks().find((book) => book.book.key === key) || null;

  async function GET(request) {
    const auth = await requireAdmin();
    if (auth.error) return respond({ error: auth.error }, auth.status);
    const { supabase, user } = auth;
    const rubyKey = new URL(request.url).searchParams.get('ruby');
    try {
      if (rubyKey != null) {
        const book = findBook(rubyKey);
        if (!book) return respond({ error: '정본 책을 찾지 못했어요.' }, 404);
        const rows = await publishedRows(supabase, user.id, [rubyKey], `id, key:${KEY_PATH}, order:${ORDER_PATH}, processed_json`);
        return respond({ key: rubyKey, coverage: literatureRubyCoverage(book, rows) });
      }
      const books = getBooks();
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
    if (!body || typeof body !== 'object' || !['prepare', 'review', 'release'].includes(body.action) || typeof body.key !== 'string') {
      return respond({ error: '작업할 책을 선택해 주세요.' }, 400);
    }
    const book = findBook(body.key);
    if (!book) return respond({ error: '정본 책을 찾지 못했어요.' }, 404);
    if (!literatureBookPublishable(book)) return respond({ error: notPublishableError }, 422);

    const { supabase, user } = auth;
    if (body.action === 'review') return reviewChapter(supabase, user, book, body.order);
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
      if (release.ids.length === 0) return respond({ ok: true, released: [] });
      const { data, error } = await supabase.from('reading_materials').update({ visibility: 'public' })
        .in('id', release.ids).eq('owner_id', user.id).eq('visibility', 'private').select('id');
      if (error) return respond({ error: '책을 공개하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
      return respond({ ok: true, released: data || [] });
    }

    const plan = planLiteraturePublish(book, rows);
    if (plan.conflicts.length) {
      return respond({ error: '이미 준비된 장 중 정본과 다른 장이 있어 넣지 않았어요. 자료 관리에서 확인해 주세요.', plan }, 409);
    }
    if (plan.insert.length === 0) return respond({ ok: true, inserted: [], plan });

    const { data, error } = await supabase.from('reading_materials')
      .insert(literaturePublishRows(book, plan.insert, user.id))
      .select('id, order:processed_json->metadata->book->>order');
    if (error) return respond({ error: '책을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
    return respond({ ok: true, inserted: data || [], plan });
  }

  return { GET, POST };
}

/** 장 「검수 완료」 — 분석 완료 · 남은 「뜻 확인 필요」 0 · 그 분석 revision에 기록(재분석하면 다시 검수). */
async function reviewChapter(supabase, user, book, order) {
  if (!Number.isInteger(order) || !book.chapters.some((chapter) => chapter.order === order)) {
    return respond({ error: '검수할 장을 선택해 주세요.' }, 400);
  }
  const { data, error } = await supabase.from('reading_materials')
    .select(`id, raw_text, order:${ORDER_PATH}, processed_json`)
    .eq('owner_id', user.id).eq(KEY_PATH, book.book.key).eq(ORDER_PATH, String(order));
  if (error) return respond({ error: '장 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
  if (!data || data.length !== 1) return respond({ error: '준비한 장을 찾지 못했어요. 게시 상태를 확인해 주세요.' }, 409);
  const row = data[0];
  const json = row.processed_json || {};
  const revision = json.metadata?.viewerRevision;
  if (json.status !== 'completed' || typeof revision !== 'string') return respond({ error: '분석을 마친 장만 검수 완료로 표시할 수 있어요.' }, 409);
  if (row.raw_text !== book.chapters.find((chapter) => chapter.order === order).rawText) {
    return respond({ error: '정본과 원문이 다른 장이에요. 자료 관리에서 확인해 주세요.' }, 409);
  }
  const remaining = literatureReviewRemaining(json);
  if (remaining > 0) return respond({ error: `「뜻 확인 필요」가 ${remaining}개 남아 있어요. 모두 확인한 뒤 검수 완료로 표시해 주세요.`, remaining }, 409);
  const next = { ...json, metadata: { ...json.metadata, literatureReview: { reviewedAt: new Date().toISOString(), viewerRevision: revision } } };
  const { data: saved, error: saveError } = await supabase.from('reading_materials').update({ processed_json: next })
    .eq('id', row.id).eq('owner_id', user.id).eq('processed_json->metadata->>viewerRevision', revision).select('id');
  if (saveError) return respond({ error: '검수 완료를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
  if (!saved?.length) return respond({ error: '그사이 장이 다시 분석됐어요. 다시 확인해 주세요.' }, 409);
  return respond({ ok: true, reviewed: { id: row.id, order } });
}
