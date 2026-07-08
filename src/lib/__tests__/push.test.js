import { describe, it, expect } from 'vitest';

// push.js → supabase.js가 모듈 로드 시 env를 요구하므로, 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { computePreferredHour } = await import('../push');

// UTC 시각 h(0-23)를 갖는 ISO 문자열
const atUtc = (h) => `2026-07-08T${String(h).padStart(2, '0')}:00:00.000Z`;

describe('computePreferredHour — 발송 시각(UTC 0-23) 계산', () => {
  it('관측 5세션 이상: UTC 시각 중앙값(홀수 개)', () => {
    // UTC 시각 [2, 8, 20, 21, 22] → 정렬 중앙값 20
    const ts = [8, 22, 2, 20, 21].map(atUtc);
    expect(computePreferredHour(ts)).toBe(20);
  });

  it('짝수 개: 가운데 두 값의 반올림 평균', () => {
    // UTC 시각 [2, 8, 20, 22, 23, 23] → 가운데 20,22 → 평균 21
    const ts = [2, 8, 20, 22, 23, 23].map(atUtc);
    expect(computePreferredHour(ts)).toBe(21);
  });

  it('UTC 기준으로 시각을 뽑는다(로컬 아님)', () => {
    // Z(UTC)로 명시된 05시 5개 → 중앙값 5
    const ts = [5, 5, 5, 5, 5].map(atUtc);
    expect(computePreferredHour(ts)).toBe(5);
  });

  it('관측 5세션 미만: 로컬 20시 → UTC 폴백 (KST, offset -540)', () => {
    // KST(UTC+9): getTimezoneOffset() = -540. 로컬 20시 = UTC 11시.
    expect(computePreferredHour([atUtc(3), atUtc(4)], { tzOffsetMinutes: -540 })).toBe(11);
  });

  it('빈 입력도 폴백을 반환한다(UTC, offset 0 → 20시)', () => {
    expect(computePreferredHour([], { tzOffsetMinutes: 0 })).toBe(20);
    expect(computePreferredHour(undefined)).toBe(20);
  });

  it('폴백이 자정을 넘으면 0-23으로 래핑 (US Eastern, offset +300)', () => {
    // EST(UTC-5): offset +300. 로컬 20시 = UTC 25시 → 1시.
    expect(computePreferredHour([atUtc(1)], { tzOffsetMinutes: 300 })).toBe(1);
  });

  it('fallbackLocalHour를 존중한다', () => {
    // 로컬 9시, offset 0 → UTC 9시
    expect(computePreferredHour([], { fallbackLocalHour: 9, tzOffsetMinutes: 0 })).toBe(9);
  });

  it('잘못된 타임스탬프는 걸러낸다', () => {
    // 유효 4개뿐 → 5 미만 → 폴백(offset 0 → 20)
    const ts = [atUtc(10), 'not-a-date', null, atUtc(11), atUtc(12), atUtc(13)];
    expect(computePreferredHour(ts, { tzOffsetMinutes: 0 })).toBe(20);
  });

  it('중앙값 결과도 항상 0-23 범위', () => {
    const ts = [23, 23, 23, 22, 21].map(atUtc);
    const h = computePreferredHour(ts);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(23);
  });
});
