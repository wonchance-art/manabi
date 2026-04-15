import { describe, it, expect } from 'vitest';
import { calculateFSRS } from '../fsrs';

const FRESH = { interval: 0, ease_factor: 0, repetitions: 0, next_review_at: null };

describe('calculateFSRS (ts-fsrs adapter)', () => {
  describe('first review (new card)', () => {
    it('Again → 짧은 stability', () => {
      const r = calculateFSRS(1, FRESH);
      expect(r.interval).toBeGreaterThan(0);
      expect(r.interval).toBeLessThan(2);
      expect(r.repetitions).toBe(0);
      expect(r.next_review_at).toBeTruthy();
    });

    it('Good → 양호한 stability', () => {
      const r = calculateFSRS(3, FRESH);
      expect(r.interval).toBeGreaterThan(0);
      expect(r.ease_factor).toBeGreaterThanOrEqual(1);
      expect(r.ease_factor).toBeLessThanOrEqual(10);
    });

    it('Easy → 가장 긴 stability, 낮은 difficulty', () => {
      const r = calculateFSRS(4, FRESH);
      expect(r.interval).toBeGreaterThan(0);
    });

    it('stability: Again < Hard ≤ Good < Easy', () => {
      const a = calculateFSRS(1, FRESH);
      const h = calculateFSRS(2, FRESH);
      const g = calculateFSRS(3, FRESH);
      const e = calculateFSRS(4, FRESH);
      expect(a.interval).toBeLessThan(h.interval);
      expect(h.interval).toBeLessThanOrEqual(g.interval);
      expect(g.interval).toBeLessThan(e.interval);
    });
  });

  describe('subsequent reviews', () => {
    const reviewed = {
      interval: 5,
      ease_factor: 5,
      repetitions: 0,
      next_review_at: new Date(Date.now()).toISOString(), // due now
    };

    it('Good increases stability', () => {
      const r = calculateFSRS(3, reviewed);
      expect(r.interval).toBeGreaterThan(reviewed.interval);
    });

    it('Again decreases stability and increments lapses', () => {
      const r = calculateFSRS(1, reviewed);
      expect(r.interval).toBeLessThan(reviewed.interval);
      expect(r.repetitions).toBe(1);
    });

    it('Hard interval < Good interval', () => {
      const hard = calculateFSRS(2, reviewed);
      const good = calculateFSRS(3, reviewed);
      expect(hard.interval).toBeLessThan(good.interval);
    });

    it('Easy interval > Good interval', () => {
      const easy = calculateFSRS(4, reviewed);
      const good = calculateFSRS(3, reviewed);
      expect(easy.interval).toBeGreaterThan(good.interval);
    });
  });

  describe('difficulty 경계', () => {
    it('difficulty stays between 1 and 10 (Easy 반복)', () => {
      let state = FRESH;
      for (let i = 0; i < 15; i++) state = calculateFSRS(4, state);
      expect(state.ease_factor).toBeGreaterThanOrEqual(1);
      expect(state.ease_factor).toBeLessThanOrEqual(10);
    });

    it('difficulty stays between 1 and 10 (Again 반복)', () => {
      let state = FRESH;
      for (let i = 0; i < 15; i++) state = calculateFSRS(1, state);
      expect(state.ease_factor).toBeGreaterThanOrEqual(1);
      expect(state.ease_factor).toBeLessThanOrEqual(10);
    });
  });

  describe('next_review_at', () => {
    it('ISO string in the future', () => {
      const r = calculateFSRS(3, FRESH);
      expect(new Date(r.next_review_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('최소 1일 뒤', () => {
      const r = calculateFSRS(1, FRESH);
      const daysAway = (new Date(r.next_review_at).getTime() - Date.now()) / (24 * 3600 * 1000);
      expect(daysAway).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('overdue cards', () => {
    it('overdue + Good → stability 증가', () => {
      const overdue = {
        interval: 5,
        ease_factor: 5,
        repetitions: 0,
        next_review_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      };
      const r = calculateFSRS(3, overdue);
      expect(r.interval).toBeGreaterThan(overdue.interval);
    });
  });
});
