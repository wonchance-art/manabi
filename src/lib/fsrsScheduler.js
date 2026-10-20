/** FSRS-ANKI-007 실행 후보. 완전한 상태 저장 계약을 통과하기 전에는 기존 어댑터에 연결하지 않는다. */
import { FSRSAlgorithm, FSRSVersion, S_MIN, S_MAX } from 'ts-fsrs';

export const FSRS_POLICY = Object.freeze({
  version: 'anki-seconds-v1', engine: 'v5.3.2 using FSRS-6.0',
  learning: Object.freeze([30, 600]), relearning: Object.freeze([600]),
  retention: 0.9, maximumInterval: 36500, timeZone: 'Asia/Seoul', rolloverHour: 4,
});
// 학습 단계 정책(REV-SCOPE R1-B-2). 어느 정책으로 새 카드를 만들고 채점할지는 서버(fsrs_capabilities)가 정한다.
// 두 정책 모두 학습 2단계 · 재학습 1단계라 단계 순번은 그대로 옮겨진다 — 학습 · 재학습 중인 카드는 다음 채점 때 새 정책으로 넘어간다.
export const FSRS_POLICIES = Object.freeze({
  'anki-seconds-v1': Object.freeze({ learning: FSRS_POLICY.learning, relearning: FSRS_POLICY.relearning }),
  'anki-v2': Object.freeze({ learning: Object.freeze([60, 600]), relearning: Object.freeze([600]) }),
});
/** 취소 · 중단 뒤 다시 묻기까지의 고정 대기(SQL next_question_at의 30초). 학습 단계와 무관하다. */
export const FSRS_RETRY_SECONDS = 30;
/**
 * Anki learn-ahead(learn_ahead_secs 기본 1200초): 학습 · 재학습 카드는 기한 20분 전부터 물을 수 있다.
 * 언제 앞당길지(다른 카드가 남지 않았을 때)는 화면이 정하고, 허용 여부는 서버가 fsrs_capabilities로 알린다.
 */
export const FSRS_LEARN_AHEAD_SECONDS = 1200;
const AHEAD_STATES = new Set(['Learning', 'Relearning']);
/**
 * 이 카드를 처음 물을 수 있는 시각(ms). 학습 · 재학습이고 기한 너머 대기(되돌리기 · 중단 30초)가 없으면 기한 − learnAheadSeconds.
 * 그 밖에는 기한과 nextQuestionAt 중 늦은 쪽.
 */
export function fsrsQuestionOpensAt(card, nextQuestionAt = null, learnAheadSeconds = 0) {
  const due = schedulerTime(card.due), wait = nextQuestionAt == null ? due : schedulerTime(nextQuestionAt);
  if (learnAheadSeconds > 0 && AHEAD_STATES.has(card.state) && wait <= due) return due - learnAheadSeconds * 1000;
  return Math.max(due, wait);
}
export function fsrsPolicySteps(version) {
  if (!Object.hasOwn(FSRS_POLICIES, version)) throw new Error('unsupported_fsrs_card');
  return FSRS_POLICIES[version];
}
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

// 지역 달력 서식기는 시간대마다 한 번만 만든다(HOME-HYDRATION-001) — 만들기가 비싸(Node 실측: 새로 만들어 쓰기 452µs ·
// 만들어 둔 것 쓰기 6.8µs) 카드마다 새로 만들면 카드 수에 비례해 주 스레드를 쓴다. 같은 옵션 · 같은 시간대면 결과가 같다.
// 잘못된 시간대는 만들 때 RangeError — 저장하지 않으므로 예전처럼 매번 던진다.
const DAY_FORMATS = new Map();
// 서울은 1988-10-09 03:00 KDT(= 1988-10-08T18:00Z) 마지막 전환 뒤로 UTC+9 고정이다(IANA tzdata Asia/Seoul — 일광 절약 없음).
// 그 뒤 시각은 서식기 없이 더해서 센다 — 페이지에서 처음 만드는 시간대 서식기는 ICU 시간대 자료를 여느라 한 번에
// CPU×4 기준 150–360ms를 막았다(배움 로그인 첫 화면 LCP 전, useLearningAdmission → dayAt). 그 전 시각 · 다른 시간대는 지역 달력 그대로.
// 결과가 같은지는 learningDayFormat.test가 Intl 결과와 대조한다(tzdata가 바뀌면 그 검사가 깨진다).
const SEOUL_FIXED_FROM = Date.UTC(1988, 9, 8, 18);
const SEOUL_OFFSET = 9 * 3600000;
function dayFormat(timeZone) {
  let format = DAY_FORMATS.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone, calendar: 'gregory', numberingSystem: 'latn',
      era: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
    DAY_FORMATS.set(timeZone, format);
  }
  return format;
}

// 학습 모델의 04시 경계다. 성장 통계의 KST 자정(growthStats)은 그대로 둔다.
// 실제 시각에서 4시간을 빼면 DST 전환일에 잘못된 날짜가 되므로 지역 달력으로 계산한다.
export function learningDay(value, timeZone = FSRS_POLICY.timeZone, rolloverHour = FSRS_POLICY.rolloverHour) {
  if (!Number.isInteger(rolloverHour) || rolloverHour < 0 || rolloverHour > 23) throw new Error('invalid_rollover');
  const ms = schedulerTime(value);
  if (timeZone === 'Asia/Seoul' && ms >= SEOUL_FIXED_FROM) {
    const local = ms + SEOUL_OFFSET, date = Math.floor(local / DAY);
    return date - (Math.floor((local - date * DAY) / 3600000) < rolloverHour ? 1 : 0);
  }
  const parts = dayFormat(timeZone).formatToParts(ms);
  const fields = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const year = fields.era === 'BC' ? 1 - Number(fields.year) : Number(fields.year);
  const day = new Date(0);
  day.setUTCFullYear(year, Number(fields.month) - 1, Number(fields.day));
  if (!Number.isFinite(day.getTime())) throw new Error('invalid_scheduler_time');
  return Math.floor(day.getTime() / DAY) - (Number(fields.hour) < rolloverHour ? 1 : 0);
}

const WALL_FORMATS = new Map();
function wallTime(ms, timeZone) {
  let format = WALL_FORMATS.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone, calendar: 'gregory', numberingSystem: 'latn', era: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    WALL_FORMATS.set(timeZone, format);
  }
  const f = Object.fromEntries(format.formatToParts(ms).map(p => [p.type, p.value]));
  const wall = new Date(0);
  wall.setUTCFullYear(f.era === 'BC' ? 1 - Number(f.year) : Number(f.year), Number(f.month) - 1, Number(f.day));
  wall.setUTCHours(Number(f.hour), Number(f.minute), Number(f.second), 0);
  return wall.getTime();
}

/**
 * 학습일 day가 시작하는 실제 시각(그날 지역 시간 rolloverHour시). Anki는 며칠 단위 복습의 기한을 날짜로 저장해
 * 그 날 경계에 한꺼번에 연다(rslib scheduler/answering/learning.rs · timing.rs) — 채점한 시각 + N×24시간이 아니다.
 */
export function learningDayStart(day, timeZone = FSRS_POLICY.timeZone, rolloverHour = FSRS_POLICY.rolloverHour) {
  if (!Number.isSafeInteger(day)) throw new Error('invalid_scheduler_time');
  const target = day * DAY + rolloverHour * 3600000;
  if (timeZone === 'Asia/Seoul' && target - SEOUL_OFFSET >= SEOUL_FIXED_FROM) return target - SEOUL_OFFSET;
  // 다른 시간대: 지역 벽시계와의 차이로 두 번 맞춘다. 그 시각이 없는 날(일광 절약 시작)은 그 뒤 첫 시각이 경계다.
  let ms = target;
  for (let i = 0; i < 3; i++) ms = target - (wallTime(ms, timeZone) - ms);
  while (learningDay(ms, timeZone, rolloverHour) < day) ms += 3600000;
  return ms;
}

export function validateFsrsCard(card) {
  if (!card || card.version !== 1 || card.engine !== FSRS_POLICY.engine ||
      !Object.hasOwn(FSRS_POLICIES, card.policyVersion) || !STATES.includes(card.state)) throw new Error('unsupported_fsrs_card');
  const policy = FSRS_POLICIES[card.policyVersion];
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
        card.step !== 0 || card.elapsedDays !== 0 || due < introduced + policy.learning[0] * 1000) throw new Error('invalid_new_card');
  } else {
    const last = schedulerTime(card.lastReview);
    if (last < introduced || due < last || card.reps < 1 || card.stability < S_MIN || card.stability > S_MAX ||
        card.difficulty < 1 || card.difficulty > 10) throw new Error('invalid_fsrs_memory');
  }
  const steps = card.state === 'Learning' ? policy.learning : card.state === 'Relearning' ? policy.relearning : null;
  if ((steps && card.step >= steps.length) || (!steps && card.step !== 0) ||
      (card.state !== 'Review' && card.scheduledDays !== 0) ||
      (card.state === 'Review' && (card.scheduledDays < 1 || card.scheduledDays > FSRS_POLICY.maximumInterval))) throw new Error('invalid_fsrs_step');
  return card;
}

/** 저장·본문 노출은 회상이 아니다. 첫 문제까지 정책의 첫 단계(30초 · 1분)를 두고 기억 상태와 평가 이력은 갱신하지 않는다. */
export function introduceFsrsCard(at, { timeZone = FSRS_POLICY.timeZone, rolloverHour = FSRS_POLICY.rolloverHour,
  policyVersion = FSRS_POLICY.version } = {}) {
  const now = schedulerTime(at), policy = fsrsPolicySteps(policyVersion);
  return validateFsrsCard({ version: 1, engine: FSRS_POLICY.engine, policyVersion,
    timeZone, rolloverHour, introducedAt: new Date(now).toISOString(), revision: 0,
    state: 'New', step: 0, stability: 0, difficulty: 0, reps: 0, lapses: 0,
    due: new Date(now + policy.learning[0] * 1000).toISOString(), lastReview: null,
    scheduledDays: 0, elapsedDays: 0 });
}

function stepPlan(card, rating, policy) {
  if (card.state === 'Review') return rating === 1 ? { state: 'Relearning', step: 0, seconds: policy.relearning[0] } : null;
  if (rating === 4) return null;
  const state = card.state === 'New' ? 'Learning' : card.state;
  const steps = state === 'Relearning' ? policy.relearning : policy.learning;
  if (rating === 1) return { state, step: 0, seconds: steps[0] };
  if (rating === 2) return { state, step: card.step, seconds: card.step > 0 ? steps[card.step]
    : steps.length === 1 ? Math.round(steps[0] * 1.5) : Math.round((steps[0] + steps[1]) / 2) };
  return card.step + 1 < steps.length ? { state, step: card.step + 1, seconds: steps[card.step + 1] } : null;
}

const clampDays = (value, minimum) => Math.min(FSRS_POLICY.maximumInterval, Math.max(Math.round(value), Math.min(minimum, FSRS_POLICY.maximumInterval)));
// Anki fuzz.rs fuzz_bounds의 위쪽 끝 — 이전 간격이 이 안이면 「거의 안 늘었어도 줄이지는 않는다」.
function fuzzUpper(interval) {
  const delta = interval < 2.5 ? 0 : [[2.5, 7, 0.15], [7, 20, 0.1], [20, Infinity, 0.05]]
    .reduce((sum, [start, end, factor]) => sum + factor * Math.max(0, Math.min(interval, end) - start), 1);
  return Math.min(FSRS_POLICY.maximumInterval, Math.round(interval + delta));
}
// Anki minimum_review_fuzz_interval: 늘었으면 이전 + 1, 퍼짐 범위 안이면 이전 그대로, 그보다 줄었으면(모수 변경) 하한 없음.
function previousFloor(interval, previous) {
  if (Math.round(interval) > previous) return previous + 1;
  return previous <= fuzzUpper(interval) ? previous : 0;
}
/**
 * 복습 카드를 맞혔을 때(어려움 · 알맞음 · 쉬움)의 간격 — Anki review.rs passing_fsrs_review_intervals와 같다.
 * 어려움 ≥ 1, 알맞음 ≥ 어려움 + 1, 쉬움 ≥ 알맞음 + 1이고, 셋 다 이전 간격 아래로 줄지 않는다. 퍼짐(fuzz)은 아직 끈다.
 */
function passingReviewDays(raw, previous) {
  const hard = clampDays(raw[1], Math.max(1, previousFloor(raw[1], previous)));
  const good = clampDays(raw[2], Math.max(hard + 1, previousFloor(raw[2], previous)));
  const easy = clampDays(raw[3], Math.max(good + 1, previousFloor(raw[3], previous)));
  return [clampDays(raw[0], 1), hard, good, easy];
}
/** 학습 · 재학습에서 졸업할 때 — 「쉬움」은 「알맞음」보다 하루 이상 길다(Anki learning.rs · relearning.rs answer_easy). */
function graduatingDays(raw) {
  const [again, hard, good] = raw.slice(0, 3).map(value => clampDays(value, 1));
  return [again, hard, good, clampDays(raw[3], good + 1)];
}

/**
 * 같은 카드와 한 번 캡처한 시각으로 네 버튼의 실제 전이를 계산한다. 미리 복습하지 않는다.
 * policyVersion = 채점 뒤 카드의 정책(서버가 알린 지금 정책). 생략하면 카드의 정책을 그대로 쓴다.
 */
export function previewFsrsRatings(input, at, { policyVersion = input?.policyVersion } = {}) {
  const card = validateFsrsCard(input), now = schedulerTime(at), policy = fsrsPolicySteps(policyVersion);
  // 순수 계산은 learn-ahead 폭까지 받는다. 실제로 앞당겨 물을 수 있는지는 서버 · DB가 지킨다.
  if (now < fsrsQuestionOpensAt(card, null, FSRS_LEARN_AHEAD_SECONDS)) throw new Error('fsrs_card_not_due');
  const elapsed = card.lastReview === null ? 0 : learningDay(now, card.timeZone, card.rolloverHour)
    - learningDay(card.lastReview, card.timeZone, card.rolloverHour);
  if (elapsed < 0) throw new Error('scheduler_clock_reversed');
  const memory = [1, 2, 3, 4].map(rating => algorithm.next_state({ stability: card.stability, difficulty: card.difficulty }, elapsed, rating));
  // Anki처럼 반올림 전 간격으로 하한을 정한다. ts-fsrs next_interval = max(1, round(이 값))과 같은 수식이다.
  const raw = memory.map(m => Math.min(FSRS_POLICY.maximumInterval, Math.max(1, m.stability * algorithm.intervalModifier)));
  const days = card.state === 'Review' ? passingReviewDays(raw, card.scheduledDays) : graduatingDays(raw);
  return Object.fromEntries([1, 2, 3, 4].map(rating => {
    const step = stepPlan(card, rating, policy), scheduledDays = step ? 0 : days[rating - 1];
    const next = { ...card, ...memory[rating - 1], policyVersion, revision: card.revision + 1,
      state: step?.state || 'Review', step: step?.step || 0, scheduledDays, elapsedDays: elapsed,
      reps: card.reps + 1, lapses: card.lapses + (card.state === 'Review' && rating === 1 ? 1 : 0),
      lastReview: new Date(now).toISOString(),
      due: new Date(step ? now + step.seconds * 1000
        : learningDayStart(learningDay(now, card.timeZone, card.rolloverHour) + scheduledDays, card.timeZone, card.rolloverHour)).toISOString() };
    validateFsrsCard(next);
    return [rating, { card: next, log: { rating, reviewedAt: next.lastReview, policyVersion: card.policyVersion,
      previousRevision: card.revision, elapsedDays: elapsed, previousState: card.state,
      applied: { state: next.state, step: next.step, due: next.due, scheduledDays, revision: next.revision },
      engine: { version: FSRS_POLICY.engine, memory: { ...memory[rating - 1] }, intervalDays: days[rating - 1] } } }];
  }));
}

export function scheduleFsrsReview(card, rating, at, options) {
  if (![1, 2, 3, 4].includes(rating)) throw new Error('invalid_fsrs_rating');
  return previewFsrsRatings(card, at, options)[rating];
}
