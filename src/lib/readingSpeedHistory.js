'use client';

/**
 * 완독 측정 이력 — 순수 로직 (v2-I R1b R2 목표 제안 + I-a R2 회차 비교, #1077 설계 §1·§4·§8).
 *
 * 두 소비처가 **같은 표본 자격**을 쓴다(비페이서·정의 버전 일치). 자격 규칙을 두 곳에
 * 적어 두면 언젠가 갈리므로 여기 한 곳에 둔다:
 *   목표 제안 — 이 언어의 최근 이력 → 내 속도 × 1.1
 *   회차 비교 — 이 **자료**의 직전 회차 → 얼마나 빨라졌나
 *
 * ── 목표 속도 자동 제안 (§4)
 *
 * 페이서의 목표 속도가 언어별 고정 기본값이면 두 방향으로 어긋난다: 잘 읽는 사람에겐
 * 답답하고 이제 시작한 사람에겐 못 따라갈 속도다. 그래서 **내가 낸 속도에서** 잡는다 —
 * timed reading의 정석대로 자기 기준 +10%(설계 §4).
 *
 * 재료는 I-a가 기존 완독 이벤트 detail에 남긴 `{ ms, chars, cpm, v, paced }`뿐이다.
 * 새 테이블도 새 이벤트도 없다(설계 §2 그대로).
 *
 * 두 가지를 반드시 지킨다:
 *  ① **비페이서만**(설계 §8) — 페이서로 읽은 완독은 '내가 낸 속도'가 아니라 '내가 설정한
 *     속도'다. 그걸로 다음 목표를 잡으면 지표가 자기 설정값을 되먹임해 제자리에서 맴돈다.
 *  ② **정의 버전 일치** — `detail.v`가 다르면 시간·글자수의 정의가 달라 섞으면 안 된다.
 *
 * 대푯값은 최근 표본의 **중앙값**이다. 평균이나 최신 한 건은 이상치 하나에 끌려간다 —
 * 자료를 열어 두고 자리를 비운 회차, 유난히 쉬운 짧은 글 한 편이면 목표가 통째로 튄다.
 */
import { PACE_STEP_UNIT, clampCpm } from './readingPacer';
import { READING_METRIC_VERSION } from './readingTimer';

/** 이보다 표본이 적으면 제안하지 않는다 — 한두 번으로 내 속도를 단정할 수 없다. */
export const SUGGEST_MIN_SAMPLES = 3;
/** 최근 N회만 본다 — 반년 전 실력은 지금의 내가 아니다. */
export const SUGGEST_WINDOW = 10;
/** 자기 기준 +10%(설계 §4 — timed reading의 정석). */
export const SUGGEST_BOOST = 1.1;

/**
 * 제안에 쓸 CPM 표본 — 최신순 rows에서 조건에 맞는 것만 최근 SUGGEST_WINDOW개.
 * rows는 이미 사용자·언어·source로 좁혀진 review_events 행이라고 본다.
 * @param {Array<{detail?: object}>} rows  created_at 내림차순
 * @returns {number[]} 최신순 cpm 값들
 */
export function readingCpmSamples(rows, { version = READING_METRIC_VERSION } = {}) {
  const out = [];
  for (const r of rows || []) {
    const d = r?.detail;
    if (!d || d.v !== version) continue;
    if (d.paced === true) continue;                    // ① 페이서 회차 제외(설계 §8)
    if (!Number.isFinite(d.cpm) || d.cpm <= 0) continue;
    out.push(d.cpm);
    if (out.length >= SUGGEST_WINDOW) break;
  }
  return out;
}

/** 중앙값 — 이상치 한 건에 끌려가지 않게. 빈 배열이면 null. */
export function median(nums) {
  const xs = (nums || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * 이 언어에서 내 최근 속도(자/분). 표본이 모자라면 null.
 * 제안값이 아니라 **측정 그대로의 나**다 — 설정 화면이 근거로 보여 준다.
 */
export function recentCpm(rows, opts) {
  const samples = readingCpmSamples(rows, opts);
  if (samples.length < SUGGEST_MIN_SAMPLES) return null;
  const m = median(samples);
  return m == null ? null : Math.round(m * 10) / 10;
}

/**
 * 목표 속도 제안(자/분). 이력이 모자라면 null → 호출자가 언어별 기본값을 쓴다.
 * 조절 버튼과 같은 5 단위로 떨어뜨려, 자동 제안과 수동 조절이 같은 눈금 위에 선다.
 */
export function suggestTargetCpm(rows, opts) {
  const mine = recentCpm(rows, opts);
  if (mine == null) return null;
  // 눈금에 앉히기 **전에** 범위로 당긴다. 순서를 바꾸면 아주 느린 독자(내 속도 1자/분)의
  // 제안이 반올림에서 0이 되고, clampCpm이 그걸 '망가진 값'으로 보아 제안 자체가
  // 사라진다 — 하한이 필요한 바로 그 사람에게 하한이 안 걸린다(계약이 잡은 결함).
  const inRange = clampCpm(mine * SUGGEST_BOOST);
  if (inRange == null) return null;
  return clampCpm(Math.round(inRange / PACE_STEP_UNIT) * PACE_STEP_UNIT);
}

/* ── 회차 비교 (I-a R2, 설계 §1·§3) ────────────────────────────────────────
   비교 대상은 **같은 자료의 이전 회차**다. 자료가 다르면 난이도가 달라 숫자가
   무의미해진다("쉬운 글을 빨리 읽었다"가 실력 향상으로 보인다).
   rows는 item_key='material:<id>'로 좁혀진 최신순 행이라고 본다. */

/** 이 자료의 직전 유효 회차 속도(자/분). 없으면 null(=첫 회차). */
export function lastRoundCpm(rows, opts) {
  return readingCpmSamples(rows, opts)[0] ?? null;
}

/** 이만큼 안쪽의 변화는 '비슷한 속도'로 본다 — 읽기 속도는 원래 이 정도 흔들린다. */
export const ROUND_SAME_PCT = 5;

/**
 * 완독 직후 한 줄용 회차 비교.
 * @param {{cpm:number, paced?:boolean}} current  이번 회차 측정(buildReadingMetric 산출)
 * @param {Array} rows  이 자료의 이전 완독 이벤트(최신순) — 이번 회차는 아직 없어야 한다
 * @returns {{prev:number, deltaPct:number, tone:'up'|'same'|'down'}|null}
 */
export function compareRound(current, rows, opts) {
  // 페이서로 읽은 회차는 '내가 낸 속도'가 아니라 '내가 설정한 속도'다(설계 §8).
  // 비교의 양쪽 중 어느 한쪽이라도 페이서면 숫자가 실력을 말하지 않는다 —
  // 이쪽(현재)은 여기서, 저쪽(과거)은 readingCpmSamples가 막는다.
  if (!current || current.paced === true) return null;
  if (!Number.isFinite(current.cpm) || current.cpm <= 0) return null;
  const prev = lastRoundCpm(rows, opts);
  if (prev == null || prev <= 0) return null;
  const deltaPct = Math.round(((current.cpm - prev) / prev) * 100);
  const tone = Math.abs(deltaPct) < ROUND_SAME_PCT ? 'same' : deltaPct > 0 ? 'up' : 'down';
  return { prev, deltaPct, tone };
}
