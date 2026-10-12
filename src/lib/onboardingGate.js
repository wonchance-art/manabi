// 첫 방문 온보딩 모달을 띄울지 — 로그인·가입·재설정 화면(/auth)에서는 띄우지 않는다.
// 온보딩 전 계정이 비밀번호 재설정 링크로 /auth?mode=reset에 오면, 전면 오버레이가 새 비밀번호 칸을 덮어
// 재설정을 끝낼 수 없었다(AUTH-GUIDE-001 M09 실검수 FAIL, 2026-10-11). 인증 화면을 끝낸 뒤 다른 화면에서 띄운다.
export function isAuthRoute(pathname) {
  return typeof pathname === 'string' && (pathname === '/auth' || pathname.startsWith('/auth/'));
}

export function shouldShowOnboarding(profile, pathname) {
  return Boolean(profile) && profile.onboarded === false && !isAuthRoute(pathname);
}
