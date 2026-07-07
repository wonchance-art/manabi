// 서버 전용 인증 헬퍼 — API 라우트에서 로그인/관리자 검증을 재사용한다.
// 반환 계약: 성공 { user }, 실패 { error, status } (기존 media 라우트 requireUser 형태와 동일).
// 패턴 근거: src/app/api/admin/dictionary/route.js — getUser(anon) → profiles.role==='admin'(service-role).
// 회원가입이 개방돼 있어 "로그인 유저 = 인터넷 아무나"라는 전제로 admin 게이트를 서버에서 강제.

import { createClient } from '@supabase/supabase-js';

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
}

// Bearer 토큰 → 로그인 유저. 실패 시 { error, status: 401 }.
export async function requireUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return { error: '로그인이 필요합니다.', status: 401 };
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: { user }, error } = await anonClient().auth.getUser(token);
  if (error || !user) return { error: '세션이 만료됐어요. 다시 로그인해주세요.', status: 401 };
  return { user };
}

// 로그인 + profiles.role==='admin'. 비로그인 401, 비관리자 403.
export async function requireAdmin(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', auth.user.id).single();
  if (profile?.role !== 'admin') return { error: '관리자 전용 기능이에요.', status: 403 };
  return { user: auth.user };
}
