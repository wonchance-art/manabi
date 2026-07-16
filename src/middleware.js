import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

const EMEA_PREVIEW_ASSET_PREFIX = '/assets/overworld/europe-mediterranean-middle-east-';

export function isProtectedOverworldPreviewAssetPath(pathname) {
  return typeof pathname === 'string' && pathname.startsWith(EMEA_PREVIEW_ASSET_PREFIX);
}

function privateAssetResponse(status = 404) {
  return new NextResponse(null, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie',
    },
  });
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const adminRoute = pathname.startsWith('/admin');
  const protectedPreviewAsset = isProtectedOverworldPreviewAssetPath(pathname);

  // 관리자 화면과 미출시 EMEA 원본 청크는 서버 세션·역할을 통과해야 한다.
  // 자산 요청은 미인증 여부 자체를 노출하지 않도록 로그인 리다이렉트 대신 404로 응답한다.
  if (adminRoute || protectedPreviewAsset) {
    const response = NextResponse.next();
    if (protectedPreviewAsset) {
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('Vary', 'Cookie');
    }

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
      if (protectedPreviewAsset) return privateAssetResponse();
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
      if (protectedPreviewAsset) return privateAssetResponse();
      return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/assets/overworld/:path*'],
};
