// CSP 정책 한 곳(SEC-HEADERS-001 → SEC-CSP-002, 2026-11-07 KST) — next.config.mjs가 Report-Only 헤더로 싣고, lib/cspReport가 보고를 받을 지시어를 여기서 안다.
//
// 지금은 **보고만** 한다(Content-Security-Policy-Report-Only). 출처 허용 목록(2단계)을 넓혀 실제 위반을 7일 관측한 뒤 강제를 정한다 — 근거 · 단계는
// docs/security-csp.md. 강제(Content-Security-Policy) 전환과 nonce 기반 엄격한 script-src는 **오너 결정 항목**이다: nonce는 문서마다 동적 렌더를
// 강제해 정적 · ISR 판을 깨고, 강제는 막힌 기능을 사용자에게 드러낸다. 이 파일은 그 둘을 하지 않는다(계약 securityHeaders.test.js).
//
// 'unsafe-inline'(script · style)은 Next의 인라인 RSC 흐름 조각 · 루트 첫 스크립트 · JSON-LD(경로마다 11–24개)와 React style 속성 때문이다 —
// 이 단계의 script-src는 「외부 스크립트 출처」만 본다.

/** Supabase 프로젝트 출처(https · wss) — 공개 URL(NEXT_PUBLIC_SUPABASE_URL)에서 만든다. 없거나 잘못된 값이면 빈 목록. */
export function supabaseOrigins(url) {
  try {
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:') return [];
    return [u.origin, `wss://${u.host}`];
  } catch {
    return [];
  }
}

/** Report-Only 정책의 지시어 → 값. 순서가 헤더 순서다. */
export function cspReportOnlyDirectives(env = process.env) {
  const supabase = supabaseOrigins(env.NEXT_PUBLIC_SUPABASE_URL);
  return [
    ['default-src', "'self'"],
    ['script-src', "'self' 'unsafe-inline'"],
    ['style-src', "'self' 'unsafe-inline'"],
    // i.ytimg.com — 함께 읽는 글 · 추천의 유튜브 썸네일(YouTube Data API thumbnails.*.url). LH-BASELINE-001에서 보고 실측(2026-11-09 KST).
    ['img-src', "'self' data: blob: https://i.ytimg.com"],
    ['font-src', "'self' data:"],
    ['connect-src', ["'self'", ...supabase].join(' ')],
    ['media-src', "'self' blob: data:"],
    ['frame-src', 'https://www.youtube-nocookie.com'],
    ['worker-src', "'self' blob:"],
    ['manifest-src', "'self'"],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['frame-ancestors', "'self'"],
    ['form-action', "'self'"],
    ['report-uri', '/api/csp-report'],
    ['report-to', 'csp'],
  ];
}

export function cspReportOnly(env = process.env) {
  return cspReportOnlyDirectives(env).map(([name, value]) => `${name} ${value}`).join('; ');
}

/**
 * 보고를 받아 기록할 지시어 — 정책의 지시어와, 브라우저가 effectiveDirective로 보내는 세분 이름(-elem · -attr).
 * default-src는 보고에 effectiveDirective로 거의 오지 않지만(세분 지시어 이름으로 온다) 옛 violated-directive가 그대로 보낼 수 있어 둔다.
 */
export const CSP_REPORTED_DIRECTIVES = Object.freeze([
  'default-src',
  'script-src', 'script-src-elem', 'script-src-attr',
  'style-src', 'style-src-elem', 'style-src-attr',
  'img-src', 'font-src', 'connect-src', 'media-src', 'frame-src', 'child-src', 'worker-src', 'manifest-src',
  'object-src', 'base-uri', 'frame-ancestors', 'form-action',
]);
