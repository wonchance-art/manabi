import { describe, it, expect } from 'vitest';

// ForecastCard가 supabase(env) 체인을 로드하므로 stub 후 동적 import (reviewEvents 테스트와 동일 관례).
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { buildForecastTapEvent } = await import('../../components/ForecastCard');

describe('buildForecastTapEvent — 예보 탭 ui 계측 규약', () => {
  it('source:ui · item_key:- · detail.qtype:forecast_tap 규약을 만든다', () => {
    const ev = buildForecastTapEvent('Japanese', { count: 4 });
    expect(ev).toEqual({
      lang: 'Japanese',
      source: 'ui',
      item_key: '-',
      correct: true,
      detail: { qtype: 'forecast_tap', count: 4 },
    });
  });

  it('forecast가 없거나 count 미정이면 count:0으로 안전 폴백', () => {
    expect(buildForecastTapEvent('English').detail.count).toBe(0);
    expect(buildForecastTapEvent('English', {}).detail.count).toBe(0);
  });

  it('logReviewEvents 필터(lang·source·item_key·boolean correct)를 통과한다', () => {
    // reviewEvents.js가 이 조건을 만족하지 않는 이벤트를 조용히 버리므로, 계측이 실제로
    // 적재되려면 아래가 참이어야 한다(계측 유실 회귀 방지).
    const e = buildForecastTapEvent('Japanese', { count: 1 });
    expect(Boolean(e.lang && e.source && e.item_key && typeof e.correct === 'boolean')).toBe(true);
  });
});
