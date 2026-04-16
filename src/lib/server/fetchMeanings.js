// 서버 전용 — 미싱 형태소들의 의미를 Gemini에 배치 요청

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function buildMeaningBatchPrompt(entries, language = 'Japanese') {
  if (language === 'English') return buildEnglishMeaningBatchPrompt(entries);
  return buildJapaneseMeaningBatchPrompt(entries);
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
  // 영어는 POS도 같이 판정해서 저장 (pre-assigned pos가 없음)
  const list = entries.map((e, i) => `${i + 1}. "${e.base_form}"`).join('\n');
  return `다음은 영어 단어 목록입니다. 각 단어의 품사와 한국어 뜻을 JSON 배열로 알려주세요.

${list}

## 출력 형식 (순서와 길이 정확히 일치)
[
  { "pos": "동사", "meanings": [{"meaning": "기본 뜻"}, {"meaning": "보조 뜻"}] },
  { "pos": "명사", "meanings": [{"meaning": "..."}] },
  ...
]

## 규칙
- pos는 한국어로 (명사/동사/형용사/부사/전치사/접속사/관사/대명사/조동사/감탄사/수사)
- 각 단어에 1~2개 주요 의미 (가장 흔한 순)
- 의미는 10자 이내로 간결하게
- 복수형이어도 단수 기준 뜻 (apples → "사과")
- 과거형이어도 원형 기준 뜻 (ran → "달리다")
- 설명/주석 금지, JSON만 출력`;
}

function parseJsonLenient(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('JSON 배열을 찾을 수 없습니다');
  return JSON.parse(cleaned.substring(start, end + 1));
}

/**
 * 미싱 형태소들의 의미를 Gemini에 요청하고 DB에 저장
 * @param {Array<{base_form, pos, reading}>} missing
 * @param {string} language
 * @param {object} supabase - server client (service role)
 * @returns {Map<string, {meanings, pos, reading, source}>} base_form → meaning entry
 */
export async function fetchMeaningsForMissing(missing, language, supabase) {
  const result = new Map();
  const errors = [];
  if (missing.length === 0) return { result, errors };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  // 한 번에 너무 많이 보내면 응답 품질 저하 — 15개씩 배치
  const BATCH_SIZE = 15;
  const MAX_RETRIES = 4;
  const DELAYS = [5000, 10000, 20000, 40000];

  async function callGroqFallback(prompt) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return null;
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'qwen/qwen3-32b',
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
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0 },
        }),
      });
      const data = await res.json();
      const isCapacity = res.status === 503 || res.status === 429 ||
        JSON.stringify(data).toLowerCase().includes('high demand') ||
        JSON.stringify(data).toLowerCase().includes('overloaded');

      if (res.ok) return { res, data };
      lastErr = { res, data };

      if (!isCapacity || attempt === MAX_RETRIES - 1) return { res, data };
      const delay = DELAYS[attempt];
      console.warn(`[fetchMeanings] capacity retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
    return lastErr;
  }

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);

    const prompt = buildMeaningBatchPrompt(batch, language);
    let { res, data } = await callWithRetry(prompt);

    // Gemini 최종 실패 → Groq 폴백 시도
    if (!res.ok) {
      const groqData = await callGroqFallback(prompt);
      if (groqData) {
        console.log('[fetchMeanings] batch recovered via Groq');
        data = groqData;
        res = { ok: true, status: 200 };
      } else {
        const errMsg = `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`;
        console.warn('[fetchMeanings] batch failed:', errMsg);
        errors.push({ stage: 'http', batch: i, error: errMsg });
        continue;
      }
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn('[fetchMeanings] empty response', JSON.stringify(data).slice(0, 200));
      errors.push({ stage: 'empty', batch: i, error: 'no candidates.text' });
      continue;
    }

    let parsed;
    try {
      parsed = parseJsonLenient(text);
    } catch (e) {
      console.warn('[fetchMeanings] parse failed:', e.message, text.slice(0, 300));
      errors.push({ stage: 'parse', batch: i, error: e.message, sample: text.slice(0, 200) });
      continue;
    }

    if (!Array.isArray(parsed) || parsed.length !== batch.length) {
      console.warn('[fetchMeanings] length mismatch', parsed?.length, batch.length);
      errors.push({ stage: 'length', batch: i, expected: batch.length, got: parsed?.length });
      continue;
    }

    // DB insert 준비
    const rows = [];
    parsed.forEach((entry, idx) => {
      const source = batch[idx];
      const meanings = Array.isArray(entry?.meanings) ? entry.meanings.filter(m => m?.meaning) : [];
      if (meanings.length === 0) return;

      const normalizedMeanings = meanings.slice(0, 3).map((m, i) => ({
        meaning: String(m.meaning).slice(0, 80),
        priority: i + 1,
      }));

      // 영어는 Gemini가 pos를 정해줌, 일본어는 기존 pos 유지
      const pos = language === 'English' && entry?.pos ? String(entry.pos).slice(0, 30) : source.pos;

      // Gemini가 맥락 기반 reading을 제공하면 kuromoji reading보다 우선
      const reading = (language === 'Japanese' && entry?.reading && typeof entry.reading === 'string')
        ? entry.reading
        : (source.reading || null);

      const dictEntry = {
        base_form: source.base_form,
        language,
        pos,
        reading,
        meanings: normalizedMeanings,
        source: 'gemini',
      };
      rows.push(dictEntry);
      result.set(source.base_form, dictEntry);
    });

    // DB 저장 (ON CONFLICT — 기존 항목은 touch만)
    if (rows.length > 0) {
      const { error } = await supabase
        .from('morpheme_dictionary')
        .upsert(rows, { onConflict: 'base_form,language', ignoreDuplicates: false });
      if (error) {
        console.warn('[fetchMeanings] db upsert failed:', error.message);
        errors.push({ stage: 'db', batch: i, error: error.message });
      }
    }
  }

  return { result, errors };
}
