import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../offlineCache', () => ({ openDb: db.open, STORE_OUTBOX: 'outbox' }));
vi.mock('../vocabularyExclusion', () => ({ loadVocabularyExclusions: async () => [], findVocabularyExclusion: () => null, exclusionKey: () => '' }));
import { enqueueReview, flushReviews, removeOutboxEntry } from '../reviewOutbox';

const entry = (seq, id = 'word') => ({ seq, userId: 'alice', itemKey: id, source: 'vocab', lang: 'Chinese',
  reviewedAt: new Date(Date.parse('2026-10-03T09:00:00Z') + seq * 1000).toISOString(),
  correct: true, detail: { word_id: id }, nextStats: { interval: 3 } });
beforeEach(() => vi.clearAllMocks());

function memoryDb(rows, failure) {
  return { transaction: () => {
    const tx = { error: failure ? new Error(failure) : null };
    tx.objectStore = () => ({
      add: row => queueMicrotask(() => {
        if (failure === 'abort') tx.onabort?.();
        else if (failure) tx.onerror?.();
        else { rows.push(row); tx.oncomplete?.(); }
      }),
      getAll: () => {
        const request = {};
        queueMicrotask(() => {
          if (failure === 'read') request.onerror?.();
          else { request.result = [...rows]; request.onsuccess?.(); }
        });
        return request;
      },
      delete: seq => queueMicrotask(() => {
        if (failure) tx.onabort?.();
        else { rows.splice(rows.findIndex(row => row.seq === seq), 1); tx.oncomplete?.(); }
      }),
    });
    return tx;
  } };
}

function remote({ historyError, readError, historyCount, rowCount, existing = [] } = {}) {
  const inserted = vi.fn(async () => ({ error: null }));
  return { inserted, from: table => table === 'review_events' ? {
    select: () => ({ eq: () => ({ gte: () => ({ lte: async () => ({ data: existing, error: historyError, count: historyCount }) }) }) }), insert: inserted,
  } : { select: () => ({ eq: () => ({ in: async () => ({ data: [{ id: 'word', last_reviewed_at: null }, { id: 'other', last_reviewed_at: null }], error: readError, count: rowCount }) }) }) } };
}

describe('durable original review intentions', () => {
  it.each(['error', 'abort'])('reports a transaction %s as failure rather than queued success', async failure => {
    const rows = [];
    db.open.mockResolvedValue(memoryDb(rows, failure));
    expect(await enqueueReview(entry(1))).toBe(false);
    expect(rows).toEqual([]);
  });
  it('preserves all older originals when the 501st review commits', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => entry(i));
    db.open.mockResolvedValue(memoryDb(rows));
    expect(await enqueueReview(entry(500))).toBe(true);
    expect(rows).toHaveLength(501);
    expect(rows[0].seq).toBe(0);
  });
  it('does not claim an offline undo succeeded when deletion aborts', async () => {
    const rows = [entry(1)];
    db.open.mockResolvedValue(memoryDb(rows, 'abort'));
    await expect(removeOutboxEntry(rows[0])).rejects.toThrow('abort');
    expect(rows).toHaveLength(1);
  });
  it('does not turn an unreadable queue into a successful empty undo', async () => {
    const rows = [entry(1)];
    db.open.mockResolvedValue(memoryDb(rows, 'read'));
    await expect(removeOutboxEntry(rows[0])).rejects.toThrow('outbox-read-failed');
    expect(rows).toHaveLength(1);
  });
  it('retains failed grades and their later dependent grades while sending independent cards', async () => {
    const rows = [entry(1), entry(2), entry(3, 'other')], remove = vi.fn();
    const persist = vi.fn(async (_client, id) => { if (id === 'word') throw new Error('offline'); });
    const result = await flushReviews(remote(), 'alice', { load: async () => rows, remove, persist });
    expect(result).toEqual({ sent: 1, kept: 2, applied: 1 });
    expect(persist).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith([3]);
  });
  it('retries an event-already-saved grade without duplicating history', async () => {
    const e = entry(1), remove = vi.fn(), persist = vi.fn();
    const client = remote({ existing: [{ source: e.source, item_key: e.itemKey, created_at: e.reviewedAt }] });
    expect(await flushReviews(client, 'alice', { load: async () => [e], remove, persist })).toEqual({ sent: 1, kept: 0, applied: 1 });
    expect(client.inserted).not.toHaveBeenCalled();
    expect(persist).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith([1]);
  });
  it.each(['historyError', 'readError'])('keeps intentions when %s prevents safe replay', async failure => {
    const remove = vi.fn(), persist = vi.fn();
    const result = await flushReviews(remote({ [failure]: new Error('offline') }), 'alice', { load: async () => [entry(1)], remove, persist });
    expect(result).toEqual({ sent: 0, kept: 1, applied: 0 });
    expect(remove).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
  it('keeps a grade if its persistence adapter is absent', async () => {
    const remove = vi.fn();
    expect(await flushReviews(remote(), 'alice', { load: async () => [entry(1)], remove })).toMatchObject({ kept: 1, sent: 0 });
    expect(remove).not.toHaveBeenCalled();
  });
  it.each(['historyCount', 'rowCount'])('refuses a truncated %s response instead of losing or duplicating reviews', async field => {
    const remove = vi.fn(), persist = vi.fn();
    expect(await flushReviews(remote({ [field]: 1001 }), 'alice', { load: async () => [entry(1)], remove, persist })).toMatchObject({ sent: 0, kept: 1 });
    expect(remove).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});
