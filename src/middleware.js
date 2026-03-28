import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // /admin 경로: 서버에서 세션 검증
  if (pathname.startsWith('/admin')) {
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
    if (!user) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }

    // role 확인 (DB 호출)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // 어드민 아님 → 홈으로
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
