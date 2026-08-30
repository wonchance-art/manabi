'use client';

/**
 * 유창성 측정 — 순수 로직 (v2-I R1a, #1077 설계, 오너 착수 승인 2026-08-30 "I ㄱㄱ").
 *
 * "읽기 속도"는 **무엇을 시간으로 치느냐**로 숫자가 완전히 달라진다. 정의를 못박는다:
 *   분자 = 자료 글자수(스크롤 %는 훑어도 100%라 부정확)
 *   분모 = **순수 읽기 시간** — 아래 3종을 뺀 시간
 *   기록 = 완독 시 1회만(부분 읽기는 노이즈 → 침묵)
 *
 * 일시정지 3종: ① 탭 숨김·화면 꺼짐 ② **단어 카드·번역 시트 열림** ③ 30초 무동작.
 * ②가 핵심이다 — 빼지 않으면 "사전을 많이 찾을수록 느린 독자"가 되어 숫자가
 * 학습을 왜곡한다(설계 §1).
 *
 * UI·타이머 배선은 useReadingTimer가 맡고 여기는 계산만 한다(dictation 선례).
 */

/** 정의 버전 — 정의가 바뀌면 올린다. 과거 기록과 섞이지 않게 detail에 함께 남긴다. */
export const READING_METRIC_VERSION = 1;
/** 무동작 판정 — 이보다 오래 아무 입력이 없으면 그 구간은 읽은 시간이 아니다. */
export const IDLE_MS = 30_000;
/** 노이즈 게이트 — 너무 짧은 자료는 속도 지표가 의미를 잃는다(설계 계약 2). */
export const MIN_CHARS = 200;

/** 자/분. 시간이 0이거나 글자수가 없으면 null(무기록). */
export function computeCpm({ ms, chars }) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  if (!Number.isFinite(chars) || chars <= 0) return null;
  return Math.round((chars / (ms / 60000)) * 10) / 10;
}

/** 기록할 만한 완독인가 — 200자 미만·시간 0은 조용히 버린다. */
export function shouldRecordReading({ ms, chars }) {
  if (!Number.isFinite(chars) || chars < MIN_CHARS) return false;
  if (!Number.isFinite(ms) || ms <= 0) return false;
  return true;
}

/**
 * 완독 이벤트 detail에 얹을 측정 조각.
 * **새 이벤트·새 테이블을 만들지 않는다** — 기존 완독 이벤트의 detail만 넓힌다
 * (v2-A 원칙 P2와 같은 수법, 기존 집계 수치 불변).
 * @returns {object|null} 기록 대상이 아니면 null
 */
export function buildReadingMetric({ ms, chars, paced = false }) {
  if (!shouldRecordReading({ ms, chars })) return null;
  const cpm = computeCpm({ ms, chars });
  if (cpm == null) return null;
  return { ms: Math.round(ms), chars, cpm, v: READING_METRIC_VERSION, paced: !!paced };
}

/** "4분 12초" — 완독 한 줄용. */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/**
 * 자료 글자수 — 공백·개행은 세지 않는다(CJK는 단어 경계가 달라 CPM이 정본).
 * 같은 자료를 재독할 때 분자가 흔들리지 않도록 원문에서만 센다.
 */
export function countReadableChars(rawText) {
  return String(rawText || '').replace(/\s+/g, '').length;
}
