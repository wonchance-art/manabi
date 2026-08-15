// 교정의 사전 승격 엔드포인트 — 뷰어 편집(✏️)에서 "이 단어 전체에 적용"을 켠 경우.
// morpheme_dictionary 쓰기는 service_role 전용(RLS)이라 서버를 거친다.
// 기존 행을 읽어 교정을 선두로 병합(buildPromotedEntry)하고 user_verified로 upsert —
// 이후 모든 분석 경로가 교정을 따르고, 자가 치유 로직은 이 행을 덮지 않는다.

import { createClient } from '@supabase/supabase-js';
import { buildPromotedEntry } from '@/lib/server/promoteDictCorrection';
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 15;

const LANGS = ['Japanese', 'English', 'Chinese'];

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !user) {
    return Response.json({ error: '세션이 만료됐어요. 다시 로그인해주세요.' }, { status: 401 });
  }

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
  const baseForm = typeof body?.base_form === 'string' ? body.base_form.trim().slice(0, 60) : '';
  const language = body?.language;
  const c = body?.corrections || {};
  const corrections = {
    ...(typeof c.meaning === 'string' ? { meaning: c.meaning } : {}),
    ...(typeof c.furigana === 'string' ? { furigana: c.furigana } : {}),
    ...(typeof c.pos === 'string' ? { pos: c.pos } : {}),
  };
  if (!baseForm || !LANGS.includes(language) || Object.keys(corrections).length === 0) {
    return Response.json({ error: 'base_form, language, corrections required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    const { data: existing, error: selErr } = await supabase
      .from('morpheme_dictionary')
      .select('meanings, reading, pos')
      .eq('language', language)
      .eq('base_form', baseForm)
      .maybeSingle();
    if (selErr) throw selErr;

    const entry = buildPromotedEntry(existing, corrections);
    if (!entry) {
      // 뜻 없는 미등재 단어에 발음만 승격 요청 — 사전 행이 성립하지 않는다
      return Response.json({ error: '뜻이 있어야 사전에 반영할 수 있어요.' }, { status: 422 });
    }

    const { error: upErr } = await supabase
      .from('morpheme_dictionary')
      .upsert({ base_form: baseForm, language, ...entry }, { onConflict: 'base_form,language' });
    if (upErr) throw upErr;

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[api/dict-correct] error:', err?.message);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
