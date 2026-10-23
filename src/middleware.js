import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { legacyTextbookTarget } from './lib/bookNavigation';
import { hasLegacyArchivePath } from './lib/legacyArchiveRoutes';
import { authEntryHref } from './lib/authRedirect';
import { withoutServerSignOut } from './lib/authCookieGuard';

// EMEA 오버월드 자산 가드는 #306 일반 공개(releaseEligible 릴리스 정합 전환)로 폐기했다.
// 스테일 가드가 남아 비관리자 전원이 EMEA 지형 404를 받는 라이브 결함을 만들었음(2026-07-22
// 게스트 라이브 검수 실측). 미출시 지역이 다시 생기면 git 이력의 프리픽스 가드 패턴으로 복원한다.
// '/' → /home(ROOT-EDGE-REDIRECT-001, 2026-10-23 KST 현장 감사 F3): page.jsx의 redirect()는 동적 렌더라 첫 진입마다
// 함수 호출 + 왕복이 붙었다(운영 cold TTFB 1328ms · LCP 4012ms vs /home 320 · 2704, warm에서도 912 vs 577 — SW는 리디렉트를 캐시하지 않는다).
// 여기(엣지)에서 보내면 함수가 돌지 않는다. next.config redirects()는 쓰지 않는다 — 들어온 질의를 목적지에 그대로 붙여
// (shared/lib/router/utils/prepare-destination.js: query = {...args.query, ...}) `/?utm=…`가 `/home?utm=…`이 된다.
// 지금(page.jsx)은 질의를 버린다 — 그 동작을 그대로 지킨다. 로그인 결과(code · error · error_description)가 붙은 요청은
// 손대지 않고 page.jsx로 넘긴다(교환 · 실패 분기는 그 파일 한 곳이 맡는다). 세션 쿠키는 읽지 않는다(guestLandingParity).
const ROOT_AUTH_RESULT_KEYS = ['code', 'error', 'error_description'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname === '/') {
    const params = request.nextUrl.searchParams;
    if (ROOT_AUTH_RESULT_KEYS.some((key) => params.has(key))) return NextResponse.next();
    return NextResponse.redirect(new URL('/home', request.url));
  }
  const archive = legacyTextbookTarget(pathname);
  if (archive) {
    const destination = request.nextUrl.clone();
    destination.pathname = archive;
    return NextResponse.redirect(destination);
  }
  if (pathname === '/learn/course') return NextResponse.redirect(new URL('/lessons', request.url));
  if (!pathname.startsWith('/admin')) return NextResponse.next();

  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          // 동시 갱신에서 진 요청이 인증 쿠키를 지우지 않게(TOKEN-REFRESH-409-001 — authCookieGuard).
          withoutServerSignOut(cookiesToSet).forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 로그인 후 열려던 관리자 화면과 조회 조건으로 돌아온다.
  if (!user) return NextResponse.redirect(new URL(authEntryHref(pathname + request.nextUrl.search), request.url));

  // role 확인 (DB 호출)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // 어드민 아님 → 홈으로
  if (profile?.role !== 'admin') return NextResponse.redirect(new URL('/', request.url));

  // Decide before the archive's async page starts streaming; notFound() after the
  // shared loading boundary can otherwise render a 404 screen with HTTP 200.
  if ((pathname === '/admin/legacy-textbooks' || pathname.startsWith('/admin/legacy-textbooks/')) && !hasLegacyArchivePath(pathname)) {
    return NextResponse.rewrite(new URL('/_not-found', request.url), {
      status: 404,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  return response;
}

export const config = {
  matcher: ['/', '/admin/:path*', '/japanese/:path*', '/chinese/:path*', '/english/:path*', '/french/:path*', '/learn/course'],
};
