/**
 * 서버(route handler / 서버 컴포넌트)용 Supabase 클라이언트 — 쿠키 세션 기반.
 *
 * service_role 키는 절대 쓰지 않는다. 항상 anon key + 사용자 쿠키 세션으로 클라이언트를 만들어,
 * 모든 쓰기가 RLS 아래에서 수행되게 한다(is_admin() 정책이 최종 방어선).
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * 쿠키 세션이 붙은 Supabase 서버 클라이언트를 만든다.
 * route handler에서는 세션 갱신 쿠키를 다시 심을 수 있도록 setAll도 연결한다.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // 서버 컴포넌트 렌더 중에는 쿠키 쓰기가 불가 — 조용히 무시(route handler에선 정상 동작).
        }
      },
    },
  });
}

/**
 * 관리자 인증 게이트 — 쿠키 세션에서 유저를 확인하고 profiles.role='admin'인지 검사한다.
 * @returns {Promise<{ supabase, user } | { error: string, status: number }>}
 *   성공 시 { supabase, user }, 실패 시 { error, status }.
 *   반환된 supabase는 사용자 세션 클라이언트이므로 이걸로 쓰기하면 RLS가 그대로 적용된다.
 */
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다.', status: 401 };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (error || profile?.role !== 'admin') {
    return { error: '관리자 권한이 필요합니다.', status: 403 };
  }

  return { supabase, user };
}
