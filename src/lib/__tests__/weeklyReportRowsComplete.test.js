import { beforeEach, describe, expect, it, vi } from 'vitest';

// 계약: 주간 리포트의 review_events는 1000행 상한에 잘리지 않는다(REVIEW-ROWS-CAP-001, 2026-10-17 KST).
// 가짜 client — 서버처럼 한 응답은 1000행에서 자르고, range · order · count를 기록한다.
const h = vi.hoisted(() => ({ events: [], counts: null, calls: [] }));
vi.mock('../supabase', () => {
  const query = (table) => {
    const state = { table, eq: {}, gte: null, lte: null, range: null, order: [], select: null };
    const q = {
      select(cols, opts) { state.select = [cols, opts]; return q; },
      eq(col, v) { state.eq[col] = v; return q; },
      gte(col, v) { state.gte = v; return q; },
      lte(col, v) { state.lte = v; return q; },
      order(col, opts) { state.order.push([col, opts?.ascending]); return q; },
      limit() { return q; },
      range(from, to) { state.range = [from, to]; return q; },
      then(resolve, reject) {
        h.calls.push(state);
        if (table !== 'review_events' || state.eq.source === 'ui') return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        const [from, to] = state.range || [0, 999];
        const count = h.counts ? h.counts.shift() ?? h.events.length : h.events.length;
        return Promise.resolve({ data: h.events.slice(from, Math.min(to, from + 999) + 1), count, error: null }).then(resolve, reject);
      },
    };
    return q;
  };
  return { supabase: { from: query } };
});
const { fetchWeeklyReportRows } = await import('../weeklyReportRows');

const now = Date.now();
const rows = (n) => Array.from({ length: n }, (_, i) => ({
  id: i + 1, source: 'vocab', item_key: `w${i}`, correct: i % 3 !== 0, created_at: new Date(now - (n - i) * 60000).toISOString(),
}));
const eventCalls = () => h.calls.filter((c) => c.table === 'review_events' && c.eq.source !== 'ui');

describe('fetchWeeklyReportRows — review_events 정본 완전 조회', () => {
  beforeEach(() => { h.events = []; h.counts = null; h.calls = []; });

  it('2500행을 1000행 페이지 3번으로 끝까지 읽는다 — 지금 시각 상한 · created_at, id 순', async () => {
    h.events = rows(2500);
    const { events } = await fetchWeeklyReportRows('u1');
    expect(events).toHaveLength(2500);
    const calls = eventCalls();
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(calls[0].select).toEqual(['id, source, item_key, correct, created_at', { count: 'exact' }]);
    expect(calls[0].order).toEqual([['created_at', true], ['id', true]]);
    expect(Date.parse(calls[0].lte)).toBeLessThanOrEqual(Date.now());
    expect(new Set(calls.map((c) => c.lte)).size).toBe(1); // 페이지마다 같은 상한
  });

  it('건수가 바뀌면(읽는 중 행이 늘거나 줄면) 1회 다시 읽는다', async () => {
    h.events = rows(1500);
    h.counts = [1500, 1501]; // 첫 시도: 2쪽에서 건수가 달라짐 → 불완전
    const { events } = await fetchWeeklyReportRows('u1');
    expect(events).toHaveLength(1500);
    expect(eventCalls()).toHaveLength(4); // 2쪽 실패 + 다시 2쪽
  });

  it('다시 읽어도 불완전하면 그 축만 빈 배열 — 다른 축은 그대로', async () => {
    h.events = rows(1500);
    h.counts = [1500, 1501, 1500, 1499];
    const result = await fetchWeeklyReportRows('u1');
    expect(result.events).toEqual([]);
    expect(result).toMatchObject({ vocabRows: [], encounterRows: [], readRows: [] });
    expect(eventCalls()).toHaveLength(4);
  });
});
