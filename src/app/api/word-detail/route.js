import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/server/auth';

export const runtime = 'nodejs';

const MAX_DETAIL_LEN = 4000; // detail_text 길이 캡 — 공유 사전 쓰기 비용/오남용 상한

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// GET — DB에서 상세 설명 조회
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const baseForm = searchParams.get('base_form');
  const language = searchParams.get('language');
  if (!baseForm || !language) return Response.json({ detail: null });

  const supabase = getSupabase();
  const { data } = await supabase
    .from('morpheme_dictionary')
    .select('detail_text')
    .eq('base_form', baseForm)
    .eq('language', language)
    .maybeSingle();

  return Response.json({ detail: data?.detail_text || null });
}

// POST — 상세 설명 저장 (미인증 service-role 쓰기 방지 — 로그인 필수)
export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Bad JSON' }, { status: 400 }); }
  const { base_form, language, detail_text } = body || {};
  if (!base_form || !language || !detail_text) {
    return Response.json({ error: 'missing fields' }, { status: 400 });
  }

  const supabase = getSupabase();
  await supabase
    .from('morpheme_dictionary')
    .update({ detail_text: String(detail_text).slice(0, MAX_DETAIL_LEN) }) // 길이 캡
    .eq('base_form', base_form)
    .eq('language', language);

  return Response.json({ ok: true });
}
