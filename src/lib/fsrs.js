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

import { fsrs, Rating, State, createEmptyCard, S_MIN, S_MAX } from 'ts-fsrs';
import { assertLegacyFsrsAllowedOnce } from './fsrsLegacyBoundary.js';
import { FSRS_POLICY, fsrsPolicySteps, introduceFsrsCard, learningDay, learningDaySpan, learningDayStart, previewFsrsRatings, schedulerTime } from './fsrsScheduler.js';

// 기본 파라미터로 스케줄러 생성 (한번만)
const scheduler = fsrs();
export const LEGACY_MAX_INTERVAL_DAYS = 365;

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
  // 간격 상한은 FSRS 카드와 같은 365일(fsrsScheduler FSRS_POLICY.maximumInterval) — 옛 경로 카드도 1년 안에 돌아온다.
  // 기한은 FSRS 카드와 같은 날 경계(학습일 + N일이 시작하는 04:00 KST, 2026-10-25 KST) — 채점 시각 + N일이 아니다.
  const intervalDays = Math.min(LEGACY_MAX_INTERVAL_DAYS, Math.max(1, Math.round(S)));
  const nextReview = new Date(learningDayStart(learningDay(now) + intervalDays));

  return {
    interval: S,
    ease_factor: D,
    repetitions: lapses,
    next_review_at: nextReview.toISOString(),
  };
}

/**
 * 단어 카드 학습 단계(오너 지시 2026-10-19 KST — 「뷰어 쪽에도 이번에 적용한 anki 값대로 분, 날짜 수」).
 * 복습실 FSRS 카드의 운영 정책 anki-v2(학습 1분 · 10분, 재학습 10분)를 옛 일정 단어 행에도 같은 계산으로 건다 —
 * 새 단어 다시 1분 · 어려움 6분 · 알맞음 10분 · 쉬움 8일, 복습 중 단어의 다시 = 10분 재학습.
 * 계산은 FSRS 카드 정본(fsrsScheduler previewFsrsRatings)을 그대로 쓴다(손계산 금지). 복습 단계(하루 이상) 단어도
 * 마지막 채점 기록이 있으면 같은 정본으로 계산한다(2026-10-23 KST) — 기록이 없는 행만 예전 calculateFSRS(일 단위).
 * 옛 행에는 단계 칸이 없어 마지막 채점 → 다음 복습 간격으로 단계를 읽는다(하루 미만 = 학습 · 재학습 단계).
 * 채점한 적 없이 등급과 함께 담은 행은 첫 안정도로 담은 등급을 읽는다(알맞음 이상 = 둘째 단계 · 쉬움 = 졸업).
 * 문법 · 드릴 카드는 이 함수를 쓰지 않는다(calculateFSRS 그대로).
 */
export const VOCAB_STEP_POLICY = 'anki-v2';
const STEPS = fsrsPolicySteps(VOCAB_STEP_POLICY);
const DAY_MS = 24 * 3600 * 1000;
// 복습 단계(하루 이상)와 학습 단계(10분 이하)를 가르는 간격 — 하루 간격 카드도 next_review_at(채점 계산 시각 기준)이
// last_reviewed_at(기록 시각, 몇 ms 뒤)보다 하루에 조금 못 미치게 찍히므로 정확히 하루로 가르면 복습 카드가 학습 단계로 읽힌다.
// 날 경계 기한(2026-10-25 KST)부터는 03:55에 1일로 답하면 기한이 5분 뒤 04:00이다 — 기한이 학습일 시작 시각이면 간격과 상관없이 복습 단계다.
const REVIEW_GAP_MS = DAY_MS / 2;
const isDayDue = (due) => learningDayStart(learningDay(due)) === due;
// 첫 안정도는 시각과 무관하다 — 서울 고정 구간 시각으로 계산해 모듈을 읽을 때 지역 달력 서식기를 만들지 않는다.
const STEP_ANCHOR = Date.UTC(2026, 0, 1);
const INITIAL_S = (() => {
  const first = previewFsrsRatings(introduceFsrsCard(STEP_ANCHOR, { policyVersion: VOCAB_STEP_POLICY }), STEP_ANCHOR + STEPS.learning[0] * 1000);
  return { good: first[3].card.stability, easy: first[4].card.stability };
})();
const timeOf = (value) => { try { return value == null ? NaN : schedulerTime(value); } catch { return NaN; } };

/** 옛 단어 행의 단계 — { state: 'New' | 'Learning' | 'Relearning' | 'Review', step }. */
export function vocabStepPhase(prev) {
  const S = Number(prev?.interval) || 0;
  if (S <= 0) return { state: 'New', step: 0 };
  const due = timeOf(prev.next_review_at), last = timeOf(prev.last_reviewed_at);
  if (Number.isFinite(last)) {
    if (!Number.isFinite(due) || due - last >= REVIEW_GAP_MS || isDayDue(due)) return { state: 'Review', step: 0 };
    if ((prev.repetitions ?? 0) > 0) return { state: 'Relearning', step: 0 };
    return { state: 'Learning', step: due - last >= STEPS.learning[1] * 1000 - 1000 ? 1 : 0 };
  }
  if (S >= INITIAL_S.easy - 1e-6) return { state: 'Review', step: 0 };
  return { state: 'Learning', step: S >= INITIAL_S.good - 1e-6 ? 1 : 0 };
}

/** 복습 단계 옛 행 → FSRS 카드(마지막 채점 기록이 있을 때만). 차례 전 채점도 받으므로 due는 지금 이하로 둔다. */
function vocabReviewCard(prev, now) {
  const last = timeOf(prev.last_reviewed_at), due = timeOf(prev.next_review_at);
  if (!Number.isFinite(last) || !Number.isFinite(due) || last > now) return null;
  const lapses = Math.max(0, prev.repetitions ?? 0);
  return { version: 1, engine: FSRS_POLICY.engine, policyVersion: VOCAB_STEP_POLICY, timeZone: FSRS_POLICY.timeZone,
    rolloverHour: FSRS_POLICY.rolloverHour, introducedAt: new Date(last).toISOString(), revision: 0, state: 'Review', step: 0,
    stability: Math.min(S_MAX, Math.max(S_MIN, Number(prev.interval))), difficulty: Math.min(10, Math.max(1, Number(prev.ease_factor) || 5)),
    reps: lapses + 1, lapses, due: new Date(Math.max(last, Math.min(due, now))).toISOString(), lastReview: new Date(last).toISOString(),
    scheduledDays: Math.min(FSRS_POLICY.storedIntervalLimit, Math.max(1, learningDaySpan(due, last) ?? Math.round((due - last) / DAY_MS))), elapsedDays: 0 };
}

/**
 * 단어 채점 — calculateFSRS와 같은 입출력({ interval, ease_factor, repetitions, next_review_at }).
 * prev에 last_reviewed_at · created_at이 있으면 단계를 그대로 잇는다. at = 채점 시각(기본 지금).
 */
export function calculateVocabFSRS(rating, prev, at = Date.now()) {
  const now = timeOf(at instanceof Date ? at.getTime() : at);
  if (!Number.isFinite(now)) return calculateFSRS(rating, prev);
  const phase = vocabStepPhase(prev);
  if (phase.state === 'Review') {
    // 복습 단계도 FSRS 카드 정본으로 계산한다(Anki 대조, 오너 승인 2026-10-23 KST) — 마지막 채점 시각을 실제 기록으로 읽고
    // 학습일(04시) 단위로 센다. 예전 calculateFSRS는 「다음 복습 − 안정도」로 추정해 간격이 Anki보다 길었다(2일 카드 9·14·24일 vs 8·11·19일).
    const card = vocabReviewCard(prev, now);
    if (card) {
      try {
        const next = previewFsrsRatings(card, now)[rating].card;
        return { interval: next.stability, ease_factor: next.difficulty, repetitions: next.lapses, next_review_at: next.due };
      } catch { /* 카드로 못 읽는 행은 아래 예전 계산 */ }
    }
    const next = calculateFSRS(rating, prev);
    return rating === 1 ? { ...next, next_review_at: new Date(now + STEPS.relearning[0] * 1000).toISOString() } : next;
  }
  try {
    let card;
    if (phase.state === 'New') card = introduceFsrsCard(now - STEPS.learning[0] * 1000, { policyVersion: VOCAB_STEP_POLICY });
    else {
      const seen = [timeOf(prev.last_reviewed_at), timeOf(prev.created_at)].find(Number.isFinite);
      const last = Math.min(Number.isFinite(seen) ? seen : now, now);
      const due = Math.max(last, Math.min(Number.isFinite(timeOf(prev.next_review_at)) ? timeOf(prev.next_review_at) : now, now));
      const lapses = Math.max(0, prev.repetitions ?? 0);
      card = { version: 1, engine: FSRS_POLICY.engine, policyVersion: VOCAB_STEP_POLICY, timeZone: FSRS_POLICY.timeZone,
        rolloverHour: FSRS_POLICY.rolloverHour, introducedAt: new Date(last).toISOString(), revision: 0, state: phase.state, step: phase.step,
        stability: Math.min(S_MAX, Math.max(S_MIN, Number(prev.interval))), difficulty: Math.min(10, Math.max(1, Number(prev.ease_factor) || 5)),
        reps: lapses + 1, lapses, due: new Date(due).toISOString(), lastReview: new Date(last).toISOString(), scheduledDays: 0, elapsedDays: 0 };
    }
    const next = previewFsrsRatings(card, now)[rating].card;
    return { interval: next.stability, ease_factor: next.difficulty, repetitions: phase.state === 'New' ? 0 : Math.max(0, prev.repetitions ?? 0),
      next_review_at: next.due };
  } catch {
    return calculateFSRS(rating, prev); // 단계를 못 읽는 행(손상 · 범위 밖 값) — 예전 계산
  }
}

/**
 * 어휘 FSRS 채점 저장의 단일 소스 — {…nextStats, last_reviewed_at}를 user_vocabulary에
 * UPDATE한다. 같은 페이로드가 4곳(단어장 scoreMutation·인라인 복습·퀘스트 복습·
 * progressStore)에 흩어져 각자 유지되던 중복의 수렴(전수 조사 구조 정리 C).
 * 컬럼은 snake_case여야 한다 — 미지 컬럼이 섞이면 PostgREST가 UPDATE 전체를
 * 거부해 채점이 조용히 유실된다(과거 사고). client는 주입식(순수 lib 유지·테스트 용이).
 */
export async function persistVocabGrade(client, wordId, nextStats, reviewedAt = new Date().toISOString(), { boundary } = {}) {
  // 같은 채점이 방금 이 카드의 경계를 확인했으면(증거) 그 답을 나눠 쓴다(F5②). 증거가 없으면 지금처럼 묻는다.
  await assertLegacyFsrsAllowedOnce(client, { cardId: wordId }, boundary);
  const { error } = await client
    .from('user_vocabulary')
    .update({ ...nextStats, last_reviewed_at: reviewedAt })
    .eq('id', wordId);
  if (error) throw error;
}
