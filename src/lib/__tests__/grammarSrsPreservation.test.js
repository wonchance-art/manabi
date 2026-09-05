import { beforeEach, expect, it, vi } from 'vitest';
const { upsert } = vi.hoisted(() => ({ upsert: vi.fn(() => Promise.resolve({})) }));
vi.mock('../supabase', () => ({ supabase: { from: () => ({ upsert }) } }));
import { enqueueGrammarReview, staggerBackfillRows } from '../grammarSrs';

beforeEach(() => vi.clearAllMocks());
it('반복 통과는 사용자·언어·챕터 키로 중복 무시하며 기존 FSRS를 덮어쓰지 않는다', () => {
  enqueueGrammarReview('user', 'Japanese', 'n5-first');
  enqueueGrammarReview('user', 'Japanese', 'n5-first');
  for (const [row, options] of upsert.mock.calls) {
    expect(row).toMatchObject({ user_id: 'user', lang: 'Japanese', slug: 'n5-first' });
    expect(options).toEqual({ onConflict: 'user_id,lang,slug', ignoreDuplicates: true });
  }
  expect(upsert).toHaveBeenCalledTimes(2);
});
it('중복 통과 기록은 한 번만 백필하고 기존 큐와 호출자의 Set을 보존한다', () => {
  const existing = new Set(['Japanese:old']);
  const rows = staggerBackfillRows('u', [
    { lang: 'Japanese', slug: 'old' }, { lang: 'Japanese', slug: 'new' },
    { lang: 'Japanese', slug: 'new' }, { lang: 'French', slug: 'new' },
  ], existing);
  expect(rows.map(r => `${r.lang}:${r.slug}`)).toEqual(['Japanese:new', 'French:new']);
  expect([...existing]).toEqual(['Japanese:old']);
});
