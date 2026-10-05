import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../offlineCache', () => ({ openDb: storage.open, STORE_OUTBOX: 'outbox' }));
vi.mock('../vocabularyExclusion', () => ({
  loadVocabularyExclusions: async () => [], findVocabularyExclusion: () => null,
  exclusionKey: (language, word) => `${language}:${word}`,
}));
import { enqueueReview, pendingReviews, flushReviews, undoQueuedReview,
  removeOutboxEntry, LEGACY_REVIEW_UNDO_KIND, dedupeEntries } from '../reviewOutbox';

const T = '2026-10-05T01:00:00.000Z';
const PREV = { interval: 1, ease_factor: 2.5, repetitions: 2,
  next_review_at: '2026-10-05T00:00:00.000Z', last_reviewed_at: '2026-10-03T01:00:00.000Z' };
const grade = (extra = {}) => ({ seq: 1, userId: 'A', source: 'vocab', itemKey: '词', lang: 'Chinese',
  reviewedAt: T, correct: true, detail: { word_id: 'card', rating: 3 },
  nextStats: { interval: 4, ease_factor: 2, repetitions: 3, next_review_at: '2026-10-09T01:00:00.000Z' }, ...extra });
const request = (extra = {}) => ({ userId: 'A', itemKey: '词', reviewedAt: T,
  wordId: 'card', lang: 'Chinese', rating: 3, prev: PREV, ...extra });
const originalEvent = () => ({ id: '9007199254741001', user_id: 'A', lang: 'Chinese', source: 'vocab',
  item_key: '词', correct: true, created_at: T, detail: { word_id: 'card', rating: 3 } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

// Request success happens before commit; abort rolls back the transaction's entire working copy.
function memoryDb(initial = []) {
  const state = { rows: structuredClone(initial), abortAdd: false, abortSettlement: false, readError: false, writes: [] };
  let seq = Math.max(0, ...initial.map(row => row.seq || 0)) + 1;
  state.db = { transaction() {
    const working = structuredClone(state.rows);
    let pending = 0, aborted = false, completeQueued = false;
    const tx = { abort() { if (aborted) return; aborted = true; queueMicrotask(() => tx.onabort?.()); } };
    const finish = () => {
      if (pending || aborted || completeQueued) return;
      completeQueued = true;
      queueMicrotask(() => {
        completeQueued = false;
        if (pending || aborted) return;
        state.rows = working;
        tx.oncomplete?.();
      });
    };
    const operation = (kind, row, task) => {
      const req = {}; pending += 1;
      queueMicrotask(() => {
        if (aborted) return;
        if (kind === 'read' && state.readError) {
          req.error = new Error('outbox-read-failed'); req.onerror?.(); tx.abort(); return;
        }
        req.result = task(); pending -= 1;
        req.onsuccess?.();
        if (kind === 'add' && state.abortAdd) { state.abortAdd = false; tx.abort(); }
        if (kind === 'put' && row.status === 'settled' && state.abortSettlement) {
          state.abortSettlement = false; tx.abort();
        }
        finish();
      });
      return req;
    };
    tx.objectStore = () => ({
      getAll: () => operation('read', null, () => structuredClone(working)),
      add: row => operation('add', row, () => { const next = { ...structuredClone(row), seq: seq++ };
        working.push(next); state.writes.push(['add-success', next]); return next.seq; }),
      put: row => operation('put', row, () => { const index = working.findIndex(e => e.seq === row.seq);
        working[index] = structuredClone(row); state.writes.push(['put-success', row]); return row.seq; }),
      delete: id => operation('delete', null, () => { const index = working.findIndex(e => e.seq === id);
        if (index >= 0) working.splice(index, 1); }),
    });
    return tx;
  } };
  storage.open.mockResolvedValue(state.db);
  return state;
}

function remote({ events = [], word = { id: 'card', user_id: 'A', ...PREV }, cap = 1000 } = {}) {
  const state = { events: structuredClone(events), words: word ? [structuredClone(word)] : [],
    inserts: [], updates: [], reads: [], historyError: false, lostMarker: false, lostUpdate: false,
    drift: false, beforeInsert: null, beforeUpdate: null };
  let nextId = 9007199254742000n;
  const client = { rpc: async () => ({ data: { version: 1, actorId: 'A', enrolled: false }, error: null }),
    from(table) {
      const filters = [], order = []; let mode = 'read', payload, bounds;
      const run = async () => {
        if (mode === 'insert') {
          if (state.beforeInsert) await state.beforeInsert(payload);
          state.inserts.push(structuredClone(payload));
          for (const row of payload) state.events.push({ ...structuredClone(row), id: String(nextId++) });
          if (state.lostMarker && payload.some(row => row.source === 'ui')) {
            state.lostMarker = false; return { error: new Error('lost marker response') };
          }
          return { error: null };
        }
        if (mode === 'update') {
          if (state.beforeUpdate) await state.beforeUpdate();
          const matches = state.words.filter(row => filters.every(fn => fn(row)));
          state.updates.push({ payload: structuredClone(payload), matched: matches.length });
          matches.forEach(row => Object.assign(row, structuredClone(payload)));
          if (state.lostUpdate) { state.lostUpdate = false; return { error: new Error('lost update response') }; }
          return { error: null };
        }
        if (table === 'review_events' && state.historyError) return { error: new Error('history offline') };
        const rows = (table === 'review_events' ? state.events : state.words)
          .filter(row => filters.every(fn => fn(row))).map(row => structuredClone(row));
        rows.sort((a, b) => { for (const key of order) {
          if (a[key] === b[key]) continue;
          if (key === 'id' && /^\d+$/.test(a.id) && /^\d+$/.test(b.id)) return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
          return a[key] < b[key] ? -1 : 1;
        } return 0; });
        const offset = bounds?.[0] || 0;
        state.reads.push({ table, offset, order: [...order] });
        return { data: rows.slice(offset, Math.min(bounds?.[1] + 1 || rows.length, offset + cap)),
          count: rows.length + (state.drift && offset > 0 ? 1 : 0), error: null };
      };
      const query = { select: () => query,
        eq(key, value) { filters.push(row => key === 'last_reviewed_at'
          ? Date.parse(row[key]) === Date.parse(value) : row[key] === value); return query; },
        gte(key, value) { filters.push(row => Date.parse(row[key]) >= Date.parse(value)); return query; },
        lte(key, value) { filters.push(row => Date.parse(row[key]) <= Date.parse(value)); return query; },
        in(key, values) { filters.push(row => values.includes(row[key])); return query; },
        order(key) { order.push(key); return query; }, range(from, to) { bounds = [from, to]; return query; },
        insert(rows) { mode = 'insert'; payload = rows; return query; },
        update(value) { mode = 'update'; payload = value; return query; },
        then(resolve, reject) { return run().then(resolve, reject); },
      };
      return query;
    },
  };
  const persist = async (_client, id, stats, reviewedAt) => {
    const row = state.words.find(row => row.id === id);
    if (row) Object.assign(row, structuredClone(stats), { last_reviewed_at: reviewedAt });
  };
  return { client, state, persist };
}

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('navigator', { onLine: true }); });
afterEach(() => vi.unstubAllGlobals());

describe('durable legacy undo and shared transmission', () => {
  it('waits for in-flight flush then compensates its committed grade instead of deleting a copied original', async () => {
    const db = memoryDb([grade()]), f = remote(); const entered = deferred(), release = deferred();
    f.state.beforeInsert = async rows => { if (rows[0].source === 'vocab') { entered.resolve(); await release.promise; } };
    const flushing = flushReviews(f.client, 'A', { persist: f.persist });
    await entered.promise;
    const undoing = undoQueuedReview(f.client, request());
    await Promise.resolve(); expect(db.rows.some(row => row.kind === LEGACY_REVIEW_UNDO_KIND)).toBe(false);
    release.resolve(); await flushing;
    expect(await undoing).toEqual({ ok: true, queued: false, status: 'settled', compensated: true });
    expect(f.state.words[0]).toMatchObject(PREV);
    expect(f.state.events.map(row => row.source)).toEqual(['vocab', 'ui']);
    expect(db.rows.filter(row => row.kind === LEGACY_REVIEW_UNDO_KIND)).toHaveLength(1);
    expect(await flushReviews(f.client, 'A', { persist: f.persist })).toEqual({ sent: 0, kept: 0, applied: 0 });
    expect(f.state.events).toHaveLength(2);
  });

  it('cancels an original after event-only partial success and retains the exact original in the tombstone', async () => {
    const e = grade(), db = memoryDb([e]), f = remote();
    await flushReviews(f.client, 'A', { persist: async () => { throw new Error('schedule offline'); } });
    expect(db.rows[0].remoteAttempted).toBe(true); expect(f.state.events).toHaveLength(1);
    await undoQueuedReview(f.client, request());
    expect(f.state.events.map(row => row.source)).toEqual(['vocab', 'ui']);
    const intent = db.rows.find(row => row.kind === LEGACY_REVIEW_UNDO_KIND);
    expect(intent.originals[0]).toMatchObject(e); expect(intent.status).toBe('settled');
    expect(await enqueueReview(e)).toBe(false);
    expect(db.rows).toHaveLength(1);
  });

  it('commits cancellation before network and never flushes a canceled grade while compensation is offline', async () => {
    const db = memoryDb([grade()]), f = remote(); f.state.historyError = true;
    await expect(undoQueuedReview(f.client, request())).rejects.toThrow('history offline');
    expect(db.rows.some(row => row.kind === LEGACY_REVIEW_UNDO_KIND && row.status === 'pending')).toBe(true);
    expect(await flushReviews(f.client, 'A', { persist: f.persist })).toEqual({ sent: 0, kept: 1, applied: 0 });
    expect(f.state.inserts).toHaveLength(0);
    f.state.historyError = false;
    expect(await flushReviews(f.client, 'A', { persist: f.persist })).toEqual({ sent: 1, kept: 0, applied: 0 });
    expect(f.state.inserts).toHaveLength(0); expect(db.rows).toHaveLength(1);
    expect(db.rows[0].status).toBe('settled');
  });

  it('does not claim cancellation when add succeeds but the transaction aborts', async () => {
    const e = grade(), db = memoryDb([e]), f = remote(); db.abortAdd = true;
    await expect(undoQueuedReview(f.client, request())).rejects.toThrow('aborted');
    expect(db.rows).toEqual([e]); expect(f.state.reads).toHaveLength(0); expect(f.state.inserts).toHaveLength(0);
  });

  it('full snapshot undo settles locally while offline only with explicit never-attempted originals', async () => {
    const e = grade({ remoteAttempted: false }), db = memoryDb([e]), f = remote();
    f.client.rpc = vi.fn(async () => { throw new Error('offline: must not call'); });
    vi.stubGlobal('navigator', { onLine: false });
    expect(await undoQueuedReview(f.client, request())).toEqual({ ok: true, queued: false, status: 'settled', compensated: false });
    expect(f.client.rpc).not.toHaveBeenCalled(); expect(f.state.reads).toHaveLength(0);
    expect(db.rows).toHaveLength(1); expect(db.rows[0].originals).toEqual([e]);
    expect(await enqueueReview(e)).toBe(false);
  });

  it('replays a lost marker response without duplicating the marker or overwriting the restored schedule', async () => {
    const db = memoryDb([grade()]), f = remote({ events: [originalEvent()], word: { id: 'card', user_id: 'A', ...grade().nextStats, last_reviewed_at: T } });
    f.state.lostMarker = true;
    await expect(undoQueuedReview(f.client, request())).rejects.toThrow('lost marker response');
    expect(db.rows.find(row => row.kind === LEGACY_REVIEW_UNDO_KIND).status).toBe('pending');
    expect(f.state.words[0]).toMatchObject(PREV);
    await undoQueuedReview(f.client, request());
    expect(f.state.events.filter(row => row.source === 'ui')).toHaveLength(1);
    expect(f.state.updates).toHaveLength(1);
    expect(db.rows).toHaveLength(1); expect(db.rows[0].status).toBe('settled');
    expect(f.state.inserts.flat().every(row => !Object.hasOwn(row, 'id'))).toBe(true);
  });

  it('recovers after settlement put succeeds but its transaction aborts, retaining original plus pending intention', async () => {
    const e = grade(), db = memoryDb([e]), f = remote({ events: [originalEvent()] }); db.abortSettlement = true;
    await expect(undoQueuedReview(f.client, request())).rejects.toThrow('aborted');
    expect(db.rows.find(row => row.seq === e.seq)).toMatchObject(e);
    expect(db.rows.find(row => row.kind === LEGACY_REVIEW_UNDO_KIND).status).toBe('pending');
    await undoQueuedReview(f.client, request());
    expect(f.state.events.filter(row => row.source === 'ui')).toHaveLength(1);
    expect(db.rows).toHaveLength(1); expect(db.rows[0].status).toBe('settled');
  });

  it('retries a lost conditional update reply from the durable snapshot without restoring twice', async () => {
    const db = memoryDb([grade()]), f = remote({ events: [originalEvent()], word: { id: 'card', user_id: 'A', ...grade().nextStats, last_reviewed_at: T } });
    f.state.lostUpdate = true;
    await expect(undoQueuedReview(f.client, request())).rejects.toThrow('lost update response');
    expect(f.state.words[0]).toMatchObject(PREV);
    expect(db.rows.find(row => row.kind === LEGACY_REVIEW_UNDO_KIND).status).toBe('pending');
    await undoQueuedReview(f.client, request());
    expect(f.state.updates).toHaveLength(1); expect(f.state.events.filter(row => row.source === 'ui')).toHaveLength(1);
    expect(db.rows[0].status).toBe('settled');
  });

  it('never restores over a later grade, including another-device advance between read and conditional update', async () => {
    memoryDb([grade()]); const f = remote({ events: [originalEvent()], word: { id: 'card', user_id: 'A', ...grade().nextStats, last_reviewed_at: T } });
    const later = '2026-10-05T02:00:00.000Z';
    f.state.beforeUpdate = async () => Object.assign(f.state.words[0], { last_reviewed_at: later, interval: 99 });
    await undoQueuedReview(f.client, request());
    expect(f.state.words[0]).toMatchObject({ last_reviewed_at: later, interval: 99 });
    expect(f.state.updates[0].matched).toBe(0); expect(f.state.events.filter(row => row.source === 'ui')).toHaveLength(1);
  });

  it('compensates an already-flushed original even when the queue entry is absent', async () => {
    const db = memoryDb(), f = remote({ events: [originalEvent()], word: { id: 'card', user_id: 'A', ...grade().nextStats, last_reviewed_at: T } });
    expect(await undoQueuedReview(f.client, request())).toMatchObject({ ok: true, compensated: true });
    expect(f.state.words[0]).toMatchObject(PREV); expect(db.rows[0].originals).toEqual([]);
  });

  it('uses actor checks after awaits and retains the durable cancel when account changes', async () => {
    const db = memoryDb([grade()]), f = remote({ events: [originalEvent()] }); let actor = 'A';
    const originalRpc = f.client.rpc;
    f.client.rpc = async (...args) => { const value = await originalRpc(...args); actor = 'B'; return value; };
    await expect(undoQueuedReview(f.client, request(), { getAccountId: () => actor })).rejects.toThrow('account_changed');
    expect(f.state.inserts).toHaveLength(0); expect(db.rows.some(row => row.status === 'pending')).toBe(true);
  });

  it('keeps other accounts and FSRS-kind records intact during matching legacy undo', async () => {
    const foreign = grade({ seq: 2, userId: 'B' });
    const fsrs = grade({ seq: 3, kind: 'fsrs-operation-v1', accountId: 'A' });
    const db = memoryDb([grade(), foreign, fsrs]), f = remote();
    await undoQueuedReview(f.client, request());
    expect(db.rows.find(row => row.seq === 2)).toEqual(foreign); expect(db.rows.find(row => row.seq === 3)).toEqual(fsrs);
  });

  it('old remove API cancels only explicit never-attempted originals and keeps durable cancellation proof', async () => {
    const e = grade({ remoteAttempted: false }), db = memoryDb([e]);
    expect(await removeOutboxEntry(e)).toBe(1);
    expect(db.rows).toHaveLength(1); expect(db.rows[0]).toMatchObject({ status: 'settled', localOnly: true });
    expect(db.rows[0].originals).toEqual([e]); expect(await enqueueReview(e)).toBe(false);
  });

  it.each([undefined, true])('old remove refuses unknown/attempted state (%s) without deleting originals', async remoteAttempted => {
    const e = grade({ remoteAttempted }), db = memoryDb([e]);
    await expect(removeOutboxEntry(e)).rejects.toMatchObject({ code: 'legacy_review_undo_requires_snapshot' });
    expect(db.rows).toEqual([e]);
  });

  it('old remove cannot use zero deleted rows as undo success', async () => {
    memoryDb(); await expect(removeOutboxEntry(request())).rejects.toMatchObject({ code: 'legacy_review_undo_requires_snapshot' });
  });

  it('old remove waits behind flush and refuses the now-absent grade instead of returning false success', async () => {
    memoryDb([grade({ remoteAttempted: false })]); const f = remote(), entered = deferred(), release = deferred();
    f.state.beforeInsert = async () => { entered.resolve(); await release.promise; };
    const flushing = flushReviews(f.client, 'A', { persist: f.persist }); await entered.promise;
    const removing = removeOutboxEntry(grade());
    release.resolve(); await flushing;
    await expect(removing).rejects.toMatchObject({ code: 'legacy_review_undo_requires_snapshot' });
    expect(f.state.events).toHaveLength(1);
  });

  it('holds a later same-card grade when undo cannot settle while independent cards continue', async () => {
    const db = memoryDb([grade(), grade({ seq: 2, reviewedAt: '2026-10-05T02:00:00.000Z' }),
      grade({ seq: 3, itemKey: 'independent', detail: { word_id: 'card-2', rating: 3 } })]);
    const f = remote(); f.state.words.push({ id: 'card-2', user_id: 'A', ...PREV });
    f.state.historyError = true;
    await expect(undoQueuedReview(f.client, request())).rejects.toThrow(); f.state.historyError = false;
    const baseRpc = f.client.rpc;
    f.client.rpc = async (name, input) => input.p_card_id === 'card'
      ? { error: new Error('blocked undo boundary') } : baseRpc(name, input);
    expect(await flushReviews(f.client, 'A', { persist: f.persist })).toEqual({ sent: 1, kept: 2, applied: 1 });
    expect(f.state.events.map(row => row.item_key)).toEqual(['independent']);
    expect(db.rows.some(row => row.seq === 2)).toBe(true);
    expect(db.rows.some(row => row.kind === LEGACY_REVIEW_UNDO_KIND && row.status === 'pending')).toBe(true);
  });

  it('refuses changed prior snapshot for an existing pending intention instead of rebasing it', async () => {
    const db = memoryDb([grade()]), f = remote(); f.state.historyError = true;
    await expect(undoQueuedReview(f.client, request())).rejects.toThrow();
    const before = structuredClone(db.rows);
    await expect(undoQueuedReview(f.client, request({ prev: { ...PREV, interval: 50 } }))).rejects.toThrow('undo_conflict');
    expect(db.rows).toEqual(before);
  });
});

describe('legacy replay dedupe and complete pages', () => {
  it('serializes concurrent flushes and deduplicates an original twice in one batch', async () => {
    const db = memoryDb([grade(), grade({ seq: 2 })]), f = remote();
    const [a, b] = await Promise.all([flushReviews(f.client, 'A', { persist: f.persist }), flushReviews(f.client, 'A', { persist: f.persist })]);
    expect(a.sent + b.sent).toBe(2); expect(f.state.events).toHaveLength(1);
    expect(db.rows).toEqual([]); expect(f.state.inserts.flat()[0]).not.toHaveProperty('id');
  });

  it('preserves different-language reviews that share surface and millisecond', () => {
    expect(dedupeEntries([grade(), grade({ lang: 'Japanese' })], [])).toHaveLength(2);
  });

  it('reads beyond 1000 history rows with stable bigint IDs then sends the missing original once', async () => {
    const db = memoryDb([grade()]);
    const events = Array.from({ length: 1001 }, (_, i) => ({ ...originalEvent(), id: String(9007199254745000n + BigInt(i)), item_key: `other-${i}` }));
    const f = remote({ events, cap: 37 });
    expect(await flushReviews(f.client, 'A', { persist: f.persist })).toEqual({ sent: 1, kept: 0, applied: 1 });
    expect(f.state.events).toHaveLength(1002); expect(db.rows).toEqual([]);
    // cap=37이면 마지막 페이지는 offset 999에서 두 행(1000·1001번째)을 읽는다.
    expect(f.state.reads.filter(row => row.table === 'review_events').map(row => row.offset)).toHaveLength(28);
    expect(f.state.reads.some(row => row.table === 'review_events' && row.offset === 999)).toBe(true);
    expect(f.state.reads.filter(row => row.table === 'review_events').every(row => row.order.join() === 'created_at,id')).toBe(true);
    expect(f.state.events[0].id).toBe(events[0].id);
  });

  it('reads every capped vocabulary page before applying/removing independent grades', async () => {
    const db = memoryDb([grade(), grade({ seq: 2, itemKey: 'second', detail: { word_id: 'card-2', rating: 3 } })]);
    const f = remote({ cap: 1 }); f.state.words.push({ id: 'card-2', user_id: 'A', ...PREV });
    expect(await flushReviews(f.client, 'A', { persist: f.persist })).toEqual({ sent: 2, kept: 0, applied: 2 });
    expect(db.rows).toEqual([]); expect(f.state.reads.some(row => row.table === 'user_vocabulary' && row.offset === 1)).toBe(true);
  });

  it('keeps originals and makes no insert when the exact count changes while reading pages', async () => {
    const e = grade(), db = memoryDb([e]);
    const f = remote({ events: [originalEvent(), { ...originalEvent(), id: '9007199254741002', item_key: 'another' }], cap: 1 });
    f.state.drift = true;
    expect(await flushReviews(f.client, 'A', { persist: f.persist })).toEqual({ sent: 0, kept: 1, applied: 0 });
    expect(db.rows).toEqual([e]); expect(f.state.inserts).toHaveLength(0);
  });

  it('read failure is not a successful empty queue', async () => {
    const db = memoryDb([grade()]); db.readError = true;
    await expect(flushReviews(remote().client, 'A')).rejects.toThrow('outbox-read-failed');
    expect(await pendingReviews('A')).toEqual([]); // public notice fallback remains compatible
  });
});
