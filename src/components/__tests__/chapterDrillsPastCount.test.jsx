import { describe, expect, it, vi } from 'vitest';

// 렌더 테스트(훅 대역 — DOM 없음): 챕터 드릴의 지난 풀이 수는 행이 아니라 건수(head)로 센다(REVIEW-ROWS-CAP-001, 2026-10-17 KST).
// 행으로 받던 때는 1000행 상한에 잘려 「n회 풀이」가 1000에서 멈췄다.
const h = vi.hoisted(() => ({ slots: [], index: 0, effects: [], calls: [], counts: { all: 1500, right: 1200 } }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useState(initial) { const i = h.index++; if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial; return [h.slots[i], (v) => { h.slots[i] = typeof v === 'function' ? v(h.slots[i]) : v; }]; },
    useRef(initial) { const i = h.index++; if (!(i in h.slots)) h.slots[i] = { current: initial }; return h.slots[i]; },
    useMemo(fn) { h.index++; return fn(); },
    useId() { return 'id'; },
    useEffect(fn) { h.index++; h.effects.push(fn); },
  };
});
vi.mock('next/navigation', () => ({ usePathname: () => '/japanese/ref/n5-01' }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../world/vocabEncounterSync', () => ({ syncVocabEncounters: () => Promise.resolve() }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from(table) {
      const s = { table, select: null, eq: {}, in: null, lte: null, limit: null, range: null };
      const q = {
        select(cols, opts) { s.select = [cols, opts]; return q; },
        eq(c, v) { s.eq[c] = v; return q; },
        in(c, v) { s.in = [c, v]; return q; },
        lte(c, v) { s.lte = v; return q; },
        limit(n) { s.limit = n; return q; },
        range(a, b) { s.range = [a, b]; return q; },
        then(resolve, reject) {
          h.calls.push(s);
          const count = s.eq.correct === true ? h.counts.right : h.counts.all;
          return Promise.resolve({ data: null, count, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  },
}));
const { default: ChapterDrills } = await import('../ChapterDrills');

async function mount(drills) {
  h.slots = []; h.index = 0; h.effects = []; h.calls = [];
  ChapterDrills({ lang: 'Japanese', drills, title: '연습' });
  for (const fn of h.effects) fn();
  await new Promise((r) => setTimeout(r, 0));
  h.index = 0; h.effects = [];
  return ChapterDrills({ lang: 'Japanese', drills, title: '연습' });
}
const text = (node) => (node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children));

describe('챕터 드릴 — 지난 풀이 수', () => {
  it('1000행을 넘는 기록도 건수 그대로 — 전체 · 정답 두 번, 같은 시각 상한, 행은 받지 않는다', async () => {
    const tree = await mount([{ id: 'n5-01-d1' }, { id: 'n5-01-d2' }]);
    expect(text(tree)).toContain('지금까지 이 챕터 드릴 1500회 풀이 · 정답 1200회 (80%)');
    const events = h.calls.filter((c) => c.table === 'review_events');
    expect(events).toHaveLength(2);
    for (const c of events) {
      expect(c.select).toEqual(['id', { count: 'exact', head: true }]);
      expect(c.in).toEqual(['item_key', ['n5-01-d1', 'n5-01-d2']]);
      expect(c.eq.source).toBeUndefined(); // source 태그는 시기별로 달라 거르지 않는다
      expect(c.limit).toBeNull();
    }
    expect(events.map((c) => c.eq.correct)).toEqual([undefined, true]);
    expect(events[0].lte).toBe(events[1].lte);
  });

  it('기록이 0건이면 서버 값으로 덮지 않는다', async () => {
    h.counts = { all: 0, right: 0 };
    const tree = await mount([{ id: 'x' }]);
    expect(text(tree)).not.toContain('회 풀이');
    h.counts = { all: 1500, right: 1200 };
  });
});
