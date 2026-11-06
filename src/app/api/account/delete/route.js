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

  // 2. service_role로 저장소 파일 → 학습 기록 · 비공개 자료 → auth 사용자 순으로 지운다.
  // 나머지(단어 · 기록 · 서재 · 프로필 …)는 auth.users CASCADE가 지운다. 공개 자료는 owner_id SET NULL로 남는다(공개 교재 보존).
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    // 저장소 파일은 DB CASCADE가 지우지 않는다 — 그 계정의 객체(owner = uid 또는 `<uid>/` 경로)를 Storage API로 먼저 지운다
    // (ACCOUNT-DELETE-002). DB 행보다 먼저 지워야 실패해도 계정이 남아 다시 시도할 수 있다. 다시 불러도 안전하다.
    const { data: objects, error: listError } = await admin.rpc('account_storage_objects', { p_user: user.id });
    if (listError) throw listError;
    await removeStorageObjects(admin, objects || []);
    // 새 일정(FSRS) 학습 기록은 계정을 RESTRICT로 참조하고 보호 장치가 단어 · 채점 기록 삭제를 막는다 —
    // 그 계정의 FSRS 영수증 · 연산 · 카드를 먼저 지우고, 이어서 공개 아닌 자료를 지운다(작성기 자료는 SET NULL이 CHECK에 걸린다).
    // service_role 전용 함수(ACCOUNT-DELETE-001 · 002). 다시 불러도 안전하다.
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

const REMOVE_CHUNK = 100;

async function removeStorageObjects(admin, objects) {
  const byBucket = new Map();
  for (const { bucket_id: bucket, name } of objects) {
    if (!bucket || !name) continue;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(name);
  }
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += REMOVE_CHUNK) {
      const { error } = await admin.storage.from(bucket).remove(names.slice(i, i + REMOVE_CHUNK));
      if (error) throw error;
    }
  }
}
