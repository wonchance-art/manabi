// 세션 쿠키 유무 판정 — 게스트에게 Supabase SDK(약 200 kB)를 받지 않기 위한 관문.
//
// 이 판정이 틀리면 "로그인했는데 새로고침하면 로그아웃돼 보이는" 형태로 조용히 깨지므로,
// @supabase/ssr이 실제로 쓰는 이름 규약을 테스트로 고정한다:
//   - 기본:   sb-<projectRef>-auth-token
//   - 조각남: sb-<projectRef>-auth-token.0, .1 …  (쿠키 4 kB 한도 초과 시)
//   - code verifier(`sb-<ref>-auth-token-code-verifier`)는 세션이 아니므로 제외한다.
export const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?\s*=/;

/**
 * 서버 쿠키 저장소(next/headers cookies())에 세션 쿠키가 있는가 — 이름만 본다(값은 읽지 않는다).
 * 배움(/home) 화면 · 대기 화면이 손님 / 로그인 배치를 서버에서부터 고르는 데 쓴다(B1 — 오너 승인 2026-10-17 KST).
 */
export function hasSupabaseSessionInJar(jar) {
  const names = typeof jar?.getAll === 'function' ? jar.getAll().map(c => c?.name).filter(Boolean) : [];
  return hasSupabaseSessionCookie(names.map(name => `${name}=1`).join('; '));
}

export function hasSupabaseSessionCookie(cookieString) {
  if (typeof cookieString !== 'string' || cookieString === '') return false;
  return SESSION_COOKIE.test(cookieString);
}

/**
 * 정적(SSG) 화면용 그리기 전 한 줄 — 같은 판정(SESSION_COOKIE)으로 세션 쿠키가 있으면 head에 style 하나(id)를 넣는다.
 * 서버 그림을 바꾸지 않고(정적 그대로) 로그인 전용 칸의 자리만 첫 그림부터 켤 때 쓴다(LEVEL-PROG-HOLD-001 — /japanese/vocab/n5 진도 줄).
 * 쿠키 이름만 본다(값은 읽지 않는다). id · css는 코드 상수만 넘긴다.
 */
export function sessionHintScript(id, css) {
  return `(function(){try{if(document.getElementById(${JSON.stringify(id)})||!/${SESSION_COOKIE.source}/.test(document.cookie))return;var s=document.createElement('style');s.id=${JSON.stringify(id)};s.textContent=${JSON.stringify(css)};document.head.appendChild(s)}catch(e){}})()`;
}
