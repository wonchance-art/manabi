// 기존 user_vocabulary에서 base_form NULL인 항목을 일괄 채움
// - 일본어: kuromoji로 분석 → 첫 토큰의 basic_form 사용
// - 영어: surface.toLowerCase()

import { createClient } from '@supabase/supabase-js';
import { detectLang, detectLangConfident } from '@/lib/constants';
import { tokenizeJaLine } from '@/lib/server/tokenizeJa';

export const runtime = 'nodejs';
export const maxDuration = 300;

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
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin' ? user : null;
}

export async function POST(request) {
  const admin = await requireAdmin(request);
  if (!admin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // base_form NULL 항목 조회 (배치 한정)
  const { data: items, error } = await supabase
    .from('user_vocabulary')
    .select('id, word_text, language')
    .is('base_form', null)
    .limit(2000);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!items?.length) return Response.json({ updated: 0, message: '백필할 항목 없음' });

  // 이 라우트의 일은 **base_form 백필**이다. 언어는 그 알고리즘을 고르는 데만 쓰고,
  // 확신 없는 추측을 `language` 컬럼에 **되쓰지 않는다** — 옛 중국어 행이 여기서도
  // `Japanese`로 굳고 있었다(같은 2트랙 복제가 클라이언트에 셋 더 있었다).
  let updated = 0, failed = 0;
  for (const row of items) {
    // 형태소 분석기 선택용 — 한자·가나면 ja 경로, 아니면 소문자화. **표기 판단**이다.
    const lang = row.language || detectLang(row.word_text);
    const lang2 = detectLangConfident(row.word_text);
    let baseForm = row.word_text; // fallback

    try {
      if (lang === 'Japanese') {
        const tokens = await tokenizeJaLine(row.word_text);
        if (tokens?.length > 0) {
          baseForm = tokens[0].base_form || row.word_text;
        }
      } else {
        baseForm = row.word_text.toLowerCase();
      }

      const { error: updErr } = await supabase
        .from('user_vocabulary')
        // language는 **확신할 때만** 채운다(빈 채로 두는 편이 잘못 굳는 것보다 낫다).
        .update({ base_form: baseForm, ...(row.language ? {} : lang2 ? { language: lang2 } : {}) })
        .eq('id', row.id);
      if (updErr) { failed++; continue; }
      updated++;
    } catch {
      failed++;
    }
  }

  return Response.json({
    scanned: items.length,
    updated,
    failed,
    remaining: items.length >= 2000 ? '≥2000 (다시 실행 필요)' : 0,
  });
}
