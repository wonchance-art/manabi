/**
 * 주간 리포트 집계 엔진 — "이번 주 나" (rfc-weekly-report R1).
 * 순수 모듈: 행 배열 + now 주입 → 이번 주·지난주 요약. 쿼리는 소비 화면 몫(growthStats 관례).
 * 주간 경계는 growthStats.learningWeekStartMs(월요일 KST 04시 — 학습일 경계, STATS-MAP-001) 정본만 쓴다 — 새 경계 계산 신설 금지.
 */

import { learningDayStartMs, learningWeekStartMs } from './growthStats';
import { conversationCorrections } from './conversation/conversationLoop.js';
import { STUDY_SOURCE_REF } from './reviewScopeUrl.js';

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

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

/** 학습 활동으로 세는 답인가 — 이번 주 「복습 N문항」과 현황 「공부한 날」이 같은 정의를 쓴다(STATS-MAP-001). */
export function countsAsStudyAnswer(event) {
  return !!event && (ACTIVITY_ONLY_SOURCES.has(event.source) || isGradedReviewEvent(event));
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
    if (!countsAsStudyAnswer(e)) continue;
    if (ACTIVITY_ONLY_SOURCES.has(e.source)) {
      total += 1; // 활동량만 — 정답률 분모 · 분자에는 넣지 않는다
      continue;
    }
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
/**
 * 이번 주 대화 성과(STATS-MAP-001 S7, 오너 「권장대로」 2026-11-01 KST) — 대화 모드 자료(metadata.conversation)에서 유도만 한다(새 기록 0).
 * 마디 = 내가 보낸 말 · 스스로 고친 문장 = 힌트 뒤 다시 말해 맞힌 것(state 'fixed') · 다시 쓴 문형 = 다시 꺼낸 문형을 맞게 쓴 것(reask ok).
 * 대화 마치기 요약(conversationSummary)과 같은 정의다.
 */
function conversationSlice(rows, startMs, endMs) {
  let turns = 0, fixed = 0, reaskOk = 0;
  const within = at => Number.isFinite(Number(at)) && Number(at) >= startMs && Number(at) < endMs;
  for (const row of rows || []) {
    for (const t of row?.turns || []) if (t?.who === 'me' && within(t.at)) turns += 1;
    for (const c of conversationCorrections({ turns: row?.turns })) if (c.state === 'fixed' && within(c.at)) fixed += 1;
    for (const r of row?.reask || []) if (r?.ok === true && within(r.at)) reaskOk += 1;
  }
  return { turns, fixed, reaskOk };
}

/** 담은 곳 — 이번 주 담은 말을 출처로 나눈다(새 칸 없음: source_material_id · source_ref). 순서가 곧 화면 순서. */
export const SAVED_SOURCES = Object.freeze(['reading', 'conversation', 'level', 'study', 'manual']);
function savedSourceSlice(vocabRows, conversationIds, startMs, endMs) {
  const out = Object.fromEntries(SAVED_SOURCES.map(key => [key, 0]));
  for (const row of vocabRows || []) {
    if (!row?.created_at || !inRange(row.created_at, startMs, endMs)) continue;
    const material = row.source_material_id == null ? null : String(row.source_material_id);
    const key = material ? (conversationIds.has(material) ? 'conversation' : 'reading')
      : row.source_ref === STUDY_SOURCE_REF ? 'study' : row.source_ref ? 'level' : 'manual';
    out[key] += 1;
  }
  return out;
}

/**
 * 기간 리포트(STATS-MAP-001 기간 요약 · 오너 「1번으로」 2026-11-02 KST) — 이번 주 창과 같은 셈을 아무 기간 [startMs, endMs)에.
 * 비교 기간은 [prevStartMs, startMs). 이번 주 리포트는 이 함수의 한 경우일 뿐이다(셈 정본 하나 — 이중 진실 금지).
 */
export function buildRangeReport({ events, vocabRows, encounterRows, readRows, conversationRows } = {}, { startMs, endMs, prevStartMs } = {}) {
  const reviews = reviewSlice(events, startMs, endMs);
  const prevReviews = reviewSlice(events, prevStartMs, startMs);
  const newWords = countInRange(vocabRows, 'created_at', startMs, endMs);
  const prevNewWords = countInRange(vocabRows, 'created_at', prevStartMs, startMs);
  const metWords = countInRange(encounterRows, 'first_met_at', startMs, endMs);
  const prevMetWords = countInRange(encounterRows, 'first_met_at', prevStartMs, startMs);
  const readsCompleted = countInRange(readRows, 'completed_at', startMs, endMs);
  const prevReadsCompleted = countInRange(readRows, 'completed_at', prevStartMs, startMs);
  const conversation = conversationSlice(conversationRows, startMs, endMs);
  const prevConversation = conversationSlice(conversationRows, prevStartMs, startMs);
  const conversationIds = new Set((conversationRows || []).map(row => String(row?.id)));
  const savedBySource = savedSourceSlice(vocabRows, conversationIds, startMs, endMs);
  return {
    period: { startMs, endMs },
    prevPeriod: { startMs: prevStartMs, endMs: startMs },
    reviews,
    prevReviews,
    newWords,
    prevNewWords,
    metWords,
    prevMetWords,
    readsCompleted,
    prevReadsCompleted,
    conversation,
    prevConversation,
    savedBySource,
    // 전 축 0이면 카드 자체를 그리지 않는다(첫 주 — 0 무표기 결).
    hasAny: reviews.total > 0 || newWords > 0 || metWords > 0 || readsCompleted > 0 || conversation.turns > 0,
  };
}

export function buildWeeklyReport(rows = {}) {
  const { now = Date.now() } = rows || {};
  const weekStart = learningWeekStartMs(now);
  const report = buildRangeReport(rows, { startMs: weekStart, endMs: weekStart + WEEK_MS, prevStartMs: weekStart - WEEK_MS });
  return { ...report, week: report.period, prevWeek: report.prevPeriod };
}

/**
 * 기간 고르기(이번 주 창 칩) — 'week' = 이번 학습 주(월요일 04시부터) · 비교 지난주,
 * '30d' = 오늘(04시 학습일)을 포함한 최근 30학습일 · 비교 그 앞 30학습일.
 */
export const PERIOD_KINDS = Object.freeze(['week', '30d']);
export const PERIOD_DAYS = Object.freeze({ week: 7, '30d': 30 });
export function periodRange(kind, now = Date.now()) {
  if (kind === '30d') {
    const endMs = learningDayStartMs(now) + DAY_MS;
    const startMs = endMs - 30 * DAY_MS;
    return { kind, startMs, endMs, prevStartMs: startMs - 30 * DAY_MS, days: 30 };
  }
  const startMs = learningWeekStartMs(now);
  return { kind: 'week', startMs, endMs: startMs + WEEK_MS, prevStartMs: startMs - WEEK_MS, days: 7 };
}

/** 카드 머리 "8/18 ~ 8/24" — KST 날짜 표기(주간 경계와 같은 시간대). */
export function weekRangeLabel(week) {
  const day = (ms) => {
    const kst = new Date(ms + 9 * 3600 * 1000);
    return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`;
  };
  return `${day(week.startMs)} ~ ${day(week.endMs - 86400000)}`;
}
