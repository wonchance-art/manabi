// 교정의 사전 승격 엔드포인트 — 뷰어 편집(✏️)에서 "이 단어 전체에 적용"을 켠 경우.
// morpheme_dictionary 쓰기는 service_role 전용(RLS)이라 서버를 거친다.
// 기존 행을 읽어 교정을 선두로 병합(buildPromotedEntry)하고 user_verified로 upsert —
// 이후 모든 분석 경로가 교정을 따르고, 자가 치유 로직은 이 행을 덮지 않는다.
//
// 권한(2026-10-07): 공유 사전은 전 사용자 화면·분석에 쓰이고 user_verified 행은 자가 치유가
// 되돌리지 않으므로, 로그인만으로는 쓸 수 없다. 화면이 이 옵션을 보이는 범위와 같게 —
// 요청한 material_id의 소유자(또는 관리자)이고, 그 자료의 processed_json에 그 단어가 실제로
// 있을 때만 upsert한다. 자료 언어와 다른 사전도 덮지 못한다.

import { createClient } from '@supabase/supabase-js';
import { buildPromotedEntry } from '@/lib/server/promoteDictCorrection';
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';
import { requireUser, isAdminUser } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

const LANGS = ['Japanese', 'English', 'Chinese'];
const KEY_MAX = 60;
const normKey = (v) => (typeof v === 'string' ? v.trim().slice(0, KEY_MAX) : '');

// reading_materials.id는 bigint — 문자열/정수 모두 받되 숫자 id 형식만 통과.
function parseMaterialId(v) {
  const s = typeof v === 'number' && Number.isSafeInteger(v) ? String(v) : (typeof v === 'string' ? v.trim() : '');
  return /^[1-9]\d{0,18}$/.test(s) ? s : null;
}

// 뷰어는 token.sep_link || token.base_form || token.text를 보낸다 — 그 자료의 토큰 중 하나가
// 같은 키(어느 필드든)를 가지면 그 단어는 이 자료에 실제로 있다.
function materialHasWord(processedJson, baseForm) {
  const dict = processedJson?.dictionary;
  if (!dict || typeof dict !== 'object') return false;
  return Object.values(dict).some((t) => t && typeof t === 'object'
    && [t.sep_link, t.base_form, t.text].some((k) => k && normKey(k) === baseForm));
}

export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const { user } = auth;

  const rl = rateLimit(getClientKey(request, user.id), { limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return Response.json(
      { error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Bad JSON' }, { status: 400 });
  }
  const baseForm = normKey(body?.base_form);
  const language = body?.language;
  const materialId = parseMaterialId(body?.material_id);
  const c = body?.corrections || {};
  const corrections = {
    ...(typeof c.meaning === 'string' ? { meaning: c.meaning } : {}),
    ...(typeof c.furigana === 'string' ? { furigana: c.furigana } : {}),
    ...(typeof c.pos === 'string' ? { pos: c.pos } : {}),
  };
  if (!baseForm || !LANGS.includes(language) || Object.keys(corrections).length === 0) {
    return Response.json({ error: 'base_form, language, corrections required' }, { status: 400 });
  }
  if (!materialId) {
    return Response.json({ error: 'material_id required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    // ⑴ 권한: 그 자료의 소유자 또는 관리자. 없는 자료도 같은 403(존재 여부를 흘리지 않는다).
    const { data: material, error: matErr } = await supabase
      .from('reading_materials')
      .select('id, owner_id, processed_json')
      .eq('id', materialId)
      .maybeSingle();
    if (matErr) throw matErr;
    const isOwner = !!material && material.owner_id === user.id;
    if (!isOwner && !(material && await isAdminUser(user.id))) {
      return Response.json({ error: '이 자료의 단어만 사전에 반영할 수 있어요.' }, { status: 403 });
    }
    // ⑵ 범위: 자료 언어의 사전만, 그 자료에 실제로 있는 단어만.
    const materialLang = material.processed_json?.metadata?.language || 'Japanese';
    if (materialLang !== language || !materialHasWord(material.processed_json, baseForm)) {
      return Response.json({ error: '이 자료에 있는 단어만 사전에 반영할 수 있어요.' }, { status: 422 });
    }

    const { data: existing, error: selErr } = await supabase
      .from('morpheme_dictionary')
      .select('meanings, reading, pos')
      .eq('language', language)
      .eq('base_form', baseForm)
      .maybeSingle();
    if (selErr) throw selErr;

    const entry = buildPromotedEntry(existing, corrections, language); // X: 정본 밖 pos는 승격에서 제외
    if (!entry) {
      // 뜻 없는 미등재 단어에 발음만 승격 요청 — 사전 행이 성립하지 않는다
      return Response.json({ error: '뜻이 있어야 사전에 반영할 수 있어요.' }, { status: 422 });
    }

    const { error: upErr } = await supabase
      .from('morpheme_dictionary')
      .upsert({ base_form: baseForm, language, ...entry }, { onConflict: 'base_form,language' });
    if (upErr) throw upErr;

    // 감사 흔적(새 테이블 없이 서버 로그 1줄) — 누가 어느 자료에서 공유 사전을 바꿨는지.
    // 뜻 본문은 남기지 않는다(자료 쪽 교정 이력은 token_corrections에 이미 있다).
    console.info('[api/dict-correct] promoted', JSON.stringify({
      user_id: user.id, material_id: materialId, language, base_form: baseForm, by: isOwner ? 'owner' : 'admin',
    }));
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[api/dict-correct] error:', err?.message);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
