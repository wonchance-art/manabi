import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { authReturnPath } from '@/lib/authRedirect';
import { recordExplicitProfileLogin } from '@/lib/learningActivity';
import { UUID } from '@/lib/learningSources';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = authReturnPath(searchParams.get('next'), '/materials');
  const failure = new URL('/auth', origin);
  failure.searchParams.set('error', 'auth_callback_failed');
  failure.searchParams.set('from', next);
  const pendingCookies = [];
  let authenticated = false;

  if (code) {
    try {
      const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            pendingCookies.push(...cookiesToSet);
          },
        },
      });
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      authenticated = !error;
      // 실제 code 교환 결과만 로그인 쓰기를 허용한다. URL/쿠키의 actor 주장은 사용하지 않는다.
      const session = data?.session, user = session?.user;
      if (!error && typeof session?.access_token === 'string' && session.access_token
          && UUID.test(user?.id || '') && user.is_anonymous !== true
          && (!data.user || data.user.id === user.id)) {
        try { await recordExplicitProfileLogin({ client: supabase, user }); }
        catch { /* 프로필 전송 실패가 이미 성공한 로그인 쿠키/리다이렉트를 손상시키지 않는다. */ }
      }
    } catch {
      // Expired codes and transport failures return to sign-in without exposing
      // a provider error or leaving the user on an unhandled server error page.
    }
  }

  const response = NextResponse.redirect(authenticated ? new URL(next, origin) : failure);
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
