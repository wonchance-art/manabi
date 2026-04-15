/**
 * FSRS 알고리즘 — 공식 라이브러리 ts-fsrs v5+ 사용
 * 기존 인터페이스 유지해서 호출부 변경 없음
 *
 * 우리 DB 스키마:
 *   interval       → stability (S, 일 단위)
 *   ease_factor    → difficulty (D, 1~10)
 *   repetitions    → lapses (Again 누적)
 *   next_review_at → ISO timestamp
 *
 * ts-fsrs Card 타입:
 *   due, stability, difficulty, elapsed_days, scheduled_days,
 *   reps, lapses, state (New/Learning/Review/Relearning), last_review
 */

import { fsrs, Rating, State, createEmptyCard } from 'ts-fsrs';

// 기본 파라미터로 스케줄러 생성 (한번만)
const scheduler = fsrs();

/**
 * 1/2/3/4 rating → ts-fsrs Rating enum
 */
function toRating(n) {
  switch (n) {
    case 1: return Rating.Again;
    case 2: return Rating.Hard;
    case 3: return Rating.Good;
    case 4: return Rating.Easy;
    default: return Rating.Good;
  }
}

/**
 * 우리 DB row → ts-fsrs Card 객체
 */
function toCard(prev) {
  const { interval: S = 0, ease_factor: D = 0, repetitions: lapses = 0, next_review_at = null } = prev || {};

  // 신규 카드(아직 복습 안 함)
  if (S === 0) {
    return createEmptyCard();
  }

  const now = Date.now();
  const due = next_review_at ? new Date(next_review_at) : new Date(now);

  // last_review는 due - S일 이전으로 추정, 단 미래면 안 됨 (ts-fsrs는 음수 delta_t 거부)
  let lastReviewTs = due.getTime() - Math.max(S, 0.01) * 24 * 3600 * 1000;
  if (lastReviewTs > now - 1000) lastReviewTs = now - 1000; // 최소 1초 전

  return {
    due,
    stability: Math.max(0.01, S),
    difficulty: Math.max(1, Math.min(10, D || 5)),
    elapsed_days: Math.max(0, (now - lastReviewTs) / (24 * 3600 * 1000)),
    scheduled_days: Math.max(0, S),
    reps: 0,
    lapses,
    state: State.Review,
    last_review: new Date(lastReviewTs),
  };
}

/**
 * @param {number} rating - 1 Again / 2 Hard / 3 Good / 4 Easy
 * @param {Object} prevStats - { interval, ease_factor, repetitions, next_review_at }
 * @returns {Object} 동일 형식의 다음 상태
 */
export function calculateFSRS(rating, prevStats) {
  const card = toCard(prevStats);
  const now = new Date();

  const schedulingCards = scheduler.repeat(card, now);
  const next = schedulingCards[toRating(rating)];

  // ts-fsrs v5 응답 구조: { card: {...}, log: {...} }
  const newCard = next.card || next; // 호환성

  const S = Math.min(Math.max(0.01, newCard.stability ?? 0.01), 36500);
  const D = Math.max(1, Math.min(10, newCard.difficulty ?? 5));
  const lapses = newCard.lapses ?? prevStats?.repetitions ?? 0;

  // next_review_at: 우리는 "일 단위 반올림" 사용 (VocabReview가 하루 단위로 복습 큐잉)
  const intervalDays = Math.max(1, Math.round(S));
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);

  return {
    interval: S,
    ease_factor: D,
    repetitions: lapses,
    next_review_at: nextReview.toISOString(),
  };
}
