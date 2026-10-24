/**
 * 관리자 서버 분석 작업 API(CANON-SERVER-ANALYSIS-001) — 관리자 게시 화면의 「서버에서 분석」 · 진행 · 멈춤.
 *
 *  GET ?kind=literature|art      → { jobs: 최근 작업[] }(그 종류 · 이 관리자 것만). 도는데 사슬이 끊긴 작업이 있으면 tick을 다시 깨운다.
 *  POST { action:'start', kind, keys }
 *                                → 작업 하나(책 key 차례 그대로)를 시작하고 tick을 깨운다. 이미 도는 작업이 있으면 409.
 *                                  key는 정본 목록에 있고 게시 기준을 통과한 책만(원문은 서버가 리포 정본에서만 만든다).
 *  POST { action:'pause', id }   → 장 사이에서 멈춘다(분석 중인 장은 끝내고 저장). 다시 돌리려면 새로 시작한다.
 *
 * 인증: requireAdmin()(쿠키 세션 + profiles.role='admin'). 작업 줄 쓰기는 사용자 세션으로 해 RLS(처음 상태로만 시작 · 멈추기만)가
 * 최종 방어다. 분석 · 진행 기록은 tick(서버 · service role)만 쓴다.
 */
import { after } from 'next/server';
import { literatureBookPublishable } from '@/lib/literaturePublish';
import { JOB_COLUMNS, kickAnalysisTick, stalledJob } from '@/lib/server/analysisJobs';
import { PUBLISH_KINDS, publishBooksOf } from '@/lib/server/publishBooks';
import { requireAdmin } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const respond = (body, status = 200) => Response.json(body, { status, headers: NO_STORE });
const MAX_KEYS = 200;

export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) return respond({ error: auth.error }, auth.status);
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  if (!PUBLISH_KINDS.includes(kind)) return respond({ error: '책 종류를 확인해 주세요.' }, 400);
  const { data, error } = await auth.supabase.from('canonical_analysis_jobs').select(JOB_COLUMNS)
    .eq('owner_id', auth.user.id).eq('kind', kind).order('created_at', { ascending: false }).limit(5);
  if (error) return respond({ error: '서버 분석 상태를 확인하지 못했어요. 잠시 후 다시 불러와 주세요.' }, 503);
  const jobs = data || [];
  if (jobs.some((job) => stalledJob(job))) after(() => kickAnalysisTick(url.origin));
  return respond({ jobs });
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return respond({ error: auth.error }, auth.status);
  let body;
  try { body = await request.json(); } catch { return respond({ error: '입력 형식을 확인해 주세요.' }, 400); }
  const { supabase, user } = auth;
  const origin = new URL(request.url).origin;

  if (body?.action === 'pause') {
    if (!Number.isSafeInteger(body.id)) return respond({ error: '멈출 작업을 선택해 주세요.' }, 400);
    const { data, error } = await supabase.from('canonical_analysis_jobs').update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', body.id).eq('owner_id', user.id).eq('status', 'running').select(JOB_COLUMNS);
    if (error) return respond({ error: '서버 분석을 멈추지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
    if (!data?.length) return respond({ error: '도는 서버 분석이 아니에요. 화면을 새로 고쳐 확인해 주세요.' }, 409);
    return respond({ job: data[0] });
  }

  if (body?.action !== 'start' || !PUBLISH_KINDS.includes(body.kind) || !Array.isArray(body.keys)) {
    return respond({ error: '서버에서 분석할 책을 선택해 주세요.' }, 400);
  }
  const keys = body.keys;
  if (keys.length === 0 || keys.length > MAX_KEYS || new Set(keys).size !== keys.length || !keys.every((key) => typeof key === 'string')) {
    return respond({ error: '서버에서 분석할 책을 선택해 주세요.' }, 400);
  }
  let books;
  try { books = publishBooksOf(body.kind); } catch { return respond({ error: '정본 책 목록을 만들지 못했어요. 리포의 원본 기록을 확인해 주세요.' }, 422); }
  const byKey = new Map(books.map((book) => [book.book.key, book]));
  const unknown = keys.find((key) => !byKey.has(key) || !literatureBookPublishable(byKey.get(key)));
  if (unknown) return respond({ error: `게시할 수 없는 책이 섞여 있어요(${unknown}).` }, 422);

  const { data, error } = await supabase.from('canonical_analysis_jobs')
    .insert({ owner_id: user.id, kind: body.kind, book_keys: keys }).select(JOB_COLUMNS);
  if (error?.code === '23505') return respond({ error: '이미 도는 서버 분석이 있어요. 끝나거나 멈춘 뒤 다시 시작해 주세요.' }, 409);
  if (error || !data?.length) return respond({ error: '서버 분석을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
  after(() => kickAnalysisTick(origin));
  return respond({ job: data[0] });
}
