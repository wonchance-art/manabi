// 서버 전용 — 미싱 형태소들의 의미를 Gemini에 배치 요청

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function buildMeaningBatchPrompt(entries) {
  // entries: [{ base_form, pos }, ...]
  const list = entries.map((e, i) => `${i + 1}. "${e.base_form}" (${e.pos})`).join('\n');
  return `다음은 일본어 단어 목록입니다. 각 단어의 기본적인 한국어 뜻을 JSON 배열로 알려주세요.

${list}

## 출력 형식 (순서와 길이 정확히 일치)
[
  { "meanings": [{"meaning": "기본 뜻"}, {"meaning": "보조 뜻(있으면)"}] },
  { "meanings": [{"meaning": "..."}] },
  ...
]

## 규칙
- 각 단어에 1~2개 주요 의미 (가장 흔한 순)
- 의미는 10자 이내로 간결하게
- 조사(は, が 등)와 조동사(ます, た 등)는 한국어 대응어 ("은/는", "이/가", "~합니다" 등)
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
  if (missing.length === 0) return result;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  // 한 번에 너무 많이 보내면 응답 품질 저하 — 15개씩 배치
  const BATCH_SIZE = 15;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);

    const prompt = buildMeaningBatchPrompt(batch);
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.warn('[fetchMeanings] batch failed:', res.status, JSON.stringify(data).slice(0, 200));
      continue; // 이 배치만 스킵, 다음 배치 계속
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) continue;

    let parsed;
    try {
      parsed = parseJsonLenient(text);
    } catch (e) {
      console.warn('[fetchMeanings] parse failed:', e.message, text.slice(0, 200));
      continue;
    }

    if (!Array.isArray(parsed) || parsed.length !== batch.length) {
      console.warn('[fetchMeanings] length mismatch', parsed?.length, batch.length);
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

      const dictEntry = {
        base_form: source.base_form,
        language,
        pos: source.pos,
        reading: source.reading || null,
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
      if (error) console.warn('[fetchMeanings] db upsert failed:', error.message);
    }
  }

  return result;
}
