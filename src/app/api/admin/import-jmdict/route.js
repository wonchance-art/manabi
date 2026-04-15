// JMdict-simplified JSON을 morpheme_dictionary에 벌크 임포트
// https://github.com/scriptin/jmdict-simplified 포맷 지원
//
// 특징:
// - 공식 JMdict 형태 그대로 — 읽기/품사 신뢰도 높음
// - 의미는 JMdict gloss (Korean > English > Any) 사용
// - Korean 없으면 기본 의미 여러 개를 '||' 조인
// - 공통 단어(common: true)만 취하는 옵션

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5분

// JMdict POS 코드 → 한국어 품사
const JMDICT_POS_MAP = {
  'n': '명사', 'n-suf': '명사', 'n-pref': '명사', 'n-adv': '명사', 'n-t': '명사',
  'v1': '동사', 'v5u': '동사', 'v5k': '동사', 'v5s': '동사', 'v5t': '동사',
  'v5n': '동사', 'v5b': '동사', 'v5m': '동사', 'v5r': '동사', 'v5g': '동사',
  'vs': '동사', 'vs-i': '동사', 'vs-s': '동사', 'vk': '동사', 'vz': '동사',
  'adj-i': '형용사', 'adj-ix': '형용사', 'adj-na': '형용동사', 'adj-no': '연체사',
  'adj-t': '형용사', 'adj-f': '형용사', 'adj-pn': '연체사',
  'adv': '부사', 'adv-to': '부사',
  'conj': '접속사',
  'int': '감탄사',
  'prt': '조사',
  'aux': '조동사', 'aux-v': '조동사', 'aux-adj': '조동사',
  'pron': '대명사',
  'cop': '조동사',
  'num': '수사', 'ctr': '조수사',
  'exp': '관용구',
  'suf': '접미사', 'pref': '접두사',
};

function mapPos(pos) {
  if (!pos || pos.length === 0) return '기타';
  for (const p of pos) {
    const mapped = JMDICT_POS_MAP[p];
    if (mapped) return mapped;
  }
  return '기타';
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
  if (!admin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Bad JSON' }, { status: 400 }); }

  const {
    words,               // JMdict-simplified words array
    commonOnly = true,   // common:true 단어만 임포트
    limit = 10000,       // 한번에 최대 처리
    preferKorean = true, // 한국어 gloss 우선 (없으면 영어)
  } = body;

  if (!Array.isArray(words)) {
    return Response.json({ error: 'words must be an array' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // 1. 변환 (JMdict 엔트리 → morpheme_dictionary row)
  const rows = [];
  const seen = new Set();
  let skippedNoKanji = 0, skippedNoGloss = 0, skippedNotCommon = 0;

  for (const w of words) {
    if (rows.length >= limit) break;

    // 단어 표기 (한자 우선, 없으면 히라가나)
    const kanjiEntry = w.kanji?.find(k => (!commonOnly || k.common));
    const kanaEntry = w.kana?.find(k => (!commonOnly || k.common)) || w.kana?.[0];

    const baseForm = kanjiEntry?.text || kanaEntry?.text;
    const reading = kanaEntry?.text;

    if (!baseForm) { skippedNoKanji++; continue; }
    if (commonOnly && !(kanjiEntry?.common || kanaEntry?.common)) { skippedNotCommon++; continue; }
    if (seen.has(baseForm)) continue;
    seen.add(baseForm);

    // 의미 추출 (첫 sense만)
    const firstSense = w.sense?.[0];
    if (!firstSense?.gloss?.length) { skippedNoGloss++; continue; }

    // 한국어 gloss 찾기
    const koGlosses = firstSense.gloss.filter(g => g.lang === 'kor' || g.lang === 'ko');
    const enGlosses = firstSense.gloss.filter(g => g.lang === 'eng' || g.lang === 'en' || !g.lang);
    const chosenGlosses = (preferKorean && koGlosses.length > 0) ? koGlosses : enGlosses;

    if (chosenGlosses.length === 0) { skippedNoGloss++; continue; }

    const meanings = chosenGlosses.slice(0, 3).map((g, i) => ({
      meaning: String(g.text).slice(0, 200),
      priority: i + 1,
    }));

    rows.push({
      base_form: baseForm,
      language: 'Japanese',
      pos: mapPos(firstSense.partOfSpeech),
      reading: reading || null,
      meanings,
      source: koGlosses.length > 0 ? 'jmdict' : 'jmdict_en', // 영어만 있으면 구분
    });
  }

  if (rows.length === 0) {
    return Response.json({
      inserted: 0,
      total: words.length,
      skippedNoKanji, skippedNoGloss, skippedNotCommon,
      message: '임포트 가능한 항목이 없어요.',
    });
  }

  // 2. 배치 upsert (크기 제한 피하려 500개씩)
  let inserted = 0, upsertErrors = 0;
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('morpheme_dictionary')
      .upsert(chunk, { onConflict: 'base_form,language', ignoreDuplicates: true });
    if (error) {
      upsertErrors++;
      console.warn('[import-jmdict] batch err:', error.message);
    } else {
      inserted += chunk.length;
    }
  }

  return Response.json({
    total: words.length,
    processed: rows.length,
    inserted,
    upsertErrors,
    skipped: {
      noKanji: skippedNoKanji,
      noGloss: skippedNoGloss,
      notCommon: skippedNotCommon,
    },
    koreanGlossCount: rows.filter(r => r.source === 'jmdict').length,
    englishGlossCount: rows.filter(r => r.source === 'jmdict_en').length,
  });
}
