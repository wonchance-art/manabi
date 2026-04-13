import { describe, it, expect } from 'vitest';
import { calculateFSRS } from '../fsrs';

const FRESH = { interval: 0, ease_factor: 0, repetitions: 0, next_review_at: null };

describe('calculateFSRS', () => {
  describe('first review (new card)', () => {
    it('Again → very short stability, high difficulty', () => {
      const r = calculateFSRS(1, FRESH);
      expect(r.interval).toBeCloseTo(0.4, 1);  // w[0]
      expect(r.ease_factor).toBeGreaterThan(5); // harder
      expect(r.repetitions).toBe(0);
      expect(r.next_review_at).toBeTruthy();
    });

    it('Good → moderate stability', () => {
      const r = calculateFSRS(3, FRESH);
      expect(r.interval).toBeCloseTo(2.4, 1);  // w[2]
      expect(r.ease_factor).toBeCloseTo(4.93, 1); // w[4] - 0*w[5]
    });

    it('Easy → highest initial stability', () => {
      const r = calculateFSRS(4, FRESH);
      expect(r.interval).toBeCloseTo(5.8, 1);  // w[3]
      expect(r.ease_factor).toBeLessThan(4.93); // easier
    });

    it('stability: Again < Hard < Good < Easy', () => {
      const a = calculateFSRS(1, FRESH);
      const h = calculateFSRS(2, FRESH);
      const g = calculateFSRS(3, FRESH);
      const e = calculateFSRS(4, FRESH);
      expect(a.interval).toBeLessThan(h.interval);
      expect(h.interval).toBeLessThan(g.interval);
      expect(g.interval).toBeLessThan(e.interval);
    });
  });

  describe('subsequent reviews', () => {
    const reviewed = {
      interval: 5,
      ease_factor: 5,
      repetitions: 0,
      next_review_at: new Date(Date.now() - 0).toISOString(), // due now
    };

    it('Good increases stability', () => {
      const r = calculateFSRS(3, reviewed);
      expect(r.interval).toBeGreaterThan(reviewed.interval);
    });

    it('Again decreases stability and increments lapses', () => {
      const r = calculateFSRS(1, reviewed);
      expect(r.interval).toBeLessThan(reviewed.interval);
      expect(r.repetitions).toBe(1); // lapses +1
    });

    it('Hard has penalty vs Good', () => {
      const hard = calculateFSRS(2, reviewed);
      const good = calculateFSRS(3, reviewed);
      expect(hard.interval).toBeLessThan(good.interval);
    });

    it('Easy has bonus vs Good', () => {
      const easy = calculateFSRS(4, reviewed);
      const good = calculateFSRS(3, reviewed);
      expect(easy.interval).toBeGreaterThan(good.interval);
    });
  });

  describe('difficulty bounds', () => {
    it('difficulty stays between 1 and 10', () => {
      let state = FRESH;
      // Always Easy 20 times → difficulty should bottom out at 1
      for (let i = 0; i < 20; i++) {
        state = calculateFSRS(4, state);
      }
      expect(state.ease_factor).toBeGreaterThanOrEqual(1);

      // Always Again 20 times → difficulty should cap at 10
      state = FRESH;
      for (let i = 0; i < 20; i++) {
        state = calculateFSRS(1, state);
      }
      expect(state.ease_factor).toBeLessThanOrEqual(10);
    });
  });

  describe('next_review_at', () => {
    it('returns ISO string in the future', () => {
      const r = calculateFSRS(3, FRESH);
      const reviewDate = new Date(r.next_review_at);
      expect(reviewDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('interval rounds to at least 1 day', () => {
      const r = calculateFSRS(1, FRESH);
      const reviewDate = new Date(r.next_review_at);
      const daysAway = (reviewDate.getTime() - Date.now()) / (24 * 3600 * 1000);
      expect(daysAway).toBeGreaterThanOrEqual(0.9); // ~1 day, allowing for execution time
    });
  });

  describe('overdue cards', () => {
    it('overdue card with Good still increases stability', () => {
      const overdue = {
        interval: 5,
        ease_factor: 5,
        repetitions: 0,
        next_review_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), // 10 days overdue
      };
      const r = calculateFSRS(3, overdue);
      expect(r.interval).toBeGreaterThan(overdue.interval);
    });
  });
});
