import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

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

// POST — 상세 설명 저장
export async function POST(request) {
  const { base_form, language, detail_text } = await request.json();
  if (!base_form || !language || !detail_text) {
    return Response.json({ error: 'missing fields' }, { status: 400 });
  }

  const supabase = getSupabase();
  await supabase
    .from('morpheme_dictionary')
    .update({ detail_text })
    .eq('base_form', base_form)
    .eq('language', language);

  return Response.json({ ok: true });
}
