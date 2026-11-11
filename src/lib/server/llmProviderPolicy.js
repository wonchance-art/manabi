// 경로별 LLM 제공자 허용 목록(LLM-PROVIDER-POLICY-001 — 오너 승인 2026-11-07 11:35 KST 「권장안대로」, 오케스트레이터 경유).
//
// 사용자가 쓰거나 붙여넣은 내용(작문 · 회화 · 손글씨 · 붙여넣은 글과 그 문장 · 문단 · 자료 원문 · PDF 쪽)은 Claude(Anthropic)에만 보낸다 —
// Claude가 실패하면 Gemini · Groq로 넘기지 않고 각 경로의 기존 실패 안내(잠시 뒤 다시 · 서비스 설정)를 그대로 보인다.
// 단어 뜻(분석 사전 경로 — 표제어 목록만 보내 공유 사전을 채운다)은 지금처럼 Claude → Gemini → Groq 대체를 남긴다.
// 문장 음성(TTS)은 callLLM을 거치지 않는 Gemini 전용 라우트라 이 표 밖이다.
//
// 판정: 표의 GEMINI_FALLBACK_ROUTES만 모든 제공자. 그 밖의 route 라벨(새 경로 포함)은 Claude만 — 닫힌 쪽이 기본이다.
// route 없는 호출은 테스트용 하위호환(모든 제공자)이고, 실제 호출부는 모두 라벨을 단다(계약 llmProviderPolicy.test.js가 소스를 훑어 잡는다).

export const ALL_PROVIDERS = Object.freeze(['anthropic', 'gemini', 'groq']);
export const CLAUDE_ONLY = Object.freeze(['anthropic']);

/** 단어 뜻(분석 사전) — 표제어 · 품사 · 기존 뜻만 실린다. Gemini 대체 유지.
 *  backfill-ipa: 영어 표제어 목록만 보내 IPA(공유 사전 reading · 단어장 발음)를 채운다 — 같은 사전 경로(IPA-CRON-FIX 2026-11-12 KST). */
export const GEMINI_FALLBACK_ROUTES = Object.freeze(['fetchMeanings', 'verifyMeanings', 'backfill-ipa']);

/** 사용자 내용 경로 — Claude만. 문서 겸 계약용 목록(여기 없는 새 라벨도 Claude만이다). */
export const USER_CONTENT_ROUTES = Object.freeze([
  'writing-feedback',          // 작문 첨삭 — 학습자가 쓴 글
  'conversation-turn',         // 회화 — 학습자 발화
  'note-recognize',            // 손글씨 — 노트 필기 이미지
  'class-ink-recognize',       // 손글씨 — 반 판서 필기 이미지
  'study-paragraph',           // 붙여넣은 글 — 자료 문단 학습
  'explain',                   // 붙여넣은 글 — 자료 문장 · 단어 설명(문장 문맥)
  'analyze/korean',            // 붙여넣은 글 — 한국어 자료 원문 분석
  'disambiguateEnPos',         // 붙여넣은 글 — 영어 자료 문장 문맥 품사 판별
  'disambiguateZhPos',         // 붙여넣은 글 — 중국어 자료 문장 문맥 품사 판별
  'classroom-lookup',          // 교사가 고른 표현(최대 500자) — 분석 사전 경로가 아니다
  'gemini-proxy',              // 클라 프록시 — 자료 토큰화 · 문장 번역 · PDF 쪽 인식 · 문항 등 원문이 실린다
  'gemini-proxy:viewer-sentence',
  'gemini-proxy:viewer-sentence-prefetch',
]);

/** 이 route에 허용된 제공자. */
export function providersFor(route) {
  if (route == null || route === '') return ALL_PROVIDERS;
  return GEMINI_FALLBACK_ROUTES.includes(route) ? ALL_PROVIDERS : CLAUDE_ONLY;
}
