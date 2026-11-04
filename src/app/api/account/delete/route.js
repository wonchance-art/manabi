// 계정 영구 삭제 — 본인 인증 필요
// Supabase auth.admin.deleteUser는 service_role 필요

import { createClient } from '@supabase/supabase-js';
import { supabasePublicKey } from '@/lib/supabaseKeys';
import { supabaseSecretKey } from '@/lib/server/supabaseKeys';

export const runtime = 'nodejs';

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const token = authHeader.replace(/^Bearer\s+/i, '');

  // 1. 세션 검증
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublicKey(),
    { db: { retry: false }, auth: { persistSession: false } }
  );
  const { data: { user }, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. service_role로 FSRS 학습 기록 → auth 사용자 삭제
  // 나머지는 CASCADE로 관련 데이터(vocab, materials, pdfs 등) 자동 삭제됨
  // (단, public 자료는 owner_id FK가 profiles이므로 profile 삭제 시 CASCADE됨)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseSecretKey(),
    { db: { retry: false }, auth: { persistSession: false } }
  );

  try {
    // 새 일정(FSRS) 학습 기록은 계정을 RESTRICT로 참조하고 보호 장치가 단어 · 채점 기록 삭제를 막는다 —
    // 그 계정의 FSRS 영수증 · 연산 · 카드를 먼저 지운다(service_role 전용 함수, ACCOUNT-DELETE-001). 다시 불러도 안전하다.
    const { error: learningError } = await admin.rpc('delete_account_learning_records', { p_user: user.id });
    if (learningError) throw learningError;
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[account/delete]', err);
    return Response.json({ error: err.message || '계정을 삭제하지 못했어요.' }, { status: 500 });
  }
}
