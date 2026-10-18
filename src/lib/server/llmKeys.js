// 서버 전용 — LLM 키 설정 여부(값은 읽지 않고 있음/없음만). llm.js가 다시 내보낸다.
// 별 모듈인 이유: 라우트 · 판별기의 「키 없음」 관문이 llm.js를 목(mock)한 테스트에서도 그대로 돌게(목은 callLLM만 준다).

/** 본선 키(Gemini 또는 Claude)가 있는가 — Claude 단독 운영(LLM-CLAUDE-001)에서 Gemini 키만 보는 관문에 막히지 않게. */
export function hasPrimaryLLMKey() {
  return !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
}
