/**
 * 기억 건강 — 순수 계산(VocabStats 「기억 건강」 카드와 현황 기억 건강 칸 공용, LEARN-HOME-AK-001에서 떼어 냄).
 * 경계는 그대로다: 선명 ≥ 0.9 · 양호 ≥ 0.7 · 흐릿 ≥ 0.4 · 위험 < 0.4(기억 확률). 「흐릿 · 위험」 = 0.7 미만 —
 * 복습 범위 state=fragile(FRAGILE_RETRIEVABILITY)과 같은 경계다.
 */
import { vocabularyRetrievability } from './vocabularyLearningRead.js';
import { vocabularyReviewCalendar } from './vocabularyLearningRows.js';

export function memoryHealth(projections = [], now = Date.now(), { learningAvailable = true, days = 7 } = {}) {
  const evaluatedAt = Math.max(new Date(now).getTime(), ...projections.map(row => Date.parse(row.review.evaluatedAt) || 0));
  const buckets = { high: 0, mid: 0, low: 0, forgotten: 0 };
  let total = 0, measured = 0;
  if (learningAvailable) for (const projection of projections) {
    const retention = vocabularyRetrievability(projection, evaluatedAt);
    if (retention == null) continue;
    measured++;
    total += retention;
    if (retention >= 0.9) buckets.high++;
    else if (retention >= 0.7) buckets.mid++;
    else if (retention >= 0.4) buckets.low++;
    else buckets.forgotten++;
  }
  const calendar = learningAvailable ? vocabularyReviewCalendar(projections, evaluatedAt, { days }) : [];
  return { buckets, measured, avgRetention: measured ? Math.round((total / measured) * 100) : null, calendar, evaluatedAt };
}
