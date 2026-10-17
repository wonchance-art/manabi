/**
 * 서버(route handler / 서버 컴포넌트)용 Supabase 클라이언트 — 쿠키 세션 기반.
 *
 * service_role 키는 절대 쓰지 않는다. 항상 anon key + 사용자 쿠키 세션으로 클라이언트를 만들어,
 * 모든 쓰기가 RLS 아래에서 수행되게 한다(is_admin() 정책이 최종 방어선).
 */
import { combineChunks, createServerClient, stringFromBase64URL } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { withoutServerSignOut } from './authCookieGuard';

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
          // 동시 갱신에서 진 요청(409)이 인증 쿠키를 지워 로그아웃시키지 않게 — 서버는 로그아웃하지 않는다(authCookieGuard).
          withoutServerSignOut(cookiesToSet).forEach(({ name, value, options }) =>
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
 * 쿠키를 읽지도 쓰지도 않는 anon 클라이언트 — 공개 응답(누구에게나 같은 바이트, 공유 캐시에 맡길 수 있는 응답)을 만드는 조회 전용.
 * 쿠키 세션 클라이언트(createSupabaseServerClient)로 조회하면 만료된 세션을 갱신하며 route handler 응답에 Set-Cookie(새 접근 ·
 * 갱신 토큰)를 싣는다 — 그 응답이 `Cache-Control: public`이면 공유 캐시가 남의 세션 쿠키를 저장 · 재사용할 수 있다(ASSET-CACHE-COOKIE-001).
 * 세션이 없으니 RLS는 anon 기준이다(공개 행만).
 */
export function createSupabasePublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
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
  if (!user) return { error: '로그인이 필요해요.', status: 401 };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (error || profile?.role !== 'admin') {
    return { error: '관리자 권한이 필요해요.', status: 403 };
  }

  return { supabase, user };
}

/**
 * 로그인 인증 게이트 — 쿠키 세션에서 유저만 확인한다(권한 검사 없음).
 * requireAdmin 과 동일한 반환 계약을 따르되 role 검사를 하지 않아, 전체 로그인 유저에게
 * 개방된 기능(학습 월드 등)의 라우트에서 쓴다. 반환된 supabase 는 사용자 세션 클라이언트이므로
 * 이걸로 쓰기하면 RLS(own-only 등)가 그대로 적용된다. service_role 키는 절대 쓰지 않는다.
 * @returns {Promise<{ supabase, user } | { error: string, status: number }>}
 */
export async function requireUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요해요.', status: 401 };

  return { supabase, user };
}

/**
 * 쿠키 세션의 접근 토큰과 만료 시각(초) — **네트워크 0 · 갱신 0**. supabase-js의 getSession은 만료가 가까우면(90초 여유)
 * 토큰을 갱신하는데, 서버 컴포넌트는 쿠키를 쓸 수 없어(setAll이 던진다) 새 토큰이 버려지고 브라우저는 옛 refresh token을
 * 다시 쓴다 → 재사용 감지로 세션이 끊길 수 있다. 그래서 읽기 전용 미리 받기는 쿠키를 직접 읽는다(@supabase/ssr의 조각 합치기 ·
 * base64 풀기 그대로 — 저장 형식을 새로 만들지 않는다). 만료는 세션 expires_at과 토큰 exp 중 이른 쪽.
 * @returns {Promise<null | { token: string, exp: number }>}
 */
export async function cookieAccessToken() {
  const cookieStore = await cookies();
  const key = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const raw = await combineChunks(key, (name) => cookieStore.get(name)?.value ?? null);
  if (!raw) return null;
  const session = JSON.parse(raw.startsWith('base64-') ? stringFromBase64URL(raw.slice('base64-'.length)) : raw);
  const token = session?.access_token;
  if (typeof token !== 'string') return null;
  const claimExp = Number(JSON.parse(stringFromBase64URL(token.split('.')[1] || '')).exp);
  const exps = [Number(session.expires_at), claimExp].filter(Number.isFinite);
  return exps.length ? { token, exp: Math.min(...exps) } : null;
}

/** 미리 받기가 건너뛰는 만료 여유(초) — supabase-js 갱신 여유(90초) + 미리 받기 예산(0.8초)보다 넉넉하게. */
export const PREFETCH_TOKEN_MARGIN_SEC = 120;

/**
 * 로그인 확인(읽기 전용 미리 받기용) — requireUser와 같은 반환 계약이되 **토큰 갱신을 절대 일으키지 않는다**(LIBRARY-PREFETCH-002).
 * ① 쿠키의 접근 토큰 만료를 먼저 본다(네트워크 0): 없음 · 만료 · 120초 안에 만료 → { error }(미리 받기 null → 브라우저가 받는다).
 * ② 넉넉하면 그 토큰을 **명시해** 검증한다 — getClaims(token)은 세션을 다시 읽지 않는다. 프로젝트 JWKS가 비대칭(ES256)이면
 *    서명을 서버에서 바로 확인(인증 왕복 0, JWKS는 프로세스 안 캐시), 대칭(HS) 토큰이면 getClaims가 getUser(token)으로 물러선다.
 * user는 { id }만 — 쓰기 · 권한 판정에는 쓰지 않는다(그 자리는 requireUser · requireAdmin).
 * @returns {Promise<{ supabase, user: { id: string } } | { error: string, status: number }>}
 */
export async function requireUserClaims({ now = Date.now() } = {}) {
  const denied = { error: '로그인이 필요해요.', status: 401 };
  const session = await cookieAccessToken().catch(() => null);
  if (!session || session.exp * 1000 - now < PREFETCH_TOKEN_MARGIN_SEC * 1000) return denied;
  const supabase = await createSupabaseServerClient();
  // 만료 · 형식 오류는 getClaims가 오류를 돌려주지 않고 던진다(supabase-js validateExp) — 던짐도 같은 「로그인 필요」.
  const { data, error } = await supabase.auth.getClaims(session.token).catch((thrown) => ({ data: null, error: thrown }));
  const id = data?.claims?.sub;
  if (error || !id) return denied;
  return { supabase, user: { id } };
}
