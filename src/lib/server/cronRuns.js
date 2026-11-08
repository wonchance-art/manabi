// 크론 실행 한 줄 · 일일 상태 점검(OPS-HEALTH-001 — 2026-11-08 KST). 저장은 service_role 전용 RPC 둘
// (public.observe_record_cron_run · public.observe_daily_health — 20261108050000). 새 크론 · 새 환경 변수 없음.
// 계약: 무엇이 실패해도(키 없음 · 함수 없음 · DB 다운 · 시간 초과) throw하지 않는다 — 크론 본체 응답을 절대 바꾸지 않는다.
import { createClient } from '@supabase/supabase-js';

export const CRON_JOBS = Object.freeze(['fetch-suggestions', 'backfill-ipa', 'send-forecast', 'analysis-jobs']);
export const CRON_RECORD_TIMEOUT_MS = 1500;

let cached;
function serviceClient(env) {
  if (cached !== undefined && env === process.env) return cached;
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  const client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  if (env === process.env) cached = client;
  return client;
}

const timeout = (ms) => new Promise((resolve) => { const t = setTimeout(() => resolve({ timedOut: true }), ms); t.unref?.(); });
const count = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.round(Number(n)) : 0);

/** 실행 한 줄을 남긴다. 결과: 'recorded' | 'skipped'(키 없음 · 알 수 없는 job) | 'failed' | 'timeout'. */
export async function recordCronRun(job, { startedAt, ok, processed = 0, failed = 0, detail = null } = {}, { client, env = process.env, timeoutMs = CRON_RECORD_TIMEOUT_MS } = {}) {
  try {
    if (!CRON_JOBS.includes(job)) return 'skipped';
    const db = client || serviceClient(env);
    if (!db) return 'skipped';
    const call = Promise.resolve(db.rpc('observe_record_cron_run', {
      p_job: job,
      p_started_at: new Date(startedAt ?? Date.now()).toISOString(),
      p_ok: Boolean(ok),
      p_processed: count(processed),
      p_failed: count(failed),
      p_detail: detail ?? null,
    })).catch(() => ({ error: true }));
    const result = await Promise.race([call, timeout(timeoutMs)]);
    if (result?.timedOut) return 'timeout';
    return result?.error ? 'failed' : 'recorded';
  } catch {
    return 'failed';
  }
}

/**
 * 크론 경로 감싸기 — 응답 JSON을 summarize(json, status)로 줄여 한 줄을 남긴다. 인증 실패(401)는 실행이 아니므로 남기지 않는다.
 * 원래 응답을 그대로 돌려준다(본문은 clone으로만 읽는다).
 */
export function withCronRun(job, handler, summarize, deps = {}) {
  return async function cronRoute(request, ctx) {
    const startedAt = Date.now();
    let response;
    try {
      response = await handler(request, ctx);
    } catch (error) {
      await recordCronRun(job, { startedAt, ok: false, failed: 1, detail: { error: String(error?.message || error).slice(0, 200) } }, deps);
      throw error;
    }
    if (response?.status === 401) return response;
    let json = null;
    try { json = await response.clone().json(); } catch { /* 본문이 JSON이 아니어도 실행은 남긴다 */ }
    let line;
    try { line = summarize(json, response.status); } catch { line = { ok: response.ok }; }
    await recordCronRun(job, { startedAt, ...line, ok: response.ok && line.ok !== false }, deps);
    return response;
  };
}

/** 그날 점검을 기록하고(이상이면 health.alert 한 줄 — DB가 하루 한 번만) 보고를 돌려준다. 실패면 null. */
export async function recordDailyHealth({ client, env = process.env, timeoutMs = 5000 } = {}) {
  try {
    const db = client || serviceClient(env);
    if (!db) return null;
    const call = Promise.resolve(db.rpc('observe_daily_health', { p_record: true })).catch(() => ({ error: true }));
    const result = await Promise.race([call, timeout(timeoutMs)]);
    if (result?.timedOut || result?.error) return null;
    return result?.data ?? null;
  } catch {
    return null;
  }
}

// 경로별 요약 — 응답 모양은 각 크론 경로 그대로(계약 opsHealth.test.js).
export const summarizeFetchSuggestions = (j) => ({
  ok: !(j?.errors?.length),
  processed: Object.values(j?.saved || {}).reduce((a, b) => a + (Number(b) || 0), 0),
  failed: j?.errors?.length || 0,
  detail: { date: j?.date ?? null, saved: j?.saved ?? null, errors: (j?.errors || []).slice(0, 5), runs: (j?.runs || []).slice(0, 20) },
});
export const summarizeBackfillIpa = (j) => ({
  ok: true,
  processed: (Number(j?.dictUpdated) || 0) + (Number(j?.geminiUpdated) || 0),
  failed: 0,
  detail: { stage: j?.stage ?? null, remaining: j?.remaining ?? null, initialEmpty: j?.initialEmpty ?? null },
});
export const summarizeSendForecast = (j) => ({
  ok: true,
  processed: Number(j?.sent) || 0,
  failed: 0,
  detail: j?.skipped ? { skipped: j.skipped } : { checked: j?.checked ?? 0, sent: j?.sent ?? 0, silent: j?.silent ?? 0, cleaned: j?.cleaned ?? 0, unavailable: j?.unavailable ?? 0 },
});
