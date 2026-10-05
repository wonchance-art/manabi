/** FSRS-ANKI-007 실행 후보. 완전한 상태 저장 계약을 통과하기 전에는 기존 어댑터에 연결하지 않는다. */
import { FSRSAlgorithm, FSRSVersion, S_MIN, S_MAX, date_scheduler } from 'ts-fsrs';

export const FSRS_POLICY = Object.freeze({
  version: 'anki-seconds-v1', engine: 'v5.3.2 using FSRS-6.0',
  learning: Object.freeze([30, 600]), relearning: Object.freeze([600]),
  retention: 0.9, maximumInterval: 36500, timeZone: 'Asia/Seoul', rolloverHour: 4,
});
const DAY = 86400000;
const STATES = ['New', 'Learning', 'Review', 'Relearning'];
const algorithm = new FSRSAlgorithm({ request_retention: FSRS_POLICY.retention,
  maximum_interval: FSRS_POLICY.maximumInterval, enable_fuzz: false, enable_short_term: true });

export function schedulerTime(value) {
  // 밀리초보다 작은 정밀도나 잘못된 달력을 Date의 자동 보정으로 숨기지 않는다.
  let ms;
  if (value instanceof Date) ms = value.getTime();
  else if (typeof value === 'number') ms = value;
  else if (typeof value === 'string') {
    const match = /^(\d{4}|[+-]\d{6})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
    if (!match || match[1] === '-000000') throw new Error('invalid_scheduler_time');
    const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '', , sign, offsetHour = '0', offsetMinute = '0'] = match;
    const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59 ||
        Number(offsetHour) > 23 || Number(offsetMinute) > 59) throw new Error('invalid_scheduler_time');
    const wall = new Date(0);
    // Date.UTC의 0..99년 → 1900..1999년 보정도 피한다.
    wall.setUTCFullYear(year, month - 1, day);
    wall.setUTCHours(hour, minute, second, Number(fraction.padEnd(3, '0')));
    if (wall.getUTCFullYear() !== year || wall.getUTCMonth() !== month - 1 || wall.getUTCDate() !== day) throw new Error('invalid_scheduler_time');
    const offset = (Number(offsetHour) * 60 + Number(offsetMinute)) * 60000 * (sign === '-' ? -1 : 1);
    ms = wall.getTime() - offset;
  }
  if (!Number.isSafeInteger(ms) || new Date(ms).getTime() !== ms) throw new Error('invalid_scheduler_time');
  return ms;
}

// 학습 모델의 04시 경계다. 성장 통계의 KST 자정(growthStats)은 그대로 둔다.
// 실제 시각에서 4시간을 빼면 DST 전환일에 잘못된 날짜가 되므로 지역 달력으로 계산한다.
export function learningDay(value, timeZone = FSRS_POLICY.timeZone, rolloverHour = FSRS_POLICY.rolloverHour) {
  if (!Number.isInteger(rolloverHour) || rolloverHour < 0 || rolloverHour > 23) throw new Error('invalid_rollover');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, calendar: 'gregory', numberingSystem: 'latn',
    era: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(schedulerTime(value));
  const fields = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const year = fields.era === 'BC' ? 1 - Number(fields.year) : Number(fields.year);
  const day = new Date(0);
  day.setUTCFullYear(year, Number(fields.month) - 1, Number(fields.day));
  if (!Number.isFinite(day.getTime())) throw new Error('invalid_scheduler_time');
  return Math.floor(day.getTime() / DAY) - (Number(fields.hour) < rolloverHour ? 1 : 0);
}

export function validateFsrsCard(card) {
  if (!card || card.version !== 1 || card.engine !== FSRS_POLICY.engine ||
      card.policyVersion !== FSRS_POLICY.version || !STATES.includes(card.state)) throw new Error('unsupported_fsrs_card');
  if (FSRSVersion !== FSRS_POLICY.engine) throw new Error('unverified_fsrs_engine');
  for (const key of ['revision', 'reps', 'lapses', 'step', 'scheduledDays', 'elapsedDays']) {
    if (!Number.isSafeInteger(card[key]) || card[key] < 0) throw new Error('invalid_fsrs_counter');
  }
  if (card.revision >= Number.MAX_SAFE_INTEGER || card.reps >= Number.MAX_SAFE_INTEGER || card.lapses > card.reps) throw new Error('invalid_fsrs_counter');
  const introduced = schedulerTime(card.introducedAt), due = schedulerTime(card.due);
  if (typeof card.timeZone !== 'string' || !Number.isInteger(card.rolloverHour)) throw new Error('invalid_scheduler_zone');
  learningDay(due, card.timeZone, card.rolloverHour);
  if (!Number.isFinite(card.stability) || !Number.isFinite(card.difficulty)) throw new Error('invalid_fsrs_memory');
  if (card.state === 'New') {
    if (card.stability !== 0 || card.difficulty !== 0 || card.reps !== 0 || card.lastReview !== null ||
        card.step !== 0 || card.elapsedDays !== 0 || due < introduced + FSRS_POLICY.learning[0] * 1000) throw new Error('invalid_new_card');
  } else {
    const last = schedulerTime(card.lastReview);
    if (last < introduced || due < last || card.reps < 1 || card.stability < S_MIN || card.stability > S_MAX ||
        card.difficulty < 1 || card.difficulty > 10) throw new Error('invalid_fsrs_memory');
  }
  const steps = card.state === 'Learning' ? FSRS_POLICY.learning : card.state === 'Relearning' ? FSRS_POLICY.relearning : null;
  if ((steps && card.step >= steps.length) || (!steps && card.step !== 0) ||
      (card.state !== 'Review' && card.scheduledDays !== 0) ||
      (card.state === 'Review' && (card.scheduledDays < 1 || card.scheduledDays > FSRS_POLICY.maximumInterval))) throw new Error('invalid_fsrs_step');
  return card;
}

/** 저장·본문 노출은 회상이 아니다. 첫 문제까지 30초를 두고 기억 상태와 평가 이력은 갱신하지 않는다. */
export function introduceFsrsCard(at, { timeZone = FSRS_POLICY.timeZone, rolloverHour = FSRS_POLICY.rolloverHour } = {}) {
  const now = schedulerTime(at);
  return validateFsrsCard({ version: 1, engine: FSRS_POLICY.engine, policyVersion: FSRS_POLICY.version,
    timeZone, rolloverHour, introducedAt: new Date(now).toISOString(), revision: 0,
    state: 'New', step: 0, stability: 0, difficulty: 0, reps: 0, lapses: 0,
    due: new Date(now + FSRS_POLICY.learning[0] * 1000).toISOString(), lastReview: null,
    scheduledDays: 0, elapsedDays: 0 });
}

function stepPlan(card, rating) {
  if (card.state === 'Review') return rating === 1 ? { state: 'Relearning', step: 0, seconds: 600 } : null;
  if (rating === 4) return null;
  const state = card.state === 'New' ? 'Learning' : card.state;
  const steps = state === 'Relearning' ? FSRS_POLICY.relearning : FSRS_POLICY.learning;
  if (rating === 1) return { state, step: 0, seconds: steps[0] };
  if (rating === 2) return { state, step: card.step, seconds: card.step > 0 ? steps[card.step]
    : steps.length === 1 ? Math.round(steps[0] * 1.5) : Math.round((steps[0] + steps[1]) / 2) };
  return card.step + 1 < steps.length ? { state, step: card.step + 1, seconds: steps[card.step + 1] } : null;
}

/** 같은 카드와 한 번 캡처한 시각으로 네 버튼의 실제 전이를 계산한다. 미리 복습하지 않는다. */
export function previewFsrsRatings(input, at) {
  const card = validateFsrsCard(input), now = schedulerTime(at);
  if (now < schedulerTime(card.due)) throw new Error('fsrs_card_not_due');
  const elapsed = card.lastReview === null ? 0 : learningDay(now, card.timeZone, card.rolloverHour)
    - learningDay(card.lastReview, card.timeZone, card.rolloverHour);
  if (elapsed < 0) throw new Error('scheduler_clock_reversed');
  const memory = [1, 2, 3, 4].map(rating => algorithm.next_state({ stability: card.stability, difficulty: card.difficulty }, elapsed, rating));
  const days = memory.map(m => algorithm.next_interval(m.stability, elapsed));
  if (card.state === 'Review') {
    days[1] = Math.min(days[1], days[2]);
    days[2] = Math.min(FSRS_POLICY.maximumInterval, Math.max(days[2], days[1] + 1));
    days[3] = Math.min(FSRS_POLICY.maximumInterval, Math.max(days[3], days[2] + 1));
  }
  return Object.fromEntries([1, 2, 3, 4].map(rating => {
    const step = stepPlan(card, rating), scheduledDays = step ? 0 : days[rating - 1];
    const next = { ...card, ...memory[rating - 1], revision: card.revision + 1,
      state: step?.state || 'Review', step: step?.step || 0, scheduledDays, elapsedDays: elapsed,
      reps: card.reps + 1, lapses: card.lapses + (card.state === 'Review' && rating === 1 ? 1 : 0),
      lastReview: new Date(now).toISOString(),
      due: step ? new Date(now + step.seconds * 1000).toISOString() : date_scheduler(new Date(now), scheduledDays, true).toISOString() };
    validateFsrsCard(next);
    return [rating, { card: next, log: { rating, reviewedAt: next.lastReview, policyVersion: card.policyVersion,
      previousRevision: card.revision, elapsedDays: elapsed, previousState: card.state,
      applied: { state: next.state, step: next.step, due: next.due, scheduledDays, revision: next.revision },
      engine: { version: FSRS_POLICY.engine, memory: { ...memory[rating - 1] }, intervalDays: days[rating - 1] } } }];
  }));
}

export function scheduleFsrsReview(card, rating, at) {
  if (![1, 2, 3, 4].includes(rating)) throw new Error('invalid_fsrs_rating');
  return previewFsrsRatings(card, at)[rating];
}
