/**
 * 성장·통계 지표의 단일 소스 — 서재(다시 읽기 서재)와 마이페이지 ProfileStats가
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
 * 성장 요약 표시 문구 — 서재·ProfileStats가 같은 카피를 쓰도록 한 곳에 모음.
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
