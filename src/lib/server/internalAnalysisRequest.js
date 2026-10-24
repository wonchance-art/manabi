// 서버 분석 작업(CANON-SERVER-ANALYSIS-001)이 분석 라우트(/api/analyze · /api/analyze/korean · /api/gemini)를 **같은 프로세스 안에서**
// 부를 때의 표식. 바깥 HTTP 요청은 Next가 만든 Request라 이 WeakSet에 들어올 수 없다 — 헤더 · 쿠키 · 본문으로 흉내 낼 수 없는 표식이다.
// 표식이 있는 요청만 로그인 · 사용자별 한도를 건너뛴다(작업 자체가 관리자 시작 + CRON_SECRET으로 깨운 tick 안에서만 돈다).
// 분석 처리(입력 캡 · 경계 · 뜻 조회 · 루비 잠금)는 브라우저 경로와 한 줄도 다르지 않다 — 같은 라우트 함수를 그대로 부른다.
const INTERNAL = new WeakSet();

/** 같은 프로세스 안 분석 요청 — 표식을 달아 돌려준다. */
export function internalAnalysisRequest(url, init) {
  const request = new Request(new URL(url, 'http://internal.analysis'), init);
  INTERNAL.add(request);
  return request;
}

/** 이 요청이 서버 분석 작업이 같은 프로세스 안에서 만든 것인가. */
export const isInternalAnalysisRequest = (request) => INTERNAL.has(request);
