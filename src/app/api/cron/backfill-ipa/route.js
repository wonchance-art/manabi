import { createClient } from '@supabase/supabase-js';
import { callGemini, parseGeminiJSON } from '../../../../lib/gemini.js';
import { requireUser, isAdminUser, SERVICE_KEY_MISSING_MESSAGE } from '@/lib/server/auth';

export const maxDuration = 60;

export async function GET(request) {
  // 관리자 판별(isAdminUser)과 보충 쓰기는 service-role로만 — 키가 없으면 판별이 예외로 꺼져 관리자도 401이 되고
  // cron 경로는 쓰기 클라이언트를 만들지 못한다. seed-starters와 같이 닫힌 채 503(같은 안내)으로 돌려준다.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: SERVICE_KEY_MISSING_MESSAGE }, { status: 503 });
  }
  // 인증: CRON_SECRET (Vercel cron) OR 관리자 세션 (대시보드 수동 실행)
  // CRON_SECRET 미설정 시 "Bearer undefined" 통과 방지 — isCron은 시크릿이 있을 때만 참.
  const authHeader = request.headers.get('authorization');
  const isCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  let isAdmin = false;
  if (!isCron && authHeader?.startsWith('Bearer ')) {
    // 관리자 판별은 service-role 헬퍼로만 — anon 키 클라이언트의 profiles 조회는 anon으로 돌아
    // 프로필 공개 범위 2단계(PROFILES-PRIVACY-001 ②) 뒤 0행이 된다.
    try {
      const auth = await requireUser(request);
      if (!auth.error) isAdmin = await isAdminUser(auth.user.id);
    } catch {}
  }
  if (!isCron && !isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // 1. furigana NULL 또는 빈 문자열인 영어 단어 수집 (배치당 최대 200)
  const [{ data: nullRows }, { data: emptyRows }] = await Promise.all([
    supabase.from('user_vocabulary')
      .select('id, base_form')
      .eq('language', 'English')
      .is('furigana', null)
      .limit(200),
    supabase.from('user_vocabulary')
      .select('id, base_form')
      .eq('language', 'English')
      .eq('furigana', '')
      .limit(200),
  ]);
  const empties = [...(nullRows || []), ...(emptyRows || [])];
  if (empties.length === 0) {
    return Response.json({ stage: 'idle', dictUpdated: 0, geminiUpdated: 0, remaining: 0 });
  }

  // 2. 사전 매칭으로 1차 백필
  const baseForms = [...new Set(empties.map(v => v.base_form).filter(Boolean))];
  let dictMap = new Map();
  if (baseForms.length > 0) {
    const { data: dictRows } = await supabase
      .from('morpheme_dictionary')
      .select('base_form, reading')
      .eq('language', 'English')
      .in('base_form', baseForms);
    dictMap = new Map((dictRows || []).filter(d => d.reading?.trim()).map(d => [d.base_form, d.reading]));
  }

  let dictUpdated = 0;
  const stillEmptyByBase = new Map(); // base_form → row[]
  for (const v of empties) {
    const ipa = dictMap.get(v.base_form);
    if (ipa) {
      const { error } = await supabase.from('user_vocabulary').update({ furigana: ipa }).eq('id', v.id);
      if (!error) dictUpdated++;
    } else if (v.base_form) {
      const arr = stillEmptyByBase.get(v.base_form) || [];
      arr.push(v);
      stillEmptyByBase.set(v.base_form, arr);
    }
  }

  // 3. 사전에 없는 단어 → Gemini 배치 호출 (한 번에 25개, 최대 3회 = 75개)
  const remainingBaseForms = [...stillEmptyByBase.keys()];
  const BATCH = 25;
  const MAX_BATCHES = 3;
  let geminiUpdated = 0;

  for (let i = 0; i < remainingBaseForms.length && i < BATCH * MAX_BATCHES; i += BATCH) {
    const slice = remainingBaseForms.slice(i, i + BATCH);
    const prompt = `Provide IPA pronunciation for these English words. Output JSON only.

Words:
${slice.map((w, idx) => `${idx + 1}. ${w}`).join('\n')}

Format: {"results":[{"word":"example","ipa":"/ɪɡˈzæm.pəl/"}, ...]}
Rules:
- Slash-delimited IPA (American English preference)
- Same order as input, one entry per word
- Skip words you cannot confidently transcribe (do not include them in results)
- Output JSON only, no other text`;

    let parsed;
    try {
      const raw = await callGemini(prompt);
      const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '';
      parsed = parseGeminiJSON(text);
    } catch {
      continue;
    }
    const results = parsed?.results || [];

    for (const entry of results) {
      const word = String(entry.word || '').trim();
      const ipa = String(entry.ipa || '').trim();
      if (!word || !ipa) continue;
      // user_vocabulary 업데이트 (해당 base_form의 모든 빈 행)
      const targetRows = stillEmptyByBase.get(word) || [];
      for (const r of targetRows) {
        const { error } = await supabase.from('user_vocabulary')
          .update({ furigana: ipa })
          .eq('id', r.id);
        if (!error) geminiUpdated++;
      }
      // morpheme_dictionary는 reading만 비어있을 때 업데이트 (meanings 등은 보존)
      await supabase.from('morpheme_dictionary')
        .update({ reading: ipa })
        .eq('language', 'English')
        .eq('base_form', word)
        .or('reading.is.null,reading.eq.');
    }
  }

  return Response.json({
    stage: 'complete',
    dictUpdated,
    geminiUpdated,
    initialEmpty: empties.length,
    remaining: Math.max(0, empties.length - dictUpdated - geminiUpdated),
  });
}
