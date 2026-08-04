import { describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

const {
  applyDrillResultToQueue,
  buildDrillReviewEvent,
  buildDrillReviewQuiz,
  drillIdFromQueueSlug,
  drillQueueSlug,
  findDrillContext,
  ratingFromDrillResult,
} = await import('../drillSrs');

const NOW = new Date('2026-08-01T05:00:00.000Z');
const calculator = vi.fn((rating) => ({
  interval: rating,
  ease_factor: rating + 2,
  repetitions: rating === 1 ? 1 : 0,
  next_review_at: `2026-08-0${rating}T05:00:00.000Z`,
}));

describe('drillSrs — ChapterDrills 결과를 기존 복습 계약으로 연결', () => {
  it('정답은 Good(3), 오답은 Again(1)으로 스케줄한다', () => {
    expect(ratingFromDrillResult(true)).toBe(3);
    expect(ratingFromDrillResult(false)).toBe(1);

    const correct = applyDrillResultToQueue([], {
      lang: 'French', drillId: 'a101-d1', correct: true,
    }, { now: NOW, calculator });
    const wrong = applyDrillResultToQueue([], {
      lang: 'French', drillId: 'a101-d2', correct: false,
    }, { now: NOW, calculator });

    expect(correct.rating).toBe(3);
    expect(correct.row).toMatchObject({ slug: 'drill:a101-d1', interval: 3 });
    expect(wrong.rating).toBe(1);
    expect(wrong.row).toMatchObject({ slug: 'drill:a101-d2', interval: 1, repetitions: 1 });
  });

  it('같은 drill id 재등록은 행을 늘리지 않고 기존 카드만 갱신한다', () => {
    const first = applyDrillResultToQueue([], {
      lang: 'French', drillId: 'a101-d1', correct: false,
    }, { now: NOW, calculator });
    const second = applyDrillResultToQueue(first.rows, {
      lang: 'French', drillId: 'a101-d1', correct: true,
    }, { now: NOW, calculator });

    expect(first.added).toBe(true);
    expect(second.added).toBe(false);
    expect(second.rows).toHaveLength(1);
    expect(second.rows[0].interval).toBe(3);
  });

  it('큐 slug는 drill id를 손실 없이 왕복한다', () => {
    expect(drillQueueSlug('a101-d1')).toBe('drill:a101-d1');
    expect(drillIdFromQueueSlug('drill:a101-d1')).toBe('a101-d1');
    expect(drillIdFromQueueSlug('a1-01-pronouns-etre')).toBeNull();
  });

  it('append-only 이벤트는 drill id와 문항 유형 신호를 보존한다', () => {
    expect(buildDrillReviewEvent('French', { id: 'a101-d7', type: 'dictation' }, false)).toEqual({
      lang: 'French',
      source: 'grammar',
      item_key: 'a101-d7',
      correct: false,
      detail: { qtype: 'listening', drill_type: 'dictation' },
    });
  });

  it('원본 드릴을 찾아 기존 GrammarReviewSession 퀴즈 형태로 만든다', () => {
    const chapter = {
      slug: 'a1-01',
      drills: [{ id: 'a101-d3', type: 'choice', prompt: '옳은 문장은?', choices: ['A', 'B'], answer: 'A' }],
    };
    const found = findDrillContext({ ALL_CHAPTERS: [chapter] }, 'a101-d3');
    expect(found).toEqual({ chapter, drill: chapter.drills[0] });
    expect(buildDrillReviewQuiz(found.drill).meaning[0]).toMatchObject({
      sentence: '옳은 문장은?', correct: 'A', distractors: ['B'],
    });
  });

  it('fill/order/dictation도 한 문항 복습 퀴즈로 손실 없이 변환한다', () => {
    const fill = buildDrillReviewQuiz({ type: 'fill', prompt: 'Je ___ ici.', answer: 'suis' });
    const order = buildDrillReviewQuiz({ type: 'order', prompt: '배열하세요.', sentence: 'Je suis ici.' });
    const dictation = buildDrillReviewQuiz({ type: 'dictation', sentence: 'Nous sommes ici.' });

    expect(fill.produce[0]).toMatchObject({ ko: 'Je ___ ici.', main: 'suis' });
    expect(order.apply[0]).toMatchObject({ tokens: ['Je', 'suis', 'ici.'], answer: 'Je suis ici.' });
    expect(dictation.produce[0]).toMatchObject({ main: 'Nous sommes ici.' });
  });
});
