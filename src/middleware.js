import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { BOOK_SERIES, legacyTextbookTarget } from './lib/bookNavigation';
import { hasLegacyArchivePath } from './lib/legacyArchiveRoutes';
import { authEntryHref } from './lib/authRedirect';
import { withoutServerSignOut } from './lib/authCookieGuard';
import { SC_HINT_COOKIE } from './lib/scFontHint';
import { hasSupabaseSessionInJar } from './lib/authCookie';
import { isBundledEdition } from './lib/textbook/bundledEditions';

// 공유 캐시 갈래(GUEST-STATIC-001) — 쿼리 · 힌트 쿠키로 갈리던 화면을 갈래마다 한 판씩 정적(ISR)으로 굽고, 여기서 판을 고른다(주소창은 그대로).
// 계정으로는 가르지 않는다: 판에는 계정 데이터가 없다. 이 갈래는 쿠키를 읽기만 하고(값 '1'인 힌트 하나) Supabase 클라이언트를 만들지 않는다.
// 내부 판 경로(/discover/reading · /discover/sc · /lessons/lang/*)는 matcher에 넣지 않는다 — rewrite된 요청이 middleware를 다시 지나므로, 거기서 정본 주소로 돌려보내면
// 판을 고른 요청까지 되돌아간다(e2e 빌드 실측: 307 루프). 바로 열어도 같은 판이고, 정본 주소는 canonical(/discover)이 알린다.
const COVER_PATHS = new Set(['/books/japanese-n5', '/books/japanese-n4', '/books/japanese-n3']);
const rewriteTo = (request, pathname, dropQuery = false) => { const url = request.nextUrl.clone(); url.pathname = pathname; if (dropQuery) url.search = ''; return NextResponse.rewrite(url); };
function guestStaticVariant(request) {
  const { pathname, searchParams } = request.nextUrl;
  // 산책: 「함께 읽는 글」(?view=reading)은 동적 화면, 간체 힌트 쿠키는 간체 판, 나머지는 기본 판(ISR 300).
  if (pathname === '/discover') {
    if (searchParams.get('view') === 'reading') return rewriteTo(request, '/discover/reading');
    if (request.cookies.get(SC_HINT_COOKIE)?.value === '1') return rewriteTo(request, '/discover/sc');
    return NextResponse.next();
  }
  // 책장(3단계): ?lang=<언어>(옛 링크 · 단어 목록 「← 교재」 · /japanese 등 리다이렉트)는 그 언어 판, 나머지는 기본 판(둘 다 ISR 3600).
  // 모르는 언어는 기본 판(예전처럼 「전체 시리즈」). 판 경로 /lessons/lang/*는 matcher 밖이다(위 산책과 같은 이유).
  if (pathname === '/lessons') {
    const lang = searchParams.get('lang');
    return BOOK_SERIES.some(series => series.language === lang) ? rewriteTo(request, `/lessons/lang/${lang}`) : NextResponse.next();
  }
  // 배움 · 교재 첫 화면(4단계): 세션 쿠키 **이름**(hasSupabaseSessionInJar — 값 · 계정은 읽지 않는다) 유무로 배치 판을 고른다(B1 · BOOKS-FLOW-002 —
  // 첫 그림부터 로그인 배치). 판에는 계정 데이터가 없어 로그인한 모두가 같은 판을 받는다. 판 경로(/home/member · /home/sc · /home/member/sc ·
  // /books/<책>/cover/* · /books/<책>/edition/*)는 matcher 밖이다(위 산책과 같은 이유).
  if (pathname === '/home') {
    const member = hasSupabaseSessionInJar(request.cookies), sc = request.cookies.get(SC_HINT_COOKIE)?.value === '1';
    const variant = `/home${member ? '/member' : ''}${sc ? '/sc' : ''}`;
    return variant === '/home' ? NextResponse.next() : rewriteTo(request, variant);
  }
  // 교재: 쿼리 없는 첫 화면은 표지 판(ISR). 쿼리가 `edition` 하나뿐이고 값이 그 책의 저장소 판본 id면(책장 · 배움 · 목차 링크, 책 안 이동 뒤
  // 새로고침 · 북마크 — 5단계) 판본별 판(/books/<책>/edition/<id>/<판>, ISR)으로 — 주소의 판본을 그 id 그대로 그리므로 보이는 판본 · 진도 키 ·
  // 앵커가 동적 화면과 같다. 판은 발행 도장이 있는 판본만 그리고, 없으면 동적 화면의 손님과 같은 안내다(미리보기 없음 — 공유 캐시).
  // 관리자 미리보기는 표식(&preview=1 — 쿼리 둘)을 붙여 동적 화면으로 간다(BookEditor · 미리보기 안 링크). 표식 없는 옛 미리보기 주소(열어 둔 탭 ·
  // 북마크)는 미발행 판본이면 안내가 된다 — 관리자에게만 생기는 변화이고, 편집기 「검수용 교재 열기」로 다시 연다. 그 밖(?reference · ?returnTo ·
  // 모르는 id · 중복 키 · utm 등)은 지금 동적 화면 그대로. 판 경로의 쿼리는 비운다(판은 쿼리를 읽지 않는다). (_rsc는 Next가 middleware 앞에서 뗀다.)
  if (COVER_PATHS.has(pathname)) {
    const hint = hasSupabaseSessionInJar(request.cookies) ? 'member' : 'guest';
    if (!searchParams.size) return rewriteTo(request, `${pathname}/cover/${hint}`);
    const edition = searchParams.get('edition');
    if (searchParams.size === 1 && isBundledEdition(pathname.slice('/books/'.length), edition)) return rewriteTo(request, `${pathname}/edition/${edition}/${hint}`, true);
    return NextResponse.next();
  }
  return null;
}

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
  const variant = guestStaticVariant(request);
  if (variant) return variant;
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
  matcher: ['/', '/admin/:path*', '/japanese/:path*', '/chinese/:path*', '/english/:path*', '/french/:path*', '/learn/course', '/discover', '/lessons',
    '/home', '/books/japanese-n5', '/books/japanese-n4', '/books/japanese-n3'],
};
