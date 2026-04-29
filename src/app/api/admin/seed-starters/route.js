import { createClient } from '@supabase/supabase-js';
import { STARTER_MATERIALS } from '../../../../lib/starter-content.js';

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

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
    return Response.json({ inserted: 0, message: '이미 모든 스타터 콘텐츠가 존재합니다.' });
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
