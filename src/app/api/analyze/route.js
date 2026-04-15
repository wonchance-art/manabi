// 하이브리드 분석 엔드포인트:
// 1. kuromoji로 형태소 분할 (서버 로컬)
// 2. 공유 morpheme_dictionary에서 의미 조회
// 3. 미싱 base_form들만 Gemini에 의미 요청 (Day 2에서 구현)
// 4. 새 의미 DB 저장
// 5. processed_json 호환 포맷으로 응답

import { createClient } from '@supabase/supabase-js';
import { tokenizeJaLine } from '@/lib/server/tokenizeJa';
import { tokenizeEnLine } from '@/lib/server/tokenizeEn';
import { fetchMeaningsForMissing } from '@/lib/server/fetchMeanings';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Node.js 함수: 최대 60초

function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const { lines, language } = body;
  if (!Array.isArray(lines) || lines.length === 0) {
    return Response.json({ error: 'lines required' }, { status: 400 });
  }
  if (!['Japanese', 'English'].includes(language)) {
    return Response.json({ error: 'language must be Japanese or English' }, { status: 400 });
  }

  try {
    // 1. 각 줄 토큰화 (언어별)
    const tokenizer = language === 'Japanese' ? tokenizeJaLine : tokenizeEnLine;
    const tokenizedLines = await Promise.all(
      lines.map(async (line) => ({
        original: line,
        tokens: language === 'Japanese'
          ? await tokenizer(line)    // kuromoji async
          : tokenizer(line),          // 영어는 sync
      }))
    );

    // 2. 모든 base_form 수집 (중복 제거)
    const allBaseForms = new Set();
    for (const { tokens } of tokenizedLines) {
      for (const t of tokens) {
        if (t.base_form) allBaseForms.add(t.base_form);
      }
    }

    // 3. DB에서 기존 의미 조회
    const supabase = getServerSupabase();
    const { data: cachedRows } = await supabase
      .from('morpheme_dictionary')
      .select('base_form, meanings, pos, reading, source')
      .eq('language', language)
      .in('base_form', [...allBaseForms]);

    const cache = new Map((cachedRows || []).map(r => [r.base_form, r]));

    // 4. 미싱 base_form들을 Gemini로 배치 조회 → 캐시에 저장 후 병합
    const missingList = [];
    for (const { tokens } of tokenizedLines) {
      for (const t of tokens) {
        if (t.base_form && !cache.has(t.base_form) && !missingList.find(m => m.base_form === t.base_form)) {
          missingList.push({
            base_form: t.base_form,
            pos: t.pos,
            reading: t.furigana,
          });
        }
      }
    }

    if (missingList.length > 0) {
      try {
        const { result: fetched } = await fetchMeaningsForMissing(missingList, language, supabase);
        for (const [baseForm, entry] of fetched) {
          cache.set(baseForm, entry);
        }
      } catch (err) {
        console.warn('[api/analyze] Gemini meaning fetch failed:', err?.message);
      }
    }

    // 5. processed_json 호환 응답 조립
    const timestamp = Date.now();
    const results = tokenizedLines.map(({ tokens }, lineIdx) => {
      const sequence = [];
      const dictionary = {};
      tokens.forEach((t, tokenIdx) => {
        const tokenId = `id_${lineIdx}_${tokenIdx}_${timestamp}`;
        sequence.push(tokenId);
        const cached = cache.get(t.base_form);
        const meaning = cached?.meanings?.[0]?.meaning || '';
        dictionary[tokenId] = {
          text: t.text,
          furigana: cached?.reading || t.furigana || '',
          pos: cached?.pos || t.pos,
          meaning,
          base_form: t.base_form,
        };
      });
      return { sequence, dictionary };
    });

    // usage_count / last_used_at 업데이트 (fire-and-forget)
    const usedBaseForms = [...allBaseForms].filter(bf => cache.has(bf));
    if (usedBaseForms.length > 0) {
      supabase.rpc('touch_morphemes', {
        lang: language,
        base_forms: usedBaseForms,
      }).then(({ error }) => {
        if (error) console.warn('[analyze] touch_morphemes failed:', error.message);
      });
    }

    return Response.json({
      results,
      stats: {
        totalTokens: [...allBaseForms].length,
        cacheHits: usedBaseForms.length,
        geminiCalls: missingList.length,
      },
    });
  } catch (err) {
    console.error('[api/analyze] error:', err);
    return Response.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
