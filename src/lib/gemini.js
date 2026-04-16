export const GEMINI_MODEL = 'models/gemini-2.5-flash';

async function callGeminiOnce(prompt, signal, { model, ...generationConfig } = {}) {
  // Supabase 세션 토큰 첨부 (서버 측 인증용)
  let authHeader = {};
  try {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      authHeader = { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {}

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(model ? { model } : {}),
      ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {})
    })
  });

  // 응답을 text로 먼저 받아서 JSON 아닐 때도 원인 노출
  const rawText = await response.text();
  let resData = null;
  try {
    resData = JSON.parse(rawText);
  } catch {
    const sample = rawText.slice(0, 200).replace(/\s+/g, ' ');
    const err = new Error(`서버 응답 형식 오류 (HTTP ${response.status}): ${sample}`);
    err.status = response.status;
    throw err;
  }

  if (!response.ok) {
    const err = new Error(resData?.error?.message || `API 요청 실패 (HTTP ${response.status})`);
    err.status = response.status;
    throw err;
  }
  const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 응답이 비어있습니다.');
  return text;
}

function isCapacityError(err) {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('503') ||
    msg.includes('resource_exhausted') ||
    err?.status === 503 ||
    err?.status === 429
  );
}

/**
 * callGemini: 용량/속도 에러에 자동 재시도 (최대 4회, 5/10/20초 백오프)
 */
export async function callGemini(prompt, signal, opts = {}) {
  const MAX_RETRIES = 4;
  const DELAYS = [5000, 10000, 20000, 40000];
  let lastErr = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callGeminiOnce(prompt, signal, opts);
    } catch (e) {
      lastErr = e;
      if (signal?.aborted) throw e;
      if (!isCapacityError(e) || attempt === MAX_RETRIES - 1) {
        throw e; // 재시도 불가 에러거나 마지막 시도
      }
      const delay = DELAYS[attempt] || 40000;
      console.warn(`[callGemini] capacity error attempt ${attempt + 1}/${MAX_RETRIES} — retry in ${delay}ms:`, e.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export function parseGeminiJSON(rawText) {
  const clean = rawText.replace(/```json|```/g, '').trim();
  // 배열([...]) 또는 객체({...}) 응답 모두 지원
  const objStart = clean.indexOf('{');
  const objEnd = clean.lastIndexOf('}');
  const arrStart = clean.indexOf('[');
  const arrEnd = clean.lastIndexOf(']');

  let jsonStr;
  if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
    if (objEnd === -1) throw new Error('JSON 괄호를 찾을 수 없습니다.');
    jsonStr = clean.substring(objStart, objEnd + 1);
  } else if (arrStart !== -1) {
    if (arrEnd === -1) throw new Error('JSON 괄호를 찾을 수 없습니다.');
    jsonStr = clean.substring(arrStart, arrEnd + 1);
  } else {
    throw new Error('JSON 괄호를 찾을 수 없습니다.');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Gemini 응답 JSON 파싱 실패: ${e.message}`);
  }
}

export function buildTokenizationPrompt(text, language = 'Japanese') {
  if (language === 'English') return buildEnglishTokenizationPrompt(text);
  return buildJapaneseTokenizationPrompt(text);
}

function buildJapaneseTokenizationPrompt(text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `다음 텍스트를 형태소 단위로 분석해서 JSON으로 출력해.

입력: "${escaped}"

## 출력 형식
{"sequence":["0","1","2",...],"dictionary":{"0":{...},"1":{...},...}}

## 각 토큰 필드
- "text": 원문 그대로의 표기 (★절대 히라가나로 바꾸지 말 것★)
- "furigana": 한자 포함 토큰만 히라가나 읽기, 나머지는 ""
- "pos": 한국어 품사
- "meaning": 한국어 뜻

## text 필드 예시 (반드시 이렇게)
✅ 올바름: 食べる → "text":"食べる", "furigana":"たべる"
❌ 잘못됨: 食べる → "text":"たべる", "furigana":"食べる"  ← text와 furigana 뒤바뀜 금지

✅ 올바름: 今日 → "text":"今日", "furigana":"きょう"
❌ 잘못됨: 今日 → "text":"きょう"  ← text는 반드시 원문 표기

## 주의
- text에는 원문 한자/가타카나/영어를 그대로 쓸 것
- 순수 히라가나 토큰(は, が, です 등)은 furigana 생략 또는 ""
- 유효한 JSON만 출력, 설명 금지`;
}

function buildEnglishTokenizationPrompt(text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `다음 영어 문장을 단어/구두점 단위로 분석해 JSON으로 출력해. 반드시 모든 토큰에 한국어 뜻을 채워야 함.

입력: "${escaped}"

## 출력 형식
{"sequence":["0","1","2",...],"dictionary":{"0":{...},"1":{...},...}}

## 각 토큰 필드 (모두 필수)
- "text": 원문 그대로의 단어/구두점 (대소문자 유지)
- "pos": 한국어 품사 ("명사", "동사", "형용사", "부사", "전치사", "접속사", "관사", "대명사", "조동사", "감탄사", "기호" 중 하나)
- "meaning": 한국어 뜻 (★반드시 채울 것. 모르면 추정이라도★)

## 토큰 분리 규칙
- 공백 기준으로 단어 분리
- 구두점(,.!?;:)은 별도 토큰, pos="기호", meaning="(문장부호)"
- 축약형(don't, I'm)은 하나의 토큰으로 유지
- 소유격 's는 별도 토큰 가능

## 예시 ("I love apples.")
{"sequence":["0","1","2","3"],"dictionary":{
  "0":{"text":"I","pos":"대명사","meaning":"나"},
  "1":{"text":"love","pos":"동사","meaning":"사랑하다"},
  "2":{"text":"apples","pos":"명사","meaning":"사과들"},
  "3":{"text":".","pos":"기호","meaning":"(마침표)"}
}}

## 주의
- meaning은 **절대 빈 문자열로 두지 말 것**. 모호하면 주요 뜻 하나만
- furigana 필드는 영어에선 불필요 (출력 금지)
- JSON만 출력, 설명 금지`;
}

/**
 * 여러 줄을 한 번에 분석하는 배치 프롬프트
 * 응답: [{ sequence, dictionary }, ...] 각 줄에 대응
 */
export function buildBatchTokenizationPrompt(lines) {
  const jsonLines = JSON.stringify(lines);
  return `다음은 여러 줄의 텍스트 배열이다. 각 줄을 독립적으로 형태소 분석해 JSON 배열로 출력해.

입력 배열: ${jsonLines}

## 출력 형식 (배열, 각 원소가 한 줄 분석 결과)
[
  {"sequence":["0","1",...],"dictionary":{"0":{...},...}},
  {"sequence":["0","1",...],"dictionary":{"0":{...},...}},
  ...
]

## 각 토큰 필드
- "text": 원문 그대로의 표기 (히라가나로 바꾸지 말 것)
- "furigana": 한자 포함 토큰만 히라가나 읽기, 나머지는 ""
- "pos": 한국어 품사
- "meaning": 한국어 뜻

## 주의
- 입력 배열 길이와 출력 배열 길이 반드시 동일
- 빈 문자열 입력이 있으면 {"sequence":[],"dictionary":{}} 로 처리
- text는 원문 그대로, furigana와 혼동 금지
- 유효한 JSON 배열만 출력, 설명 금지`;
}
