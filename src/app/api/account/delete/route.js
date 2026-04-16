// 계정 영구 삭제 — 본인 인증 필요
// Supabase auth.admin.deleteUser는 service_role 필요

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const token = authHeader.replace(/^Bearer\s+/i, '');

  // 1. 세션 검증
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. service_role로 auth 사용자 삭제
  // RLS CASCADE로 관련 데이터(vocab, materials, pdfs 등) 자동 삭제됨
  // (단, public 자료는 owner_id FK가 profiles이므로 profile 삭제 시 CASCADE됨)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[account/delete]', err);
    return Response.json({ error: err.message || '삭제 실패' }, { status: 500 });
  }
}
