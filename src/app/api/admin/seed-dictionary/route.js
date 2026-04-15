// 관리자 전용 — 공유 사전 시드
// 1. 내장 SEED_JP_CORE에 사용자 제공 추가 목록(base_forms) 합치기
// 2. 이미 DB에 있는 것 제외
// 3. Gemini로 배치 의미 요청 → upsert

import { createClient } from '@supabase/supabase-js';
import { SEED_JP_CORE } from '@/lib/server/seed-jp-core';
import { SEED_JP_COMMON } from '@/lib/server/seed-jp-common';
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
    includeCore = true,               // SEED_JP_CORE 포함 (조사/조동사/빈도 최상위 ~180)
    includeCommon = false,             // SEED_JP_COMMON 포함 (일상 어휘 ~400)
    extraBaseForms = [],              // 사용자 제공 추가 목록
    limit = 1000,                     // 한번에 처리할 최대 항목
  } = body;

  const supabase = serverSupabase();

  // 1. 시드 대상 조립 (중복 제거)
  let candidates = [];
  const seen = new Set();
  const addIfNew = (item) => {
    if (seen.has(item.base_form)) return;
    seen.add(item.base_form);
    candidates.push(item);
  };

  if (includeCore) SEED_JP_CORE.forEach(addIfNew);
  if (includeCommon) SEED_JP_COMMON.forEach(addIfNew);
  if (Array.isArray(extraBaseForms)) {
    for (const bf of extraBaseForms) {
      if (typeof bf !== 'string') continue;
      const trimmed = bf.trim();
      if (!trimmed) continue;
      addIfNew({ base_form: trimmed, pos: '미분류', reading: '' });
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
    const { result: fetched, errors } = await fetchMeaningsForMissing(missing, 'Japanese', supabase);
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
      errors: errors.slice(0, 5), // 앞 5개만 노출
    });
  } catch (err) {
    return Response.json(
      { error: err?.message || 'Seed failed' },
      { status: 500 }
    );
  }
}
