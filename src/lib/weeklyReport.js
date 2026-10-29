/**
 * 주간 리포트 집계 엔진 — "이번 주 나" (rfc-weekly-report R1).
 * 순수 모듈: 행 배열 + now 주입 → 이번 주·지난주 요약. 쿼리는 소비 화면 몫(growthStats 관례).
 * 주간 경계는 growthStats.kstWeekStartMs 정본만 쓴다 — 새 경계 계산 신설 금지.
 */

import { kstWeekStartMs } from './growthStats';

const WEEK_MS = 7 * 86400000;

/**
 * 활동량에만 드는 출처 — 「한자」 탭 넘기기(HANZI-TAB-AL-001 §4)는 글자마다 스스로 「알아요 · 몰라요」를 고른 기록이다.
 * 이번 주 복습 수(활동량)에는 넣고, 정답률 · 다이얼 같은 채점 신호에는 섞지 않는다.
 */
// 단어 목록 바퀴 답(source 'level' — LEVEL-ROUND-001)도 같은 자리: 목록에서 스스로 고른 O · X라 활동량만 센다.
export const ACTIVITY_ONLY_SOURCES = Object.freeze(new Set(['hanzi', 'level']));

/** 채점 문항 판정 — EWMA 다이얼과 동일 결(ui=행동 계측·dict=자가 채점·hanzi · level=목록 자기 확인은 정답률 신호가 아니다). */
export function isGradedReviewEvent(event) {
  // 집중 연습(source 'practice')은 일정 밖 연습이라 복습 수 · 정답률 · 산출 단어에 넣지 않는다(REV-SCOPE §6-1 ⑤).
  return !!event && event.source !== 'ui' && event.source !== 'dict' && event.source !== 'practice'
    && !ACTIVITY_ONLY_SOURCES.has(event.source);
}

function inRange(ts, startMs, endMs) {
  const t = new Date(ts).getTime();
  return Number.isFinite(t) && t >= startMs && t < endMs;
}

function countInRange(rows, field, startMs, endMs) {
  let n = 0;
  for (const row of rows || []) {
    if (row?.[field] && inRange(row[field], startMs, endMs)) n += 1;
  }
  return n;
}

function reviewSlice(events, startMs, endMs) {
  let total = 0;
  let graded = 0;
  let correct = 0;
  for (const e of events || []) {
    if (!e?.created_at || !inRange(e.created_at, startMs, endMs)) continue;
    if (ACTIVITY_ONLY_SOURCES.has(e.source)) {
      total += 1; // 활동량만 — 정답률 분모 · 분자에는 넣지 않는다
      continue;
    }
    if (!isGradedReviewEvent(e)) continue;
    total += 1;
    graded += 1;
    if (e.correct) correct += 1;
  }
  return { total, correct, accuracy: graded > 0 ? correct / graded : null };
}

/**
 * 주간 리포트 조립.
 * @param {object} p
 * @param {Array<{source, correct, created_at}>} [p.events] - review_events(2주 조회)
 * @param {Array<{created_at}>} [p.vocabRows] - user_vocabulary(2주 조회)
 * @param {Array<{first_met_at}>} [p.encounterRows] - user_vocab_encounters(2주 조회)
 * @param {Array<{completed_at}>} [p.readRows] - material_progress 완독 행(2주 조회)
 * @param {number} [p.now] - 기준 시각(테스트 주입)
 * @returns 주간 요약 — { week, prevWeek, reviews, prevReviews, newWords, prevNewWords,
 *          metWords, prevMetWords, readsCompleted, prevReadsCompleted, hasAny }
 */
export function buildWeeklyReport({ events, vocabRows, encounterRows, readRows, now = Date.now() } = {}) {
  const weekStart = kstWeekStartMs(now);
  const prevStart = weekStart - WEEK_MS;

  const reviews = reviewSlice(events, weekStart, weekStart + WEEK_MS);
  const prevReviews = reviewSlice(events, prevStart, weekStart);

  const newWords = countInRange(vocabRows, 'created_at', weekStart, weekStart + WEEK_MS);
  const prevNewWords = countInRange(vocabRows, 'created_at', prevStart, weekStart);
  const metWords = countInRange(encounterRows, 'first_met_at', weekStart, weekStart + WEEK_MS);
  const prevMetWords = countInRange(encounterRows, 'first_met_at', prevStart, weekStart);
  const readsCompleted = countInRange(readRows, 'completed_at', weekStart, weekStart + WEEK_MS);
  const prevReadsCompleted = countInRange(readRows, 'completed_at', prevStart, weekStart);

  return {
    week: { startMs: weekStart, endMs: weekStart + WEEK_MS },
    prevWeek: { startMs: prevStart, endMs: weekStart },
    reviews,
    prevReviews,
    newWords,
    prevNewWords,
    metWords,
    prevMetWords,
    readsCompleted,
    prevReadsCompleted,
    // 전 축 0이면 카드 자체를 그리지 않는다(첫 주 — 0 무표기 결).
    hasAny: reviews.total > 0 || newWords > 0 || metWords > 0 || readsCompleted > 0,
  };
}

/** 카드 머리 "8/18 ~ 8/24" — KST 날짜 표기(주간 경계와 같은 시간대). */
export function weekRangeLabel(week) {
  const day = (ms) => {
    const kst = new Date(ms + 9 * 3600 * 1000);
    return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`;
  };
  return `${day(week.startMs)} ~ ${day(week.endMs - 86400000)}`;
}
