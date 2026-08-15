// 하이브리드 분석 엔드포인트:
// 1. kuromoji로 형태소 분할 (서버 로컬)
// 2. 공유 morpheme_dictionary에서 의미 조회
// 3. 미싱 base_form들만 Gemini에 의미 요청 (Day 2에서 구현)
// 4. 새 의미 DB 저장
// 5. processed_json 호환 포맷으로 응답

import { createClient } from '@supabase/supabase-js';
import { tokenizeJaLine } from '@/lib/server/tokenizeJa';
import { tokenizeEnLine } from '@/lib/server/tokenizeEn';
import { tokenizeZhLine } from '@/lib/server/tokenizeZh';
import { fetchMeaningsForMissing } from '@/lib/server/fetchMeanings';
import {
  collectZhPosMarks, disambiguateZhPos, resolveZhTokenPos, zhPosMarkKey,
  pickZhMeaning, needsZhMeaningPosRefresh, buildZhPosWriteback, splitZhToken,
} from '@/lib/server/disambiguateZhPos';
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Node.js 함수: 최대 60초

// 입력 캡(비용 남용 방지) — 정상 세션은 문단 단위 수 줄이라 캡에 닿지 않는다.
const MAX_LINES = 100;      // 요청당 줄 수
const MAX_LINE_LEN = 200;   // 줄당 문자 수
// 요청당 Gemini 의미 조회 상한(미싱 base_form) — fetchMeanings 배치 폭발 방지.
// BATCH_SIZE=15 기준 최대 ~7배치. 초과분은 이번 요청에 뜻 없이 넘어가고(빈 meaning) 다음
// 요청에서 다시 미싱으로 잡혀 점진 백필된다(그레이스풀 디그레이드).
const MAX_MISSING = 100;

function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function POST(request) {
  const startedAt = Date.now();
  // 인증 확인 — 로그인 사용자만 분석 가능 (Gemini 쿼터 남용 방지)
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

  // Rate limit — 사용자별 분당 20회
  const key = getClientKey(request, user.id);
  const rl = rateLimit(key, { limit: 20, windowMs: 60_000 });
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

  const { lines: rawLines, language } = body;
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return Response.json({ error: 'lines required' }, { status: 400 });
  }
  if (!['Japanese', 'English', 'Chinese'].includes(language)) {
    return Response.json({ error: 'language must be Japanese, English or Chinese' }, { status: 400 });
  }
  // 줄 수·줄 길이 캡 — 토큰화·Gemini 팬아웃 비용을 상한. 정상 세션(수 줄)은 영향 없음.
  const lines = rawLines.slice(0, MAX_LINES).map((l) => String(l ?? '').slice(0, MAX_LINE_LEN));

  try {
    // 1. 각 줄 토큰화 (언어별)
    // 일본어=kuromoji(async) · 영어=lemmatizer · 중국어=jieba+병음(둘 다 sync)
    const tokenizer = language === 'Japanese' ? tokenizeJaLine
      : language === 'Chinese' ? tokenizeZhLine
      : tokenizeEnLine;
    const tokenizedLines = await Promise.all(
      lines.map(async (line) => ({
        original: line,
        tokens: language === 'Japanese'
          ? await tokenizer(line)    // kuromoji async
          : tokenizer(line),          // 영어·중국어는 sync
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

    // 4.2. 중국어 자가 치유 — 다중 품사 행인데 뜻에 pos 태그가 없는 캐시 행은 미싱 경로로
    // 뜻을 재조회해 태깅한다(겸류사 뜻 정렬이 문맥 품사를 따르려면 뜻마다 pos가 필요).
    // 진짜 미싱 뒤에 붙어 MAX_MISSING 캡에서 미싱이 우선. 재조회 실패 시 기존 행 유지.
    if (language === 'Chinese') {
      for (const [baseForm, entry] of cache) {
        if (needsZhMeaningPosRefresh(entry) && !missingList.some(m => m.base_form === baseForm)) {
          missingList.push({ base_form: baseForm, pos: entry.pos, reading: entry.reading });
        }
      }
    }

    // 4.5. 중국어 품사 문맥 판별 — 겸류사(工作·计划·希望 등)는 jieba가 문맥 불문 단어당 한
    // 태그만 달고, 캐시 pos 우선 병합이 그 첫 품사를 박제한다(병음 박제 #1004와 같은 구조).
    // 명/동/형 계열 한자어를 모아 flash-lite 1회로 "품사 후보 전체 + 이 문장에서의 품사"를
    // 받는다. 뜻 조회와 서로 독립(판별은 pos만, 뜻 조회는 meaning만)이라 병렬 실행 —
    // 미싱이 있는 요청에선 벽시계 추가가 없다. 실패 시 기존 pos 폴백(그레이스풀).
    const zhMarks = language === 'Chinese' ? collectZhPosMarks(tokenizedLines, cache) : [];
    const posPicksPromise = zhMarks.length > 0
      ? disambiguateZhPos(lines, zhMarks, { deadlineMs: startedAt + 35_000 })
      : Promise.resolve(new Map());

    // 미싱 처리 상한 — 배치 폭발 방지. 초과분은 이번 요청에서 뜻 없이 넘어간다(다음에 백필).
    // deadline: 캐시가 빈 언어(중국어 개통 직후)는 미싱 100개 순차 조회가 실측 94s로 60s 캡을
    // 넘겨 함수째 죽고, 클라에선 문단 전체 실패로 보였다(#969). 함수 킬 전에 조회만 중단한다.
    const cappedMissing = missingList.slice(0, MAX_MISSING);
    const meaningsPromise = (async () => {
      if (cappedMissing.length === 0) return;
      try {
        // 35s: 마지막 웨이브가 deadline 직전 시작 + 개별 타임아웃 20s까지 물고 늘어져도
        // 60s(maxDuration) 안에 응답 조립까지 마치는 상한.
        const { result: fetched } = await fetchMeaningsForMissing(cappedMissing, language, supabase, {
          deadlineMs: startedAt + 35_000,
          concurrency: 3,
        });
        for (const [baseForm, entry] of fetched) {
          cache.set(baseForm, entry);
        }
      } catch (err) {
        console.warn('[api/analyze] Gemini meaning fetch failed:', err?.message);
      }
    })();
    // disambiguateZhPos는 내부에서 전부 catch — reject 없이 빈 Map으로 수렴한다.
    const [posPicks] = await Promise.all([posPicksPromise, meaningsPromise]);

    // 5. processed_json 호환 응답 조립
    // 불필요 furigana 필터: 히라가나·카타카나·기호만인 토큰은 reading 무시
    const isAllHiragana = s => /^[\u3040-\u309F\u30FC]+$/.test(s);
    const isAllKatakana = s => /^[\u30A0-\u30FF\u30FC]+$/.test(s);
    const isSymbolOnly  = s => /^[\s\d\p{P}\p{S}\u3000-\u303F\uFF00-\uFFEF]+$/u.test(s);

    function cleanFurigana(surface, rawReading) {
      if (!rawReading) return null;
      // IPA 발음 기호 (영어)는 항상 유지
      if (rawReading.startsWith('/')) return rawReading;
      if (isAllHiragana(surface) || isAllKatakana(surface) || isSymbolOnly(surface)) return null;
      if (rawReading === surface) return null;
      return rawReading;
    }

    const timestamp = Date.now();
    const results = tokenizedLines.map(({ tokens }, lineIdx) => {
      const sequence = [];
      const dictionary = {};
      // OOV 우연 병합 분리 — 판별기가 "별개 단어들의 우연 결합"으로 판정한 토큰(笔在→笔/在)은
      // 부분 토큰들로 조립한다(실단어 신조어(社恐)는 유지 verdict). 클라이언트(analyzeText)가
      // 서버 id를 위치 기준으로 재부여하므로 토큰 수 변화는 안전하다.
      const lineTokens = language === 'Chinese'
        ? tokens.flatMap((t) => {
            const parts = posPicks.get(zhPosMarkKey(lineIdx, t.text))?.parts;
            return parts?.length ? splitZhToken(t, parts) : [t];
          })
        : tokens;
      lineTokens.forEach((t, tokenIdx) => {
        const tokenId = `id_${lineIdx}_${tokenIdx}_${timestamp}`;
        sequence.push(tokenId);
        const cached = cache.get(t.base_form);
        // 중국어 병음은 토크나이저가 문장 문맥(다음자·변조)으로 산출 — 캐시(첫 문맥의 병음)가
        // 덮으면 문맥이 박제된다(#1004). 일본어는 Gemini 맥락 reading이 캐시에 있어 캐시 우선 유지.
        const rawReading = (language === 'Chinese'
          ? (t.furigana || cached?.reading)
          : (cached?.reading || t.furigana)) || null;
        // 중국어 품사: 문맥 pick > 후보 첫 항목 > 캐시 > jieba(다른 언어는 기존 캐시 우선 그대로).
        // 후보가 2개 이상이면 pos_all 동봉 — 뷰어가 후보 전체를 보여주고 맥락 품사만 강조한다.
        const { pos, posAll } = language === 'Chinese'
          ? resolveZhTokenPos({
              pick: posPicks.get(zhPosMarkKey(lineIdx, t.text)),
              cachedPos: cached?.pos,
              tokenPos: t.pos,
              tokenPosAll: t.pos_all,
            })
          : { pos: cached?.pos || t.pos, posAll: null };
        // 뜻도 문맥 품사를 따른다 — 짚힌 pos와 일치하는 뜻 우선, 없으면 첫 뜻(기존 동작).
        const meaning = language === 'Chinese'
          ? pickZhMeaning(cached?.meanings, pos)
          : (cached?.meanings?.[0]?.meaning || '');
        dictionary[tokenId] = {
          text: t.text,
          furigana: cleanFurigana(t.text, rawReading),
          pos,
          meaning,
          base_form: t.base_form,
          ...(posAll ? { pos_all: posAll } : {}),
        };
      });
      return { sequence, dictionary };
    });

    // 중국어 자가 치유 ② — 문맥 판별이 알아낸 다중 후보를 단일 pos 레거시 gemini 행에 기록
    // (fire-and-forget). 다음 요청부터 캐시가 후보를 알고, 4.2의 뜻 pos 백필이 이어진다.
    if (language === 'Chinese' && zhMarks.length > 0) {
      for (const { pos: wbPos, baseForms } of buildZhPosWriteback(zhMarks, posPicks, cache)) {
        supabase.from('morpheme_dictionary')
          .update({ pos: wbPos })
          .eq('language', 'Chinese')
          .eq('source', 'gemini')
          .in('base_form', baseForms)
          .then(({ error }) => {
            if (error) console.warn('[analyze] zh pos writeback failed:', error.message);
          });
      }
    }

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
        geminiCalls: cappedMissing.length,
      },
    });
  } catch (err) {
    console.error('[api/analyze] error:', err);
    return Response.json(
      { error: 'Internal Server Error' }, // 내부 err.message 노출 금지
      { status: 500 }
    );
  }
}
