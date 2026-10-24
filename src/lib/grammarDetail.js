'use client';
// 뷰어 [문장] 탭 번역 프롬프트(번역 · 맥락 · 말투 + 문형 칸). 예전 [자세히] 문법 해설 · [더 쉽게] 프롬프트는
// [문장] 탭 개편(목업 U 4판 · 오너 10-24 「더 쉽게와 문법 버튼 아예 없애줘」)으로 걷어 냈다 — 패턴은 문형 사전 카드가 맡는다.

/**
 * 좌측 번역·맥락 프롬프트 — 말투(뉘앙스)는 학습에 유의미할 때만 붙는 조건부 줄.
 * patternBlock(sentencePattern.buildPatternPromptBlock)이 오면 같은 요청에 **문형** 칸을 붙인다(목업 U 4판 — 요청 수 그대로).
 * 맥락은 [문장] 탭에서 번역 아래 회색 한 줄이라 한 문장으로 받는다(오너 10-24 「간결하게」).
 */
export function buildContextPrompt(text, langKo, patternBlock = null) {
  return `다음 ${langKo} 텍스트를 한국어로 처리해주세요.

"${text}"

아래 형식 정확히 따라 출력. 도입 문구 없이 바로:

**번역**
자연스러운 한국어 번역

**맥락**
내용 이해를 돕는 배경 설명 한 문장

**말투**
격식·반말 차이나 화자 관계가 학습에 유의미할 때만 한 줄. 서술문·설명문처럼
말투를 따질 필요가 없으면 이 항목(제목 포함)을 통째로 생략
${patternBlock ? `
${patternBlock.format}
` : ''}
규칙: 마크다운 **굵게**만 사용, 간결하게${patternBlock ? `
${patternBlock.rules}` : ''}`;
}
