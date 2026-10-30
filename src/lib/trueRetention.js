/**
 * 실제 기억률 표 — 「복습 단계 카드를 다시 만났을 때 맞힌 비율」(Anki 24.11 True Retention 대조, 설계 docs/design/true-retention.md).
 * 순수 모듈: 이미 받아 온 행(review_events · fsrs_operations) + now 주입 → 기간별 익히는 중 · 익숙 표. 조회는 소비 화면 몫(growthStats 관례).
 *
 * ── 무엇을 세나(Anki rslib stats/graphs/retention.rs와 같은 결)
 *  · 일정을 바꾼 어휘 채점만 센다 — 채점 판정은 weeklyReport.isGradedReviewEvent(연습 · ui · dict · hanzi · level 제외) 정본,
 *    그 위에 source 'vocab' + 평가(rating 1–4, /study 어휘 문항은 정오)가 있는 행. 산출(produce) · 예열(warmup) · 단어 없는 문항은 일정 밖이라 뺀다.
 *  · 되돌린 채점은 뺀다 — undoneReviews.dropUndoneEvents 정본 + 새 일정의 undo 연산(undoneOperationId)도 함께 본다(마커 조회가 잘려도 빠지게).
 *  · 채점 직전 간격이 1일 이상인 카드만 — 학습 · 재학습 단계(분 단위)와 같은 날 다시 본 답은 Anki처럼 뺀다.
 *    새 일정 = 연산의 previousCard가 Review 상태일 때 그 scheduledDays. 예전 일정 = detail.prev_interval_days(있으면) 또는
 *    같은 단어의 직전 채점부터 지난 학습일 수(추정 — estimated로 따로 센다. 예전 일정 이벤트에는 직전 간격이 기록돼 있지 않다).
 *  · 익숙 = 직전 간격 ≥ growthStats.MATURE_MIN_INTERVAL(21일), 그 밖은 익히는 중. 맞힘 = 다시(1) 말고 전부.
 *  · 기간은 학습일(fsrsScheduler.learningDay — 04시 경계) 단위: 오늘 · 어제 · 지난 7일 · 지난 30일 · 지난 365일 · 전체.
 * 목표는 FSRS_POLICY.retention(0.9) — 숫자를 여기서 다시 쓰지 않는다.
 * 「기억 건강」의 유지율(memoryHealth — 지금 기억할 확률의 예측)과는 다른 값이다: 이 표는 실제로 답한 결과다.
 */
import { isGradedReviewEvent } from './weeklyReport.js';
import { dropUndoneEvents } from './undoneReviews.js';
import { FSRS_POLICY, learningDay } from './fsrsScheduler.js';
import { MATURE_MIN_INTERVAL } from './growthStats.js';

/** 기간 — fromDay = 오늘 학습일에서 몇 날 전부터인가(null = 처음부터). Anki today · yesterday · week · month · year · all_time과 같은 폭. */
export const TRUE_RETENTION_PERIODS = Object.freeze([
  Object.freeze({ key: 'today', fromDay: 0, toDay: 0 }),
  Object.freeze({ key: 'yesterday', fromDay: 1, toDay: 1 }),
  Object.freeze({ key: 'week', fromDay: 6, toDay: 0 }),
  Object.freeze({ key: 'month', fromDay: 29, toDay: 0 }),
  Object.freeze({ key: 'year', fromDay: 364, toDay: 0 }),
  Object.freeze({ key: 'all', fromDay: null, toDay: 0 }),
]);
/** 대표 기간 — 하루 값은 흔들리므로 한 달을 본다(Anki 설명서 「monthly data」). */
export const TRUE_RETENTION_HEADLINE = 'month';

const RATINGS = new Set([1, 2, 3, 4]);
const stamp = value => (typeof value === 'number' ? value : Date.parse(value));

/**
 * 일정을 바꾼 어휘 채점인가 — 맞힘 여부(pass)를 돌려주고, 아니면 null.
 * 평가가 있으면 평가로(다시 = 실패), /study 어휘 문항(평가 없이 정답 3 · 오답 1로 일정을 바꾼다 — studyExerciseBridge)은 정오로.
 */
function scheduledAnswer(event) {
  if (!isGradedReviewEvent(event) || event.source !== 'vocab') return null;
  const detail = event.detail || {};
  if (detail.qtype === 'produce' || detail.warmup || detail.practice) return null;
  const rating = Number(detail.rating);
  if (RATINGS.has(rating)) return { pass: rating > 1 };
  if (detail.mode === 'study' && detail.word_id && typeof event.correct === 'boolean') return { pass: event.correct };
  return null;
}

/** fsrs_operations 행 → { previous: Map(연산 id → previousCard), undone: Set(되돌린 연산 id) }. operation 통째 또는 previousCard만 골라 받은 행 모두. */
function indexOperations(operations) {
  const previous = new Map();
  const undone = new Set();
  for (const row of operations || []) {
    if (!row?.id) continue;
    const op = row.operation || {};
    if (row.kind === 'undo') {
      if (op.undoneOperationId) undone.add(String(op.undoneOperationId));
      continue;
    }
    if (row.kind && row.kind !== 'grade') continue;
    const card = op.previousCard ?? row.previousCard;
    if (card) previous.set(String(row.id), card);
  }
  return { previous, undone };
}

const emptyCell = () => ({ passed: 0, failed: 0, total: 0, rate: null });
function add(cell, pass) {
  if (pass) cell.passed += 1; else cell.failed += 1;
  cell.total += 1;
  cell.rate = cell.passed / cell.total;
}

/**
 * 실제 기억률 표 조립.
 * @param {object} p
 * @param {Array<{source, item_key, correct, created_at, lang?, detail}>} [p.events] - review_events(어휘 채점 + undo 마커). 예전 일정의 직전 간격 추정은
 *   같은 단어의 앞선 채점이 있어야 하므로 보이는 기간보다 넉넉히(전체 행 권장) 넘긴다.
 * @param {Array} [p.undoMarkers] - undo 마커를 따로 조회했으면(undoneReviewsRows.fetchUndoMarkers) 그 결과. 생략하면 events 안의 마커.
 * @param {Array<{id, kind?, operation?, previousCard?}>} [p.operations] - fsrs_operations(grade · undo). 새 일정 채점의 직전 카드 출처.
 * @param {string} [p.lang] - review_events.lang으로 거른다(현황 언어 칩). 생략하면 전 언어.
 * @param {number} [p.now] - 기준 시각(테스트 주입).
 * @returns {{ target: number, today: number, periods: Array<{key, young, mature, all}>,
 *   skipped: { learning: number, first: number, unknown: number }, estimated: number }}
 *   learning = 학습 · 재학습 단계나 같은 날 다시 본 답, first = 첫 채점(직전 간격 없음), unknown = 새 일정인데 연산을 못 찾음,
 *   estimated = 예전 일정이라 직전 간격을 학습일 수로 추정해 센 답(전체 기간 기준).
 */
export function buildTrueRetention({ events, undoMarkers, operations, lang, now = Date.now() } = {}) {
  const today = learningDay(stamp(now));
  const { previous, undone } = indexOperations(operations);
  const effective = dropUndoneEvents(Array.isArray(events) ? events : [], undoMarkers)
    .filter(e => !(e?.detail?.fsrs_operation_id && undone.has(String(e.detail.fsrs_operation_id))));

  // 오래된 순으로 — 예전 일정의 직전 채점을 찾으려면 단어별 앞선 답이 먼저 와야 한다.
  const answers = [];
  for (const event of effective) {
    const answer = scheduledAnswer(event);
    const at = stamp(event?.created_at);
    if (!answer || !Number.isFinite(at)) continue;
    answers.push({ event, at, day: learningDay(at), pass: answer.pass });
  }
  answers.sort((a, b) => a.at - b.at);

  const periods = TRUE_RETENTION_PERIODS.map(p => ({ key: p.key, from: p.fromDay == null ? -Infinity : today - p.fromDay,
    to: today - p.toDay, young: emptyCell(), mature: emptyCell(), all: emptyCell() }));
  const skipped = { learning: 0, first: 0, unknown: 0 };
  let estimated = 0;
  const lastLegacyDay = new Map(); // word_id → 직전 예전 일정 채점의 학습일

  for (const { event, day, pass } of answers) {
    const detail = event.detail || {};
    // 직전 간격 — 예전 일정의 단어별 직전 채점 기록은 언어 · 기간 거르기 전에 갱신한다(다른 칸의 직전 답이 될 수 있다).
    let interval = null;
    let guessed = false;
    if (detail.fsrs_operation_id) {
      const card = previous.get(String(detail.fsrs_operation_id));
      if (card) interval = card.state === 'Review' ? Number(card.scheduledDays) : 0;
    } else {
      const wordKey = String(detail.word_id ?? event.item_key);
      const prevDay = lastLegacyDay.get(wordKey);
      lastLegacyDay.set(wordKey, day);
      const recorded = Number(detail.prev_interval_days);
      if (detail.prev_interval_days != null && Number.isFinite(recorded)) interval = recorded;
      else if (prevDay != null) { interval = day - prevDay; guessed = true; }
    }
    if (lang && event.lang !== lang) continue;
    if (day > today) continue; // 기기 시계가 앞선 행 — 어느 기간에도 넣지 않는다
    if (interval == null) {
      if (detail.fsrs_operation_id) skipped.unknown += 1; else skipped.first += 1;
      continue;
    }
    if (!(interval >= 1)) { skipped.learning += 1; continue; }
    if (guessed) estimated += 1;
    const mature = interval >= MATURE_MIN_INTERVAL;
    for (const period of periods) {
      if (day < period.from || day > period.to) continue;
      add(mature ? period.mature : period.young, pass);
      add(period.all, pass);
    }
  }

  return {
    target: FSRS_POLICY.retention,
    today,
    periods: periods.map(({ key, young, mature, all }) => ({ key, young, mature, all })),
    skipped,
    estimated,
  };
}
