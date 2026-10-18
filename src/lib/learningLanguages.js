// 학습 언어 정본 — import 0개. 복습 범위 주소(reviewScopeUrl → 레벨 목록 · 서버 /vocab)가 언어 목록 하나 때문에
// learningSources(경계 편집 · 교재 출처 · 뷰어 문맥)를 통째로 끌어오지 않게 따로 둔다. learningSources가 다시 내보낸다.
// 고정한다: 이 배열을 바꾸는 호출부는 0건이다(grep 2026-10-16) — 바뀌면 언어 검사 전부가 조용히 달라진다.
export const LEARNING_LANGUAGES = Object.freeze(['Japanese', 'Chinese', 'French', 'English', 'Korean']);
