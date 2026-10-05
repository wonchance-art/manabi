import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { locks as nativeLocks } from 'node:worker_threads';
import { PostgrestClient } from '@supabase/postgrest-js';
import { readCompleteLegacyRows, withLegacyReviewLock, withLegacyReviewOnlineLock } from '../legacyReviewSync';

const remote = vi.hoisted(() => ({ events: vi.fn(), grade: vi.fn(), activity: vi.fn(), enqueue: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../reviewEvents', () => ({ logReviewEvents: remote.events }));
vi.mock('../fsrs', () => ({ persistVocabGrade: remote.grade }));
vi.mock('../streak', () => ({ recordActivity: remote.activity }));
vi.mock('../reviewOutbox', () => ({ enqueueReview: remote.enqueue }));
vi.mock('../fsrsLegacyBoundary', () => ({
  assertCachedLegacyFsrsAllowed: vi.fn(), assertLegacyFsrsAllowed: vi.fn(), isFsrsLegacyWriteError: () => false,
}));
import { recordReviewCompleted } from '../learn/progressStore';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// SQL-like stable order and inclusive ranges; the remote cap can be smaller than the requested page.
function pages(source, { cap = 1000, respond = response => response } = {}) {
  const requests = [], selections = [], filters = [];
  const makeQuery = () => {
    const ordering = [];
    const query = {
      select(columns, options) { selections.push([columns, options]); return query; },
      eq(column, value) { filters.push([column, value]); return query; },
      order(column, options) { ordering.push([column, options]); return query; },
      abortSignal(signal) { query.signal = signal; return query; },
      async range(from, to) {
        requests.push({ from, to, ordering: structuredClone(ordering), signal: query.signal });
        const sorted = [...source].sort((a, b) => {
          for (const [key, { ascending }] of ordering) {
            const left = key === 'id' ? BigInt(a[key]) : a[key];
            const right = key === 'id' ? BigInt(b[key]) : b[key];
            if (left !== right) return (left < right ? -1 : 1) * (ascending ? 1 : -1);
          }
          return 0;
        });
        return respond({ data: sorted.slice(from, Math.min(to + 1, from + cap)), error: null, count: source.length }, requests.length);
      },
    };
    return query.select('id, source, item_key, created_at', { count: 'exact' }).eq('user_id', 'alice');
  };
  return { makeQuery, requests, selections, filters };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { onLine: true });
  remote.events.mockResolvedValue(true);
  remote.grade.mockResolvedValue();
  remote.activity.mockResolvedValue(true);
  remote.enqueue.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllGlobals());

describe('legacy actor lock', () => {
  it('holds a same-actor writer until all its awaited work completes, while another actor proceeds', async () => {
    const started = deferred(), release = deferred(), order = [];
    const first = withLegacyReviewLock('alice', async () => {
      order.push('alice-start'); started.resolve(); await release.promise; order.push('alice-end'); return 7;
    });
    await started.promise;
    const second = withLegacyReviewLock('alice', () => { order.push('alice-second'); return 8; });
    expect(await withLegacyReviewLock('bob', () => { order.push('bob'); return 9; })).toBe(9);
    expect(order).toEqual(['alice-start', 'bob']);
    release.resolve();
    expect(await Promise.all([first, second])).toEqual([7, 8]);
    expect(order).toEqual(['alice-start', 'bob', 'alice-end', 'alice-second']);
  });

  it('releases on a rejected task and preserves its original error for the caller', async () => {
    const error = new Error('response-lost');
    const failing = withLegacyReviewLock('alice', () => { throw error; });
    const next = withLegacyReviewLock('alice', () => 'retry');
    await expect(failing).rejects.toBe(error);
    expect(await next).toBe('retry');
  });

  it('uses one exclusive same-origin Web Lock per actor and returns its task result', async () => {
    const request = vi.fn(async (_name, options, task) => {
      expect(options).toEqual({ mode: 'exclusive' }); return task();
    });
    vi.stubGlobal('navigator', { locks: { request } });
    expect(await withLegacyReviewLock('alice', () => 23)).toBe(23);
    expect(request).toHaveBeenCalledWith('manabi:legacy-review:alice', { mode: 'exclusive' }, expect.any(Function));
    await withLegacyReviewLock('bob', () => {});
    expect(request.mock.calls[1][0]).toBe('manabi:legacy-review:bob');
  });

  it('does not bypass a failed Web Lock request by rerunning the write outside the lock', async () => {
    const denied = new Error('lock-denied'), task = vi.fn();
    const request = vi.fn().mockRejectedValueOnce(denied).mockImplementation(async (_name, _options, work) => work());
    vi.stubGlobal('navigator', { locks: { request } });
    await expect(withLegacyReviewLock('alice', task)).rejects.toBe(denied);
    expect(task).not.toHaveBeenCalled();
    expect(await withLegacyReviewLock('alice', () => 'next')).toBe('next');
  });

  it('rejects missing actors without executing a write', async () => {
    const task = vi.fn();
    await expect(withLegacyReviewLock('', task)).rejects.toThrow('legacy_review_invalid_lock');
    expect(task).not.toHaveBeenCalled();
  });
});

describe('fair shared actor and exclusive online card locks', () => {
  it('holds two different cards simultaneously before either remote response is released', async () => {
    const releases = [deferred(), deferred()], active = new Set();
    const work = ['card-a', 'card-b'].map((key, index) => withLegacyReviewOnlineLock('parallel', key, async () => {
      active.add(key); await releases[index].promise; active.delete(key); return key;
    }));
    try {
      await vi.waitFor(() => expect([...active].sort()).toEqual(['card-a', 'card-b']));
      releases[0].resolve();
      expect(await work[0]).toBe('card-a');
      expect([...active]).toEqual(['card-b']);
      releases[1].resolve();
      expect(await work[1]).toBe('card-b');
    } finally {
      releases.forEach(release => release.resolve()); await Promise.allSettled(work);
    }
  }, 2000);

  it('serializes the same card while a different card enters its own exclusive lock', async () => {
    const firstRelease = deferred(), secondRelease = deferred(), started = [];
    const first = withLegacyReviewOnlineLock('same-card', 'a', async () => {
      started.push('a-first'); await firstRelease.promise;
    });
    const second = withLegacyReviewOnlineLock('same-card', 'a', async () => {
      started.push('a-second'); await secondRelease.promise;
    });
    const other = withLegacyReviewOnlineLock('same-card', 'b', () => { started.push('b'); });
    try {
      await other;
      expect(started).toEqual(['a-first', 'b']);
      firstRelease.resolve(); await first;
      await vi.waitFor(() => expect(started).toEqual(['a-first', 'b', 'a-second']));
      secondRelease.resolve(); await second;
    } finally {
      firstRelease.resolve(); secondRelease.resolve(); await Promise.allSettled([first, second, other]);
    }
  }, 2000);

  it.each(['flush', 'undo'])('%s waits for both online readers and blocks readers queued after it', async operation => {
    const actor = `fair-${operation}`, releases = [deferred(), deferred()], writerRelease = deferred();
    const started = [], work = ['a', 'b'].map((key, index) => withLegacyReviewOnlineLock(actor, key, async () => {
      started.push(key); await releases[index].promise;
    }));
    let writer, late;
    try {
      await vi.waitFor(() => expect(started).toEqual(['a', 'b']));
      writer = withLegacyReviewLock(actor, async () => { started.push(operation); await writerRelease.promise; });
      late = withLegacyReviewOnlineLock(actor, 'c', () => { started.push('late-reader'); });
      await withLegacyReviewLock('fair-probe', () => {});
      expect(started).toEqual(['a', 'b']);
      releases[0].resolve(); await work[0];
      expect(started).toEqual(['a', 'b']);
      releases[1].resolve(); await work[1];
      await vi.waitFor(() => expect(started).toEqual(['a', 'b', operation]));
      writerRelease.resolve(); await writer; await late;
      expect(started).toEqual(['a', 'b', operation, 'late-reader']);
    } finally {
      releases.forEach(release => release.resolve()); writerRelease.resolve();
      await Promise.allSettled([...work, writer, late]);
    }
  }, 2000);

  it('releases both locks on a failed online task and keeps queued writers ahead of later readers', async () => {
    const release = deferred(), error = new Error('online-response-lost'), order = [];
    const failing = withLegacyReviewOnlineLock('failure', 'card', async () => {
      order.push('online'); await release.promise; throw error;
    });
    const caught = failing.catch(reason => reason);
    const writer = withLegacyReviewLock('failure', () => { order.push('writer'); return 'flushed'; });
    const retry = withLegacyReviewOnlineLock('failure', 'card', () => { order.push('retry'); return 'retried'; });
    try {
      await vi.waitFor(() => expect(order).toEqual(['online']));
      release.resolve();
      expect(await caught).toBe(error);
      expect(await writer).toBe('flushed');
      expect(await retry).toBe('retried');
      expect(order).toEqual(['online', 'writer', 'retry']);
    } finally {
      release.resolve(); await Promise.allSettled([caught, writer, retry]);
    }
  }, 2000);

  it('passes shared actor and separate exclusive card modes to Web Locks without reacquiring the actor', async () => {
    const request = vi.fn(async (_name, _options, work) => work());
    vi.stubGlobal('navigator', { locks: { request } });
    expect(await withLegacyReviewOnlineLock('alice', 'card-a', () => 42)).toBe(42);
    await withLegacyReviewLock('alice', () => {});
    await withLegacyReviewLock('alice', () => {}, { mode: 'shared' });
    expect(request.mock.calls.map(([name, options]) => [name, options])).toEqual([
      ['manabi:legacy-review:alice', { mode: 'shared' }],
      ['manabi:legacy-review-card:["alice","card-a"]', { mode: 'exclusive' }],
      ['manabi:legacy-review:alice', { mode: 'exclusive' }],
      ['manabi:legacy-review:alice', { mode: 'shared' }],
    ]);
  });

  it('keeps different cards concurrent and the actor writer waiting with actual Node 24 Web Locks', async () => {
    const calls = [], releases = [deferred(), deferred()], writerRelease = deferred(), started = [];
    vi.stubGlobal('navigator', { locks: { request(name, options, work) {
      calls.push([name, options]); return nativeLocks.request(name, options, work);
    } } });
    const work = ['a', 'b'].map((key, index) => withLegacyReviewOnlineLock('native-real', key, async () => {
      started.push(key); await releases[index].promise;
    }));
    let writer, late;
    try {
      await vi.waitFor(() => expect(started).toEqual(['a', 'b']));
      writer = withLegacyReviewLock('native-real', async () => { started.push('writer'); await writerRelease.promise; });
      late = withLegacyReviewOnlineLock('native-real', 'c', () => { started.push('late'); });
      releases[0].resolve(); await work[0];
      expect(started).toEqual(['a', 'b']);
      releases[1].resolve(); await work[1];
      await vi.waitFor(() => expect(started).toEqual(['a', 'b', 'writer']));
      expect(calls.filter(([name]) => name === 'manabi:legacy-review:native-real').map(([, options]) => options))
        .toEqual([{ mode: 'shared' }, { mode: 'shared' }, { mode: 'exclusive' }]);
      expect(calls.filter(([name]) => name.startsWith('manabi:legacy-review-card:')).map(([, options]) => options))
        .toEqual([{ mode: 'exclusive' }, { mode: 'exclusive' }]);
      writerRelease.resolve(); await writer; await late;
      expect(started).toEqual(['a', 'b', 'writer', 'late']);
    } finally {
      releases.forEach(release => release.resolve()); writerRelease.resolve();
      await Promise.allSettled([...work, writer, late]);
    }
  }, 2000);

  it.each(['actor', 'card'])('does not bypass a denied native %s lock, and releases its queue', async stage => {
    const denied = new Error(`${stage}-lock-denied`), task = vi.fn();
    let rejectNext = true;
    const request = vi.fn(async (name, _options, work) => {
      const isCard = name.startsWith('manabi:legacy-review-card:');
      if (rejectNext && isCard === (stage === 'card')) { rejectNext = false; throw denied; }
      return work();
    });
    vi.stubGlobal('navigator', { locks: { request } });
    await expect(withLegacyReviewOnlineLock('native-failure', 'a', task)).rejects.toBe(denied);
    expect(task).not.toHaveBeenCalled();
    expect(await withLegacyReviewLock('native-failure', () => 'writer')).toBe('writer');
    expect(await withLegacyReviewOnlineLock('native-failure', 'a', () => 'retry')).toBe('retry');
  });

  it('rejects unsupported lock modes and missing card keys without executing a task', async () => {
    const task = vi.fn();
    await expect(withLegacyReviewLock('alice', task, { mode: 'invalid' })).rejects.toThrow('legacy_review_invalid_lock');
    await expect(withLegacyReviewOnlineLock('alice', '', task)).rejects.toThrow('legacy_review_invalid_lock');
    expect(task).not.toHaveBeenCalled();
  });
});

describe('complete legacy history', () => {
  it.each([undefined, 1])('accepts existing full terminal-Promise response shape with count=%s', async count => {
    const rows = [{ source: 'vocab', item_key: 'book', created_at: '2026-10-04T00:00:00Z' }];
    const factory = vi.fn(async () => ({ data: rows, error: null, count }));
    expect(await readCompleteLegacyRows(factory)).toEqual(rows);
    expect(factory).toHaveBeenCalledOnce();
  });

  it('fails closed when a terminal Promise is partial and has no way to request another page', async () => {
    await expect(readCompleteLegacyRows(async () => ({ data: [{ id: 1 }], count: 1001, error: null })))
      .rejects.toThrow('legacy_review_incomplete');
  });

  it.each([1000, 1001])('reads all %s rows through actual stable order and range calls at the 1000-row cap', async total => {
    const source = Array.from({ length: total }, (_, index) => ({ id: index + 1, created_at: 'same-time' })).reverse();
    const f = pages(source);
    const result = await readCompleteLegacyRows(f.makeQuery, { orderBy: ['created_at', 'id'] });
    expect(result.map(row => row.id)).toEqual(Array.from({ length: total }, (_, index) => index + 1));
    expect(f.requests).toEqual((total === 1000 ? [[0, 999]] : [[0, 999], [1000, 1999]])
      .map(([from, to]) => ({ from, to, signal: undefined, ordering: [['created_at', { ascending: true }], ['id', { ascending: true }]] })));
    expect(f.selections.every(([, options]) => options.count === 'exact')).toBe(true);
    expect(f.filters.every(([column, value]) => column === 'user_id' && value === 'alice')).toBe(true);
  });

  it('continues after a shorter capped page and preserves bigint IDs without UUID replacement', async () => {
    const base = 9007199254740993n;
    const source = Array.from({ length: 1001 }, (_, index) => ({ id: String(base + BigInt(index)) })).reverse();
    const f = pages(source, { cap: 1000 });
    const result = await readCompleteLegacyRows(f.makeQuery, { pageSize: 2000 });
    expect(result).toHaveLength(1001);
    expect(result[0].id).toBe(String(base));
    expect(result[1000].id).toBe(String(base + 1000n));
    expect(f.requests.map(({ from, to }) => [from, to])).toEqual([[0, 1999], [1000, 2999]]);
    expect(source.every(row => /^\d+$/.test(row.id))).toBe(true);
  });

  it.each([1000, 1001])('uses installed PostgREST query serialization and exact-count parsing for %s capped rows', async total => {
    const source = Array.from({ length: total }, (_, index) => ({
      id: index + 1, created_at: '2026-10-05T00:00:00Z', source: 'vocab', item_key: `word-${index}`,
    })).reverse();
    const requests = [];
    const client = new PostgrestClient('https://legacy-fixture.invalid/rest/v1', { fetch: async (input, options) => {
      const url = new URL(input), headers = new Headers(options.headers);
      expect(url.pathname).toBe('/rest/v1/review_events');
      expect(url.searchParams.get('user_id')).toBe('eq.alice');
      expect(url.searchParams.get('order')).toBe('created_at.asc,id.asc');
      expect(headers.get('Prefer')).toContain('count=exact');
      const from = Number(url.searchParams.get('offset') || 0), requested = Number(url.searchParams.get('limit'));
      requests.push([from, requested]);
      const ordered = [...source].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
      const data = ordered.slice(from, from + Math.min(requested, 1000));
      return new Response(JSON.stringify(data), { status: 200, headers: {
        'Content-Type': 'application/json', 'Content-Range': `${from}-${from + data.length - 1}/${total}`,
      } });
    } });
    const rows = await readCompleteLegacyRows(() => client.from('review_events')
      .select('id, source, item_key, created_at', { count: 'exact' }).eq('user_id', 'alice'),
    { orderBy: ['created_at', 'id'] });
    expect(rows.map(row => row.id)).toEqual(Array.from({ length: total }, (_, index) => index + 1));
    expect(requests).toEqual(total === 1000 ? [[0, 1000]] : [[0, 1000], [1000, 1000]]);
  });

  it.each(['count-drift', 'empty-page', 'duplicate-page', 'query-error', 'missing-count', 'missing-id', 'overflow'])(
    'rejects %s instead of returning partial history', async fault => {
      const error = new Error('page-two-unavailable');
      const f = pages([{ id: 1 }, { id: 2 }, { id: 3 }], { cap: 2, respond(response, page) {
        if (page !== 2) return response;
        if (fault === 'count-drift') return { ...response, count: 4 };
        if (fault === 'empty-page') return { ...response, data: [] };
        if (fault === 'duplicate-page') return { ...response, data: [{ id: 2 }] };
        if (fault === 'query-error') return { ...response, error };
        if (fault === 'missing-count') return { ...response, count: null };
        if (fault === 'missing-id') return { ...response, data: [{}] };
        return { ...response, data: [{ id: 3 }, { id: 4 }] };
      } });
      await expect(readCompleteLegacyRows(f.makeQuery)).rejects.toBeInstanceOf(Error);
      expect(f.requests).toHaveLength(2);
    },
  );

  it('returns an exact empty result but rejects malformed or explicitly partial data', async () => {
    const f = pages([]);
    expect(await readCompleteLegacyRows(f.makeQuery)).toEqual([]);
    await expect(readCompleteLegacyRows(async () => ({ data: null, count: 0 }))).rejects.toThrow('legacy_review_incomplete');
    await expect(readCompleteLegacyRows(async () => ({ data: [], complete: false }))).rejects.toThrow('legacy_review_incomplete');
  });

  it('propagates cancellation both before the request and after a response without returning success', async () => {
    const before = new AbortController(), factory = vi.fn(); before.abort();
    await expect(readCompleteLegacyRows(factory, { signal: before.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(factory).not.toHaveBeenCalled();
    const during = new AbortController();
    const f = pages([{ id: 1 }], { respond(response) { during.abort(); return response; } });
    await expect(readCompleteLegacyRows(f.makeQuery, { signal: during.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.requests[0].signal).toBe(during.signal);
  });
});

describe('online progress shares the legacy flush/undo lock', () => {
  const ref = { type: 'vocab', itemKey: 'book', lang: 'Japanese', correct: true, detail: { word_id: 'word', rating: 3 } };
  const stats = { interval: 1, repetitions: 1, ease_factor: 2.5, next_review_at: '2026-10-06T00:00:00Z' };

  it('keeps online event, SRS and activity inside the lock before a same-actor undo/flush may start', async () => {
    const grading = deferred(), release = deferred(), order = [];
    remote.events.mockImplementation(async () => { order.push('event'); });
    remote.grade.mockImplementation(async () => { order.push('grade-start'); grading.resolve(); await release.promise; order.push('grade-end'); });
    remote.activity.mockImplementation(async () => { order.push('activity'); });
    const online = recordReviewCompleted('alice', ref, stats);
    await grading.promise;
    const undoOrFlush = withLegacyReviewLock('alice', () => { order.push('undo-or-flush'); });
    await withLegacyReviewLock('bob', () => {});
    expect(order).toEqual(['event', 'grade-start']);
    release.resolve();
    const result = await online; await undoOrFlush;
    expect(result).toMatchObject({ ok: true, reviewedAt: expect.any(String) });
    expect(order).toEqual(['event', 'grade-start', 'grade-end', 'activity', 'undo-or-flush']);
    expect(remote.events.mock.calls[0][1][0].created_at).toBe(result.reviewedAt);
    expect(remote.grade.mock.calls[0][3]).toBe(result.reviewedAt);
    expect(remote.events.mock.calls[0][1][0]).not.toHaveProperty('id');
  });

  it('waits for an existing flush/undo actor lock before inserting an online event', async () => {
    const started = deferred(), release = deferred();
    const flushOrUndo = withLegacyReviewLock('alice', async () => { started.resolve(); await release.promise; });
    await started.promise;
    const online = recordReviewCompleted('alice', ref, stats);
    await withLegacyReviewLock('bob', () => {});
    expect(remote.events).not.toHaveBeenCalled();
    release.resolve(); await flushOrUndo;
    expect(await online).toMatchObject({ ok: true });
  });

  it('releases online lock before fallback enqueue reacquires it, retaining the original event time', async () => {
    remote.grade.mockImplementationOnce(async () => {
      // 이벤트가 반영된 뒤 연결이 끊겨도 명시적 offline 무전송으로 재분류하지 않는다.
      navigator.onLine = false;
      throw new Error('SRS-response-lost');
    });
    remote.enqueue.mockImplementation(entry => withLegacyReviewLock(entry.userId, () => true));
    const result = await recordReviewCompleted('alice', ref, stats);
    expect(result).toMatchObject({ ok: true, queued: true });
    expect(remote.enqueue).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      userId: 'alice', reviewedAt: result.reviewedAt, nextStats: stats, remoteAttempted: true,
    }));
    expect(remote.events.mock.calls[0][1][0].created_at).toBe(result.reviewedAt);
    expect(remote.activity).not.toHaveBeenCalled();
    expect(await withLegacyReviewLock('alice', () => 'undo-can-continue')).toBe('undo-can-continue');
  }, 2000);

  it('does not wrap explicit offline enqueue with a second actor lock', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    remote.enqueue.mockImplementation(entry => withLegacyReviewLock(entry.userId, () => true));
    const result = await recordReviewCompleted('alice', ref, stats);
    expect(result).toMatchObject({ ok: true, queued: true });
    expect(remote.enqueue).toHaveBeenCalledExactlyOnceWith({
      userId: 'alice', source: ref.type, itemKey: ref.itemKey, lang: ref.lang, correct: ref.correct,
      detail: ref.detail, nextStats: stats, reviewedAt: result.reviewedAt, remoteAttempted: false,
    });
    expect(remote.events).not.toHaveBeenCalled();
    expect(remote.grade).not.toHaveBeenCalled();
    expect(remote.activity).not.toHaveBeenCalled();
  }, 2000);

  it('marks a lost event response as attempted even when navigator becomes offline before fallback enqueue', async () => {
    remote.events.mockImplementationOnce(async () => {
      navigator.onLine = false;
      throw new Error('event-response-lost');
    });
    const result = await recordReviewCompleted('alice', ref, stats);
    expect(result).toMatchObject({ ok: true, queued: true });
    expect(remote.enqueue).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      userId: 'alice', source: 'vocab', itemKey: ref.itemKey, detail: ref.detail,
      nextStats: stats, reviewedAt: result.reviewedAt, remoteAttempted: true,
    }));
    expect(remote.events.mock.calls[0][1][0].created_at).toBe(result.reviewedAt);
    expect(remote.grade).not.toHaveBeenCalled();
    expect(remote.activity).not.toHaveBeenCalled();
  });

  it('retains a grammar source and no word ID while marking only explicit offline intent as unattempted', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const grammar = { type: 'grammar', itemKey: 'grammar-lesson', lang: 'Japanese', correct: false,
      detail: { qtype: 'grammar', rating: 1 } };
    const result = await recordReviewCompleted('alice', grammar);
    expect(result).toMatchObject({ ok: true, queued: true });
    expect(remote.enqueue).toHaveBeenCalledExactlyOnceWith({
      userId: 'alice', source: 'grammar', itemKey: grammar.itemKey, lang: grammar.lang, correct: false,
      detail: grammar.detail, nextStats: null, reviewedAt: result.reviewedAt, remoteAttempted: false,
    });
    expect(remote.enqueue.mock.calls[0][0].detail).not.toHaveProperty('word_id');
    expect(remote.events).not.toHaveBeenCalled();
    expect(remote.grade).not.toHaveBeenCalled();
  });
});

describe('online progress independent-card response regression', () => {
  const stats = { interval: 1, repetitions: 1, ease_factor: 2.5, next_review_at: '2026-10-06T00:00:00Z' };
  const ref = wordId => ({ type: 'vocab', itemKey: wordId, lang: 'Japanese', correct: true,
    detail: { word_id: wordId, rating: 3 } });

  it('sends the second different-card event while the first real progress call is awaiting its response', async () => {
    const releases = [deferred(), deferred()], started = [];
    remote.events.mockImplementation(async (_actor, events) => {
      const index = started.length; started.push(events[0].detail.word_id); await releases[index].promise;
    });
    const first = recordReviewCompleted('progress-parallel', ref('word-a'), stats);
    let second;
    try {
      await vi.waitFor(() => expect(started).toEqual(['word-a']));
      second = recordReviewCompleted('progress-parallel', ref('word-b'), stats);
      await vi.waitFor(() => expect(started).toEqual(['word-a', 'word-b']));
      expect(remote.grade).not.toHaveBeenCalled();
      releases[1].resolve();
      expect(await second).toMatchObject({ ok: true });
      expect(remote.grade).toHaveBeenCalledExactlyOnceWith({}, 'word-b', stats, expect.any(String));
      releases[0].resolve();
      expect(await first).toMatchObject({ ok: true });
      expect(remote.events).toHaveBeenCalledTimes(2);
      expect(remote.grade).toHaveBeenCalledTimes(2);
      expect(remote.enqueue).not.toHaveBeenCalled();
    } finally {
      releases.forEach(release => release.resolve()); await Promise.allSettled([first, second]);
    }
  }, 2000);

  it('serializes aliases with the same word_id even when their displayed item and language differ', async () => {
    const release = deferred(), started = [];
    remote.events.mockImplementation(async (_actor, events) => {
      started.push(events[0].item_key); if (started.length === 1) await release.promise;
    });
    const first = recordReviewCompleted('progress-same', ref('word'), stats);
    let second;
    try {
      await vi.waitFor(() => expect(started).toEqual(['word']));
      second = recordReviewCompleted('progress-same', { ...ref('word'), itemKey: 'alias', lang: 'English' }, stats);
      await withLegacyReviewLock('progress-probe', () => {});
      expect(started).toEqual(['word']);
      release.resolve();
      expect(await first).toMatchObject({ ok: true });
      expect(await second).toMatchObject({ ok: true });
      expect(started).toEqual(['word', 'alias']);
    } finally {
      release.resolve(); await Promise.allSettled([first, second]);
    }
  }, 2000);
});
