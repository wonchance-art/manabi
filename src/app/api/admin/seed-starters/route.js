import { createClient } from '@supabase/supabase-js';
import { STARTER_MATERIALS } from '../../../../lib/starter-content.js';
import { requireAdmin } from '@/lib/server/auth';

export async function POST(request) {
  // 관리자 판별과 시드 쓰기는 service-role로만 — anon 키로 떨어지면 profiles 조회가 anon으로 돌아
  // 프로필 공개 범위 2단계(PROFILES-PRIVACY-001 ②) 뒤 관리자도 403이 된다. 키가 없으면 닫힌 채 503.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: '서버 설정이 끝나지 않아 지금은 실행할 수 없어요.' }, { status: 503 });
  }
  const auth = await requireAdmin(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const { user } = auth;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // 이미 존재하는 스타터 자료 확인 (title 기준)
  // 148+ 타이틀을 한 번에 .in()으로 보내면 PostgREST URL 길이 제한 → 30개씩 배치
  const starterTitles = STARTER_MATERIALS.map(m => m.title);
  const CHUNK = 30;
  const existingTitles = new Set();
  for (let i = 0; i < starterTitles.length; i += CHUNK) {
    const slice = starterTitles.slice(i, i + CHUNK);
    const { data: existing } = await supabase
      .from('reading_materials')
      .select('title')
      .in('title', slice);
    for (const r of (existing || [])) existingTitles.add(r.title);
  }
  const toInsert = STARTER_MATERIALS.filter(m => !existingTitles.has(m.title));

  if (toInsert.length === 0) {
    return Response.json({ inserted: 0, message: '스타터 콘텐츠가 이미 모두 있어요.' });
  }

  const rows = toInsert.map(m => ({
    title: m.title,
    raw_text: m.raw_text,
    visibility: 'public',
    owner_id: user.id,
    processed_json: {
      sequence: [], dictionary: {}, last_idx: -1, status: 'idle',
      metadata: { language: m.language, level: m.level, updated_at: new Date().toISOString() },
    },
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('reading_materials')
    .insert(rows)
    .select('id, title');

  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  return Response.json({ inserted: inserted.length, materials: inserted });
}
