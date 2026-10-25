// 추천 본문의 돌아갈 곳(?from=) — 들어온 화면으로. 목록 밖 값은 서재로.
// middleware(엣지)도 이 표로 판을 고른다(서재 밖 값마다 /suggestions/[id]/from/<값> 판 — GUEST-STATIC-001 6단계). 그래서 무거운 의존이 없는 이 파일에 둔다
// (suggestionReading.js는 저장 도구 · 출처 표기까지 끌고 와 엣지 묶음이 커진다). suggestionReading.js가 같은 이름으로 다시 내보낸다.
export const SUGGESTION_BACK = Object.freeze({
  home: { href: '/home', label: '← 오늘로' },
  discover: { href: '/discover', label: '← 산책으로' },
  // 「함께 읽는 글」 목록에서 연 추천은 그 목록으로(READER-RETURN-001).
  reading: { href: '/discover?view=reading', label: '← 함께 읽는 글' },
  materials: { href: '/materials', label: '← 내 서재로' },
});
export const suggestionBackKey = (from) => (Object.hasOwn(SUGGESTION_BACK, from) ? from : 'materials');
