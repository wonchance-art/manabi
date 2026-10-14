/**
 * 성장·통계 지표의 단일 소스 — 서재(/study/library)와 홈(HomePage)이
 * 공유하는 정의 상수·순수 함수. 쿼리는 각 화면이 자기 방식(서버 count / 클라 필터)으로
 * 하되, "무엇을 세는가"의 판정·문구는 반드시 이 모듈을 통과시킨다.
 *
 * 순수 모듈(외부 의존 없음) — 그대로 단위 테스트한다.
 */

import { isVocabularyLearningProjection } from './vocabularyLearningRead.js';

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
    const gap = stamp(row.memory.due) - stamp(row.memory.lastReview);
    return Number.isFinite(gap) ? Math.max(0, Math.floor(gap / DAY_MS)) : null;
  }
  const gap = stamp(row?.next_review_at) - stamp(row?.last_reviewed_at);
  return Number.isFinite(gap) ? Math.max(0, Math.floor(gap / DAY_MS)) : null;
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
 * '이번 주 세션' 판정 — 세션 시각(used_at)이 KST 주 시작 이후.
 * 서버 쿼리의 `.gte('used_at', kstWeekStartIso())`와 동치(클라이언트 필터용).
 * @param {number|string|Date|null} usedAt - used_at (ms/ISO/Date)
 * @param {number} [nowMs=Date.now()]
 */
export function isThisWeekSession(usedAt, nowMs = Date.now()) {
  if (!usedAt) return false;
  const t = usedAt instanceof Date ? usedAt.getTime()
    : typeof usedAt === 'number' ? usedAt
    : new Date(usedAt).getTime();
  return Number.isFinite(t) && t >= kstWeekStartMs(nowMs);
}

/**
 * 성장 요약 표시 문구 — 서재·학습 허브가 같은 카피를 쓰도록 한 곳에 모음.
 * 화면마다 라벨/설명이 어긋나지 않게 여기서만 관리한다.
 */
export const GROWTH_LABELS = {
  knownWords: '아는 단어',
  passedChapters: '통과 챕터',
  weekSessions: '이번 주 세션',
};

export const GROWTH_COPY = {
  // '아는 단어' 타일 보조 설명 — interval≥7의 사람말 정의
  knownWordSub: '일주일 넘게 기억한 단어',
};
