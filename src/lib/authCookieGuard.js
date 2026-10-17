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

// 진짜 무효 세션(TOKEN-REFRESH-409-001 후속 · a775 리뷰 2026-10-17 KST) — 위 가드는 409와 진짜 무효를 구분하지 못해, 다른 기기 로그아웃 ·
// 차단 · 삭제 뒤에도 그 브라우저가 접근 토큰 수명 동안 「로그인한 것처럼 보이는데 서버는 401」로 남았다. 서버가 getUser 오류 코드로
// 「이 세션은 다시 살아나지 않는다」를 확인했을 때만 인증 쿠키를 지운다. 코드는 @supabase/auth-js 2.100 lib/error-codes.d.ts의 ErrorCode
// (fetch.handleError가 응답 code · error_code에서 고른다). session_not_found는 handleError가 AuthSessionMissingError(코드 없음)로 바꾼다.
//   지운다: session_not_found(→ AuthSessionMissingError) · session_expired · refresh_token_not_found · user_not_found · user_banned
//   지우지 않는다: conflict(409 동시 갱신 — 이긴 쪽이 새 쿠키를 심었다) · refresh_token_already_used(재사용 간격 밖의 늦은 요청에서도 난다 —
//     브라우저 갱신에 맡긴다) · bad_jwt(시계 차 · 만료 직전에도 난다 — refresh token은 살아 있을 수 있다) · 네트워크 · 5xx(재시도 가능)
export const INVALID_SESSION_CODES = Object.freeze(['session_expired', 'refresh_token_not_found', 'user_not_found', 'user_banned']);

/** getUser 오류가 「세션이 영영 무효」인가 — 그때만 서버가 인증 쿠키를 지운다. */
export function invalidSessionError(error) {
  if (!error) return false;
  if (error.name === 'AuthSessionMissingError') return true; // session_not_found(응답) · 쿠키 세션을 못 읽음 — 지울 쿠키가 없으면 아무것도 안 한다
  return INVALID_SESSION_CODES.includes(error.code);
}

/** 지금 있는 인증 쿠키(조각 포함)를 지우는 쓰기 — @supabase/ssr의 삭제와 같은 속성(path / · lax · httpOnly 아님 · maxAge 0). */
export function authCookieRemovals(names) {
  return (Array.isArray(names) ? names : []).filter((name) => AUTH_COOKIE.test(name))
    .map((name) => ({ name, value: '', options: { path: '/', sameSite: 'lax', httpOnly: false, maxAge: 0 } }));
}
