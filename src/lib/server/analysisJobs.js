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
import { consumeDailyQuota } from './dailyQuota';
import { getLLMStats } from './llm';

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
export const JOB_COLUMNS = 'id, owner_id, kind, book_keys, material_ids, status, current_key, chapters_done, chapters_failed, attempts, failure_streak, last_error, llm_usage, lease_until, created_at, updated_at';
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

// ── 공개 시드(starter) 작업(STARTER-ANALYSIS-001, 2026-11-06 KST) ──
// 책 작업과 같은 tick · 임대 · 장별 시도(3) · 연달아 실패 멈춤(3) · 같은 분석 경로(analyzeChapter)를 쓰고, 다른 것은 셋뿐이다:
//   ① 대상 = 작업 줄의 material_ids(시작할 때 고른 공개 시드 id, 그 차례대로) — 책 게시(prepare) 없음
//   ② 하루 상한 회계 — 자료마다 분석 요청 수만큼 작업 관리자의 'analyze' 하루 상한(AI-QUOTA-001)을 먼저 쓴다. 닿으면 실패가 아니라
//      「내일 이어서」 — 작업은 그대로 돌고 다음 날 예약 실행이 잇는다(사용자가 브라우저로 분석할 때와 같은 회계)
//   ③ llm_usage — 이 작업 동안 쓴 LLM 호출 · 토큰을 모델별로 더한다(인스턴스 집계 getLLMStats의 전후 차 — 같은 인스턴스의 다른 요청이
//      섞일 수 있어 근사값이다. 정본은 Vercel 로그의 [llm] 줄).
/** 분석 요청 수 추정 — analyzeText의 요청당 글자 예산(일 800 · 영 2000 · 중 400 · 한 1600)으로 나눈 올림, 최소 1. */
const REQUEST_BUDGET = Object.freeze({ Japanese: 800, English: 2000, Chinese: 400, Korean: 1600 });
export function analysisRequestUnits(rawText, language) {
  const chars = String(rawText || '').length;
  return Math.max(1, Math.ceil(chars / (REQUEST_BUDGET[language] || 2000)));
}

/** 인스턴스 LLM 집계 두 스냅샷의 차 → { 모델: {calls, ok, in, out, thinking} }(호출이 있었던 모델만). 창이 새로 열렸으면 뒤 스냅샷 그대로. */
export function usageDelta(before, after) {
  const out = {};
  const keys = ['calls', 'ok', 'in', 'out', 'thinking'];
  for (const [tier, models] of Object.entries(after?.tiers || {})) {
    for (const [model, b] of Object.entries(models || {})) {
      const a = before?.tiers?.[tier]?.[model] || {};
      const reset = (Number(b.calls) || 0) < (Number(a.calls) || 0);
      const d = Object.fromEntries(keys.map((k) => [k, (Number(b[k]) || 0) - (reset ? 0 : (Number(a[k]) || 0))]));
      if (d.calls <= 0) continue;
      const cur = out[model] || Object.fromEntries(keys.map((k) => [k, 0]));
      out[model] = Object.fromEntries(keys.map((k) => [k, cur[k] + d[k]]));
    }
  }
  return out;
}

/** 작업 llm_usage에 차를 더한다 → { calls, in, out, thinking, byModel }. */
export function mergeUsage(usage, delta) {
  const byModel = { ...(usage?.byModel || {}) };
  for (const [model, d] of Object.entries(delta || {})) {
    const cur = byModel[model] || { calls: 0, ok: 0, in: 0, out: 0, thinking: 0 };
    byModel[model] = Object.fromEntries(Object.keys(cur).map((k) => [k, cur[k] + (Number(d[k]) || 0)]));
  }
  const sum = (k) => Object.values(byModel).reduce((acc, m) => acc + (Number(m[k]) || 0), 0);
  return { calls: sum('calls'), in: sum('in'), out: sum('out'), thinking: sum('thinking'), byModel };
}

/** starter 작업의 자료 행 — 작업 관리자 소유 · 공개 · material_ids 안. order = material_ids 안의 자리. */
async function starterRows(supabase, job) {
  const ids = (job.material_ids || []).map(Number);
  if (!ids.length) return [];
  const { data, error } = await supabase.from('reading_materials')
    .select('id, status:processed_json->>status, language:processed_json->metadata->>language, raw_text')
    .eq('owner_id', job.owner_id).eq('visibility', 'public').in('id', ids);
  if (error) throw error;
  const order = new Map(ids.map((id, i) => [id, i]));
  return (data || []).map((row) => ({ ...row, order: order.get(Number(row.id)) ?? ids.length }));
}

/** starter 작업의 다음 자료 — 분석 전이고 시도 상한 전인 것 중 material_ids 차례가 가장 앞선 것. → {key: null, chapter} | null */
async function nextStarter(supabase, job, listStarter) {
  const chapter = pickChapter(await listStarter(supabase, job), job.attempts);
  return chapter ? { key: null, chapter } : null;
}

export const STARTER_DAILY_LIMIT_NOTE = '오늘 분석 상한에 닿아 내일 예약 실행에서 이어서 해요.';

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
  // 연달아 실패는 「포기한 장」 단위로 센다(STARTER-ANALYSIS-001 운영 실측 2026-11-07 KST — 한 자료의 재시도 3회가 그대로
  // 「연달아 3장」으로 세져 자료 하나가 망가지면 작업 전체가 멈췄다). 재시도 중인 실패는 세지 않고, 세 번째 시도까지 실패해
  // 그 장을 건너뛸 때 1을 더한다 — 서로 다른 장 FAILURE_STOP개가 연달아 포기되면(할당량 · 네트워크 같은 공통 원인) 멈춘다.
  const gaveUp = tries >= CHAPTER_ATTEMPTS;
  const streak = job.failure_streak + (gaveUp ? 1 : 0);
  const last_error = shortError(outcome.error);
  return {
    attempts: { ...job.attempts, [id]: tries },
    chapters_failed: job.chapters_failed + (gaveUp ? 1 : 0),
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
  listStarter = starterRows, consumeQuota = consumeDailyQuota, llmStats = getLLMStats,
} = {}) {
  if (!supabase) return { processed: 0, more: false };
  const claimed = await claimJob(supabase, now());
  if (!claimed) return { processed: 0, more: false };
  const started = now();
  const prepared = new Set();
  let processed = 0;
  let books;
  try {
    // 이 작업의 책만 — 문학책은 그 책들 원문만 읽는다(BUILD-OOM-001). 모르는 key는 빠지고 nextChapter가 「찾지 못함」으로 넘긴다.
    const starter = claimed.kind === 'starter';
    if (starter) books = [];
    else { try { books = getBooks(claimed.kind, claimed.book_keys); } catch { books = null; } }
    if (!books) {
      await updateJob(supabase, claimed.id, { status: 'failed', last_error: '정본 책 목록을 만들지 못했어요. 리포의 원본 기록을 확인해 주세요.' });
      return { jobId: claimed.id, processed, more: true };
    }
    while (now() - started < TICK_START_BUDGET_MS) {
      const job = await readJob(supabase, claimed.id);
      if (job.status !== 'running') return { jobId: job.id, processed, more: true };
      const next = starter
        ? await nextStarter(supabase, job, listStarter)
        : await nextChapter(supabase, job, books, prepared, { prepare, listChapters, publishable });
      if (!next) {
        await updateJob(supabase, job.id, { status: 'done', current_key: null });
        return { jobId: job.id, processed, more: true };
      }
      if (starter) {
        // 하루 상한 회계(AI-QUOTA-001) — 닿으면 실패로 세지 않고 오늘은 여기까지(작업은 도는 채로, 다음 날 예약 실행이 잇는다).
        const quota = await consumeQuota({ kind: 'analyze', subject: `u:${job.owner_id}`, units: analysisRequestUnits(next.chapter.raw_text, next.chapter.language) });
        if (!quota.ok) {
          await updateJob(supabase, job.id, { last_error: STARTER_DAILY_LIMIT_NOTE });
          return { jobId: job.id, processed, more: false };
        }
      }
      const statsBefore = starter ? llmStats() : null;
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
      if (starter) patch.llm_usage = mergeUsage(fresh.llm_usage, usageDelta(statsBefore, llmStats()));
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
