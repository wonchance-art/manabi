// 운영 오류 기록의 서버 쓰기(ERROR-OBSERVE-001) — /api/client-error(브라우저 오류)와 instrumentation onRequestError(서버 오류)가 함께 쓴다.
// 저장은 SECURITY DEFINER RPC public.observe_record_error 하나(service_role만 실행 — 표 observe.error_events는 Data API 밖 · RLS 켜짐 ·
// 직접 권한 없음). 같은 오류는 한 시간 칸마다 한 줄(hits 증가) · 새 줄 분당 30 · 하루 1000 상한 · 30일 지난 줄은 쓸 때 조금씩 지운다(DB 쪽).
// 계약: 무엇이 실패해도(키 없음 · DB 다운 · 시간 초과) throw하지 않고 결과 문자열만 돌려준다 — 요청 · 화면을 절대 깨뜨리지 않는다.
import { createClient } from '@supabase/supabase-js';
import { browserFamily, buildErrorEvent } from '../errorEvent';

export const RECORD_TIMEOUT_MS = 1500;
const SOURCES = new Set(['client', 'server']);

const timeout = (ms) => new Promise((resolve) => { const t = setTimeout(() => resolve({ timedOut: true }), ms); t.unref?.(); });

function serviceClient(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/**
 * 정리된 기록 한 건을 저장한다. 결과: 'recorded' | 'counted' | 'dropped' | 'invalid' (DB 판정) · 'skipped'(키 없음) · 'failed' · 'timeout'.
 * @param {{source: 'client'|'server', kind: string, message: string, stack?: string|null, digest?: string|null, route?: string|null,
 *   release?: string|null, browser?: string|null}} event
 */
export async function recordErrorEvent(event, { env = process.env, client, timeoutMs = RECORD_TIMEOUT_MS } = {}) {
  try {
    if (!event || !SOURCES.has(event.source) || !event.kind || !event.message) return 'invalid';
    const db = client || serviceClient(env);
    if (!db) return 'skipped';
    const call = Promise.resolve(db.rpc('observe_record_error', {
      p_source: event.source, p_kind: event.kind, p_message: event.message, p_stack: event.stack ?? null,
      p_digest: event.digest ?? null, p_route: event.route ?? null, p_release: event.release ?? null, p_browser: event.browser ?? null,
    })).catch(() => ({ error: true }));
    const result = await Promise.race([call, timeout(timeoutMs)]);
    if (result?.timedOut) return 'timeout';
    if (result?.error) return 'failed';
    return typeof result?.data === 'string' ? result.data : 'recorded';
  } catch {
    return 'failed';
  }
}

/** 본문을 max 바이트까지만 읽는다 — 넘으면 null(나머지는 읽지 않고 끊는다). */
export async function readLimited(request, max) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

// 흐름 제어용 Next 신호(리다이렉트 · notFound · 정적 생성 포기)는 오류가 아니다.
const CONTROL_DIGEST = /^(?:NEXT_|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/;

/** onRequestError(err, request, context) → 정리된 서버 기록 한 건(기록하지 않을 것이면 null). */
export function serverErrorEvent(error, request, context, env = process.env) {
  if (CONTROL_DIGEST.test(String(error?.digest || ''))) return null;
  const type = String(context?.routeType || 'request').toLowerCase().replace(/[^a-z]/g, '') || 'request';
  const event = buildErrorEvent({
    kind: `server.${type}`.slice(0, 48),
    error,
    // 라우트 틀(/viewer/[id])을 먼저 — 실제 주소의 ID가 남지 않는다. 없으면 주소에서 쿼리를 뗀 경로.
    route: context?.routePath || request?.path,
    release: env.NEXT_PUBLIC_BUILD_SHA,
  });
  if (!event) return null;
  const ua = request?.headers?.['user-agent'];
  return { ...event, source: 'server', browser: browserFamily(Array.isArray(ua) ? ua[0] : ua) };
}
