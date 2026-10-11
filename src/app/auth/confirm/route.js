import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { EMAIL_OTP_TYPES, confirmDestination } from '@/lib/authConfirm';
import { recordExplicitProfileLogin } from '@/lib/learningActivity';
import { UUID } from '@/lib/learningSources';

// 메일 링크(token_hash) 확인 — /auth/callback(PKCE code 교환)과 달리 링크를 요청한 브라우저의
// code_verifier 쿠키가 필요 없어, PC에서 가입하고 휴대폰 메일에서 열어도 인증·재설정이 끝난다.
// Supabase 메일 템플릿이 {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<종류> 를 가리킬 때 쓰인다.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = confirmDestination(type, searchParams.get('next'));
  const failure = new URL('/auth', origin);
  failure.searchParams.set('error', 'auth_callback_failed');
  failure.searchParams.set('from', next);
  const pendingCookies = [];
  let authenticated = false;

  if (tokenHash && EMAIL_OTP_TYPES.has(type)) {
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
      const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      authenticated = !error;
      // 실제 확인 결과의 세션만 로그인 쓰기를 허용한다 — /auth/callback과 같은 조건.
      const session = data?.session, user = session?.user;
      if (!error && typeof session?.access_token === 'string' && session.access_token
          && UUID.test(user?.id || '') && user.is_anonymous !== true
          && (!data.user || data.user.id === user.id)) {
        try { await recordExplicitProfileLogin({ client: supabase, user }); }
        catch { /* 프로필 전송 실패가 이미 성공한 확인 쿠키/리다이렉트를 손상시키지 않는다. */ }
      }
    } catch {
      // 만료·재사용된 링크와 전송 실패는 공급자 오류를 노출하지 않고 로그인 화면으로 돌린다.
    }
  }

  const response = NextResponse.redirect(authenticated ? new URL(next, origin) : failure);
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
