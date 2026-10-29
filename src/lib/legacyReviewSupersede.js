/**
 * 예전 일정(user_vocabulary) 비교 후 쓰기가 0행이었다 — 이 채점이 바탕으로 한 일정(last_reviewed_at)이 그 사이 바뀌었다
 * (다른 기기가 먼저 복습 · 되돌림). 독립 리뷰 2026-10-25 KST. 쓰기(fsrs.persistVocabGrade) · 기록(progressStore) · 재생(reviewOutbox) ·
 * 화면(VocabPage)이 같은 판정을 쓴다 — 작은 모듈로 두어 정적 import가 FSRS 계산 묶음을 끌어오지 않게 한다.
 */
export const LEGACY_REVIEW_SUPERSEDED = 'legacy_review_superseded';
export const isLegacyReviewSuperseded = error => error?.code === LEGACY_REVIEW_SUPERSEDED;
export const legacyReviewSupersededError = () => Object.assign(new Error(LEGACY_REVIEW_SUPERSEDED), { code: LEGACY_REVIEW_SUPERSEDED });
/** 다른 기기가 먼저 복습해 이 채점의 일정은 두었다(기록은 남았다) — 화면 문구 정본(해요체 · 두 문장). */
export const LEGACY_REVIEW_SUPERSEDED_NOTICE = '다른 기기에서 먼저 복습한 표현이에요. 일정은 그 복습대로 둘게요.';
