import { describe, it, expect, vi, beforeEach } from 'vitest';

// useInlineReview는 useMutation/useQueryClient 두 훅만 사용 — 둘 다 얇게 목킹하면
// React 렌더 트리 없이도 mutationFn/onSuccess를 직접 호출해 검증할 수 있다.
const updateEq = vi.fn(async () => ({ error: null }));
const updateMock = vi.fn(() => ({ eq: updateEq }));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock('../supabase', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (config) => config,
}));

vi.mock('../streak', () => ({
  recordActivity: vi.fn(),
}));

const logReviewEvents = vi.fn();
vi.mock('../reviewEvents', () => ({
  logReviewEvents: (...args) => logReviewEvents(...args),
}));

vi.mock('../fsrs', () => ({
  calculateFSRS: vi.fn(() => ({ interval: 3, ease_factor: 2.6, repetitions: 1, next_review_at: '2026-07-12T00:00:00.000Z' })),
}));

const { useInlineReview } = await import('../useInlineReview');

function makeVocab(overrides = {}) {
  return {
    id: 'v1',
    word_text: 'chat',
    meaning: '고양이',
    language: 'French',
    interval: 0,
    ease_factor: 0,
    repetitions: 0,
    next_review_at: null,
    ...overrides,
  };
}

describe('useInlineReview — review_events 기록', () => {
  beforeEach(() => {
    logReviewEvents.mockClear();
    updateEq.mockClear();
    updateMock.mockClear();
    fromMock.mockClear();
  });

  it('채점(오답) 시 VocabPage와 동일 규약으로 logReviewEvents를 호출한다 — qtype=flash, item_key=word_text', async () => {
    const user = { id: 'u1' };
    const config = useInlineReview({ user, fetchProfile: vi.fn(), toast: vi.fn() });
    const vocab = makeVocab();

    const result = await config.mutationFn({ vocab, rating: 1 });
    await config.onSuccess(result);

    expect(logReviewEvents).toHaveBeenCalledTimes(1);
    expect(logReviewEvents).toHaveBeenCalledWith('u1', [{
      lang: 'French',
      source: 'vocab',
      item_key: 'chat',
      correct: false,
      detail: { word_id: 'v1', meaning: '고양이', rating: 1, qtype: 'flash' },
    }]);
  });

  it('정답(rating>1) 시 correct:true로 기록한다', async () => {
    const user = { id: 'u1' };
    const config = useInlineReview({ user, fetchProfile: vi.fn(), toast: vi.fn() });
    const vocab = makeVocab({ id: 'v2', word_text: 'chien' });

    const result = await config.mutationFn({ vocab, rating: 3 });
    await config.onSuccess(result);

    expect(logReviewEvents).toHaveBeenCalledWith('u1', [
      expect.objectContaining({ item_key: 'chien', correct: true, detail: expect.objectContaining({ qtype: 'flash', rating: 3 }) }),
    ]);
  });

  it('vocab.language가 없으면 detectLang으로 유도한다', async () => {
    const user = { id: 'u1' };
    const config = useInlineReview({ user, fetchProfile: vi.fn(), toast: vi.fn() });
    const vocab = makeVocab({ language: undefined, word_text: '猫' });

    const result = await config.mutationFn({ vocab, rating: 2 });
    await config.onSuccess(result);

    expect(logReviewEvents).toHaveBeenCalledWith('u1', [
      expect.objectContaining({ lang: 'Japanese' }),
    ]);
  });
});
