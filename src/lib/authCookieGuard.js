// 서버가 인증 쿠키를 지우지 않게 하는 가드(TOKEN-REFRESH-409-001 — 2026-10-17 KST).
//
// 접근 토큰이 만료된 채 한 화면이 /api/learning/* 를 여러 개 동시에 부르면, 각 route handler의 쿠키 세션 클라이언트가 같은
// refresh token으로 동시에 갱신한다. 하나만 이기고 나머지는 Supabase Auth가 409(「Too many concurrent token refresh requests on the
// same session or refresh token」)로 거절한다. supabase-js는 재시도할 수 없는 인증 오류면 세션을 지우고(_removeSession → SIGNED_OUT),
// @supabase/ssr는 그 사건을 그 응답의 Set-Cookie(값 '' · maxAge 0)로 내보낸다 — 그 응답이 이긴 쪽보다 늦게 도착하면 브라우저의 인증
// 쿠키가 지워져 로그아웃된다. 이 앱은 서버에서 로그아웃하지 않는다(로그아웃은 브라우저의 AuthContext.signOut 한 곳) — 그래서 서버
// 쿠키 쓰기 묶음이 「인증 쿠키를 지우기만 하는」 모양이면 통째로 버린다. 그 요청은 지금처럼 401(로그인 필요)로 끝나고, 세션은 이긴
// 갱신(브라우저 또는 다른 요청)이 심은 쿠키 그대로 남는다. 새 토큰을 심는 묶음(갱신 성공 — 남는 조각 지우기 포함)은 그대로 쓴다.
const AUTH_COOKIE = /^sb-[^.]+-auth-token(?:\.\d+)?$/;

const isRemoval = ({ value, options }) => value === '' || options?.maxAge === 0;

/** @param {{ name: string, value: string, options?: object }[]} cookiesToSet */
export function withoutServerSignOut(cookiesToSet) {
  const list = Array.isArray(cookiesToSet) ? cookiesToSet : [];
  const auth = list.filter(({ name }) => AUTH_COOKIE.test(name));
  if (auth.length && auth.every(isRemoval)) return list.filter(({ name }) => !AUTH_COOKIE.test(name));
  return list;
}
