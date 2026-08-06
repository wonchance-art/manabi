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

  // 이 엔드포인트의 정당한 용도는 '아직 비어 있는 공용 설명을 캐시로 채우는 것'뿐이다.
  // 로그인만 하면 누구나 임의 문자열을 보낼 수 있으므로, 이미 채워진 설명은 덮어쓰지 않는다
  // (반달리즘·오염 차단). 잘못 채워진 항목은 관리자 사전 화면에서 교정한다.
  // 렌더 단계는 이미 이스케이프하지만(#835), 저장 단계에서도 마크업성 입력을 거절한다.
  if (/[<>]/.test(String(detail_text))) {
    return Response.json({ error: 'markup not allowed' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('morpheme_dictionary')
    .select('detail_text')
    .eq('base_form', base_form)
    .eq('language', language)
    .maybeSingle();

  if (existing?.detail_text) {
    return Response.json({ ok: true, skipped: 'already filled' });
  }

  const { error } = await supabase
    .from('morpheme_dictionary')
    .update({ detail_text: String(detail_text).slice(0, MAX_DETAIL_LEN) }) // 길이 캡
    .eq('base_form', base_form)
    .eq('language', language);

  if (error) return Response.json({ error: 'save failed' }, { status: 500 });
  return Response.json({ ok: true });
}
