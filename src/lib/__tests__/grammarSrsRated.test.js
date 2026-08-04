import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const upsert = vi.fn();
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle,
    upsert,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return {
    chain,
    maybeSingle,
    upsert,
    from: vi.fn(() => chain),
    calculateFSRS: vi.fn(),
  };
});

vi.mock('../supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('../fsrs', () => ({ calculateFSRS: mocks.calculateFSRS }));

const { upsertRatedGrammarReview } = await import('../grammarSrs');

describe('upsertRatedGrammarReview — 단일 카드 등록+첫 채점', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chain.select.mockReturnValue(mocks.chain);
    mocks.chain.eq.mockReturnValue(mocks.chain);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.calculateFSRS.mockReturnValue({
      interval: 1.25,
      ease_factor: 5,
      repetitions: 1,
      next_review_at: '2026-08-02T05:00:00.000Z',
    });
  });

  it('없는 drill 행은 신규 상태에서 Again(1)으로 계산해 conflict key에 upsert한다', async () => {
    const now = new Date('2026-08-01T05:00:00.000Z');
    const row = await upsertRatedGrammarReview('u1', 'French', 'drill:a101-d1', 1, now);

    expect(mocks.calculateFSRS).toHaveBeenCalledWith(1, expect.objectContaining({
      user_id: 'u1', lang: 'French', slug: 'drill:a101-d1', interval: 0,
    }));
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', slug: 'drill:a101-d1', interval: 1.25,
      last_reviewed_at: now.toISOString(),
    }), { onConflict: 'user_id,lang,slug' });
    expect(row?.slug).toBe('drill:a101-d1');
  });

  it('기존 행은 중복 등록 없이 현재 상태에서 Good(3)으로 전진시킨다', async () => {
    const previous = {
      user_id: 'u1', lang: 'French', slug: 'drill:a101-d1',
      interval: 2, ease_factor: 4, repetitions: 0,
      next_review_at: '2026-08-03T05:00:00.000Z',
    };
    mocks.maybeSingle.mockResolvedValue({ data: previous, error: null });

    await upsertRatedGrammarReview('u1', 'French', 'drill:a101-d1', 3);

    expect(mocks.calculateFSRS).toHaveBeenCalledWith(3, previous);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });
});
