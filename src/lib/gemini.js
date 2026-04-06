export const GEMINI_MODEL = 'models/gemini-2.0-flash';

export async function callGemini(prompt, signal, { model, ...generationConfig } = {}) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(model ? { model } : {}),
      ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {})
    })
  });
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.error?.message || 'API 요청 실패');
  const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 응답이 비어있습니다.');
  return text;
}

export function parseGeminiJSON(rawText) {
  const clean = rawText.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('JSON 괄호를 찾을 수 없습니다.');
  return JSON.parse(clean.substring(start, end + 1));
}

export function buildTokenizationPrompt(text) {
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
