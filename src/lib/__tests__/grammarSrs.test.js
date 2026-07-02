import { describe, it, expect } from 'vitest';

// grammarSrs → supabase.js가 모듈 로드 시 env를 요구하므로, 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { ratingFromScore, initialQueueRow, staggerBackfillRows } = await import('../grammarSrs');

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

describe('staggerBackfillRows — 과거 통과 챕터 분산 백필', () => {
  const NOW = new Date('2026-07-02T09:00:00Z');
  const passed = Array.from({ length: 23 }, (_, i) => ({ lang: 'Japanese', slug: `ch-${i}` }));

  it('하루 10개씩 분산 스케줄 — 첫 10개는 오늘 due', () => {
    const rows = staggerBackfillRows('u1', passed, new Set(), NOW, 10);
    expect(rows).toHaveLength(23);
    expect(rows[0].next_review_at).toBe(NOW.toISOString());
    expect(rows[9].next_review_at).toBe(NOW.toISOString());
    expect(new Date(rows[10].next_review_at).getDate()).toBe(3);   // +1일
    expect(new Date(rows[22].next_review_at).getDate()).toBe(4);   // +2일
  });

  it('이미 큐에 있는 챕터는 건너뛴다', () => {
    const existing = new Set(['Japanese:ch-0', 'Japanese:ch-5']);
    const rows = staggerBackfillRows('u1', passed, existing, NOW, 10);
    expect(rows).toHaveLength(21);
    expect(rows.some(r => r.slug === 'ch-0' || r.slug === 'ch-5')).toBe(false);
    // 건너뛴 자리는 당겨져서 여전히 첫 10개가 오늘
    expect(rows.filter(r => r.next_review_at === NOW.toISOString())).toHaveLength(10);
  });

  it('신규 카드 상태(interval 0)로 등록한다', () => {
    const [row] = staggerBackfillRows('u1', [{ lang: 'French', slug: 'a1-01' }], new Set(), NOW);
    expect(row).toMatchObject({ user_id: 'u1', lang: 'French', slug: 'a1-01', interval: 0, repetitions: 0 });
  });

  it('빈 입력·깨진 항목은 무시', () => {
    expect(staggerBackfillRows('u1', [], new Set(), NOW)).toEqual([]);
    expect(staggerBackfillRows('u1', [null, { lang: 'x' }], new Set(), NOW)).toEqual([]);
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
