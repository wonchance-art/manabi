// 관리자용 사전 항목 CRUD
// GET  ?q=검색어&source=gemini&language=Japanese&limit=50 → 항목 리스트
// PATCH { id, updates } → 의미/pos/reading 수정 (source='user_verified'로 승격)
// DELETE ?id=... → 항목 삭제

import { createClient } from '@supabase/supabase-js';
import { normalizeAdminMeanings } from '@/lib/server/adminDictionaryMeanings';

export const runtime = 'nodejs';

async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const sa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user } } = await sa.auth.getUser(token);
  if (!user) return null;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin' ? user : null;
}

function serverSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function GET(request) {
  const admin = await requireAdmin(request);
  if (!admin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const source = searchParams.get('source');
  const language = searchParams.get('language') || 'Japanese';
  const limit = Math.min(parseInt(searchParams.get('limit')) || 50, 200);

  const supabase = serverSupabase();
  let query = supabase
    .from('morpheme_dictionary')
    .select('id, base_form, language, pos, reading, meanings, source, usage_count, last_used_at', { count: 'exact' })
    .eq('language', language)
    .order('last_used_at', { ascending: false })
    .limit(limit);

  if (source) query = query.eq('source', source);
  if (q) query = query.ilike('base_form', `%${q}%`);

  const { data, error, count } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ items: data || [], total: count ?? 0 });
}

export async function PATCH(request) {
  const admin = await requireAdmin(request);
  if (!admin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Bad JSON' }, { status: 400 }); }
  const { id, updates } = body || {};
  if (!id || !updates) return Response.json({ error: 'id + updates required' }, { status: 400 });

  const supabase = serverSupabase();
  const allowed = {};
  if (typeof updates.pos === 'string') allowed.pos = updates.pos.slice(0, 30);
  if (typeof updates.reading === 'string') allowed.reading = updates.reading.slice(0, 100);
  if (Array.isArray(updates.meanings)) {
    // 뜻별 pos·en_pos_v(요청에 있으면 보존)와, 글자가 그대로인 뜻의 기존 pos·en_pos_v·ja를 이어받는다
    // — 예전엔 {meaning, priority}만 남겨 편집 한 번에 겸류 뜻 정렬 정보가 영구히 사라졌다(MEANING-VERIFY-001).
    const { data: current, error: readError } = await supabase
      .from('morpheme_dictionary')
      .select('language, meanings')
      .eq('id', id)
      .single();
    if (readError || !current) return Response.json({ error: 'Not found' }, { status: 404 });
    allowed.meanings = normalizeAdminMeanings(updates.meanings, {
      language: current.language,
      previous: current.meanings,
    });
  }
  if (Object.keys(allowed).length === 0) {
    return Response.json({ error: 'No valid fields' }, { status: 400 });
  }
  allowed.source = 'user_verified'; // 관리자 편집 → 검증 상태로 승격

  const { data, error } = await supabase
    .from('morpheme_dictionary')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ item: data });
}

export async function DELETE(request) {
  const admin = await requireAdmin(request);
  if (!admin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const supabase = serverSupabase();
  const { error } = await supabase.from('morpheme_dictionary').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
