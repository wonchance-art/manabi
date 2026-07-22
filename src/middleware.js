import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// EMEA 오버월드 자산 가드는 #306 일반 공개(releaseEligible 릴리스 정합 전환)로 폐기했다.
// 스테일 가드가 남아 비관리자 전원이 EMEA 지형 404를 받는 라이브 결함을 만들었음(2026-07-22
// 게스트 라이브 검수 실측). 미출시 지역이 다시 생기면 git 이력의 프리픽스 가드 패턴으로 복원한다.
export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/admin')) return NextResponse.next();

  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 미로그인 → 로그인 페이지
  if (!user) return NextResponse.redirect(new URL('/auth', request.url));

  // role 확인 (DB 호출)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // 어드민 아님 → 홈으로
  if (profile?.role !== 'admin') return NextResponse.redirect(new URL('/', request.url));

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
