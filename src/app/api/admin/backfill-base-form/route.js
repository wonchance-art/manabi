// 기존 user_vocabulary에서 base_form NULL인 항목을 일괄 채움
// - 일본어: kuromoji로 분석 → 첫 토큰의 basic_form 사용
// - 영어: surface.toLowerCase()

import { createClient } from '@supabase/supabase-js';
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

  // 언어 자동 감지 (language NULL 대응)
  const hasCJK = (s) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(s);

  let updated = 0, failed = 0;
  for (const row of items) {
    const lang = row.language || (hasCJK(row.word_text) ? 'Japanese' : 'English');
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
        .update({ base_form: baseForm, language: lang })
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
