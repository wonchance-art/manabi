// 관리자 전용 — 공유 사전 시드
// 1. 내장 SEED_JP_CORE에 사용자 제공 추가 목록(base_forms) 합치기
// 2. 이미 DB에 있는 것 제외
// 3. Gemini로 배치 의미 요청 → upsert

import { createClient } from '@supabase/supabase-js';
import { SEED_JP_CORE } from '@/lib/server/seed-jp-core';
import { fetchMeaningsForMissing } from '@/lib/server/fetchMeanings';

export const runtime = 'nodejs';
export const maxDuration = 120; // 최대 2분

function serverSupabase(token) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  return supabase;
}

async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user } } = await supabase.auth.getUser(token);
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

export async function POST(request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body = {};
  try { body = await request.json(); } catch {}
  const {
    includeCore = true,               // 내장 SEED_JP_CORE 포함 여부
    extraBaseForms = [],              // 사용자 제공 추가 목록 (["単語1", "単語2", ...])
    limit = 500,                      // 한번에 처리할 최대 항목
  } = body;

  const supabase = serverSupabase();

  // 1. 시드 대상 조립
  let candidates = [];
  if (includeCore) candidates.push(...SEED_JP_CORE);
  if (Array.isArray(extraBaseForms)) {
    for (const bf of extraBaseForms) {
      if (typeof bf !== 'string') continue;
      const trimmed = bf.trim();
      if (!trimmed) continue;
      if (candidates.find(c => c.base_form === trimmed)) continue;
      candidates.push({ base_form: trimmed, pos: '미분류', reading: '' });
    }
  }
  candidates = candidates.slice(0, limit);

  // 2. 이미 DB에 있는 것 제외
  const baseForms = candidates.map(c => c.base_form);
  const { data: existing } = await supabase
    .from('morpheme_dictionary')
    .select('base_form')
    .eq('language', 'Japanese')
    .in('base_form', baseForms);
  const existingSet = new Set((existing || []).map(e => e.base_form));
  const missing = candidates.filter(c => !existingSet.has(c.base_form));

  if (missing.length === 0) {
    return Response.json({
      skipped: candidates.length,
      inserted: 0,
      message: '모든 항목이 이미 사전에 있어요.',
    });
  }

  // 3. Gemini 배치 의미 요청 + upsert
  try {
    const fetched = await fetchMeaningsForMissing(missing, 'Japanese', supabase);
    // source를 'jmdict_seed'로 표시 (내장 시드 구분)
    const updateIds = [...fetched.keys()];
    if (updateIds.length > 0) {
      await supabase
        .from('morpheme_dictionary')
        .update({ source: 'jmdict_seed' })
        .eq('language', 'Japanese')
        .in('base_form', updateIds);
    }

    return Response.json({
      total: candidates.length,
      skipped: existingSet.size,
      attempted: missing.length,
      inserted: fetched.size,
      failed: missing.length - fetched.size,
    });
  } catch (err) {
    return Response.json(
      { error: err?.message || 'Seed failed' },
      { status: 500 }
    );
  }
}
