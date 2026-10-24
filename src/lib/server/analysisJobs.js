// 서버 분석 작업(CANON-SERVER-ANALYSIS-001, 오너 「서버 분석 A안 승인, 권장대로 ㄱㄱ」 2026-10-24 KST) — 스스로 이어 달리기.
//
// 관리자가 「서버에서 분석」을 누르면 작업 한 줄(canonical_analysis_jobs)이 생기고, tick(/api/cron/analysis-jobs)이 깨어나
//   ① 도는 작업 하나를 임대(lease)로 잡고 ② 책 차례대로 「게시」(없는 장 준비 · 분석 전 장 metadata 맞춤 — 관리자 화면과 같은 처리)한 뒤
//   ③ 분석 전 장을 하나씩 브라우저와 **같은 분석 경로**(runPreservedReanalysis + analyzeText, 라우트를 같은 프로세스 안에서 — transport)로 분석해
//   ④ 작업 확인 저장(canonical_analysis_save)으로 쓰고 ⑤ 시간 예산이 남으면 다음 장, 다 쓰면 임대를 풀고 다음 tick을 스스로 부른다.
// 화면을 닫아도 진행된다. 멈춤은 장 사이에서 듣는다(분석 중인 장은 끝내고 저장한다 — 비용을 버리지 않는다).
// 한 장은 세 번까지(CHAPTER_ATTEMPTS), 연달아 세 장 실패면(FAILURE_STOP — 할당량 · 네트워크 같은 공통 원인) 작업을 「실패」로 멈춘다.
// 검수 · 공개는 하지 않는다(사람 확인 지점 — 관리자 화면 그대로). 끊긴 사슬은 관리자 화면 열기 · 하루 한 번 예약 실행이 다시 깨운다.
import { createClient } from '@supabase/supabase-js';
import { analyzeText } from '../analyzeText';
import { literatureBookPublishable } from '../literaturePublish';
import { runPreservedReanalysis } from '../reanalysisPreservation';
import { prepareCanonicalBook } from './bookPublishRoute';
import { internalAnalysisRequest } from './internalAnalysisRequest';
import { publishBooksOf } from './publishBooks';
import { POST as analyzeRoute } from '@/app/api/analyze/route';
import { POST as koreanRoute } from '@/app/api/analyze/korean/route';
import { POST as geminiRoute } from '@/app/api/gemini/route';

/** 한 장 시도 상한 · 연달아 실패 멈춤 — 관리자 화면 일괄 분석(FAILURE_STOP 3)과 같은 기준. */
export const CHAPTER_ATTEMPTS = 3;
export const FAILURE_STOP = 3;
/** tick 함수 수명(maxDuration 300초) 안의 예산 — 새 장은 시작 뒤 120초 안에만 잡고, 한 장은 170초까지 기다린다(최악 290초). */
export const TICK_START_BUDGET_MS = 120_000;
export const CHAPTER_TIMEOUT_MS = 170_000;
/** 임대 — tick 수명보다 길게(끝나기 전에 다른 tick이 같은 작업을 잡지 않게). 죽은 tick의 임대는 이 시간 뒤 풀린다. */
export const LEASE_MS = 300_000;
/** 끊긴 사슬로 보는 기준 — 도는 작업인데 임대가 없고 이만큼 조용하면 관리자 화면이 tick을 다시 깨운다. */
export const STALL_MS = 60_000;
export const JOB_COLUMNS = 'id, owner_id, kind, book_keys, status, current_key, chapters_done, chapters_failed, attempts, failure_streak, last_error, lease_until, created_at, updated_at';
const KEY_PATH = 'processed_json->metadata->book->>key';
const ORDER_PATH = 'processed_json->metadata->book->>order';

/** 서버 쓰기 클라이언트 — 키가 없으면 null(라우트가 503으로 닫는다). */
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
}

const ROUTES = Object.freeze({ '/api/analyze': analyzeRoute, '/api/analyze/korean': koreanRoute, '/api/gemini': geminiRoute });

/** analyzeText · callGemini의 transport — 분석 라우트를 같은 프로세스 안에서(표식 요청 — 로그인 · 사용자 한도만 건너뛴다). */
export async function inProcessTransport(url, init) {
  const path = new URL(url, 'http://internal.analysis').pathname;
  const route = ROUTES[path];
  if (!route) throw new Error(`서버 분석이 부를 수 없는 경로예요: ${path}`);
  return route(internalAnalysisRequest(path, init));
}

/** 장 고르기 — 분석 전이고 시도 상한 전인 장 중 장 순서가 가장 앞선 것. chapters: [{id, order, status}] */
export function pickChapter(chapters, attempts = {}) {
  return (chapters || [])
    .filter((chapter) => chapter.status !== 'completed' && (Number(attempts[String(chapter.id)]) || 0) < CHAPTER_ATTEMPTS)
    .sort((a, b) => Number(a.order) - Number(b.order) || a.id - b.id)[0] || null;
}

const shortError = (error) => String(error?.message || error || '분석하지 못했어요.').replace(/\s+/g, ' ').slice(0, 300);

/** 장 하나를 마친 뒤 작업 고칠 칸. outcome: {ok: true} | {ok: false, error} */
export function jobAfterChapter(job, materialId, outcome) {
  if (outcome.ok) return { chapters_done: job.chapters_done + 1, failure_streak: 0 };
  const id = String(materialId);
  const tries = (Number(job.attempts?.[id]) || 0) + 1;
  const streak = job.failure_streak + 1;
  const last_error = shortError(outcome.error);
  return {
    attempts: { ...job.attempts, [id]: tries },
    chapters_failed: job.chapters_failed + (tries >= CHAPTER_ATTEMPTS ? 1 : 0),
    failure_streak: streak,
    last_error,
    ...(streak >= FAILURE_STOP ? { status: 'failed', last_error: `연달아 ${streak}장을 분석하지 못해 멈췄어요 — ${last_error}`.slice(0, 500) } : {}),
  };
}

async function updateJob(supabase, id, patch) {
  const { error } = await supabase.from('canonical_analysis_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

/** 도는 작업 하나를 임대로 잡는다(임대가 없거나 지난 것 중 가장 오래 조용한 것). 다른 tick이 먼저 잡았으면 null. */
export async function claimJob(supabase, now = Date.now()) {
  const at = new Date(now).toISOString();
  const { data, error } = await supabase.from('canonical_analysis_jobs').select('id')
    .eq('status', 'running').or(`lease_until.is.null,lease_until.lt.${at}`).order('updated_at', { ascending: true }).limit(1);
  if (error) throw error;
  if (!data?.length) return null;
  const { data: claimed, error: claimError } = await supabase.from('canonical_analysis_jobs')
    .update({ lease_until: new Date(now + LEASE_MS).toISOString(), updated_at: at })
    .eq('id', data[0].id).eq('status', 'running').or(`lease_until.is.null,lease_until.lt.${at}`)
    .select(JOB_COLUMNS);
  if (claimError) throw claimError;
  return claimed?.[0] || null;
}

async function readJob(supabase, id) {
  const { data, error } = await supabase.from('canonical_analysis_jobs').select(JOB_COLUMNS).eq('id', id).single();
  if (error) throw error;
  return data;
}

async function chapterRows(supabase, ownerId, key) {
  const { data, error } = await supabase.from('reading_materials')
    .select(`id, order:${ORDER_PATH}, status:processed_json->>status`).eq('owner_id', ownerId).eq(KEY_PATH, key).eq('visibility', 'private');
  if (error) throw error;
  return data || [];
}

/** 작업 확인 저장 — replaceViewerAnalysis와 같은 인자 · 같은 비교 저장, 사용자 세션 대신 작업 id. */
export function jobSave(jobId) {
  return async (client, material, rawText, json, attempt) => {
    const { data, error } = await client.rpc('canonical_analysis_save', {
      p_job: jobId, p_id: String(material.id), p_expected_raw: material.raw_text,
      p_expected_json: material.processed_json, p_raw: rawText, p_json: json, p_attempt: attempt,
    });
    if (error) throw error;
    if (!data?.material?.id) throw new Error('저장 결과를 확인하지 못했어요.');
    return data.material;
  };
}

/** 장 하나 분석 — 브라우저 「이어서 분석」과 같은 경로(fullReset · 저자 루비 잠금 · 교정 보존). 실패는 던진다. */
export async function analyzeChapter(supabase, job, materialId, { timeoutMs = CHAPTER_TIMEOUT_MS, transport = inProcessTransport } = {}) {
  const { data: row, error } = await supabase.from('reading_materials').select('*').eq('id', materialId).eq('owner_id', job.owner_id).single();
  if (error) throw error;
  const analyze = (rawText, signal, options) => analyzeText(rawText, signal, { ...options, transport });
  await runPreservedReanalysis(supabase, row, AbortSignal.timeout(timeoutMs), analyze, { fullReset: true, replace: jobSave(job.id) });
}

/**
 * 다음 장 — 책 차례대로, 처음 닿는 책은 이 tick에서 한 번 「게시」(없는 장 준비 · 분석 전 장 맞춤)한 뒤 분석 전 장을 고른다.
 * 게시할 수 없는 책(정본 목록에 없음 · 권리 기준 · 정본과 다른 장)은 이유를 남기고 건너뛴다. → {key, chapter} | null(남은 장 없음)
 */
async function nextChapter(supabase, job, books, prepared, { prepare, listChapters, publishable }) {
  const start = Math.max(0, job.book_keys.indexOf(job.current_key));
  for (const key of job.book_keys.slice(start)) {
    if (!prepared.has(key)) {
      prepared.add(key);
      const book = books.find((item) => item.book.key === key);
      const result = !book ? { error: '정본 책을 찾지 못했어요.' }
        : !publishable(book) ? { error: '권리 · 출처 기준을 통과하지 못한 책이에요.' }
          : await prepare(supabase, job.owner_id, book).then(({ status, body }) => (status === 200 ? {} : { error: body.error }));
      if (result.error) {
        await updateJob(supabase, job.id, { last_error: `${key}: ${result.error}`.slice(0, 500) });
        continue;
      }
    }
    const chapter = pickChapter(await listChapters(supabase, job.owner_id, key), job.attempts);
    if (chapter) {
      if (job.current_key !== key) await updateJob(supabase, job.id, { current_key: key });
      return { key, chapter };
    }
  }
  return null;
}

/**
 * tick 한 번 — 작업 하나를 잡아 시간 예산 안에서 장을 분석한다. → {jobId?, processed, more}
 * more = 다음 tick을 부를 이유가 있다(예산을 다 써서 남은 장이 있거나, 이 작업이 끝나 다른 작업이 기다릴 수 있다).
 */
export async function runAnalysisTick({
  supabase = serviceClient(), now = () => Date.now(), getBooks = publishBooksOf, analyze = analyzeChapter,
  prepare = prepareCanonicalBook, listChapters = chapterRows, publishable = literatureBookPublishable,
} = {}) {
  if (!supabase) return { processed: 0, more: false };
  const claimed = await claimJob(supabase, now());
  if (!claimed) return { processed: 0, more: false };
  const started = now();
  const prepared = new Set();
  let processed = 0;
  let books;
  try {
    try { books = getBooks(claimed.kind); } catch { books = null; }
    if (!books) {
      await updateJob(supabase, claimed.id, { status: 'failed', last_error: '정본 책 목록을 만들지 못했어요. 리포의 원본 기록을 확인해 주세요.' });
      return { jobId: claimed.id, processed, more: true };
    }
    while (now() - started < TICK_START_BUDGET_MS) {
      const job = await readJob(supabase, claimed.id);
      if (job.status !== 'running') return { jobId: job.id, processed, more: true };
      const next = await nextChapter(supabase, job, books, prepared, { prepare, listChapters, publishable });
      if (!next) {
        await updateJob(supabase, job.id, { status: 'done', current_key: null });
        return { jobId: job.id, processed, more: true };
      }
      let outcome;
      try {
        await analyze(supabase, job, next.chapter.id);
        outcome = { ok: true };
      } catch (error) {
        outcome = { ok: false, error };
      }
      processed += 1;
      const fresh = await readJob(supabase, job.id);
      const patch = jobAfterChapter(fresh, next.chapter.id, outcome);
      // 멈춤 · 실패로 바뀐 작업은 상태를 되돌리지 않는다(진행 수만 남긴다).
      if (fresh.status !== 'running') delete patch.status;
      await updateJob(supabase, job.id, patch);
      if (patch.status === 'failed') return { jobId: job.id, processed, more: true };
    }
    return { jobId: claimed.id, processed, more: true };
  } finally {
    await supabase.from('canonical_analysis_jobs').update({ lease_until: null }).eq('id', claimed.id);
  }
}

/** 다음 tick 부르기 — 같은 배포의 예약 실행 주소로(CRON_SECRET). 시크릿이 없으면 사슬을 잇지 않는다(false). */
export async function kickAnalysisTick(origin, { fetchImpl = fetch } = {}) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !origin) return false;
  try {
    const response = await fetchImpl(new URL('/api/cron/analysis-jobs', origin), {
      method: 'POST', headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** 끊긴 사슬 — 도는 작업인데 임대가 없거나 지났고 STALL_MS 넘게 조용하다(관리자 화면이 다시 깨운다). */
export function stalledJob(job, now = Date.now()) {
  if (job?.status !== 'running') return false;
  const lease = Date.parse(job.lease_until || '');
  const quiet = now - Date.parse(job.updated_at || 0);
  return (!Number.isFinite(lease) || lease < now) && quiet > STALL_MS;
}
