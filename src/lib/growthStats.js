/**
 * 성장·통계 지표의 단일 소스 — 서재(/study/library)와 홈(HomePage)이
 * 공유하는 정의 상수·순수 함수. 쿼리는 각 화면이 자기 방식(서버 count / 클라 필터)으로
 * 하되, "무엇을 세는가"의 판정·문구는 반드시 이 모듈을 통과시킨다.
 *
 * 순수 모듈(외부 의존 없음) — 그대로 단위 테스트한다.
 */

/** 아는 단어 기준 — SRS interval(안정도)이 이 일수 이상이면 '아는 단어'로 본다. */
export const KNOWN_WORD_MIN_INTERVAL = 7;

/**
 * '아는 단어' 판정 — interval(안정도) ≥ KNOWN_WORD_MIN_INTERVAL.
 * interval이 없으면(신규·null) 0으로 보아 미달. 서버 쿼리의 `.gte('interval', 7)`와 동치.
 * @param {{interval?: number|null}} row - user_vocabulary 한 행
 */
export function isKnownWord(row) {
  return (row?.interval ?? 0) >= KNOWN_WORD_MIN_INTERVAL;
}

/** '숙련' 경계 — 이 모듈 밖에서 쓰지 않는다(단어 상세 카드의 단계 라벨 전용). */
export const MASTERED_MIN_INTERVAL = 30;

/**
 * 단어 단계 — 신규 / 초기 / 학습 중 / 숙련 (부채 ②, 2026-09-01).
 *
 * ── 왜 여기로 왔나
 * 이 판정이 `VocabDetailCard` 안에 삼항으로 있었고, 중간 경계 `7`을
 * **`KNOWN_WORD_MIN_INTERVAL`을 import하지 않고 리터럴로** 쓰고 있었다. 지금은 값이
 * 같아 증상이 없지만 상수를 바꾸는 순간 **카드는 「학습 중」인데 카운터는 「아는 단어」가
 * 아닌** 상태가 생긴다 — 그게 「기억 통계 이중 진실」로 적혀 있던 것의 실체다
 * (나머지는 이 모듈이 생기면서 이미 해소됐다: 주간 기억 수치는 두 화면이 다 review_events).
 *
 * 이 모듈의 선언대로 **「무엇을 세는가」의 판정·문구가 여기를 지난다.** 색은 지나지
 * 않는다 — 그건 표현이라 CSS가 진다(`.badge--stage-*`).
 *
 * @param {{interval?: number|null, last_reviewed_at?: string|null}} row - user_vocabulary 한 행
 * @returns {{key: 'new'|'early'|'learning'|'mastered', label: string}}
 */
export function wordStage(row) {
  if (!row?.last_reviewed_at) return { key: 'new', label: '신규' };
  const interval = row?.interval ?? 0;
  if (interval >= MASTERED_MIN_INTERVAL) return { key: 'mastered', label: '숙련' };
  if (interval >= KNOWN_WORD_MIN_INTERVAL) return { key: 'learning', label: '학습 중' };
  return { key: 'early', label: '초기' };
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
