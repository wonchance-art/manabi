// CSP 정책 한 곳(SEC-HEADERS-001 → SEC-CSP-002, 2026-11-07 KST) — next.config.mjs가 Report-Only 헤더로 싣고, lib/cspReport가 보고를 받을 지시어를 여기서 안다.
//
// 1단계 네 지시어(object-src · base-uri · frame-ancestors · form-action)는 **강제**(Content-Security-Policy, SEC-CSP-003 · 2026-11-14 KST)다.
// 출처 허용 목록(2단계)은 계속 **보고만** 한다(Content-Security-Policy-Report-Only) — 근거 · 단계는 docs/security-csp.md. 2단계 강제와 nonce 기반
// 엄격한 script-src는 다음 7일 집계 뒤 판단한다(nonce는 문서마다 동적 렌더를 강제해 정적 · ISR 판을 깬다 — 오너 결정 항목). 계약 securityHeaders.test.js.
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

/**
 * object-src — <embed> · <object>. 'none'이 아니라 Supabase 저장소 출처(https)만 연다: PDF 보기의 기본 경로(PdfDocument)가
 * 저장소 서명 URL을 <embed type="application/pdf">로 띄운다(PdfViewerPage). 'none'이면 Chromium이 그 embed를 막는다(SEC-CSP-003 실측,
 * 2026-11-14 KST — 같은 출처 · 다른 출처 모두). 공개 URL이 없으면 'none'.
 */
export function objectSrc(env = process.env) {
  const [https] = supabaseOrigins(env.NEXT_PUBLIC_SUPABASE_URL);
  return https || "'none'";
}

/**
 * 강제(Content-Security-Policy) 지시어 — 1단계(SEC-CSP-003, 2026-11-14 KST 오케스트레이터 승인 · 7일 Report-Only 관측 뒤). 스크립트 · 스타일을
 * 건드리지 않아 정적 · ISR 판에 영향이 없다. frame-ancestors 'self'는 X-Frame-Options SAMEORIGIN과 같은 뜻, form-action 'self'는 외부로 보내는
 * form 0(코드 전수: <form> 31개 모두 action · method 없이 JS 처리, OAuth · 이메일 링크는 화면 이동)이라 막히는 것이 없다.
 */
export function cspEnforcedDirectives(env = process.env) {
  return [
    ['object-src', objectSrc(env)],
    ['base-uri', "'self'"],
    ['frame-ancestors', "'self'"],
    ['form-action', "'self'"],
    ['report-uri', '/api/csp-report'],
    ['report-to', 'csp'],
  ];
}

export function cspEnforced(env = process.env) {
  return cspEnforcedDirectives(env).map(([name, value]) => `${name} ${value}`).join('; ');
}

/**
 * Report-Only 정책의 지시어 → 값. 순서가 헤더 순서다. 강제로 옮긴 base-uri · frame-ancestors · form-action은 빼고(두 번 보고하지 않게),
 * object-src는 남긴다 — 빠지면 Report-Only의 default-src 'self'가 대신 걸려 저장소 PDF embed를 위반으로 보고한다.
 */
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
    ['object-src', objectSrc(env)],
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
