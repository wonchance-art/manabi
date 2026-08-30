/**
 * 목표 궤도 — 순수 계산 (v2-D R2, #1077 설계 §2).
 *
 * ── 왜 필요한가
 *
 * R1로 계획표가 곧 진도표가 됐지만, 표는 "지금 몇 개 했다"까지만 말한다. 목표일이
 * 정해져 있는데 **역산이 없어서** 그 진도가 빠른 건지 늦은 건지 알 수 없었다
 * (`TARGET='2026-12-31'` 하드코딩, 남은 일수·필요 속도·예상 완료일 계산 0).
 *
 * 여기서 하는 일은 넷뿐이다: 남은 일수, 하루에 몇 개가 필요한지, 요즘 실제로 몇 개씩
 * 하고 있는지, 이 속도면 언제 끝나는지. 판정은 세 단계(여유·적정·이탈)까지만 하고
 * 벌칙이나 독촉은 두지 않는다(Beeminder 배제 근거 — 설계 §6).
 *
 * 조회는 소비 화면 몫이다(`weeklyReport`·`growthStats` 관례). 이 파일은 행을 받지 않고
 * 숫자만 받아 계산한다 — 날짜 경계는 KST 정본(`kstDayStartMs`) 하나만 쓴다.
 */

import { kstDateString, kstDayStartMs } from './growthStats.js';
import { isChapterDone } from './studyPlan.js';
import { normalizeSlug } from './world/storageSchema.js';

const DAY_MS = 86400000;

/** 속도를 재는 창 — 반년 전 실력은 지금의 내가 아니고, 3일은 표본이 아니다. */
export const PACE_WINDOW_DAYS = 14;

/** 예상 완료일이 목표일에서 이만큼 벌어지면 판정이 바뀐다(양쪽 대칭). */
export const PACE_SLACK_DAYS = 7;

/**
 * 최근 N일 안에 끝낸 챕터 수.
 * 계획에 있는 slug만 세므로 독해 트랙('rt:') 행이 섞여도 속도가 부풀지 않는다.
 * slug는 rename 별칭을 거쳐 대조한다(markProgress와 같은 규칙 — 두 곳이 갈리면
 * 완주 수와 속도가 서로 다른 진도를 말하게 된다).
 *
 * @param {Array} rows user_ref_progress 행 [{ slug, read, passed, updated_at }]
 * @param {Set<string>} slugSet 계획에 있는 챕터 slug
 * @param {{windowDays?: number, now?: number}} [opts]
 */
export function countRecentDone(rows, slugSet, { windowDays = PACE_WINDOW_DAYS, now = Date.now() } = {}) {
  if (!slugSet || slugSet.size === 0) return 0;
  const since = kstDayStartMs(now) - (Math.max(1, windowDays) - 1) * DAY_MS;
  const seen = new Set();
  for (const r of rows || []) {
    if (!r?.slug || !isChapterDone(r)) continue;
    const slug = normalizeSlug(r.slug);
    if (!slugSet.has(slug) || seen.has(slug)) continue;
    const t = new Date(r.updated_at).getTime();
    if (!Number.isFinite(t) || t < since) continue;
    seen.add(slug);
  }
  return seen.size;
}

/**
 * 궤도 계산.
 *
 * @param {object} p
 * @param {number} p.remaining 남은 챕터 수
 * @param {string} p.targetDate 목표일 'YYYY-MM-DD'(KST)
 * @param {number} p.recentDone 최근 windowDays 안에 끝낸 챕터 수
 * @param {number} [p.windowDays]
 * @param {number} [p.now]
 * @returns {object|null} 목표일이 없으면 **null — 화면은 침묵한다**(설계 §4 계약 5)
 *   { daysLeft, remaining, done, needPerDay, actualPerDay, etaDate, gapDays, verdict }
 *   verdict: '여유' | '적정' | '이탈' | null(최근 진도가 없어 예측 불가)
 */
export function pace({ remaining, targetDate, recentDone = 0, windowDays = PACE_WINDOW_DAYS, now = Date.now() } = {}) {
  if (!targetDate) return null;
  const targetMs = Date.parse(`${targetDate}T00:00:00+09:00`);
  if (!Number.isFinite(targetMs)) return null;
  if (!Number.isFinite(remaining)) return null;

  const todayMs = kstDayStartMs(now);
  const daysLeft = Math.round((targetMs - todayMs) / DAY_MS);

  // 다 했으면 남은 계산이 전부 무의미하다 — 화면도 축하 한 줄이면 된다.
  if (remaining <= 0) {
    return { done: true, daysLeft, remaining: 0, needPerDay: 0, actualPerDay: 0, etaDate: null, gapDays: null, verdict: null };
  }

  // 기한이 지났거나 오늘이 마지막이면 '남은 일수'로 나누는 게 의미가 없다 — 0 나눗셈 방어.
  const usableDays = Math.max(1, daysLeft);
  const needPerDay = remaining / usableDays;

  const span = Math.max(1, windowDays);
  const actualPerDay = Math.max(0, recentDone) / span;

  // 최근 진도가 0이면 예상 완료일을 지을 수 없다(∞). 억지 숫자 대신 모른다고 말한다.
  const etaMs = actualPerDay > 0 ? now + Math.ceil(remaining / actualPerDay) * DAY_MS : null;
  const etaDate = etaMs == null ? null : kstDateString(etaMs);
  const gapDays = etaMs == null ? null : Math.round((kstDayStartMs(etaMs) - targetMs) / DAY_MS);

  let verdict = null;
  if (daysLeft <= 0) verdict = '이탈';                    // 기한이 지났는데 남아 있다
  else if (gapDays != null) {
    verdict = gapDays <= -PACE_SLACK_DAYS ? '여유'
      : gapDays >= PACE_SLACK_DAYS ? '이탈'
        : '적정';
  }

  return { done: false, daysLeft, remaining, needPerDay, actualPerDay, etaDate, gapDays, verdict };
}

/** 화면 표기용 반올림 — "하루 0.4챕터". 소수 한 자리, 정수는 정수로. */
export function perDayLabel(n) {
  if (!Number.isFinite(n) || n <= 0) return '0';
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
