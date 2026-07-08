import { describe, it, expect } from 'vitest';
import { forgetting_curve, generatorParameters, computeDecayFactor } from 'ts-fsrs';
import { buildForecast, RETRIEVABILITY_THRESHOLD } from '../forecast';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-08T00:00:00.000Z');

// forecast.js와 동일한 기본 파라미터로 "retrievability r을 만들려면 stability S인
// 단어가 마지막 복습 이후 며칠 지나야 하는가"를 역산한다(공식의 역함수).
// 매직 넘버를 하드코딩하지 않고 ts-fsrs가 export하는 동일 공식으로 계산해
// 라이브러리 버전이 바뀌어도 테스트가 스스로 맞는 값을 다시 구한다.
const { w } = generatorParameters();
const { decay, factor } = computeDecayFactor(w);
function daysForRetrievability(r, stability) {
  return stability * (Math.pow(r, 1 / decay) - 1) / factor;
}
function lastReviewedAtFor(retrievabilityNow, stability, now = NOW) {
  const elapsedDays = daysForRetrievability(retrievabilityNow, stability);
  return new Date(now.getTime() - elapsedDays * DAY_MS).toISOString();
}

// 계산이 실제로 forecast.js가 쓰는 공식과 일치하는지 자체 점검(회귀 안전망).
function retrievabilityAtDaysLater(retrievabilityNow, stability, daysLater, now = NOW) {
  const lastReviewedAt = lastReviewedAtFor(retrievabilityNow, stability, now);
  const elapsedDays = (now.getTime() + daysLater * DAY_MS - new Date(lastReviewedAt).getTime()) / DAY_MS;
  return forgetting_curve(w, elapsedDays, stability);
}

describe('buildForecast — 망각 예보 (docs/plan-v3-living-serial.md §3-A)', () => {
  it('(a) 경계: 지금 0.71 → 자정(now+24h) 0.69로 떨어지는 단어는 falling에 포함된다', () => {
    const stability = 1;
    // 자체 점검 — 픽스처가 실제로 0.71 → 0.7 미만 경계를 넘는지 먼저 확인.
    expect(retrievabilityAtDaysLater(0.71, stability, 1)).toBeLessThan(RETRIEVABILITY_THRESHOLD);

    const rows = [{
      word_text: '約束',
      interval: stability,
      last_reviewed_at: lastReviewedAtFor(0.71, stability),
    }];

    const { falling, count } = buildForecast(rows, NOW);

    expect(count).toBe(1);
    expect(falling).toHaveLength(1);
    expect(falling[0].word_text).toBe('約束');
    expect(falling[0].retrievabilityNow).toBeGreaterThanOrEqual(RETRIEVABILITY_THRESHOLD);
    expect(falling[0].retrievabilityNow).toBeCloseTo(0.71, 2);
    expect(falling[0].retrievabilityEndOfDay).toBeLessThan(RETRIEVABILITY_THRESHOLD);
    // falling 항목은 지정된 세 필드만 노출한다(stability 등 내부 필드 유출 금지).
    expect(Object.keys(falling[0]).sort()).toEqual(
      ['retrievabilityEndOfDay', 'retrievabilityNow', 'word_text'].sort()
    );
  });

  it('(b) 이미 0.70 미만인 행은 falling에서 제외된다(이미 안개 속 — due 큐가 담당)', () => {
    const stability = 1;
    const rows = [{
      word_text: 'すでに霧',
      interval: stability,
      last_reviewed_at: lastReviewedAtFor(0.60, stability), // 지금부터 이미 60%
    }];

    const { falling, count, top3 } = buildForecast(rows, NOW);

    expect(count).toBe(0);
    expect(falling).toHaveLength(0);
    expect(top3).toHaveLength(0);
  });

  it('(c) top3는 falling 중 stability 내림차순 3개다', () => {
    // 4개 모두 "falling" 조건(지금 ≥0.70, 자정 <0.70)을 만족하도록 개별 stability에
    // 맞춰 elapsed를 역산 — stability가 클수록 하루 사이 감쇠가 느려지므로
    // 각자 자기 stability 기준으로 경계에 걸치게 만든다.
    const words = [
      { word_text: 'w-0.9', stability: 0.9 },
      { word_text: 'w-1.0', stability: 1.0 },
      { word_text: 'w-1.1', stability: 1.1 },
      { word_text: 'w-1.3', stability: 1.3 },
    ];
    const rows = words.map(({ word_text, stability }) => ({
      word_text,
      interval: stability,
      last_reviewed_at: lastReviewedAtFor(0.705, stability),
    }));

    // 자체 점검 — 네 픽스처 모두 실제로 falling 조건을 만족하는지 확인.
    for (const { stability } of words) {
      expect(retrievabilityAtDaysLater(0.705, stability, 1)).toBeLessThan(RETRIEVABILITY_THRESHOLD);
    }

    const { falling, top3, count } = buildForecast(rows, NOW);

    expect(count).toBe(4);
    expect(top3).toHaveLength(3);
    // stability 내림차순: 1.3 → 1.1 → 1.0 (0.9는 4위라 제외)
    expect(top3.map(t => t.word_text)).toEqual(['w-1.3', 'w-1.1', 'w-1.0']);
  });

  it('(d) 빈 입력이면 count는 0이고 falling/top3도 비어 있다', () => {
    expect(buildForecast([], NOW)).toEqual({ falling: [], count: 0, top3: [] });
    expect(buildForecast(null, NOW)).toEqual({ falling: [], count: 0, top3: [] });
    expect(buildForecast(undefined, NOW)).toEqual({ falling: [], count: 0, top3: [] });
  });

  it('(e) 신규 저장만 된 행(학습 이력 없음)은 제외된다', () => {
    const rows = [
      // last_reviewed_at 없음 — vocabStudy.js의 isNewWord()와 동일 관례로 "신규"
      { word_text: '新規1', interval: 0, last_reviewed_at: null },
      // interval 0이지만 last_reviewed_at은 어쩌다 채워진 방어적 케이스도 제외
      { word_text: '新規2', interval: 0, last_reviewed_at: NOW.toISOString() },
      // last_reviewed_at 필드 자체가 없는 경우(undefined)도 방어
      { word_text: '新規3', interval: 5 },
    ];

    const { falling, count } = buildForecast(rows, NOW);

    expect(count).toBe(0);
    expect(falling).toHaveLength(0);
  });
});
