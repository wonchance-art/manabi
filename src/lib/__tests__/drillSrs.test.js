import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

const {
  applyDrillResultToQueue,
  applyGuestReviewResult,
  migrateGuestDrillQueue,
  GUEST_DRILL_QUEUE_KEY,
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

// 게스트 복습 세션(로그인 없이 /review/grammar)이 채점 결과를 기기 큐에 반영하는 경로.
// 서버에 못 쓰는 대신 같은 FSRS 계산으로 카드를 전진시켜야 한다 — 안 그러면 같은 카드가 영원히 due로 남는다.
describe('applyGuestReviewResult — 비로그인 복습 채점', () => {
  const store = new Map();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, v),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const seed = (rows) => store.set(GUEST_DRILL_QUEUE_KEY, JSON.stringify(rows));
  const queue = () => JSON.parse(store.get(GUEST_DRILL_QUEUE_KEY));

  it('큐에 있는 카드를 전진시키고 다음 간격(일)을 돌려준다', () => {
    seed([{ user_id: 'guest', lang: 'French', slug: 'drill:a101-d1', interval: 1, next_review_at: '2000-01-01T00:00:00.000Z' }]);

    const days = applyGuestReviewResult(
      { lang: 'French', slug: 'drill:a101-d1', rating: 3 },
      { now: NOW, calculator },
    );

    expect(days).toBe(3);                    // calculator가 interval: rating을 돌려준다
    expect(queue()).toHaveLength(1);         // 복습은 카드를 늘리지 않는다
    expect(queue()[0].next_review_at).toBe('2026-08-03T05:00:00.000Z');
    expect(queue()[0].last_reviewed_at).toBe(NOW.toISOString());
  });

  it('큐에 없는 카드는 만들지 않는다 — 복습은 등록된 카드에만 일어난다', () => {
    seed([{ user_id: 'guest', lang: 'French', slug: 'drill:a101-d1', interval: 1 }]);

    const days = applyGuestReviewResult(
      { lang: 'French', slug: 'drill:없는카드', rating: 3 },
      { now: NOW, calculator },
    );

    expect(days).toBeNull();
    expect(queue()).toHaveLength(1);
    expect(queue()[0].slug).toBe('drill:a101-d1');
  });

  it('인자가 모자라면 큐를 건드리지 않는다', () => {
    seed([{ user_id: 'guest', lang: 'French', slug: 'drill:a101-d1', interval: 1 }]);
    expect(applyGuestReviewResult({ lang: 'French', slug: '', rating: 3 })).toBeNull();
    expect(applyGuestReviewResult({ lang: '', slug: 'drill:a101-d1', rating: 3 })).toBeNull();
    expect(applyGuestReviewResult({ lang: 'French', slug: 'drill:a101-d1', rating: 0 })).toBeNull();
    expect(queue()).toHaveLength(1);
  });
});

// 로그인 시 기기 큐 → 서버 이관. 여기가 조용히 깨지면 게스트로 쌓은 복습이 로그인과 함께 사라진다.
describe('migrateGuestDrillQueue — 로그인 시 기기 큐 이관', () => {
  const store = new Map();
  let upsert;

  beforeEach(() => {
    store.clear();
    upsert = vi.fn(async () => ({ error: null }));
    // 파일 상단에서 이미 import한 모듈이 캐시에 있으면 아래 doMock이 적용되지 않는다
    // (그러면 진짜 supabase를 타고 조용히 migrated: 0이 되어 테스트가 헛통과한다).
    vi.resetModules();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, v),
      },
    });
    vi.doMock('../supabase.js', () => ({ supabase: { from: () => ({ upsert }) } }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('../supabase.js');
    vi.resetModules();
  });

  const seed = (rows) => store.set(GUEST_DRILL_QUEUE_KEY, JSON.stringify(rows));
  const queue = () => JSON.parse(store.get(GUEST_DRILL_QUEUE_KEY) || '[]');
  const load = async () => (await import('../drillSrs')).migrateGuestDrillQueue;

  it('서버에 없는 카드만 넣고(ignoreDuplicates) 성공 뒤에 로컬을 비운다', async () => {
    seed([
      { user_id: 'guest', lang: 'French', slug: 'drill:a101-d1', interval: 3, ease_factor: 5, repetitions: 0, next_review_at: '2026-09-01T00:00:00.000Z' },
      { user_id: 'guest', lang: 'Japanese', slug: 'drill:n504-d4', interval: 1, next_review_at: '2026-08-20T00:00:00.000Z' },
    ]);

    const migrate = await load();
    const result = await migrate('user-1');

    expect(result.migrated).toBe(2);
    expect(upsert).toHaveBeenCalledTimes(1);
    const [payload, options] = upsert.mock.calls[0];
    expect(options).toEqual({ onConflict: 'user_id,lang,slug', ignoreDuplicates: true });
    expect(payload).toHaveLength(2);
    expect(payload[0]).toMatchObject({ user_id: 'user-1', lang: 'French', slug: 'drill:a101-d1', interval: 3 });
    expect(queue()).toEqual([]);   // 성공했으니 기기 큐는 비운다
  });

  it('쓰기가 실패하면 로컬 큐를 지우지 않는다 — 다음 기회에 다시 시도한다', async () => {
    seed([{ user_id: 'guest', lang: 'French', slug: 'drill:a101-d1', interval: 3 }]);
    upsert = vi.fn(async () => ({ error: { message: 'nope' } }));

    const migrate = await load();
    const result = await migrate('user-1');

    expect(result.migrated).toBe(0);
    expect(queue()).toHaveLength(1);
  });

  it('비로그인·빈 큐·드릴 아닌 slug는 아무것도 쓰지 않는다', async () => {
    const migrate = await load();

    seed([{ user_id: 'guest', lang: 'French', slug: 'drill:a101-d1' }]);
    expect((await migrate(null)).migrated).toBe(0);

    seed([]);
    expect((await migrate('user-1')).migrated).toBe(0);

    seed([{ user_id: 'guest', lang: 'French', slug: 'a1-01-pronouns-etre' }]); // 챕터 큐는 이 경로가 아니다
    expect((await migrate('user-1')).migrated).toBe(0);

    expect(upsert).not.toHaveBeenCalled();
  });
});
