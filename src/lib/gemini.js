export const GEMINI_MODEL = 'gemini-2.0-flash-lite-preview-02-05';

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
  return resData.candidates[0].content.parts[0].text;
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
  return `입력된 텍스트 "${escaped}"를 정밀 분석해서 반드시 아래 규칙을 지킨 JSON으로 응답해.

1. 데이터 구조 (Index Mapping):
   - "sequence": ["0", "1", "2", ...] 형태로 원문의 모든 요소를 순서대로 번호를 매길 것.
   - "dictionary": {"0": {...}, "1": {...}} 형태로 정보를 넣을 것.

2. 분석 규칙 (필독):
   - 문단 구분 보존: 원문에 줄 바꿈(\\n)이 있다면 반드시 하나의 독립된 토큰으로 포함할 것.
   - 모든 단어와 기호(따옴표, 콤마, 마침표, 띄어쓰기 등)를 빠짐없이 토큰으로 분리할 것.
   - [영어]: 단어 토큰의 'furigana' 필드에 발음 기호(IPA) 작성 (/ / 포함).
   - [일본어]: 한자가 포함된 토큰만 'furigana' 작성.
   - meaning & pos: 무조건 한국어로 정확한 품사와 뜻 작성.
   - 응답은 무조건 { "sequence": [... ] 로 시작하는 유효한 JSON 포맷이어야 함.

설명 없이 오직 순수한 JSON만 응답할 것.`;
}
