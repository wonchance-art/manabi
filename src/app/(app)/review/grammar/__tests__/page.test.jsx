import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ user: { id: 'learner' }, passed: [], due: [], upcoming: [], queued: [], writes: [], overrides: new Map() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from(table) {
    let mode = '', selected = '', action = 'select';
    const query = {
      select(fields) { selected = fields; return query; }, eq() { return query; },
      order() { return query; }, limit() { return query; },
      lte() { mode = 'due'; return query; }, gt() { mode = 'upcoming'; return query; },
      delete() { action = 'delete'; return query; },
      upsert(rows, opts) { action = 'upsert'; state.writes.push({ rows, opts }); return query; },
      then(resolve, reject) {
        const data = action !== 'select' ? [] : table === 'user_ref_progress' ? state.passed
          : mode === 'due' ? state.due : mode === 'upcoming' ? state.upcoming
            : selected === 'lang, slug' ? state.queued : [];
        return Promise.resolve({ data }).then(resolve, reject);
      },
    };
    return query;
  },
}) }));
vi.mock('@/views/GuestGrammarReview', () => ({ default: function GuestFixture() { return null; } }));
vi.mock('@/views/GrammarReviewSession', () => ({ default: () => null }));
vi.mock('@/content/japanese', () => ({ getReadingTrack: () => null }));
vi.mock('@/content/refLangs', () => {
  const chapters = ['due', 'later', 'candidate'].map((slug, i) => ({
    slug, title: `원본 ${slug}`, level: 'A1', order: i + 1,
    sections: [{ heading: '본문', pattern: 'want', distractors: ['need','like','have'], examples: [{ en: `I want ${slug}.`, ko: '원해요.' }] }],
  }));
  const ref = { base: '/english', name: '영어', langCode: 'en', flag: '', ALL_CHAPTERS: chapters,
    isIntroLevel: () => false, getGrammarChapters: () => chapters,
    getChapter: slug => { const chapter = chapters.find(c => c.slug === slug); return chapter ? { chapter } : null; },
  };
  return { getRefLang: lang => lang === 'English' ? ref : null };
});
vi.mock('@/lib/contentOverrides', async importOriginal => ({
  ...await importOriginal(), getOverridesForLang: async () => state.overrides,
}));
import Page from '../page';
import GuestGrammarReview from '@/views/GuestGrammarReview';

beforeEach(() => {
  state.user = { id: 'learner' }; state.passed = []; state.queued = [];
  state.due = [{ lang: 'English', slug: 'due', interval: 12, ease_factor: 3.5, repetitions: 4, next_review_at: '2026-09-01T00:00:00Z' }];
  state.upcoming = [{ lang: 'English', slug: 'later', next_review_at: '2026-09-20T00:00:00Z' }];
  state.writes = []; state.overrides = new Map([
    ['due', { title: '수정된 오늘 복습', sections: [{ heading: '새 본문', pattern: 'want', distractors: ['need','like','have'], examples: [{ en: 'I want tea.', ko: '차를 원해요.' }] }] }],
    ['later', { title: '수정된 예정 복습' }],
  ]);
});

describe('복습 서버 페이지', () => {
  it('관리자 수정 제목·예문을 실제 복습 props로 전달하고 기존 FSRS 값은 그대로 둔다', async () => {
    const rendered = await Page();
    expect(rendered.props.items[0]).toMatchObject({ title: '수정된 오늘 복습', srs: state.due[0] });
    expect(rendered.props.items[0].quiz.meaning[0]).toMatchObject({ full: 'I want tea.', sourceRef: { quote: 'I want tea.', chapterSlug: 'due' } });
    expect(rendered.props.upcoming[0].title).toBe('수정된 예정 복습');
    expect(state.writes).toEqual([]);
  });
  it('수정 후 퀴즈가 없어진 챕터는 정적 원본 기준으로 백필하지 않는다', async () => {
    state.passed = [{ lang: 'English', slug: 'candidate', check_total: 3 }];
    state.overrides.set('candidate', { sections: [{ heading: '읽기 전용' }] });
    await Page();
    expect(state.writes).toEqual([]);
  });
  it('기존 큐와 온보딩 건너뛰기 기록을 다시 등록하지 않는다', async () => {
    state.passed = [{ lang: 'English', slug: 'due', check_total: 3 }, { lang: 'English', slug: 'candidate', check_total: null }];
    state.queued = [{ lang: 'English', slug: 'due' }];
    await Page();
    expect(state.writes).toEqual([]);
  });
  it('비로그인에서는 원고나 복습 기록을 읽는 단계로 진입하지 않는다', async () => {
    state.user = null;
    const rendered = await Page();
    expect(rendered.type).toBe(GuestGrammarReview);
    expect(state.writes).toEqual([]);
  });
});
