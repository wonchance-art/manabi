import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kstDayStartIso } from '../growthStats';

const h = vi.hoisted(() => ({ actor: 'actor-a', slots: [], index: 0, effects: [], cleanups: new Map(),
  client: null, queryClient: null, observer: null, options: null, unsubscribe: null }));
vi.mock('react', async original => ({ ...await original(),
  useState(initial) {
    const index = h.index++;
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[index], value => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
  },
  useEffect(fn, deps) {
    const index = h.index++, old = h.slots[index];
    if (!old || deps.some((value, i) => value !== old[i])) { h.slots[index] = deps; h.effects.push({ index, fn }); }
  },
}));
vi.mock('@tanstack/react-query', async original => ({ ...await original(),
  useQuery(options) {
    h.options = options;
    if (!h.observer) {
      h.observer = new QueryObserver(h.queryClient, options);
      h.unsubscribe = h.observer.subscribe(() => {});
    } else h.observer.setOptions(options);
    return h.observer.getCurrentResult();
  },
}));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: h.actor ? { id: h.actor } : null }) }));
vi.mock('../supabase', () => ({ supabase: { from: (...args) => h.client.from(...args) } }));
import { useOutputWords, fetchTodayReviewRows } from '../useOutputWords';

const BEFORE = Date.parse('2026-10-04T14:59:59.999Z');
const MIDNIGHT = BEFORE + 1;
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const word = (id, at = null) => ({ id, word_text: id, meaning: `뜻 ${id}`, language: 'Chinese', last_reviewed_at: at });
const grade = (id, at) => ({ id: `event-${id}`, source: 'vocab', item_key: id, correct: true, created_at: at, detail: { word_id: id } });
function database({ rows = [], events = [], hold = null } = {}) {
  const calls = [];
  return { calls, from(table) {
    const call = { table }; calls.push(call);
    let ids, since, until;
    const q = {
      select() { return q; }, eq(key, value) { call[key] = value; return q; },
      gte(key, value) { since = [key, value]; call.since = since; return q; },
      lte(key, value) { until = [key, value]; call.until = until; return q; },
      order() { return q; }, in(key, value) { ids = value; return q; }, range() { return q; },
      abortSignal(signal) { call.signal = signal; return q; },
      then(resolve, reject) {
        const response = () => {
          const selected = (table === 'review_events' ? events : rows).filter(row => (!ids || ids.includes(row.id))
            && (!since || Date.parse(row[since[0]]) >= Date.parse(since[1]))
            && (!until || Date.parse(row[until[0]]) <= Date.parse(until[1])));
          return { data: selected, count: selected.length, error: null };
        };
        return (table === 'review_events' && hold ? hold.promise.then(response) : Promise.resolve(response())).then(resolve, reject);
      },
    };
    return q;
  } };
}
function RenderOutputWords() {
  h.index = 0;
  const result = useOutputWords('Chinese');
  for (const { index, fn } of h.effects.splice(0)) { h.cleanups.get(index)?.(); h.cleanups.set(index, fn()); }
  return result;
}
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function seed(actor, at, id = 'yesterday') {
  const data = { actorId: actor, vocabRows: [word(id)], events: [grade(id, new Date(at).toISOString())], allowFallback: false, now: at };
  h.queryClient.setQueryData(['output-words', actor, kstDayStartIso(at)], data);
  return data;
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(BEFORE);
  h.actor = 'actor-a'; h.slots = []; h.index = 0; h.effects = []; h.cleanups = new Map();
  h.observer = null; h.unsubscribe = null;
  h.queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  h.client = database();
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('document', new EventTarget());
});
afterEach(() => {
  for (const cleanup of h.cleanups.values()) cleanup?.();
  h.unsubscribe?.(); h.observer?.destroy(); h.queryClient.clear();
  vi.unstubAllGlobals(); vi.useRealTimers();
});

describe('output word KST day/cache boundary and actor isolation', () => {
  it('does not select yesterday from a fresh five-minute cache whose snapshot now is yesterday', async () => {
    const saved = seed('actor-a', BEFORE);
    expect(RenderOutputWords().map(row => row.id)).toEqual(['yesterday']);
    vi.setSystemTime(MIDNIGHT);
    // 타이머를 실행하지 않아도 다른 렌더는 현재 날짜 key/selector를 사용한다.
    expect(RenderOutputWords()).toEqual([]);
    expect(h.options.queryKey).toEqual(['output-words', 'actor-a', kstDayStartIso(MIDNIGHT)]);
    expect(h.queryClient.getQueryData(['output-words', 'actor-a', kstDayStartIso(BEFORE)])).toEqual(saved);
    await tick(); expect(RenderOutputWords()).toEqual([]);
  });

  it('wakes at KST midnight and opens a new bounded query instead of waiting for staleTime', async () => {
    seed('actor-a', BEFORE);
    h.client = database({ rows: [word('today')], events: [grade('today', new Date(MIDNIGHT).toISOString())] });
    expect(RenderOutputWords().map(row => row.id)).toEqual(['yesterday']);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.slots[0]).toBe(kstDayStartIso(MIDNIGHT));
    RenderOutputWords(); await tick();
    expect(RenderOutputWords().map(row => row.id)).toEqual(['today']);
    const call = h.client.calls.find(value => value.table === 'review_events');
    expect(call.since).toEqual(['created_at', '2026-10-04T15:00:00.000Z']);
    expect(call.until).toEqual(['created_at', '2026-10-04T15:00:00.000Z']);
    expect(h.queryClient.getQueryData(h.options.queryKey).now).toBe(MIDNIGHT);
  });

  it('uses current selector time on a warm current-day cache, without changing the cached snapshot time', () => {
    vi.setSystemTime(MIDNIGHT);
    const contaminated = { actorId: 'actor-a', vocabRows: [word('yesterday', new Date(BEFORE).toISOString())],
      events: [grade('yesterday', new Date(BEFORE).toISOString())], allowFallback: true, now: BEFORE };
    h.queryClient.setQueryData(['output-words', 'actor-a', kstDayStartIso(MIDNIGHT)], contaminated);
    expect(RenderOutputWords()).toEqual([]);
    expect(h.queryClient.getQueryData(h.options.queryKey).now).toBe(BEFORE);
  });

  it('keeps a query snapshot upper bound when the request completes after midnight', async () => {
    const hold = deferred(); h.client = database({ hold, rows: [word('old')], events: [grade('old', new Date(BEFORE).toISOString())] });
    const pending = fetchTodayReviewRows('actor-a', { client: h.client, now: BEFORE });
    vi.setSystemTime(MIDNIGHT + 5000); hold.resolve();
    const data = await pending;
    expect(data.now).toBe(BEFORE);
    expect(h.client.calls[0].until).toEqual(['created_at', new Date(BEFORE).toISOString()]);
  });

  it('cannot show a late previous-actor reply after the query switches accounts', async () => {
    const hold = deferred(); const previous = database({ hold, rows: [word('a')], events: [grade('a', new Date(BEFORE).toISOString())] });
    h.client = previous; RenderOutputWords(); await tick();
    h.actor = 'actor-b'; h.client = database({ rows: [word('b')], events: [grade('b', new Date(BEFORE).toISOString())] });
    expect(RenderOutputWords()).toEqual([]); await tick();
    expect(RenderOutputWords().map(row => row.id)).toEqual(['b']);
    expect(h.options.queryKey[1]).toBe('actor-b');
    expect(h.client.calls.every(call => call.user_id === 'actor-b')).toBe(true);
    hold.resolve(); await tick(); expect(RenderOutputWords().map(row => row.id)).toEqual(['b']);
    expect(previous.calls[0].signal.aborted).toBe(true);
  });

  it('rejects foreign-actor cache data even under the active query key', () => {
    const foreign = seed('actor-a', BEFORE, 'foreign');
    h.actor = 'actor-b'; h.queryClient.setQueryData(['output-words', 'actor-b', kstDayStartIso(BEFORE)], foreign);
    expect(RenderOutputWords()).toEqual([]);
  });

  it('refreshes the day on suspended-tab focus and removes boundary/listener work on unmount', async () => {
    seed('actor-a', BEFORE); RenderOutputWords();
    vi.setSystemTime(MIDNIGHT + 60000); window.dispatchEvent(new Event('focus'));
    expect(h.slots[0]).toBe(kstDayStartIso(MIDNIGHT)); RenderOutputWords(); await tick();
    expect(h.options.queryKey[2]).toBe(kstDayStartIso(MIDNIGHT));
    for (const cleanup of h.cleanups.values()) cleanup?.(); h.cleanups.clear();
    const old = h.slots[0]; vi.setSystemTime(MIDNIGHT + 86400000);
    document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus'));
    expect(h.slots[0]).toBe(old); expect(vi.getTimerCount()).toBe(0);
  });
});
