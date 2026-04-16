// 에러 리포팅 wrapper.
// 기본 동작: console.error + 최근 에러 20건 메모리 보관 (디버깅용).
// Sentry/Axiom 등 연동 시 아래 `externalReporters` 배열에 추가.

const MAX_BUFFER = 20;
const recentErrors = [];

const externalReporters = [];

// Sentry 연동 예시 (설치 후 주석 해제):
// import * as Sentry from '@sentry/nextjs';
// if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
//   externalReporters.push((err, ctx) => Sentry.captureException(err, { extra: ctx }));
// }

/**
 * 에러를 로깅하고 외부 리포터가 설정돼 있으면 전송.
 * @param {Error | unknown} err
 * @param {Record<string, unknown>} [context] — URL, user ID 등 부가 정보
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

  console.error('[report]', entry.message, context);

  for (const fn of externalReporters) {
    try { fn(err, context); } catch { /* 리포터 자체 실패는 무시 */ }
  }
}

export function getRecentErrors() {
  return [...recentErrors];
}

// window 전역 에러 로깅 (클라이언트 전용, 로깅만 — 에러 전파는 막지 않음)
if (typeof window !== 'undefined' && !window.__anatomyErrorHooked) {
  window.__anatomyErrorHooked = true;
  window.addEventListener('error', (e) => {
    // 로깅만, re-throw 안 함
    console.warn('[global-error]', e.message, e.filename, e.lineno);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[unhandled-rejection]', e.reason?.message || e.reason);
  });
}
