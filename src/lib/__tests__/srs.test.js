import { describe, it, expect } from 'vitest';
import { calculateNextReview } from '../srs';

const FRESH = { repetitions: 0, ease_factor: 2.5, interval: 0 };

describe('calculateNextReview (SM-2)', () => {
  describe('첫 복습', () => {
    it('quality 3 (정답) → interval 1, repetitions 1', () => {
      const r = calculateNextReview(3, FRESH);
      expect(r.interval).toBe(1);
      expect(r.repetitions).toBe(1);
    });

    it('quality 5 (완벽) → interval 1, repetitions 1', () => {
      const r = calculateNextReview(5, FRESH);
      expect(r.interval).toBe(1);
      expect(r.repetitions).toBe(1);
    });

    it('quality 2 (오답) → interval 1, repetitions 리셋 0', () => {
      const r = calculateNextReview(2, FRESH);
      expect(r.interval).toBe(1);
      expect(r.repetitions).toBe(0);
    });
  });

  describe('두 번째 복습', () => {
    it('연속 정답 → interval 6', () => {
      const afterFirst = { repetitions: 1, ease_factor: 2.5, interval: 1 };
      const r = calculateNextReview(4, afterFirst);
      expect(r.interval).toBe(6);
      expect(r.repetitions).toBe(2);
    });
  });

  describe('세 번째 이후 복습', () => {
    it('interval * ease_factor 적용', () => {
      const state = { repetitions: 2, ease_factor: 2.5, interval: 6 };
      const r = calculateNextReview(4, state);
      expect(r.interval).toBe(15); // round(6 * 2.5) = 15
      expect(r.repetitions).toBe(3);
    });

    it('오답 시 interval 1로 리셋, repetitions 0', () => {
      const state = { repetitions: 5, ease_factor: 2.5, interval: 30 };
      const r = calculateNextReview(1, state);
      expect(r.interval).toBe(1);
      expect(r.repetitions).toBe(0);
    });
  });

  describe('Ease Factor 조정', () => {
    it('quality 5 → ease_factor 증가', () => {
      const r = calculateNextReview(5, FRESH);
      expect(r.ease_factor).toBeGreaterThan(2.5);
    });

    it('quality 0 → ease_factor 감소 (최소 1.3)', () => {
      const r = calculateNextReview(0, FRESH);
      expect(r.ease_factor).toBeGreaterThanOrEqual(1.3);
    });

    it('ease_factor 최소값 1.3 보장', () => {
      let state = { ...FRESH };
      for (let i = 0; i < 20; i++) {
        state = {
          ...calculateNextReview(0, state),
        };
      }
      expect(state.ease_factor).toBe(1.3);
    });

    it('quality 3 → ease_factor 약간 감소', () => {
      const r = calculateNextReview(3, FRESH);
      // EF + 0.1 - (5-3)*(0.08 + (5-3)*0.02) = 2.5 + 0.1 - 2*(0.08 + 0.04) = 2.5 + 0.1 - 0.24 = 2.36
      expect(r.ease_factor).toBeCloseTo(2.36, 2);
    });
  });

  describe('next_review_at', () => {
    it('ISO 문자열 반환', () => {
      const r = calculateNextReview(3, FRESH);
      expect(() => new Date(r.next_review_at)).not.toThrow();
      expect(new Date(r.next_review_at).getTime()).toBeGreaterThan(Date.now());
    });
  });
});
