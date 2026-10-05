import { describe, expect, it, vi } from 'vitest';
import { createFsrsLearningClient, fsrsFailureStatus } from '../fsrsLearningClient';
import { FSRS_OPERATION_KIND, normalizeFsrsRequest } from '../fsrsOperationOutbox';
import { assertCachedLegacyFsrsAllowed } from '../fsrsLegacyBoundary';

const payload = (operationId = 'grade-1', cardId = 'card-1', expectedRevision = 0) => ({
  action: 'grade', operationId, cardId, expectedRevision, attemptId: `attempt-${cardId}`, rating: 3,
});
const revealed = (cardId = 'card-1', revision = 0) => ({ cardId, card: { revision }, attempt: {
  id: `attempt-${cardId}`, userId: 'alice', cardId, card: { revision }, phase: 'revealed', eligible: true,
  questionAt: '2026-10-03T01:00:00Z', revealedAt: '2026-10-03T01:00:02Z', hintedAt: null,
} });
const queued = (seq, cardId = 'card-1', extra = {}) => ({ kind: FSRS_OPERATION_KIND, seq,
  accountId: 'alice', cardId, operationId: `grade-${seq}`, status: 'queued',
  payload: normalizeFsrsRequest(payload(`grade-${seq}`, cardId), 'alice'),
  receipt: { attemptId: `attempt-${cardId}`, revision: 0,
    questionAt: '2026-10-03T01:00:00Z', revealedAt: '2026-10-03T01:00:02Z' }, ...extra });
const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const success = (request, duplicate = false) => ({ ok: true, version: 1, cardId: request.cardId,
  operationId: request.operationId, card: { revision: request.expectedRevision + 1 }, duplicate });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function memory(initial = []) {
  const rows = structuredClone(initial);
  return { rows,
    list: vi.fn(async (accountId, { includeSettled = false } = {}) => structuredClone(rows.filter(row =>
      row.accountId === accountId && (includeSettled || row.status !== 'settled')))),
    append: vi.fn(async input => {
      const previous = rows.find(row => row.accountId === input.accountId && row.operationId === input.payload.operationId);
      if (previous) return structuredClone(previous);
      const entry = { ...input, seq: rows.length + 1, kind: FSRS_OPERATION_KIND,
        cardId: input.payload.cardId, operationId: input.payload.operationId,
        status: input.blockReason ? 'blocked' : 'queued' };
      rows.push(structuredClone(entry)); return structuredClone(entry);
    }),
    mark: vi.fn(async (entry, patch) => {
      const index = rows.findIndex(row => row.seq === entry.seq);
      if (rows[index].status !== 'settled') rows[index] = { ...rows[index], ...structuredClone(patch) };
      return structuredClone(rows[index]);
    }),
  };
}

describe('account-bound FSRS operation transport', () => {
  it('requires acknowledged online reveal, then returns durable pending before a slow network completes', async () => {
    const store = memory(), gate = deferred();
    const fetchImpl = vi.fn(async (_url, options) => {
      if (options.method === 'GET') return reply({ version: 1, actorId: 'alice', enabled: true, registryAvailable: true, cards: [revealed()] });
      await gate.promise;
      return reply(success(JSON.parse(options.body)));
    });
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl });
    await client.load();
    expect(await client.submit(payload())).toMatchObject({ queued: true, status: 'pending', operationId: 'grade-1' });
    expect(store.rows[0].status).toBe('queued');
    expect(store.rows[0].receipt.revealedAt).toBe('2026-10-03T01:00:02Z');
    gate.resolve(); await client.flush();
    expect(await client.pending()).toEqual([]);
    const sent = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(sent).toEqual({ ...payload(), accountId: 'alice' });
    expect(sent).not.toHaveProperty('reviewedAt');
    client.dispose();
  });

  it('preserves an unreceipted offline rating as blocked without claiming a valid recall', async () => {
    const store = memory(), fetchImpl = vi.fn(), client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl });
    expect(await client.submit(payload())).toMatchObject({ queued: true, status: 'blocked', blockReason: 'fsrs_online_attempt_required' });
    await client.flush();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await client.pending()).toHaveLength(1);
    client.dispose();
  });

  it('records a server-acknowledged reveal receipt after an online question/reveal handshake', async () => {
    const store = memory(), questionActor = '10000000-0000-0000-0000-000000000001';
    const questionStore = { prepare: vi.fn(async request => request), settle: vi.fn(async (_, value) => value) };
    const fetchImpl = vi.fn(async (_url, options) => {
      const request = JSON.parse(options.body);
      if (request.action === 'grade') return reply(success(request));
      const body = { ...revealed(), ok: true, version: 1, actorId: questionActor, operationId: request.operationId,
        attempt: { ...revealed().attempt, userId: questionActor },
        admission: { version: 1, actorId: questionActor, installed: true, enabled: true, active: true, fsrsEnabled: true,
          startsAt: '2026-10-02T19:00:00.000Z', now: '2026-10-03T01:00:00.000Z', learningDay: '2026-10-03',
          timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 10, policyRevision: 1, used: 1, remaining: 9,
          fsrsUsed: 1, legacyUsed: 0, admittedLegacyCardIds: [] } };
      if (request.action === 'question') body.attempt = { ...body.attempt, phase: 'question', revealedAt: null };
      return reply(body);
    });
    const client = createFsrsLearningClient({ accountId: questionActor, outbox: store, fetchImpl, questionStore });
    await client.question({ cardId: 'card-1', operationId: 'q-1', expectedRevision: 0, dailyNewLimit: 10, expectedPolicyRevision: 1 });
    await client.reveal({ cardId: 'card-1', operationId: 'r-1', expectedRevision: 0, attemptId: 'attempt-card-1' });
    expect(await client.submit(payload())).toMatchObject({ status: 'pending' });
    await client.flush();
    expect(store.rows[0].status).toBe('settled');
    expect(fetchImpl.mock.calls.map(call => JSON.parse(call[1].body).action)).toEqual(['question', 'reveal', 'grade']);
    client.dispose();
  });

  it.each([
    { eligible: false, hintedAt: '2026-10-03T01:00:01Z' },
    { userId: 'bob' },
    { revealedAt: '2026-10-02T01:00:00Z' },
    { phase: 'question', revealedAt: null },
  ])('never converts an invalid or exposed attempt into recall: %j', async patch => {
    const store = memory(), card = revealed();
    card.attempt = { ...card.attempt, ...patch };
    const fetchImpl = vi.fn(async () => reply({ version: 1, actorId: 'alice', enabled: true, registryAvailable: true, cards: [card] }));
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl });
    await client.load();
    expect(await client.submit(payload())).toMatchObject({ status: 'blocked' });
    await client.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    client.dispose();
  });

  it('remembers actor-bound inactive enrollments and rejects another actor response', async () => {
    const enrolled = 'inactive-enrolled-card';
    const client = createFsrsLearningClient({ accountId: 'actor-one', outbox: memory(), fetchImpl: async () => reply({ version: 1,
      actorId: 'actor-one', enabled: false, registryAvailable: true, cards: [{ cardId: enrolled, active: false }] }) });
    await client.load();
    expect(() => assertCachedLegacyFsrsAllowed('actor-one', enrolled)).toThrow('fsrs_legacy_write_blocked');
    expect(() => assertCachedLegacyFsrsAllowed('actor-two', enrolled)).not.toThrow();
    const wrong = createFsrsLearningClient({ accountId: 'actor-two', outbox: memory(), fetchImpl: async () => reply({ version: 1,
      actorId: 'actor-one', enabled: false, registryAvailable: true, cards: [{ cardId: enrolled }] }) });
    await expect(wrong.load()).rejects.toThrow('fsrs_account_changed');
    expect(() => assertCachedLegacyFsrsAllowed('actor-two', enrolled)).not.toThrow();
    client.dispose(); wrong.dispose();
  });

  it('refuses to advance if original intention cannot commit', async () => {
    const store = memory(), fetchImpl = vi.fn();
    store.append.mockRejectedValue(new Error('quota'));
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl });
    await expect(client.submit(payload())).rejects.toThrow('quota');
    expect(fetchImpl).not.toHaveBeenCalled();
    client.dispose();
  });

  it('holds same-card successors after a conflict while sending an independent card', async () => {
    const store = memory([queued(1), queued(2), queued(3, 'other')]);
    const fetchImpl = vi.fn(async (_url, options) => {
      const request = JSON.parse(options.body);
      return request.cardId === 'card-1' ? reply({ ok: false, code: 'fsrs_revision_conflict' }, 409) : reply(success(request));
    });
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl });
    await client.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(store.rows.map(row => row.status)).toEqual(['conflict', 'queued', 'settled']);
    await client.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    client.dispose();
  });

  it('retries transient failures with identical IDs and treats a duplicate as a settled receipt', async () => {
    const store = memory([queued(1)]);
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(async (_url, options) => reply(success(JSON.parse(options.body), true)));
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl });
    expect(await client.flush()).toMatchObject([{ status: 'pending' }]);
    expect(await client.flush()).toMatchObject([{ status: 'replayed' }]);
    expect(fetchImpl.mock.calls[0][1].body).toBe(fetchImpl.mock.calls[1][1].body);
    expect(store.rows).toHaveLength(1);
    client.dispose();
  });

  it('accepts a request-bound duplicate receipt carrying a newer canonical card', async () => {
    const store = memory([queued(1)]);
    const fetchImpl = vi.fn(async (_url, options) => reply({ ...success(JSON.parse(options.body), true), card: { revision: 7 } }));
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl });
    expect(await client.flush()).toMatchObject([{ status: 'replayed', response: { card: { revision: 7 } } }]);
    expect(await client.pending()).toEqual([]);
    client.dispose();
  });

  it.each([{ operationId: 'someone-else' }, { cardId: 'another-card' }, { card: { revision: 0 } },
    { card: { revision: 7 }, duplicate: false }])('does not settle a mismatched response %j', async patch => {
    const store = memory([queued(1)]);
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store,
      fetchImpl: async (_url, options) => reply({ ...success(JSON.parse(options.body)), ...patch }) });
    expect(await client.flush()).toMatchObject([{ status: 'pending', blockReason: 'fsrs_invalid_response' }]);
    expect(store.rows[0].status).toBe('queued');
    client.dispose();
  });

  it('keeps a server-accepted operation pending if the local success receipt cannot commit', async () => {
    const store = memory([queued(1), queued(2), queued(3, 'other')]);
    store.mark.mockImplementation(async (entry, patch) => {
      if (entry.seq === 1) throw new Error('quota');
      const index = store.rows.findIndex(row => row.seq === entry.seq);
      return Object.assign(store.rows[index], patch);
    });
    const fetchImpl = vi.fn(async (_url, options) => reply(success(JSON.parse(options.body))));
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl });
    await client.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(store.rows.map(row => row.status)).toEqual(['queued', 'queued', 'settled']);
    client.dispose();
  });

  it('single-flights concurrent flush calls and appends in-flight undo as a compensating operation', async () => {
    const store = memory([queued(1)]), gate = deferred();
    const fetchImpl = vi.fn(async (_url, options) => {
      const request = JSON.parse(options.body);
      if (request.action === 'grade') await gate.promise;
      return reply(success(request));
    });
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl });
    const first = client.flush();
    expect(client.flush()).toBe(first);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(await client.submit({ action: 'undo', operationId: 'undo-1', cardId: 'card-1', expectedRevision: 1,
      targetOperationId: 'grade-1' })).toMatchObject({ queued: true, status: 'pending' });
    expect(store.rows).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    gate.resolve(); await first;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.map(call => JSON.parse(call[1].body).action)).toEqual(['grade', 'undo']);
    expect(store.rows.map(row => row.status)).toEqual(['settled', 'settled']);
    client.dispose();
  });

  it('stops after an account switch even when the old request finishes successfully', async () => {
    const store = memory([queued(1), queued(2, 'other')]), gate = deferred();
    let owner = 'alice';
    const fetchImpl = vi.fn(async (_url, options) => { await gate.promise; return reply(success(JSON.parse(options.body))); });
    const client = createFsrsLearningClient({ accountId: 'alice', getAccountId: () => owner, outbox: store, fetchImpl });
    const flushed = client.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    owner = 'bob'; gate.resolve();
    await expect(flushed).rejects.toThrow('fsrs_account_changed');
    expect(store.mark).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(store.rows.map(row => row.status)).toEqual(['queued', 'queued']);
    client.dispose();
  });

  it('does not substitute a stale GET failure or unreadable queue with an empty success', async () => {
    const store = memory(); store.list.mockRejectedValue(new Error('blocked storage'));
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store,
      fetchImpl: async () => reply({ ok: false, code: 'fsrs_storage_unavailable' }, 503) });
    await expect(client.load()).rejects.toThrow('blocked storage');
    await expect(client.pending()).rejects.toThrow('blocked storage');
    await expect(client.flush()).rejects.toThrow('blocked storage');
    client.dispose();
  });

  it('constructs without browser effects; explicit start/dispose may repeat safely', async () => {
    const events = new EventTarget();
    const add = vi.spyOn(events, 'addEventListener'), remove = vi.spyOn(events, 'removeEventListener');
    const fetchImpl = vi.fn();
    const client = createFsrsLearningClient({ accountId: undefined, eventTarget: events, fetchImpl });
    expect(add).not.toHaveBeenCalled();
    client.start(); client.start();
    expect(add).toHaveBeenCalledTimes(2);
    client.dispose();
    expect(remove).toHaveBeenCalledTimes(2);
    client.start();
    await expect(client.load()).rejects.toThrow('fsrs_invalid_account');
    expect(fetchImpl).not.toHaveBeenCalled();
    client.dispose();
  });

  it('uses online/focus to reconcile durable operations and stops listeners after disposal', async () => {
    const events = new EventTarget(), store = memory([queued(1)]);
    const listener = vi.fn(), fetchImpl = vi.fn(async (_url, options) => reply(success(JSON.parse(options.body))));
    const client = createFsrsLearningClient({ accountId: 'alice', eventTarget: events, outbox: store, fetchImpl });
    client.start(); client.subscribe(listener);
    events.dispatchEvent(new Event('online')); events.dispatchEvent(new Event('focus'));
    await client.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: 'applied', operationId: 'grade-1' }));
    client.dispose();
    events.dispatchEvent(new Event('online'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('resumes committed originals on already-online startup without needing a new focus or submission', async () => {
    const store = memory([queued(1)]), fetchImpl = vi.fn(async (_url, options) => reply(success(JSON.parse(options.body))));
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl, eventTarget: new EventTarget() });
    client.start();
    await vi.waitFor(() => expect(store.rows[0].status).toBe('settled'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    client.dispose();
  });

  it('persists new-card enrollment before sending and keeps its stable ID on a later retry', async () => {
    const store = memory(), cardId = 'new-pending-enrollment';
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(async (_url, options) => {
        const request = JSON.parse(options.body);
        expect(store.rows[0].operationId).toBe(request.operationId);
        return reply({ ok: true, version: 1, cardId, operationId: request.operationId, card: { revision: 0 }, duplicate: true });
      });
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl });
    const input = { cardId, operationId: 'enroll-new', expectedRevision: 0 };
    expect(await client.enroll(input)).toMatchObject({ queued: true, status: 'pending', cardId });
    expect(() => assertCachedLegacyFsrsAllowed('alice', cardId)).toThrow('fsrs_legacy_write_blocked');
    expect(await client.enroll(input)).toMatchObject({ ok: true, duplicate: true, card: { revision: 0 } });
    expect(store.rows).toHaveLength(1);
    expect(fetchImpl.mock.calls[0][1].body).toBe(fetchImpl.mock.calls[1][1].body);
    client.dispose();
  });

  it('rehydrates pending enrollment into legacy protection before a failed GET', async () => {
    const cardId = 'rehydrated-pending-enroll';
    const row = { ...queued(1, cardId), payload: normalizeFsrsRequest({ action: 'enroll', cardId,
      operationId: 'grade-1', expectedRevision: 0 }, 'alice'), receipt: null };
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: memory([row]),
      fetchImpl: async () => { throw new Error('offline'); } });
    expect(() => assertCachedLegacyFsrsAllowed('alice', cardId)).not.toThrow();
    await expect(client.load()).rejects.toThrow('offline');
    expect(() => assertCachedLegacyFsrsAllowed('alice', cardId)).toThrow('fsrs_legacy_write_blocked');
    client.dispose();
  });

  it('does not send enrollment if its original intention cannot commit', async () => {
    const store = memory(), fetchImpl = vi.fn();
    store.append.mockRejectedValue(new Error('quota'));
    const client = createFsrsLearningClient({ accountId: 'alice', outbox: store, fetchImpl });
    await expect(client.enroll({ cardId: 'new-card', operationId: 'enroll-new', expectedRevision: 0 })).rejects.toThrow('quota');
    expect(fetchImpl).not.toHaveBeenCalled();
    client.dispose();
  });

  it.each([
    [{ status: 409, code: 'fsrs_stale_attempt' }, 'stale'],
    [{ status: 409, code: 'fsrs_operation_conflict' }, 'conflict'],
    [{ status: 422, code: 'recall_not_eligible' }, 'blocked'],
    [{ status: 503, code: 'fsrs_storage_unavailable' }, 'queued'],
    [{ status: 401, code: 'unauthorized' }, 'queued'],
  ])('keeps distinct replay outcome %j as %s', (error, state) => {
    expect(fsrsFailureStatus(error)).toBe(state);
  });
});
