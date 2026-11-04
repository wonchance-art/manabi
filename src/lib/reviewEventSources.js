/**
 * review_events 출처 분류 정본(EVENT-SOURCE-001, 2026-11-04 KST — 오너 상시 방침 「백엔드 데이터 관련 개선은 알아서」).
 * 답이 아닌 기록 — 정답률 · 복습 수 · 난이도 다이얼 · 공부한 날 어디에도 「답」으로 들어가지 않는다.
 *   ui = 행동 계측(되돌리기 표식 등) · dict = 사전 자가 확인 · assist = /study 재료 단어 팝오버 · 「왜 이게 답이에요?」 열람.
 * assist는 correct:false로 쌓여(어제 도움 받은 단어를 오늘 다시 내려고 — studySession) 예전엔 채점 판정(weeklyReport.isGradedReviewEvent)과
 * 난이도 다이얼(practiceEvents.countsForDifficulty)이 각자 목록(ui · dict)만 빼서 팝오버 한 번이 오답 한 번으로 셌다.
 * 두 판정이 이 집합 하나를 쓴다. 순수 상수 모듈 — import 없음(첫 화면 · 학습 화면 어디서 받아도 가볍다).
 */
export const NON_ANSWER_SOURCES = Object.freeze(new Set(['ui', 'dict', 'assist']));
