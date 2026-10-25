// PERF P8(2026-10-26 KST) — /review/grammar 서버 조립: 오늘 복습(due 10) · 예정(30) 읽기를 백필 읽기와 함께 시작하고,
// 백필이 쓰기를 보냈을 때만 쓰기 뒤에 두 읽기를 같은 기준 시각으로 다시 한다. 결과(세션 props)는 직렬일 때와 같아야 한다.
// 메모리 grammar_review 표 하나로 실제 필터(lte · gt · 정렬 · limit · ignoreDuplicates upsert)를 흉내 내고, 시작 · 끝 순서를 기록한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DAY = 86400000;
const db = vi.hoisted(() => ({ user: { id: 'learner' }, passed: [], table: [], events: [], reads: [], writes: [], delay: { passed: 20, upsert: 20 } }));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({
  auth: { getUser: async () => ({ data: { user: db.user } }) },
  from(table) {
    let selected = '', action = 'select', lte = null, gt = null, limit = Infinity, upserted = null;
    const query = {
      select(fields) { selected = fields; return query; }, eq() { return query; }, order() { return query; },
      limit(n) { limit = n; return query; },
      lte(_, value) { lte = value; return query; }, gt(_, value) { gt = value; return query; },
      delete() { action = 'delete'; return query; },
      upsert(rows, opts) { action = 'upsert'; upserted = { rows, opts }; return query; },
      then(resolve, reject) {
        const run = async () => {
          if (action === 'delete') return { data: [] };
          if (action === 'upsert') {
            db.events.push('start:upsert'); db.writes.push(upserted);
            await wait(db.delay.upsert);
            for (const row of upserted.rows) if (!db.table.some(r => r.lang === row.lang && r.slug === row.slug)) db.table.push({ ...row });
            db.events.push('end:upsert');
            return { data: null };
          }
          if (table === 'user_ref_progress') {
            db.events.push('start:passed'); await wait(db.delay.passed); db.events.push('end:passed');
            return { data: db.passed };
          }
          if (lte === null && gt === null) return { data: db.table.map(({ lang, slug }) => ({ lang, slug })) };
          const kind = lte !== null ? 'due' : 'upcoming';
          db.events.push(`start:${kind}`); db.reads.push({ kind, at: lte ?? gt });
          const rows = db.table.filter(r => (lte !== null ? r.next_review_at <= lte : r.next_review_at > gt))
            .sort((a, b) => a.next_review_at.localeCompare(b.next_review_at)).slice(0, limit)
            .map(r => (selected === '*' ? { ...r } : { lang: r.lang, slug: r.slug, next_review_at: r.next_review_at }));
          await wait(1);
          db.events.push(`end:${kind}`);
          return { data: rows };
        };
        return run().then(resolve, reject);
      },
    };
    return query;
  },
}) }));
vi.mock('@/views/GuestGrammarReview', () => ({ default: () => null }));
vi.mock('@/views/GrammarReviewSession', () => ({ default: () => null }));
vi.mock('@/content/japanese', () => ({ getReadingTrack: () => null }));
vi.mock('@/content/refLangs', () => {
  const slugs = ['due', 'later', ...Array.from({ length: 11 }, (_, i) => `c${String(i + 1).padStart(2, '0')}`)];
  const chapters = slugs.map((slug, i) => ({
    slug, title: `원본 ${slug}`, level: 'A1', order: i + 1,
    sections: [{ heading: '본문', pattern: 'want', distractors: ['need', 'like', 'have'], examples: [{ en: `I want ${slug}.`, ko: '원해요.' }] }],
  }));
  const ref = { base: '/english', name: '영어', langCode: 'en', ALL_CHAPTERS: chapters,
    isIntroLevel: () => false, getGrammarChapters: () => chapters,
    getChapter: slug => { const chapter = chapters.find(c => c.slug === slug); return chapter ? { chapter } : null; },
  };
  return { getRefLang: lang => (lang === 'English' ? ref : null) };
});
vi.mock('@/lib/contentOverrides', async importOriginal => ({ ...await importOriginal(), getOverridesForLang: async () => new Map() }));
import Page from '../page';

const iso = (offset) => new Date(Date.now() + offset).toISOString();
const row = (slug, next_review_at) => ({ user_id: 'learner', lang: 'English', slug, interval: 3, ease_factor: 2.5, repetitions: 2, next_review_at });

beforeEach(() => {
  db.user = { id: 'learner' }; db.events = []; db.reads = []; db.writes = [];
  db.table = [row('due', iso(-DAY)), row('later', iso(30 * DAY))];
  db.passed = [];
});

describe('문법 복습 서버 조립 — due · 예정 읽기를 백필 읽기와 나란히', () => {
  it('백필할 것이 없으면 due · 예정은 한 번씩, 통과 기록 읽기가 끝나기 전에 시작하고 결과는 그대로', async () => {
    db.passed = [{ lang: 'English', slug: 'due', check_total: 3, updated_at: iso(-2 * DAY) }]; // 이미 큐에 있다 → 쓰기 0
    const rendered = await Page();
    expect(db.writes).toEqual([]);
    expect(db.reads.map(r => r.kind).sort()).toEqual(['due', 'upcoming']);
    expect(db.events.indexOf('start:due')).toBeLessThan(db.events.indexOf('end:passed'));
    expect(db.events.indexOf('start:upcoming')).toBeLessThan(db.events.indexOf('end:passed'));
    expect(db.reads[0].at).toBe(db.reads[1].at); // 같은 기준 시각
    expect(rendered.props.items.map(i => i.srs.slug)).toEqual(['due']);
    expect(rendered.props.items[0].srs).toMatchObject({ interval: 3, ease_factor: 2.5, repetitions: 2 });
    expect(rendered.props.upcoming.map(u => u.title)).toEqual(['원본 later']);
  });

  it('백필이 쓰면 쓰기가 끝난 뒤 due · 예정을 같은 기준 시각으로 다시 읽어, 직렬일 때와 같은 결과(오늘 묶음 · 다음 날 묶음)', async () => {
    db.passed = Array.from({ length: 11 }, (_, i) => ({ lang: 'English', slug: `c${String(i + 1).padStart(2, '0')}`, check_total: 3, updated_at: iso(-(20 - i) * DAY) }));
    const rendered = await Page();
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0].rows).toHaveLength(11);
    const after = db.events.indexOf('end:upsert');
    const late = db.reads.slice(2);
    expect(late.map(r => r.kind).sort()).toEqual(['due', 'upcoming']);
    expect(late[0].at).toBe(late[1].at);
    expect(db.events.lastIndexOf('start:due')).toBeGreaterThan(after);
    expect(db.events.lastIndexOf('start:upcoming')).toBeGreaterThan(after);
    // 직렬 기준: 기존 due 1 + 오늘 백필 10 중 앞선 9(limit 10 — c10은 due지만 잘림), 예정은 다음 날 백필(c11) → 기존 later
    expect(rendered.props.items.map(i => i.srs.slug)).toEqual(['due', 'c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09']);
    expect(rendered.props.upcoming.map(u => u.title)).toEqual(['원본 c11', '원본 later']);
  });

  it('쓰기가 실패해도(예외) 다시 읽는다 — 일부가 들어갔을 수 있다', async () => {
    db.passed = [{ lang: 'English', slug: 'c01', check_total: 3, updated_at: iso(-DAY) }];
    db.delay.upsert = 5;
    const original = db.table.push;
    db.table.push = function push(...rows) { original.apply(this, rows); throw new Error('network'); };
    try {
      const rendered = await Page();
      expect(db.reads.filter(r => r.kind === 'due')).toHaveLength(2);
      expect(rendered.props.items.map(i => i.srs.slug)).toEqual(['due', 'c01']);
    } finally { db.table.push = original; db.delay.upsert = 20; }
  });
});
