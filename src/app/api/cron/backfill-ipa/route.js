import { createClient } from '@supabase/supabase-js';
import { callGemini, parseGeminiJSON } from '../../../../lib/gemini.js';
import { requireUser, isAdminUser, SERVICE_KEY_MISSING_MESSAGE } from '@/lib/server/auth';
import { summarizeBackfillIpa, withCronRun } from '@/lib/server/cronRuns';

export const maxDuration = 60;

const IPA_BATCH = 25;
const IPA_MAX_BATCHES = 3; // 하루 상한 — 두 단계(단어장 · 공개 자료 사전 행)가 함께 쓴다(25 × 3 = 75낱말)

/** 낱말 묶음 → Map(word → IPA). 실패한 묶음은 건너뛴다(빈 Map). */
async function fetchIpaBatch(words) {
  const prompt = `Provide IPA pronunciation for these English words. Output JSON only.

Words:
${words.map((w, idx) => `${idx + 1}. ${w}`).join('\n')}

Format: {"results":[{"word":"example","ipa":"/ɪɡˈzæm.pəl/"}, ...]}
Rules:
- Slash-delimited IPA (American English preference)
- Same order as input, one entry per word
- Skip words you cannot confidently transcribe (do not include them in results)
- Output JSON only, no other text`;
  try {
    const raw = await callGemini(prompt);
    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '';
    const out = new Map();
    for (const entry of parseGeminiJSON(text)?.results || []) {
      const word = String(entry.word || '').trim();
      const ipa = String(entry.ipa || '').trim();
      if (word && ipa) out.set(word, ipa);
    }
    return out;
  } catch {
    return new Map();
  }
}

/**
 * 공개 영어 자료에 쓰인 낱말의 사전 행 중 reading(IPA)이 빈 것(IPA-DICT-001 · 2026-11-09 KST, 오케스트레이터 03:48 승인).
 * 로그인 카드의 발음 기호는 공유 사전 reading에서 온다 — 단어장에 담기기 전에는 위 1단계가 그 행을 채우지 않았다
 * (SEED-QA-002 B로 넣은 22행 실측). reading만 쓴다 — 뜻 · 품사 · source(user_verified 포함)는 그대로.
 */
async function publicDictIpaTargets(supabase, limit) {
  if (limit <= 0) return [];
  const { data: mats, error } = await supabase.from('reading_materials')
    .select('processed_json')
    .eq('visibility', 'public')
    .eq('processed_json->>status', 'completed')
    .eq('processed_json->metadata->>language', 'English');
  if (error || !mats?.length) return [];
  const forms = new Set();
  for (const m of mats) {
    for (const t of Object.values(m.processed_json?.dictionary || {})) {
      if (!t || t.pos === '기호' || t.pos === '개행' || !/\p{L}/u.test(String(t.text || ''))) continue;
      const key = t.sep_link || t.base_form;
      if (key) forms.add(key);
    }
  }
  const empty = [];
  const list = [...forms];
  for (let i = 0; i < list.length; i += 200) {
    const { data: rows } = await supabase.from('morpheme_dictionary')
      .select('base_form, reading')
      .eq('language', 'English')
      .in('base_form', list.slice(i, i + 200));
    for (const r of rows || []) if (!r.reading?.trim()) empty.push(r.base_form);
  }
  return empty.sort().slice(0, limit);
}

// OPS-HEALTH-001: 실행 한 줄(observe.cron_runs) — 인증 실패(401)는 남기지 않는다.
async function backfillIpa(request) {
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
  let geminiUpdated = 0;
  let batchesUsed = 0;

  for (let i = 0; i < remainingBaseForms.length && batchesUsed < IPA_MAX_BATCHES; i += IPA_BATCH) {
    const results = await fetchIpaBatch(remainingBaseForms.slice(i, i + IPA_BATCH));
    batchesUsed++;
    for (const [word, ipa] of results) {
      // user_vocabulary 업데이트 (해당 base_form의 모든 빈 행)
      for (const r of stillEmptyByBase.get(word) || []) {
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

  // 4. 남은 상한으로 공개 자료에 쓰인 사전 행의 빈 reading(IPA-DICT-001) — reading만, 비었을 때만.
  let publicDictUpdated = 0;
  let publicDictTargets = 0;
  try {
    const targets = await publicDictIpaTargets(supabase, (IPA_MAX_BATCHES - batchesUsed) * IPA_BATCH);
    publicDictTargets = targets.length;
    for (let i = 0; i < targets.length && batchesUsed < IPA_MAX_BATCHES; i += IPA_BATCH) {
      const results = await fetchIpaBatch(targets.slice(i, i + IPA_BATCH));
      batchesUsed++;
      for (const [word, ipa] of results) {
        if (!targets.includes(word)) continue;
        const { data: updated, error } = await supabase.from('morpheme_dictionary')
          .update({ reading: ipa })
          .eq('language', 'English')
          .eq('base_form', word)
          .or('reading.is.null,reading.eq.')
          .select('base_form');
        if (!error && updated?.length) publicDictUpdated++;
      }
    }
  } catch { /* 2단계 실패는 1단계 결과를 깨지 않는다 */ }

  if (empties.length === 0 && publicDictTargets === 0) {
    return Response.json({ stage: 'idle', dictUpdated: 0, geminiUpdated: 0, remaining: 0, publicDictTargets: 0, publicDictUpdated: 0 });
  }

  return Response.json({
    stage: 'complete',
    dictUpdated,
    geminiUpdated,
    initialEmpty: empties.length,
    remaining: Math.max(0, empties.length - dictUpdated - geminiUpdated),
    publicDictTargets,
    publicDictUpdated,
  });
}

export const GET = withCronRun('backfill-ipa', backfillIpa, summarizeBackfillIpa);
