/**
 * 성장·통계 지표의 단일 소스 — 서재(/study/library)와 홈(HomePage)이
 * 공유하는 정의 상수·순수 함수. 쿼리는 각 화면이 자기 방식(서버 count / 클라 필터)으로
 * 하되, "무엇을 세는가"의 판정·문구는 반드시 이 모듈을 통과시킨다.
 *
 * 순수 모듈(외부 의존 없음) — 그대로 단위 테스트한다.
 */

import { isVocabularyLearningProjection } from './vocabularyLearningRead.js';
import { FSRS_POLICY, learningDaySpan } from './fsrsScheduler.js';
import { METRICS } from './metrics/registry.js';

/** 아는 단어 기준 — 읽기용 안정도가 이 일수 이상이면 '아는 단어'로 본다. */
export const KNOWN_WORD_MIN_INTERVAL = 7;

/**
 * '아는 단어' 판정 — interval(안정도) ≥ KNOWN_WORD_MIN_INTERVAL.
 * interval이 없으면(신규·null) 0으로 보아 미달. 서버 쿼리의 `.gte('interval', 7)`와 동치.
 * @param {{interval?: number|null}} row - user_vocabulary 한 행
 */
export function isKnownWord(row) {
  return (isVocabularyLearningProjection(row) ? row.memory.stability ?? 0 : row?.interval ?? 0) >= KNOWN_WORD_MIN_INTERVAL;
}

/** 「익숙」 경계(Anki Mature와 같은 21일) — 카드 단계 전용. 「아는 단어」(KNOWN_WORD_MIN_INTERVAL)와는 따로 둔다. */
export const MATURE_MIN_INTERVAL = 21;

const DAY_MS = 86400000;
const stamp = value => (value == null ? NaN : typeof value === 'number' ? value : Date.parse(value));

/**
 * 카드 간격(일, 버림) = 다음 복습 예정일 − 마지막 복습일(REV-SCOPE 3판 §3-4, D15).
 * 새 일정(FSRS) 카드는 scheduledDays와 같다. 예전 일정 카드는 next_review_at − last_reviewed_at으로 잰다 —
 * 예전 카드의 interval 칸은 실제로 안정도라 간격으로 쓰지 않는다. 잴 수 없으면 null.
 */
export function cardIntervalDays(row) {
  if (isVocabularyLearningProjection(row)) {
    if (row.source === 'fsrs-v1') return row.memory.state === 'Review' ? row.memory.scheduledDays ?? null : 0;
    return legacyGapDays(stamp(row.memory.due), stamp(row.memory.lastReview));
  }
  return legacyGapDays(stamp(row?.next_review_at), stamp(row?.last_reviewed_at));
}
/**
 * 예전 일정 채점 이벤트의 detail 보강(TRUE-RET-001) — 채점 직전 카드 간격(cardIntervalDays). 실제 기억률(trueRetention)이
 * 학습일 추정 대신 이 값을 쓴다. 잴 수 없으면(첫 채점 · 기한 없음) 빈 객체 — 그때 detail 모양은 예전 그대로다(덧붙이는 칸 하나뿐).
 * 쓰는 곳: VocabPage · useInlineReview · QuestReview · studyExerciseBridge(예전 일정 채점 4곳). 새 일정은 연산의 previousCard가 진다.
 */
export function prevIntervalDetail(row) {
  const days = cardIntervalDays(row);
  return days == null ? {} : { prev_interval_days: days };
}
// 날 경계 기한(학습일 시작 시각, 2026-10-25 KST)은 학습일 수로 센다 — 23:00에 1일로 답한 카드는 5시간 뒤가 기한이어도 간격 1일.
function legacyGapDays(due, last) {
  const gap = due - last;
  if (!Number.isFinite(gap)) return null;
  try {
    const days = learningDaySpan(due, last);
    if (days) return days;
  } catch { /* 범위 밖 시각은 시간 차로 */ }
  return Math.max(0, Math.floor(gap / DAY_MS));
}

const STAGE_LABELS = { new: '신규', learning: '학습', young: '익히는 중', mature: '익숙', relearning: '재학습' };
const stage = key => ({ key, label: STAGE_LABELS[key] });

/**
 * 카드 단계 — 신규 → 학습 → 익히는 중(간격 21일 미만) → 익숙(21일 이상) → 재학습
 * (Anki New · Learning · Young · Mature · Relearning, 오너 결정 D15 2026-10-10).
 *
 * ── 왜 여기에 있나
 * 이 판정이 `VocabDetailCard` 안에 삼항으로 있다가 이 모듈로 왔다(부채 ②, 2026-09-01). 이 모듈의 선언대로
 * **「무엇을 세는가」의 판정 · 문구가 여기를 지난다.** 색은 표현이라 CSS가 진다(`.badge--stage-*`).
 *
 * ── 바뀐 점(REV-SCOPE-R1B-1)
 * 예전 판정(초기 · 학습 중 7일 · 숙련 30일, 안정도 기준)을 대체한다. 단계 경계는 「아는 단어」 기준
 * (KNOWN_WORD_MIN_INTERVAL = 7, 안정도)과 분리한다 — 그 값을 바꾸면 현황 「아는 단어」 숫자가 달라지므로
 * 별도 결정이다. 예전 일정 카드에는 분 단위 학습 단계가 없어 신규 · 익히는 중 · 익숙만 나온다.
 * 일정 계산에는 영향이 없다(읽기 전용 표시).
 *
 * @param {object} row - 학습 projection 또는 user_vocabulary 한 행
 * @returns {{key: 'new'|'learning'|'young'|'mature'|'relearning', label: string}}
 */
export function wordStage(row) {
  if (isVocabularyLearningProjection(row) && row.source === 'fsrs-v1') {
    const state = row.memory.state;
    if (state === 'New') return stage('new');
    if (state === 'Learning') return stage('learning');
    if (state === 'Relearning') return stage('relearning');
  } else if (!(isVocabularyLearningProjection(row) ? row.memory.lastReview : row?.last_reviewed_at)) {
    return stage('new');
  }
  return stage((cardIntervalDays(row) ?? 0) >= MATURE_MIN_INTERVAL ? 'mature' : 'young');
}

/**
 * '통과 챕터' 판정 — user_ref_progress 행의 passed 플래그가 true.
 * 서버 쿼리의 `.eq('passed', true)`와 동치(클라이언트 필터용).
 * @param {{passed?: boolean}} row - user_ref_progress 한 행
 */
export function isPassedChapter(row) {
  return row?.passed === true;
}

/**
 * KST 기준 이번 주 월요일 0시의 UTC 밀리초.
 * (studyMaterials·StudySessionPage에 흩어진 동일 구현의 정본 — 이 모듈로 수렴.)
 * @param {number} [nowMs=Date.now()]
 */
export function kstWeekStartMs(nowMs = Date.now()) {
  const kst = new Date(nowMs + 9 * 3600 * 1000);
  const dow = kst.getUTCDay();                 // 0=일 … 6=토
  const daysSinceMon = (dow + 6) % 7;          // 월=0 … 일=6
  // Date.UTC(...)는 'KST 자정을 UTC인 척'한 값 → 9h를 빼 실제 UTC 순간으로 되돌린다.
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
    - daysSinceMon * 86400000 - 9 * 3600 * 1000;
}

/** KST 기준 오늘 0시의 UTC 밀리초. */
export function kstDayStartMs(nowMs = Date.now()) {
  const kst = new Date(nowMs + 9 * 3600 * 1000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
    - 9 * 3600 * 1000;
}

/** KST 기준 오늘 0시의 UTC ISO 문자열(일간 집계 하한). */
export function kstDayStartIso(nowMs = Date.now()) {
  return new Date(kstDayStartMs(nowMs)).toISOString();
}

/**
 * KST 기준 오늘 날짜 문자열(YYYY-MM-DD) — daily_suggestions의 date 키 정본.
 * 수집 크론(15:00 UTC = KST 자정)과 조회(/api/suggestions/today)가 서로 다른
 * 시간대 날짜를 쓰면 '오늘 읽기'가 하루 대부분 비는 실결함 — 양쪽이 이 함수 하나를 쓴다.
 */
export function kstDateString(nowMs = Date.now()) {
  return new Date(nowMs + 9 * 3600 * 1000).toISOString().split('T')[0];
}

/** KST 기준 이번 주 월요일 0시의 UTC ISO 문자열(서버 count 조회 하한). */
export function kstWeekStartIso(nowMs = Date.now()) {
  return new Date(kstWeekStartMs(nowMs)).toISOString();
}

/**
 * ── 학습일 경계(04시) — 표시 통계의 하루 · 한 주 정본 (오너 결정 2026-11-01 KST, STATS-MAP-001)
 * 히트맵 · 이번 주 · 오늘 목표 · 서재 「이번 주 세션」 · 그룹 주간 합계가 FSRS 학습일(fsrsScheduler.learningDay, KST 04시)과
 * 같은 날을 말하게 한다. 새벽 2시 복습이 히트맵에서는 「오늘」, 실제 기억률에서는 「어제」로 갈리던 것을 없앤다.
 * KST 자정 함수(kst*)는 그대로 둔다 — 추천 글 날짜 키 · D-day 같은 달력 날짜는 자정이 맞다.
 */
export const LEARNING_DAY_OFFSET_MS = FSRS_POLICY.rolloverHour * 3600 * 1000;
/** 이번 학습일의 시작(KST 04시)의 UTC 밀리초. 03:59 KST는 아직 전날 학습일이다. */
export function learningDayStartMs(nowMs = Date.now()) {
  return kstDayStartMs(nowMs - LEARNING_DAY_OFFSET_MS) + LEARNING_DAY_OFFSET_MS;
}
/** 이번 학습 주(월요일 KST 04시부터)의 시작 UTC 밀리초. */
export function learningWeekStartMs(nowMs = Date.now()) {
  return kstWeekStartMs(nowMs - LEARNING_DAY_OFFSET_MS) + LEARNING_DAY_OFFSET_MS;
}
export function learningWeekStartIso(nowMs = Date.now()) {
  return new Date(learningWeekStartMs(nowMs)).toISOString();
}
/** 그 시각이 속한 학습일의 날짜 문자열(YYYY-MM-DD) — 히트맵 칸 키. */
export function learningDateString(nowMs = Date.now()) {
  return kstDateString(nowMs - LEARNING_DAY_OFFSET_MS);
}

/**
 * '이번 주 세션' 판정 — 세션 시각(used_at)이 KST 주 시작 이후.
 * 서버 쿼리의 `.gte('used_at', learningWeekStartIso())`와 동치(클라이언트 필터용) — 학습 주(월요일 KST 04시) 기준.
 * @param {number|string|Date|null} usedAt - used_at (ms/ISO/Date)
 * @param {number} [nowMs=Date.now()]
 */
export function isThisWeekSession(usedAt, nowMs = Date.now()) {
  if (!usedAt) return false;
  const t = usedAt instanceof Date ? usedAt.getTime()
    : typeof usedAt === 'number' ? usedAt
    : new Date(usedAt).getTime();
  return Number.isFinite(t) && t >= learningWeekStartMs(nowMs);
}

/**
 * 성장 요약 표시 문구 — 서재·학습 허브가 같은 카피를 쓰도록 한 곳에 모음.
 * 화면마다 라벨/설명이 어긋나지 않게 여기서만 관리한다.
 */
export const GROWTH_LABELS = {
  knownWords: METRICS.remembered.label, // 「기억한 단어」 — 현황의 「이미 아는 단어」(표시 수)와 다른 값이다(지표 사전)
  passedChapters: '통과 챕터',
  weekSessions: '이번 주 세션',
};

export const GROWTH_COPY = {
  // 「기억한 단어」 타일 보조 설명 — interval≥7의 사람말 정의
  knownWordSub: METRICS.remembered.sub,
};
