'use client';

/**
 * 자동 진행(페이서) — 순수 로직 (v2-I R1b, #1077 설계 §4~§10, 오너 착수 승인 2026-08-30 "I-b ㄱㄱ").
 *
 * 체류 시간은 **고정 초가 아니라 글자수 ÷ 목표 속도**다(설계 §4). 고정 초는 짧은 문장에서
 * 지루하고 긴 문장에서 못 따라가서, 어느 쪽으로 맞춰도 나머지가 망가진다.
 *
 *   체류(ms) = clamp( 글자수 / 목표CPM × 60000 , 하한 1.2초, 상한 20초 )
 *
 * 하한은 "눈이 문장에 닿기도 전에 넘어감"을, 상한은 "멈춘 줄 알고 손이 나감"을 막는다.
 * 조절은 자/분으로 하되 설정 화면엔 **초를 병기**한다 — 오너가 처음 말한 "몇 초 후"를
 * 그대로 쓸 수 있어야 하기 때문이다(설계 §7②).
 *
 * 타이머 배선은 useReadingPacer가, 진행 선은 CSS 애니메이션이 맡고 여기는 계산만 한다
 * (readingTimer/useReadingTimer와 같은 2층 분리).
 */

/** 체류 하한·상한 — 설계 계약 7. */
export const PACE_MIN_MS = 1200;
export const PACE_MAX_MS = 20000;
/** 목표 속도의 사람이 쓸 수 있는 범위. 밖은 조절 버튼이 더 안 나간다. */
export const PACE_MIN_CPM = 30;
export const PACE_MAX_CPM = 1200;
/** 목표 속도가 앉는 눈금(자/분). 수동 조절과 자동 제안이 같은 눈금 위에 서야
    "제안값에서 한 칸 올림"이 예측 가능해진다(R2에서 제안이 이 상수를 공유한다). */
export const PACE_STEP_UNIT = 5;

/**
 * 이력이 없을 때의 언어별 보수적 기본값(설계 §4).
 * CJK는 한 글자가 담는 정보가 커서 같은 내용도 글자수가 적다 — 라틴 문자와 같은 수를
 * 쓰면 중국어에서 눈이 못 따라간다. 학습자 기준으로 낮게 잡고 조절에 맡긴다.
 * (내 CPM × 1.1 자동 제안은 I-b R2 — 측정 이력이 쌓인 뒤.)
 */
export const DEFAULT_TARGET_CPM = {
  Chinese: 90,
  Japanese: 110,
  English: 400,
  French: 380,
};
export const FALLBACK_TARGET_CPM = 120;

export function defaultTargetCpm(lang) {
  return DEFAULT_TARGET_CPM[lang] ?? FALLBACK_TARGET_CPM;
}

/** 목표 속도를 쓸 수 있는 범위로 — 값이 망가졌으면 null(페이서 미발동). */
export function clampCpm(cpm) {
  if (!Number.isFinite(cpm) || cpm <= 0) return null;
  return Math.min(PACE_MAX_CPM, Math.max(PACE_MIN_CPM, Math.round(cpm)));
}

/**
 * 이 문장에 머무를 시간(ms). 글자수나 목표 속도가 없으면 null — 호출자는 페이서를 켜지 않는다.
 * @param {{ chars:number, targetCpm:number }} param
 */
export function dwellMs({ chars, targetCpm }) {
  if (!Number.isFinite(chars) || chars <= 0) return null;
  const cpm = clampCpm(targetCpm);
  if (cpm == null) return null;
  const raw = (chars / cpm) * 60000;
  return Math.round(Math.min(PACE_MAX_MS, Math.max(PACE_MIN_MS, raw)));
}

/**
 * [− 느리게] / [빠르게 +] 한 칸. **곱셈(±10%)** 으로 움직인다 — 언어별 스케일이
 * 90자/분과 400자/분으로 4배 넘게 벌어져서, 고정 증분은 한쪽에서 무의미해진다
 * (중국어에서 +50은 폭주, 영어에서 +10은 티도 안 난다).
 */
export function stepCpm(cpm, dir) {
  const base = clampCpm(cpm) ?? FALLBACK_TARGET_CPM;
  const next = dir > 0 ? base * 1.1 : base / 1.1;
  return clampCpm(Math.round(next / PACE_STEP_UNIT) * PACE_STEP_UNIT);
}

/** 초 표기 — 소수 1자리("9.3초"의 9.3). */
export function secondsOf(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 100) / 10;
}

/**
 * 설정 시트 한 줄용 — "이 문장(14자) ≈ 9.3초 · 평균 ≈ 6.1초".
 * 내부는 글자수 비례지만 조절은 초 감각으로 하게 만든다(설계 §7②).
 * 지정된 문장이 없으면 this는 null이고 평균만 보여준다.
 * @returns {{ thisChars:number|null, thisSec:number|null, avgChars:number|null, avgSec:number|null }}
 */
export function paceHint({ chars, avgChars, targetCpm }) {
  const thisChars = Number.isFinite(chars) && chars > 0 ? chars : null;
  const avg = Number.isFinite(avgChars) && avgChars > 0 ? Math.round(avgChars) : null;
  return {
    thisChars,
    thisSec: thisChars == null ? null : secondsOf(dwellMs({ chars: thisChars, targetCpm })),
    avgChars: avg,
    avgSec: avg == null ? null : secondsOf(dwellMs({ chars: avg, targetCpm })),
  };
}
