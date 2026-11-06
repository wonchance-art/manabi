// 에러 리포팅 wrapper.
// 기본 동작: console.error + 최근 에러 20건 메모리 보관 (디버깅용) + 운영 오류 기록(ERROR-OBSERVE-001).
// 운영 기록: 정리한 칸(errorEvent.js FIELDS — 종류 · 메시지 · 스택 앞부분 · 오류 ID · 경로 · 배포 판)만 /api/client-error로 보낸다.
// 화면은 바꾸지 않는다. 보내기 실패는 조용히 버린다(오류 화면이 또 오류를 내지 않게).

import { buildErrorEvent, errorEventKey, LIMITS } from './errorEvent';

const MAX_BUFFER = 20;
const recentErrors = [];

export const CLIENT_ERROR_ENDPOINT = '/api/client-error';
const MAX_SENDS_PER_PAGE = 8; // 한 번 연 화면에서 보내는 상한 — 같은 오류가 되풀이돼도 요청이 늘지 않는다
const sentKeys = new Set();
let sends = 0;

// 개발 서버에서는 보내지 않는다(콘솔로 충분하다) — 운영 빌드(Preview · 운영 · e2e 빌드)만.
const shouldSend = () => typeof window !== 'undefined' && process.env.NODE_ENV === 'production';

/**
 * 오류 기록 한 건을 보낸다(브라우저 전용). 보냈으면 true. 무엇이 잘못돼도 throw하지 않는다.
 * @param {unknown} err
 * @param {{kind?: string, digest?: string}} [context]
 */
export function sendErrorEvent(err, context = {}, { force = false } = {}) {
  try {
    if (!force && !shouldSend()) return false;
    const event = buildErrorEvent({
      kind: context.kind || 'window.error',
      error: err,
      digest: context.digest,
      route: window.location?.pathname,
      release: process.env.NEXT_PUBLIC_BUILD_SHA,
    });
    if (!event) return false;
    const key = errorEventKey(event);
    if (sentKeys.has(key) || sends >= MAX_SENDS_PER_PAGE) return false;
    const body = JSON.stringify(event);
    if (body.length > LIMITS.body) return false;
    sentKeys.add(key);
    sends += 1;
    // 화면을 떠나는 중에도 닿는 sendBeacon 먼저, 없거나 거절되면 keepalive fetch.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
      && navigator.sendBeacon(CLIENT_ERROR_ENDPOINT, new Blob([body], { type: 'application/json' }))) return true;
    if (typeof fetch === 'function') {
      fetch(CLIENT_ERROR_ENDPOINT, {
        method: 'POST', body, keepalive: true, credentials: 'omit',
        headers: { 'content-type': 'application/json' },
      }).catch(() => {});
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

const externalReporters = [sendErrorEvent];

// Sentry 연동 예시 (설치 후 주석 해제):
// import * as Sentry from '@sentry/nextjs';
// if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
//   externalReporters.push((err, ctx) => Sentry.captureException(err, { extra: ctx }));
// }

/**
 * 에러를 로깅하고 운영 기록으로 보낸다.
 * @param {Error | unknown} err
 * @param {{kind?: string, digest?: string}} [context] — kind: 'boundary.root' 같은 종류, digest: 서버 오류 ID
 */
export function reportError(err, context = {}) {
  const entry = {
    at: new Date().toISOString(),
    message: err?.message || String(err),
    stack: err?.stack,
    name: err?.name,
    context,
  };

  recentErrors.unshift(entry);
  if (recentErrors.length > MAX_BUFFER) recentErrors.length = MAX_BUFFER;

  console.error('[report]', err, context);

  for (const fn of externalReporters) {
    try { fn(err, { ...context, digest: context.digest ?? err?.digest }); } catch { /* 리포터 자체 실패는 무시 */ }
  }
}

export function getRecentErrors() {
  return [...recentErrors];
}

// 기록하지 않는 전역 오류 — 정보가 없거나(교차 출처 「Script error.」) 무해한 것(ResizeObserver 알림 · 취소한 요청),
// 확장 프로그램 · 다른 출처 스크립트가 낸 것.
const NOISE = /^(?:Uncaught\s+)?Script error\.?$|ResizeObserver loop|AbortError|The (?:operation|user) (?:was )?abort/i;
export function isNoiseError(message, filename) {
  if (!message || NOISE.test(String(message))) return true;
  if (filename && typeof window !== 'undefined') {
    try { if (new URL(filename, window.location.href).origin !== window.location.origin) return true; } catch { return true; }
  }
  return false;
}

/**
 * window 전역 에러 기록 (클라이언트 전용, 기록만 — 에러 전파는 막지 않는다). 한 번만 건다.
 * 루트 Providers가 부른다 — 모듈을 불러올 때도 한 번 건다(수화 전에 난 오류도 잡게).
 */
export function installGlobalErrorHooks() {
  if (typeof window === 'undefined' || window.__anatomyErrorHooked) return false;
  window.__anatomyErrorHooked = true;
  window.addEventListener('error', (e) => {
    // 로깅만, re-throw 안 함
    console.warn('[global-error]', e.message, e.filename, e.lineno);
    if (isNoiseError(e.message, e.filename)) return;
    sendErrorEvent(e.error || e.message, { kind: 'window.error' });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    console.warn('[unhandled-rejection]', reason?.message || reason);
    const text = reason?.message || (typeof reason === 'string' ? reason : '');
    if (isNoiseError(text) || reason?.name === 'AbortError') return;
    sendErrorEvent(reason instanceof Error ? reason : text, { kind: 'window.rejection' });
  });
  return true;
}

installGlobalErrorHooks();
