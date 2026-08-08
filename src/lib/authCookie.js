// 세션 쿠키 유무 판정 — 게스트에게 Supabase SDK(약 200 kB)를 받지 않기 위한 관문.
//
// 이 판정이 틀리면 "로그인했는데 새로고침하면 로그아웃돼 보이는" 형태로 조용히 깨지므로,
// @supabase/ssr이 실제로 쓰는 이름 규약을 테스트로 고정한다:
//   - 기본:   sb-<projectRef>-auth-token
//   - 조각남: sb-<projectRef>-auth-token.0, .1 …  (쿠키 4 kB 한도 초과 시)
//   - code verifier(`sb-<ref>-auth-token-code-verifier`)는 세션이 아니므로 제외한다.
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?\s*=/;

export function hasSupabaseSessionCookie(cookieString) {
  if (typeof cookieString !== 'string' || cookieString === '') return false;
  return SESSION_COOKIE.test(cookieString);
}
