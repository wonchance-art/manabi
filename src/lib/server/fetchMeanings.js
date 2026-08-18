// 서버 전용 — 미싱 형태소들의 의미를 Gemini에 배치 요청

// 뜻 조회는 단순 구조화 작업 — thinking 없는 flash-lite가 4배 빠르고 품질 동등(실측 배치당 12.7s→3.2s)
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

function buildMeaningBatchPrompt(entries, language = 'Japanese') {
  if (language === 'English') return buildEnglishMeaningBatchPrompt(entries);
  if (language === 'Chinese') return buildChineseMeaningBatchPrompt(entries);
  return buildJapaneseMeaningBatchPrompt(entries);
}

function buildChineseMeaningBatchPrompt(entries) {
  const list = entries.map((e, i) => `${i + 1}. "${e.base_form}"${e.pos ? ` (${e.pos})` : ''}`).join('\n');
  return `다음은 중국어(간체) 단어 목록입니다. 각 단어의 품사, 병음, 한국어 뜻을 JSON 배열로 알려주세요.

${list}

## 출력 형식 (순서와 길이 정확히 일치)
[
  { "pos": "명사", "reading": "túshūguǎn", "meanings": [{"meaning": "도서관", "pos": "명사"}], "ja": {"form": "図書館", "yomi": "としょかん"} },
  { "pos": "동사·명사", "reading": "gōngzuò", "meanings": [{"meaning": "일하다", "pos": "동사"}, {"meaning": "일, 직업", "pos": "명사"}], "ja": {"form": "仕事", "yomi": "しごと", "diff": true, "warn": null} },
  { "pos": "명사", "reading": "qìchē", "meanings": [{"meaning": "자동차", "pos": "명사"}], "ja": {"form": "自動車", "yomi": "じどうしゃ", "diff": true, "warn": "기차"} },
  ...
]

## 규칙
- pos는 한국어로 (명사/동사/형용사/부사/전치사/접속사/조사/대명사/양사/수사/감탄사/성어)
- 여러 품사로 두루 쓰이는 단어(겸류사)는 흔한 순으로 '·'로 이어 모두 적기 (예: 工作·学习 → "동사·명사")
- 각 뜻(meanings 항목)에 그 뜻이 속하는 품사(pos)를 붙이기 — 겸류사는 품사마다 뜻 최소 1개
- ja: 이 단어의 일본어 대응 — form은 일본어에서 실제 그 뜻으로 쓰는 표기(신자체), yomi는 히라가나 읽기.
  같은 한자어를 일본어도 같은 뜻으로 쓰면 diff 생략(図書館), 일본어에선 다른 단어를 쓰면 그 단어를 form에 넣고 diff: true(老师→先生).
  기능어(的·了 등)나 마땅한 대응이 없으면 ja: null
- ja.warn: 동형이의어 경고 — 이 단어와 같은 표기(신자체로 옮긴 형태)가 일본어에 존재하는데 뜻이 다를 때만,
  일본어에서의 그 뜻을 15자 이내로 (예: 汽车→"기차", 手纸→"편지", 勉强→"공부"). 해당 없으면 warn: null
- reading은 성조 기호가 붙은 병음 (예: 图书馆→túshūguǎn, 中国→Zhōngguó)
- 각 단어에 1~3개 주요 의미 (가장 흔한 순)
- 의미는 10자 이내로 간결하게
- 다음자(多音字)는 가장 일반적인 독음 기준
- 조사(的, 了, 着 등)는 한국어 대응 기능 설명 ("~의", "완료", "진행" 등)
- 설명/주석 금지, JSON만 출력`;
}

function buildJapaneseMeaningBatchPrompt(entries) {
  const list = entries.map((e, i) => `${i + 1}. "${e.base_form}" (${e.pos || '미상'})`).join('\n');
  return `다음은 일본어 단어 목록입니다. 각 단어의 한국어 뜻과 히라가나 읽기를 JSON 배열로 알려주세요.

${list}

## 출력 형식 (순서와 길이 정확히 일치)
[
  { "reading": "ひらがな読み", "meanings": [{"meaning": "기본 뜻"}, {"meaning": "보조 뜻(있으면)"}] },
  { "reading": "...", "meanings": [{"meaning": "..."}] },
  ...
]

## 규칙
- reading: 가장 일반적인 문맥에서의 히라가나 읽기 (예: 一日→いちにち, 今日→きょう, 大人→おとな)
- 한자가 없는 단어(히라가나/카타카나/기호)는 reading을 null로
- 각 단어에 1~2개 주요 의미 (가장 흔한 순)
- 의미는 10자 이내로 간결하게
- 조사(は, が 등)와 조동사(ます, た 등)는 한국어 대응어 ("은/는", "이/가", "~합니다" 등)
- 설명/주석 금지, JSON만 출력`;
}

function buildEnglishMeaningBatchPrompt(entries) {
  const list = entries.map((e, i) => `${i + 1}. "${e.base_form}"`).join('\n');
  return `다음은 영어 단어 목록입니다. 각 단어의 품사, IPA 발음, 한국어 뜻을 JSON 배열로 알려주세요.

${list}

## 출력 형식 (순서와 길이 정확히 일치)
[
  { "pos": "동사·명사", "ipa": "/ˈrek.ɔːd/", "meanings": [{"meaning": "기록하다", "pos": "동사"}, {"meaning": "기록", "pos": "명사"}] },
  { "pos": "명사", "ipa": "/wɜːrd/", "meanings": [{"meaning": "단어", "pos": "명사"}] },
  ...
]

## 규칙
- pos는 한국어로 (명사/동사/형용사/부사/전치사/접속사/관사/대명사/조동사/감탄사/수사)
- 여러 품사로 쓰이는 단어는 흔한 순으로 '·'로 이어 후보를 모두 적기(최대 3개)
- 각 meanings 항목에 그 뜻의 pos를 반드시 붙이고, pos 후보마다 뜻을 최소 1개 포함
- ipa는 슬래시 포함 IPA 발음 기호
- 각 단어에 1~3개 주요 의미 (가장 흔한 순)
- 의미는 10자 이내로 간결하게
- 복수형이어도 단수 기준 뜻 (apples → "사과")
- 과거형이어도 원형 기준 뜻 (ran → "달리다")
- 설명/주석 금지, JSON만 출력`;
}

export function parseJsonLenient(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('JSON 배열을 찾을 수 없습니다');
  return JSON.parse(cleaned.substring(start, end + 1));
}

const ENGLISH_POS = new Set([
  '명사', '동사', '형용사', '부사', '전치사', '접속사',
  '관사', '대명사', '조동사', '감탄사', '수사',
]);

function splitEnglishPos(value) {
  return String(value || '').split('·').map((pos) => pos.trim()).filter(Boolean);
}

/**
 * 미싱 형태소들의 의미를 Gemini에 요청하고 DB에 저장
 * @param {Array<{base_form, pos, reading}>} missing
 * @param {string} language
 * @param {object} supabase - server client (service role)
 * @param {object} [opts]
 * @param {number|null} [opts.deadlineMs] - 이 시각(epoch ms)을 넘기면 새 배치·재시도를 시작하지
 *   않고 중단. 남은 단어는 뜻 없이 반환된다(MAX_MISSING 초과분과 같은 그레이스풀 디그레이드 —
 *   캐시가 빈 언어에서 배치 순차 대기가 Vercel maxDuration을 넘겨 함수째 죽는 것을 방지, #969).
 * @param {number} [opts.concurrency] - 동시 배치 수. 순차(=1)는 미싱 100개에 실측 94s로
 *   60s 캡 초과 — 기본 3.
 * @returns {Map<string, {meanings, pos, reading, source}>} base_form → meaning entry
 */
export async function fetchMeaningsForMissing(missing, language, supabase, opts = {}) {
  const { deadlineMs = null, concurrency = 3 } = opts;
  const result = new Map();
  const errors = [];
  if (missing.length === 0) return { result, errors };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  // 한 번에 너무 많이 보내면 응답 품질 저하 — 15개씩 배치
  const BATCH_SIZE = 15;
  const MAX_RETRIES = 4;
  const DELAYS = [5000, 10000, 20000, 40000];
  const CALL_TIMEOUT_MS = 20_000; // 개별 호출 행잉 방지 — deadline 판정은 호출 사이에만 돌므로 필수
  const pastDeadline = () => deadlineMs != null && Date.now() >= deadlineMs;

  async function callGroqFallback(prompt) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return null;
    if (pastDeadline()) return null; // deadline 후 폴백까지 타면 함수 킬 위험 — 스킵
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          model: 'qwen/qwen3.6-27b', // qwen3-32b는 Groq에서 퇴역(2026-08 목록 실측) — 승계 모델
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          stream: false,
          reasoning_effort: 'none', // thinking 토큰 낭비 방지
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) return null;
      // Gemini candidates 형식으로 포장 (downstream text 파싱은 동일)
      return {
        candidates: [{ content: { parts: [{ text }] } }],
        _provider: 'groq',
      };
    } catch { return null; }
  }

  async function callWithRetry(prompt) {
    let lastErr = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let res, data;
      try {
        res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0 },
          }),
        });
        data = await res.json();
      } catch (e) {
        res = { ok: false, status: 0 };
        data = { error: e?.message || 'fetch failed' };
      }
      const isCapacity = res.status === 503 || res.status === 429 || res.status === 0 ||
        JSON.stringify(data).toLowerCase().includes('high demand') ||
        JSON.stringify(data).toLowerCase().includes('overloaded');

      if (res.ok) return { res, data };
      lastErr = { res, data };

      if (!isCapacity || attempt === MAX_RETRIES - 1) return { res, data };
      const delay = DELAYS[attempt];
      if (deadlineMs != null && Date.now() + delay >= deadlineMs) return lastErr;
      console.warn(`[fetchMeanings] capacity retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
    return lastErr;
  }

  async function processBatch(batch, batchOffset) {
    const prompt = buildMeaningBatchPrompt(batch, language);
    let { res, data } = await callWithRetry(prompt);

    // Gemini 최종 실패 → Groq 폴백 시도
    if (!res.ok) {
      const groqData = await callGroqFallback(prompt);
      if (groqData) {
        data = groqData;
        res = { ok: true, status: 200 };
      } else {
        const errMsg = `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`;
        console.warn('[fetchMeanings] batch failed:', errMsg);
        errors.push({ stage: 'http', batch: batchOffset, error: errMsg });
        return;
      }
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn('[fetchMeanings] empty response', JSON.stringify(data).slice(0, 200));
      errors.push({ stage: 'empty', batch: batchOffset, error: 'no candidates.text' });
      return;
    }

    let parsed;
    try {
      parsed = parseJsonLenient(text);
    } catch (e) {
      console.warn('[fetchMeanings] parse failed:', e.message, text.slice(0, 300));
      errors.push({ stage: 'parse', batch: batchOffset, error: e.message, sample: text.slice(0, 200) });
      return;
    }

    if (!Array.isArray(parsed) || parsed.length !== batch.length) {
      console.warn('[fetchMeanings] length mismatch', parsed?.length, batch.length);
      errors.push({ stage: 'length', batch: batchOffset, expected: batch.length, got: parsed?.length });
      return;
    }

    // DB insert 준비
    const rows = [];
    parsed.forEach((entry, idx) => {
      const source = batch[idx];
      if (language === 'English' && source?.source === 'user_verified') return;
      const meanings = Array.isArray(entry?.meanings) ? entry.meanings.filter(m => m?.meaning) : [];
      if (meanings.length === 0) return;

      // 영어 후보·뜻별 pos 계약은 행 단위 fail-closed. 모델이 허용 목록 밖 품사를 주거나
      // 후보별 뜻을 빠뜨리면 marker도 DB 갱신도 하지 않아 다음 요청에서 재시도한다.
      const enPosCandidates = language === 'English' ? splitEnglishPos(entry?.pos) : null;
      if (language === 'English' && (
        enPosCandidates.length < 1 || enPosCandidates.length > 3 ||
        new Set(enPosCandidates).size !== enPosCandidates.length ||
        enPosCandidates.some((pos) => !ENGLISH_POS.has(pos))
      )) return;

      // 뜻별 pos 태그(중국어 겸류사 — 뜻 정렬이 문맥 품사를 따르는 데 필요)는 모델이 준 경우만 보존
      const normalizedMeanings = meanings.slice(0, 3).map((m, i) => ({
        meaning: String(m.meaning).slice(0, 80),
        priority: i + 1,
        ...(m?.pos && typeof m.pos === 'string' ? { pos: String(m.pos).trim().slice(0, 20) } : {}),
      }));

      if (language === 'English') {
        const invalidMeaning = normalizedMeanings.some((meaning) =>
          !meaning.pos || !ENGLISH_POS.has(meaning.pos) || !enPosCandidates.includes(meaning.pos));
        const missingCandidate = enPosCandidates.some((pos) =>
          !normalizedMeanings.some((meaning) => meaning.pos === pos));
        if (invalidMeaning || missingCandidate) return;
        // 위치는 저장 관례일 뿐 판정기는 meanings 전체에서 marker 존재를 찾는다. 사전 승격으로
        // 이 항목이 뒤로 밀려도 필드 스프레드가 marker를 보존한다.
        normalizedMeanings[0] = { ...normalizedMeanings[0], en_pos_v: 1 };
      }

      // 일본어 대응(한자 대조 2단계, 중국어만) — meanings jsonb 안 관례 필드로 저장(스키마
      // 무변경). ja: null도 "판정 완료·대응 없음"으로 기록해 레거시 미판정(키 자체 부재)과
      // 구분한다 — 백필 판정(needsZhJaBackfill)이 이 구분에 기댄다.
      if (language === 'Chinese' && normalizedMeanings.length > 0) {
        const rawJa = entry?.ja;
        // warn(동형이의어 — 같은 표기가 일본어에서 다른 뜻, 3단계)도 null을 명시 기록:
        // warn 키 부재 = 2단계 시절 미판정 → 백필 1회 대상(needsZhJaBackfill).
        const ja = rawJa && typeof rawJa === 'object' &&
          typeof rawJa.form === 'string' && rawJa.form.trim() &&
          typeof rawJa.yomi === 'string' && rawJa.yomi.trim()
          ? {
              form: rawJa.form.trim().slice(0, 20),
              yomi: rawJa.yomi.trim().slice(0, 30),
              ...(rawJa.diff === true ? { diff: true } : {}),
              warn: typeof rawJa.warn === 'string' && rawJa.warn.trim()
                ? rawJa.warn.trim().slice(0, 30)
                : null,
            }
          : null;
        normalizedMeanings[0] = { ...normalizedMeanings[0], ja };
      }

      // 영어·중국어는 Gemini가 pos를 정해줌(중국어는 겸류 다중 pos '동사·명사' 포함 — jieba
      // 단일 태그보다 정확). 일본어는 kuromoji pos가 이미 정확해 유지.
      const pos = (language === 'English' || language === 'Chinese') && entry?.pos
        ? (language === 'English' ? enPosCandidates.join('·') : String(entry.pos).slice(0, 30))
        : source.pos;

      // 일본어: Gemini 맥락 기반 reading / 영어: IPA 발음
      let reading;
      if (language === 'Japanese' && entry?.reading && typeof entry.reading === 'string') {
        reading = entry.reading;
      } else if (language === 'English' && entry?.ipa && typeof entry.ipa === 'string') {
        reading = entry.ipa;
      } else {
        reading = source.reading || null;
      }

      const dictEntry = {
        base_form: source.base_form,
        language,
        pos,
        reading,
        meanings: normalizedMeanings,
        source: 'gemini',
      };
      rows.push({ dictEntry, refresh: source?.existing === true });
      result.set(source.base_form, dictEntry);
    });

    // DB 저장. 영어 신규 행은 충돌 무시(동시 user_verified 승격 보호), lazy backfill은
    // source 조건부 update로 user_verified를 이중 보호한다. 다른 언어의 기존 계약은 유지.
    if (rows.length > 0) {
      if (language === 'English') {
        const newRows = rows.filter((row) => !row.refresh).map((row) => row.dictEntry);
        if (newRows.length > 0) {
          const { error } = await supabase
            .from('morpheme_dictionary')
            .upsert(newRows, { onConflict: 'base_form,language', ignoreDuplicates: true });
          if (error) {
            console.warn('[fetchMeanings] db upsert failed:', error.message);
            errors.push({ stage: 'db', batch: batchOffset, error: error.message });
          }
        }
        for (const { dictEntry, refresh } of rows) {
          if (!refresh) continue;
          const { error } = await supabase
            .from('morpheme_dictionary')
            .update({
              pos: dictEntry.pos,
              reading: dictEntry.reading,
              meanings: dictEntry.meanings,
              source: 'gemini',
            })
            .eq('language', 'English')
            .eq('base_form', dictEntry.base_form)
            .neq('source', 'user_verified');
          if (error) {
            console.warn('[fetchMeanings] db update failed:', error.message);
            errors.push({ stage: 'db', batch: batchOffset, error: error.message });
          }
        }
      } else {
        const { error } = await supabase
          .from('morpheme_dictionary')
          .upsert(rows.map((row) => row.dictEntry), { onConflict: 'base_form,language', ignoreDuplicates: false });
        if (error) {
          console.warn('[fetchMeanings] db upsert failed:', error.message);
          errors.push({ stage: 'db', batch: batchOffset, error: error.message });
        }
      }
    }
  }

  // 배치를 concurrency개씩 웨이브로 병렬 실행. 웨이브 사이에만 deadline을 판정해
  // 진행 중 배치는 자연 완료시킨다(개별 호출은 CALL_TIMEOUT_MS로 상한).
  const batches = [];
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    batches.push({ batch: missing.slice(i, i + BATCH_SIZE), offset: i });
  }
  for (let w = 0; w < batches.length; w += concurrency) {
    if (pastDeadline()) {
      const remaining = batches.slice(w).reduce((n, b) => n + b.batch.length, 0);
      console.warn(`[fetchMeanings] deadline reached — ${remaining} words skipped (graceful degrade)`);
      errors.push({ stage: 'deadline', batch: batches[w].offset, remaining });
      break;
    }
    const wave = batches.slice(w, w + concurrency);
    await Promise.all(wave.map(({ batch, offset }) => processBatch(batch, offset)));
  }

  return { result, errors };
}
