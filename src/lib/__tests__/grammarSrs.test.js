import { describe, it, expect } from 'vitest';

// grammarSrs → supabase.js가 모듈 로드 시 env를 요구하므로, 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { ratingFromScore, initialQueueRow } = await import('../grammarSrs');

describe('ratingFromScore — 정답률 → FSRS rating', () => {
  it('만점 → 4 (Easy)', () => {
    expect(ratingFromScore(4, 4)).toBe(4);
    expect(ratingFromScore(1, 1)).toBe(4);
  });

  it('75% 이상 → 3 (Good)', () => {
    expect(ratingFromScore(3, 4)).toBe(3);
  });

  it('50% 이상 → 2 (Hard)', () => {
    expect(ratingFromScore(2, 4)).toBe(2);
  });

  it('50% 미만 → 1 (Again)', () => {
    expect(ratingFromScore(1, 4)).toBe(1);
    expect(ratingFromScore(0, 4)).toBe(1);
  });

  it('0문항(빈 퀴즈) → 1', () => {
    expect(ratingFromScore(0, 0)).toBe(1);
  });
});

describe('initialQueueRow — 첫 등록 상태', () => {
  it('신규 카드(interval 0), 첫 복습은 +1일', () => {
    const now = new Date('2026-07-01T09:00:00Z');
    const row = initialQueueRow('u1', 'Japanese', 'n5-04-desu-da', now);
    expect(row).toMatchObject({
      user_id: 'u1', lang: 'Japanese', slug: 'n5-04-desu-da',
      interval: 0, ease_factor: 0, repetitions: 0,
    });
    expect(new Date(row.next_review_at).getTime()).toBe(
      new Date('2026-07-02T09:00:00Z').getTime()
    );
  });
});
