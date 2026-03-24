// ai-service.js — Gemini AI 호출 공통 모듈

/**
 * Gemini API에 프롬프트를 보내고 텍스트 응답을 반환
 * @param {string} prompt - 전송할 프롬프트
 * @param {object} [options] - generationConfig 옵션 (temperature, response_mime_type 등)
 * @returns {Promise<string>} AI 응답 텍스트
 */
async function callGemini(prompt, options = {}) {
    // Vercel Serverless API (/api/gemini.js) 호출을 통해 API 키 숨김 처리
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            model: CONFIG.GEMINI_MODEL, // config.js의 모델명 전달
            ...(Object.keys(options).length > 0 ? { generationConfig: options } : {})
        })
    });

    const resData = await response.json();
    if (!response.ok) throw new Error(resData.error?.message || "API 요청 실패");

    return resData.candidates[0].content.parts[0].text;
}

/**
 * Gemini 응답에서 JSON 객체를 안전하게 추출 + 파싱
 * (```json``` 마커 제거, 첫 { ~ 마지막 } 추출)
 * @param {string} rawText - AI 응답 원문
 * @returns {object} 파싱된 JSON 객체
 */
function parseGeminiJSON(rawText) {
    const clean = rawText.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error("JSON 괄호를 찾을 수 없습니다.");
    return JSON.parse(clean.substring(start, end + 1));
}

/**
 * 토큰화 분석 프롬프트 생성 (admin + viewer에서 공유)
 * @param {string} text - 분석할 원문 텍스트 (이스케이프 전)
 * @returns {string} 완성된 프롬프트
 */
function buildTokenizationPrompt(text) {
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `입력된 텍스트 "${escaped}"를 정밀 분석해서 반드시 아래 규칙을 지킨 JSON으로 응답해.

1. 데이터 구조 (Index Mapping):
   - "sequence": ["0", "1", "2", ...] 형태로 원문의 모든 요소를 순서대로 번호를 매길 것.
   - "dictionary": {"0": {...}, "1": {...}} 형태로 정보를 넣을 것.

2. 분석 규칙 (필독 - JSON 파싱 오류 절대 방지):
   - 문단 구분 보존: 원문에 줄 바꿈(Enter, \\n)이 있다면 절대 생략하지 말고 반드시 하나의 독립된 토큰으로 포함할 것.
   - 원문의 모든 단어와 기호(따옴표, 콤마, 마침표, 띄어쓰기 공백 등)를 단 하나도 빠뜨리지 말고 독립된 토큰으로 분리할 것.
   - 단어, 따옴표('), 쌍따옴표("), 이모지, 특수문자 등을 단 하나도 빠뜨리지 말고 각각 추출하되, JSON 문법(배열, 쉼표, 쌍따옴표)이 깨지지 않도록 이스케이프 처리에 주의할 것.
   - 단어 단위를 무시하고 여러 글자를 하나로 묶지 말 것!
   - [영어]: 단어 토큰의 'furigana' 필드에 발음 기호(IPA)를 작성 (/ / 포함). 공백과 기호는 비울 것.
   - [일본어]: 한자가 포함된 토큰만 'furigana' 작성.
   - meaning & pos: 무조건 한국어로 정확한 품사와 뜻을 작성.
   - **중요**: 문장에 이스케이프 되지 않은 따옴표 중첩이나 알 수 없는 기호가 있더라도 JSON 문법을 절대 깨트리지 마라.
   - 응답은 무조건 \`{ "sequence": [... \` 로 시작하는 완벽하게 유효한 JSON 포맷이어야 한다.

3. 예시: "a big apple"
   sequence: ["0", "1", "2", "3", "4"]
   dictionary: {
     "0": {"text": "a", "pos": "관사", "furigana": "/ə/", "meaning": "하나의"},
     "1": {"text": " ", "pos": "공백", "furigana": "", "meaning": ""},
     "2": {"text": "big", "pos": "형용사", "furigana": "/bɪg/", "meaning": "큰"},
     "3": {"text": " ", "pos": "공백", "furigana": "", "meaning": ""},
     "4": {"text": "apple", "pos": "명사", "furigana": "/ˈæp.əl/", "meaning": "사과"}
   }

설명 없이 오직 순수한 JSON만 응답할 것.`;
}
