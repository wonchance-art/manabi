import { describe, expect, it } from 'vitest';
import { createFsrsOperationOutbox, FSRS_OPERATION_KIND, normalizeFsrsRequest } from '../fsrsOperationOutbox';

const payload = (operationId = 'op-1', cardId = 'card-1') => ({ action: 'grade', cardId, operationId,
  expectedRevision: 2, attemptId: 'attempt-1', rating: 3 });
const tagged = (seq, accountId = 'alice') => ({ kind: FSRS_OPERATION_KIND, seq, accountId,
  cardId: 'card-1', operationId: `op-${seq}`, payload: normalizeFsrsRequest(payload(`op-${seq}`), accountId), status: 'queued' });

// Injected transaction model; a separate Chromium run checks the native IDB path.
function database(initial = [], { readFailure = false, abortWrite = false, holdCommit = false } = {}) {
  let rows = structuredClone(initial), release;
  const db = { rows: () => structuredClone(rows), release: () => release?.(), transaction: (_store, mode) => {
    let working = structuredClone(rows), active = true, pending = 0;
    const tx = { error: null, abort() {
      if (!active) return;
      active = false;
      queueMicrotask(() => tx.onabort?.());
    } };
    const finish = () => {
      if (!active || pending) return;
      const commit = () => {
        if (!active) return;
        active = false;
        if (mode === 'readwrite') rows = working;
        tx.oncomplete?.();
      };
      if (holdCommit) release = commit;
      else queueMicrotask(commit);
    };
    const request = (action, read = false) => {
      const req = {};
      pending++;
      queueMicrotask(() => {
        if (!active) return;
        if (read && readFailure) {
          req.error = new Error('read failed'); req.onerror?.();
        } else {
          req.result = action(); req.onsuccess?.();
          if (!read && abortWrite) tx.abort();
        }
        pending--;
        finish();
      });
      return req;
    };
    tx.objectStore = () => ({
      getAll: () => request(() => structuredClone(working), true),
      get: seq => request(() => structuredClone(working.find(row => row.seq === seq)), true),
      add: entry => request(() => {
        const seq = Math.max(0, ...working.map(row => row.seq || 0)) + 1;
        working.push({ ...structuredClone(entry), seq }); return seq;
      }),
      put: entry => request(() => {
        working = working.map(row => row.seq === entry.seq ? structuredClone(entry) : row); return entry.seq;
      }),
    });
    return tx;
  } };
  return db;
}

describe('FSRS operation durable storage', () => {
  it('does not resolve queued success at add request success before transaction commit', async () => {
    const db = database([], { holdCommit: true });
    const store = createFsrsOperationOutbox({ open: async () => db });
    let resolved = false;
    const saved = store.append({ accountId: 'alice', payload: payload() }).then(value => { resolved = true; return value; });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(resolved).toBe(false);
    expect(db.rows()).toEqual([]);
    db.release();
    expect(await saved).toMatchObject({ seq: 1, status: 'queued', operationId: 'op-1' });
  });

  it('rejects an abort after request success and preserves all earlier originals', async () => {
    const db = database([tagged(1)], { abortWrite: true });
    const store = createFsrsOperationOutbox({ open: async () => db });
    await expect(store.append({ accountId: 'alice', payload: payload('op-2') })).rejects.toThrow('aborted');
    expect(db.rows()).toEqual([tagged(1)]);
  });

  it('retains over 500 entries without TTL and isolates legacy and other accounts', async () => {
    const old = Array.from({ length: 501 }, (_, index) => ({ ...tagged(index + 1), createdAt: '2000-01-01T00:00:00Z' }));
    const db = database([...old, { seq: 502, userId: 'alice', itemKey: 'legacy' }, tagged(503, 'bob')]);
    const store = createFsrsOperationOutbox({ open: async () => db });
    await store.append({ accountId: 'alice', payload: payload('op-new', 'new') });
    const pending = await store.list('alice');
    expect(pending).toHaveLength(502);
    expect(pending[0].operationId).toBe('op-1');
    expect(pending.at(-1).operationId).toBe('op-new');
    expect(db.rows()).toHaveLength(504);
  });

  it('serializes duplicate IDs into one original and rejects different intent with the same ID', async () => {
    const db = database();
    const store = createFsrsOperationOutbox({ open: async () => db });
    const first = await store.append({ accountId: 'alice', payload: payload() });
    expect(await store.append({ accountId: 'alice', payload: payload() })).toEqual(first);
    await expect(store.append({ accountId: 'alice', payload: { ...payload(), rating: 4 } }))
      .rejects.toThrow('fsrs_operation_id_conflict');
    expect(db.rows()).toHaveLength(1);
  });

  it('keeps settled receipts and never changes them to a later failed attempt', async () => {
    const db = database();
    const store = createFsrsOperationOutbox({ open: async () => db });
    const entry = await store.append({ accountId: 'alice', payload: payload() });
    const response = { ok: true, operationId: 'op-1', card: { revision: 3 } };
    const settled = await store.mark(entry, { status: 'settled', response });
    expect(await store.mark(entry, { status: 'queued', blockReason: 'offline' })).toEqual(settled);
    expect(await store.list('alice')).toEqual([]);
    expect(await store.list('alice', { includeSettled: true })).toEqual([settled]);
    expect(settled.payload).toEqual(entry.payload);
  });

  it('cannot mark another account or operation through a local seq collision', async () => {
    const db = database([tagged(1)]), store = createFsrsOperationOutbox({ open: async () => db });
    await expect(store.mark({ ...tagged(1), accountId: 'bob' }, { status: 'settled' }))
      .rejects.toThrow('fsrs_outbox_identity_conflict');
    expect(db.rows()).toEqual([tagged(1)]);
  });

  it('does not turn unreadable storage into an empty successful queue', async () => {
    const store = createFsrsOperationOutbox({ open: async () => database([tagged(1)], { readFailure: true }) });
    await expect(store.list('alice')).rejects.toThrow('read failed');
    await expect(store.append({ accountId: 'alice', payload: payload('new') })).rejects.toThrow('read failed');
  });

  it.each(['nextCard', 'due', 'reviewedAt', 'owner', 'previousCard'])('rejects browser-controlled %s', key => {
    expect(() => normalizeFsrsRequest({ ...payload(), [key]: 'untrusted' }, 'alice')).toThrow('fsrs_invalid_request');
  });
  it('binds payload to the current account and rejects invalid revision or unsupported actions', () => {
    expect(() => normalizeFsrsRequest({ ...payload(), accountId: 'bob' }, 'alice')).toThrow();
    expect(() => normalizeFsrsRequest({ ...payload(), expectedRevision: -1 }, 'alice')).toThrow();
    expect(() => normalizeFsrsRequest({ ...payload(), action: 'reset' }, 'alice')).toThrow();
  });
});
