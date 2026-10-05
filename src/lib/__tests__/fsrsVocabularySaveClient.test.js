import { describe, expect, it, vi } from 'vitest';
import { createFsrsLearningClient } from '../fsrsLearningClient';
import { createFsrsReviewController } from '../useFsrsReview';
import { normalizeFsrsSaveRequest, normalizeFsrsRequest, FSRS_OPERATION_KIND } from '../fsrsOperationOutbox';
import { assertCachedLegacyFsrsAllowed } from '../fsrsLegacyBoundary';
import { introduceFsrsCard } from '../fsrsScheduler';

const actor = '11111111-1111-4111-8111-111111111111';
const otherActor = '22222222-2222-4222-8222-222222222222';
const proposed = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const old = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now = '2026-10-04T06:00:00Z';
const vocabulary = { word_text: '你好', base_form: '你好', meaning: '안녕하세요', furigana: 'nǐ hǎo', pos: '감탄사', language: 'Chinese' };
const request = (operationId = 'save-one', cardId = proposed) => ({ action: 'save', accountId: actor, operationId, cardId, vocabulary });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const http = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const success = (input, { actualId = input.cardId, enrolled = true, created = true, duplicate = false, revision = 0 } = {}) => ({
  ok: true, version: 1, actorId: actor, operationId: input.operationId, requestedCardId: input.cardId,
  vocabularyId: actualId, created, enrolled, duplicate, row: { id: actualId, user_id: actor, ...input.vocabulary },
  state: { cardId: actualId, userId: actor, enrolled, card: enrolled ? { ...introduceFsrsCard(now), revision } : null,
    attempt: null, eligible: true, known: false, excluded: false }, now,
});
function storage(initial = []) {
  const rows = structuredClone(initial);
  return { rows,
    list: vi.fn(async (accountId, { includeSettled = false } = {}) => structuredClone(rows.filter(row =>
      row.accountId === accountId && (includeSettled || row.status !== 'settled')))),
    append: vi.fn(async ({ accountId, payload, receipt = null, blockReason = null }) => {
      const normalized = normalizeFsrsRequest(payload, accountId);
      const existing = rows.find(row => row.accountId === accountId && row.operationId === normalized.operationId);
      if (existing) {
        if (JSON.stringify(existing.payload) !== JSON.stringify(normalized)) throw new Error('fsrs_operation_id_conflict');
        return structuredClone(existing);
      }
      const row = { kind: FSRS_OPERATION_KIND, seq: rows.length + 1, accountId, cardId: normalized.cardId,
        operationId: normalized.operationId, payload: normalized, receipt, blockReason, status: blockReason ? 'blocked' : 'queued' };
      rows.push(structuredClone(row)); return row;
    }),
    mark: vi.fn(async (entry, patch) => {
      const row = rows.find(row => row.seq === entry.seq && row.accountId === entry.accountId);
      if (row.status !== 'settled') Object.assign(row, structuredClone(patch));
      return structuredClone(row);
    }),
  };
}

describe('atomic manual vocabulary save transport', () => {
  it('does not send any request before the original save transaction commits', async () => {
    const outbox = storage(), gate = deferred(), append = outbox.append;
    outbox.append = vi.fn(async entry => { await gate.promise; return append(entry); });
    const fetchImpl = vi.fn(async (_url, options) => http(success(JSON.parse(options.body))));
    const client = createFsrsLearningClient({ accountId: actor, outbox, fetchImpl });
    const pending = client.save(request());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchImpl).not.toHaveBeenCalled(); expect(outbox.rows).toEqual([]);
    gate.resolve();
    expect(await pending).toMatchObject({ ok: true, vocabularyId: proposed, enrolled: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/learning/vocabulary');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(request());
    client.dispose();
  });

  it('treats an aborted original as failure with zero database/network work', async () => {
    const outbox = storage(), fetchImpl = vi.fn(); outbox.append.mockRejectedValue(new Error('transaction aborted'));
    const client = createFsrsLearningClient({ accountId: actor, outbox, fetchImpl });
    await expect(client.save(request())).rejects.toThrow('transaction aborted');
    expect(fetchImpl).not.toHaveBeenCalled(); expect(outbox.rows).toEqual([]); client.dispose();
  });

  it('reloads a lost server reply and resends the exact original ID/body without another insert', async () => {
    const outbox = storage(), seen = new Map(), bodies = [], settled = [];
    const fetchImpl = vi.fn(async (_url, options) => {
      bodies.push(options.body); const input = JSON.parse(options.body);
      if (!seen.has(input.operationId)) {
        seen.set(input.operationId, true); throw new Error('response lost after database commit');
      }
      return http(success(input, { duplicate: true, revision: 2 }));
    });
    const first = createFsrsLearningClient({ accountId: actor, outbox, fetchImpl });
    expect(await first.save(request())).toMatchObject({ queued: true, status: 'pending' }); first.dispose();
    const next = createFsrsLearningClient({ accountId: actor, outbox, fetchImpl, eventTarget: new EventTarget() });
    next.subscribe(event => { if (['applied', 'replayed'].includes(event.status)) settled.push(event); });
    next.start();
    await vi.waitFor(() => expect(outbox.rows[0].status).toBe('settled'));
    expect(seen.size).toBe(1); expect(bodies[0]).toBe(bodies[1]); expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({ accountId: actor, action: 'save', status: 'replayed', response: { state: { card: { revision: 2 } } } });
    expect(outbox.rows[0].payload).toEqual(request()); next.dispose();
  });

  it('settles an old duplicate under its actual ID without classifying it as enrolled', async () => {
    const outbox = storage();
    const client = createFsrsLearningClient({ accountId: actor, outbox, fetchImpl: async (_url, options) => {
      const body = success(JSON.parse(options.body), { actualId: old, created: false, enrolled: false });
      body.row.meaning = 'preserved old meaning'; return http(body);
    } });
    const result = await client.save(request());
    expect(result).toMatchObject({ ok: true, vocabularyId: old, requestedCardId: proposed, created: false, enrolled: false,
      row: { meaning: 'preserved old meaning' }, state: { card: null } });
    expect(() => assertCachedLegacyFsrsAllowed(actor, old)).not.toThrow();
    expect(outbox.rows[0].cardId).toBe(proposed); client.dispose();
  });

  it('never turns a same-ID legacy duplicate into positive enrollment evidence', async () => {
    const legacyId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', outbox = storage();
    const client = createFsrsLearningClient({ accountId: actor, outbox, fetchImpl: async (_url, options) =>
      http(success(JSON.parse(options.body), { actualId: legacyId, created: false, enrolled: false })) });
    expect(() => assertCachedLegacyFsrsAllowed(actor, legacyId)).not.toThrow();
    expect(await client.save(request('same-legacy', legacyId))).toMatchObject({ ok: true, enrolled: false });
    await client.pending();
    expect(() => assertCachedLegacyFsrsAllowed(actor, legacyId)).not.toThrow(); client.dispose();
  });

  it('explicitly retries a recovered exclusion using the immutable original but never rebases conflicts', async () => {
    const outbox = storage(), fetchImpl = vi.fn()
      .mockResolvedValueOnce(http({ ok: false, code: 'fsrs_card_excluded' }, 409))
      .mockImplementation(async (_url, options) => http(success(JSON.parse(options.body))));
    const client = createFsrsLearningClient({ accountId: actor, outbox, fetchImpl });
    expect(await client.save(request())).toMatchObject({ status: 'blocked' });
    await client.flush(); expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await client.retrySave('save-one')).toMatchObject({ ok: true });
    expect(fetchImpl.mock.calls[0][1].body).toBe(fetchImpl.mock.calls[1][1].body);
    client.dispose();
    const conflicting = storage(), rejectedFetch = vi.fn(async () => http({ ok: false, code: 'fsrs_operation_conflict' }, 409));
    const conflictClient = createFsrsLearningClient({ accountId: actor, outbox: conflicting, fetchImpl: rejectedFetch });
    await conflictClient.save(request());
    expect(await conflictClient.retrySave('save-one')).toMatchObject({ status: 'conflict' });
    expect(rejectedFetch).toHaveBeenCalledTimes(1); conflictClient.dispose();
  });

  it('retains uncertainty when a successful server reply cannot be durably recorded', async () => {
    const outbox = storage(), mark = outbox.mark;
    outbox.mark.mockImplementationOnce(async () => { throw new Error('quota'); });
    const fetchImpl = vi.fn(async (_url, options) => http(success(JSON.parse(options.body), { duplicate: fetchImpl.mock.calls.length > 1 })));
    const client = createFsrsLearningClient({ accountId: actor, outbox, fetchImpl });
    expect(await client.save(request())).toMatchObject({ queued: true, status: 'pending' });
    expect(outbox.rows[0].status).toBe('queued');
    outbox.mark = mark;
    expect(await client.retrySave('save-one')).toMatchObject({ ok: true, duplicate: true });
    expect(fetchImpl.mock.calls[0][1].body).toBe(fetchImpl.mock.calls[1][1].body); client.dispose();
  });

  it('stops settlement and notifications when the authenticated account switches mid-request', async () => {
    const outbox = storage(), gate = deferred(), changes = [], fetchImpl = vi.fn(async (_url, options) => {
      await gate.promise; return http(success(JSON.parse(options.body)));
    });
    let current = actor;
    const client = createFsrsLearningClient({ accountId: actor, getAccountId: () => current, outbox, fetchImpl });
    client.subscribe(event => changes.push(event)); const pending = client.save(request());
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce()); current = otherActor; gate.resolve();
    await expect(pending).rejects.toThrow('fsrs_account_changed');
    expect(changes.some(event => ['applied', 'replayed'].includes(event.status))).toBe(false);
    expect(outbox.rows[0].status).toBe('queued'); expect(outbox.mark).not.toHaveBeenCalled(); client.dispose();
  });

  it.each([
    { actorId: otherActor }, { requestedCardId: old }, { vocabularyId: old },
    { created: true, enrolled: false }, { row: { id: proposed, user_id: otherActor } },
    { state: { cardId: old, userId: actor, enrolled: true, card: { revision: 0 } } },
  ])('does not settle an inconsistent save receipt %j', async patch => {
    const outbox = storage();
    const client = createFsrsLearningClient({ accountId: actor, outbox, fetchImpl: async (_url, options) =>
      http({ ...success(JSON.parse(options.body)), ...patch }) });
    expect(await client.save(request())).toMatchObject({ queued: true, status: 'pending' });
    expect(outbox.rows[0].status).toBe('queued'); client.dispose();
  });

  it.each([[503, 'fsrs_storage_unavailable', 'pending'], [409, 'fsrs_card_excluded', 'blocked'],
    [409, 'fsrs_operation_conflict', 'conflict']])('retains %s %s as %s without a fallback endpoint', async (status, code, expected) => {
    const outbox = storage(), fetchImpl = vi.fn(async () => http({ ok: false, code }, status));
    const client = createFsrsLearningClient({ accountId: actor, outbox, fetchImpl });
    expect(await client.save(request())).toMatchObject({ queued: true, status: expected });
    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual(['/api/learning/vocabulary']);
    expect(outbox.rows).toHaveLength(1); client.dispose();
  });

  it.each(['next_review_at', 'user_id', 'source_sentence', 'card', 'created_at'])('rejects unapproved vocabulary %s before storage/network', key => {
    expect(() => normalizeFsrsSaveRequest({ ...request(), vocabulary: { ...vocabulary, [key]: 'forged' } }, actor)).toThrow('fsrs_invalid_request');
  });
  it('normalizes NFC/whitespace, rejects aliases and excessive UTF16 lengths, and preserves action-specific legacy contracts', () => {
    expect(normalizeFsrsSaveRequest({ ...request(), vocabulary: { word_text: '  cafe\u0301  ', language: 'French' } }, actor).vocabulary)
      .toEqual({ word_text: 'café', language: 'French' });
    expect(() => normalizeFsrsSaveRequest({ ...request(), vocabulary: { ...vocabulary, reading: 'nǐ hǎo' } }, actor)).toThrow();
    expect(() => normalizeFsrsSaveRequest({ ...request(), vocabulary: { ...vocabulary, meaning: 'x'.repeat(2001) } }, actor)).toThrow();
    expect(() => normalizeFsrsSaveRequest({ ...request(), expectedRevision: 0 }, actor)).toThrow();
    expect(() => normalizeFsrsSaveRequest({ ...request(), accountId: otherActor }, actor)).toThrow();
    expect(normalizeFsrsRequest({ action: 'undo', operationId: 'undo', targetOperationId: 'grade', cardId: proposed, expectedRevision: 1 }, actor))
      .toEqual({ action: 'undo', cardId: proposed, operationId: 'undo', expectedRevision: 1, targetOperationId: 'grade', accountId: actor });
  });
});

const admissionFixture = enabled => ({ version: 1, actorId: actor, installed: true, enabled, active: enabled, fsrsEnabled: enabled,
  startsAt: enabled ? '2026-10-03T19:00:00.000Z' : null, now, learningDay: '2026-10-04', timeZone: 'Asia/Seoul', rolloverHour: 4,
  limit: 15, policyRevision: 1, used: 0, remaining: 15, fsrsUsed: 0, legacyUsed: 0, admittedLegacyCardIds: [] });

function controllerFixture({ enabled = true } = {}) {
  const outbox = storage(), applied = vi.fn(); let listener, networkAvailable = false;
  const server = success(request());
  const client = {
    start: vi.fn(), dispose: vi.fn(), subscribe: fn => { listener = fn; return () => { listener = null; }; },
    pending: () => outbox.list(actor),
    load: vi.fn(async () => ({ version: 1, enabled, registryAvailable: true, cards: [], now, admission: admissionFixture(enabled) })),
    save: vi.fn(async payload => {
      const entry = await outbox.append({ accountId: actor, payload });
      if (!networkAvailable) return { queued: true, operationId: payload.operationId, status: 'pending' };
      const response = { ...server, operationId: payload.operationId, requestedCardId: payload.cardId, vocabularyId: payload.cardId,
        row: { ...server.row, id: payload.cardId }, state: { ...server.state, cardId: payload.cardId } };
      await outbox.mark(entry, { status: 'settled', response });
      listener?.({ type: 'change', status: 'applied', action: 'save', accountId: actor, operationId: payload.operationId, response });
      return response;
    }),
    retrySave: vi.fn(async operationId => client.save(outbox.rows.find(row => row.operationId === operationId).payload)),
  };
  let id = 0;
  const controller = createFsrsReviewController({ accountId: actor, client, now: () => Date.parse(now),
    makeId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    eventTarget: new EventTarget(), visibilityTarget: null, onApplied: applied });
  controller.start();
  return { controller, client, applied, outbox, enable: () => { networkAvailable = true; }, emit: event => listener?.(event) };
}

describe('manual save review controller', () => {
  it('reuses durable draft identity while pending and invalidates once only after actor-bound settlement', async () => {
    const env = controllerFixture(); await env.controller.refresh();
    expect(await env.controller.saveVocabulary(vocabulary)).toMatchObject({ queued: true });
    const original = env.client.save.mock.calls[0][0];
    expect(env.controller.getSnapshot().pendingSaves).toHaveLength(1); expect(env.applied).not.toHaveBeenCalled();
    await env.controller.saveVocabulary({ ...vocabulary });
    expect(env.client.save.mock.calls[1][0]).toEqual(original);
    env.enable();
    expect(await env.controller.retrySave(original.operationId)).toMatchObject({ ok: true });
    expect(env.applied).toHaveBeenCalledTimes(1);
    expect(env.applied.mock.calls[0][0]).toBe(actor);
    expect(env.controller.getSnapshot().pendingSaves).toEqual([]);
    env.controller.dispose();
  });
  it('restores pending saves when the registry is offline and never substitutes an empty list', async () => {
    const env = controllerFixture(); await env.controller.refresh(); await env.controller.saveVocabulary(vocabulary);
    env.client.load.mockRejectedValue(new Error('offline'));
    expect(await env.controller.refresh()).toBe(false);
    expect(env.controller.getSnapshot().pendingSaves).toHaveLength(1); expect(env.applied).not.toHaveBeenCalled();
    env.controller.dispose();
  });
  it('reads a new complete registry after settlement instead of accepting a pre-save GET as current', async () => {
    const env = controllerFixture(); await env.controller.refresh(); env.enable();
    const earlier = deferred();
    env.client.load.mockImplementationOnce(() => earlier.promise).mockImplementation(async () => {
      const input = env.client.save.mock.calls[0][0];
      return { version: 1, enabled: true, registryAvailable: true, cards: [success(input).state], now, admission: admissionFixture(true) };
    });
    const oldRead = env.controller.refresh();
    const saving = env.controller.saveVocabulary(vocabulary);
    await vi.waitFor(() => expect(env.client.save).toHaveBeenCalledOnce());
    earlier.resolve({ version: 1, enabled: true, registryAvailable: true, cards: [], now, admission: admissionFixture(true) });
    await oldRead; await saving;
    expect(env.controller.getSnapshot().cards.map(entry => entry.cardId)).toEqual([env.client.save.mock.calls[0][0].cardId]);
    expect(env.applied).toHaveBeenCalledTimes(1); env.controller.dispose();
  });
  it('does not start saving on an inactive contract or apply another actor settlement to caches', async () => {
    const env = controllerFixture({ enabled: false }); await env.controller.refresh();
    await expect(env.controller.saveVocabulary(vocabulary)).rejects.toThrow('fsrs_storage_unavailable');
    expect(env.client.save).not.toHaveBeenCalled();
    env.emit({ type: 'change', status: 'applied', action: 'save', accountId: otherActor, response: success(request()) });
    expect(env.applied).not.toHaveBeenCalled(); env.controller.dispose();
  });
});
