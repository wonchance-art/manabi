/**
 * 관리자 정본 문학책 게시 API(AOZORA-P0-2).
 *
 *  GET                → { books: 요약[] }  권리 근거 · 장별 게시/분석 상태 · 게시 계획(원문 없음)
 *  GET ?ruby=<key>    → { key, coverage }   분석된 장의 저자 루비 적용 수(적용률 검수)
 *  POST { action:'publish', key }
 *                     → 정본 장 중 아직 없는 장만 공개 reading_materials로 넣는다(book key + 장 순서 멱등).
 *                       원문이 다른 장·중복 장이 있으면 409로 아무것도 넣지 않는다(덮어쓰기·삭제 없음).
 *
 * 원문은 요청이 아니라 리포 빌드 산출물(index.generated.js)에서만 온다 — 클라이언트가 장 내용을 보낼 수 없다.
 * 인증: requireAdmin()(쿠키 세션 + profiles.role='admin'). 쓰기는 사용자 세션 클라이언트로 해 RLS(소유자 쓰기)가
 * 최종 방어다. service_role 키는 쓰지 않는다. 행 소유자는 게시한 관리자 본인이다.
 */
import { requireAdmin } from '@/lib/supabaseServer';
import { LITERATURE_BOOKS } from '@/content/literature/aozora/index.generated.js';
import {
  literatureBookPublishable, literatureBookSummary, literaturePublishRows, literatureRubyCoverage, planLiteraturePublish,
} from '@/lib/literaturePublish';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const respond = (body, status = 200) => Response.json(body, { status, headers: NO_STORE });
const KEY_PATH = 'processed_json->metadata->book->>key';
const ROW_COLUMNS = `id, raw_text, visibility, status:processed_json->>status, key:${KEY_PATH}, order:processed_json->metadata->book->>order`;

const findBook = (key) => LITERATURE_BOOKS.find((book) => book.book.key === key) || null;

async function publishedRows(supabase, ownerId, keys, columns = ROW_COLUMNS) {
  if (keys.length === 0) return [];
  const { data, error } = await supabase.from('reading_materials').select(columns).eq('owner_id', ownerId).in(KEY_PATH, keys);
  if (error) throw error;
  return data || [];
}

export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) return respond({ error: auth.error }, auth.status);
  const { supabase, user } = auth;
  const rubyKey = new URL(request.url).searchParams.get('ruby');
  try {
    if (rubyKey != null) {
      const book = findBook(rubyKey);
      if (!book) return respond({ error: '정본 책을 찾지 못했어요.' }, 404);
      const rows = await publishedRows(supabase, user.id, [rubyKey], `id, key:${KEY_PATH}, order:processed_json->metadata->book->>order, processed_json`);
      return respond({ key: rubyKey, coverage: literatureRubyCoverage(book, rows) });
    }
    const rows = await publishedRows(supabase, user.id, LITERATURE_BOOKS.map((book) => book.book.key));
    return respond({ books: LITERATURE_BOOKS.map((book) => literatureBookSummary(book, rows.filter((row) => row.key === book.book.key))) });
  } catch {
    return respond({ error: '게시 상태를 확인하지 못했어요. 잠시 후 다시 불러와 주세요.' }, 503);
  }
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return respond({ error: auth.error }, auth.status);
  let body;
  try { body = await request.json(); } catch { return respond({ error: '입력 형식을 확인해 주세요.' }, 400); }
  if (!body || typeof body !== 'object' || body.action !== 'publish' || typeof body.key !== 'string') {
    return respond({ error: '게시할 책을 선택해 주세요.' }, 400);
  }
  const book = findBook(body.key);
  if (!book) return respond({ error: '정본 책을 찾지 못했어요.' }, 404);
  if (!literatureBookPublishable(book)) return respond({ error: '권리 기록이 공개 기준을 통과하지 못한 책이에요.' }, 422);

  const { supabase, user } = auth;
  let plan;
  try {
    plan = planLiteraturePublish(book, await publishedRows(supabase, user.id, [book.book.key]));
  } catch {
    return respond({ error: '게시 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
  }
  if (plan.conflicts.length) {
    return respond({ error: '이미 게시된 장 중 정본과 다른 장이 있어 게시하지 않았어요. 자료 관리에서 확인해 주세요.', plan }, 409);
  }
  if (plan.insert.length === 0) return respond({ ok: true, inserted: [], plan });

  const { data, error } = await supabase.from('reading_materials')
    .insert(literaturePublishRows(book, plan.insert, user.id))
    .select('id, order:processed_json->metadata->book->>order');
  if (error) return respond({ error: '책을 게시하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
  return respond({ ok: true, inserted: data || [], plan });
}
