import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), service: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ requireUser: mocks.authenticate }));
vi.mock('@/lib/server/fsrsLearning', async original => ({ ...(await original()), fsrsServiceClient: mocks.service }));
import { normalizeManualVocabularyRequest, readVocabularyLearningSnapshot, saveManualVocabulary, validateVocabularyLearningSnapshot } from '../server/fsrsVocabulary.js';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler.js';
import { GET, POST } from '../../app/api/learning/vocabulary/route.js';

const actor = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const cardId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const legacyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now = '2026-10-04T00:00:00.000Z';
const clone = value => JSON.parse(JSON.stringify(value));
const raw = (id = cardId) => ({ id, user_id: actor, word_text: '책', base_form: '책', meaning: '书', language: 'Korean',
  furigana: '', pos: '', interval: 0, ease_factor: 0, repetitions: 0, last_reviewed_at: null, next_review_at: now, created_at: now,
  source_material_id: null, source_sentence: 'preserve source' });
const registry = (id = cardId, enrolled = true) => ({ cardId: id, userId: actor, enrolled,
  card: enrolled ? introduceFsrsCard(now) : null, attempt: null, eligible: true, known: false, excluded: false,
  nextQuestionAt: enrolled ? '2026-10-04T00:00:30.000Z' : null, firstQuestionAt: null });
const body = () => ({ action: 'save', accountId: actor, operationId: 'save-1', cardId,
  vocabulary: { word_text: '책', base_form: '책', meaning: '书', furigana: '', pos: '', language: 'Korean' } });
let client, authClient, snapshot, receipt, databaseError;

beforeEach(() => {
  vi.clearAllMocks(); receipt = null; databaseError = null;
  snapshot = { version: 1, actorId: actor, enabled: true, registryAvailable: true, complete: true, now,
    rows: [raw(), raw(legacyId)], registry: [registry(), registry(legacyId, false)] };
  authClient = { rpc: vi.fn(async () => ({ data: { version: 1, languages: { Korean: { save: true, review: true, known: true, exclude: true } } } })) };
  client = { rpc: vi.fn(async (name, args) => {
    if (databaseError) return { error: databaseError };
    if (name === 'fsrs_vocabulary_snapshot') return { data: clone(snapshot) };
    if (name !== 'fsrs_save_manual_vocabulary') throw Error('unexpected rpc');
    return { data: receipt || { version: 1, actorId: actor, operationId: args.p_request.operationId,
      requestedCardId: args.p_request.cardId, vocabularyId: args.p_request.cardId, created: true, enrolled: true, duplicate: false,
      row: { ...raw(args.p_request.cardId), ...args.p_request.vocabulary }, state: { ...registry(args.p_request.cardId),
        card: args.p_initial_card, nextQuestionAt: args.p_initial_card.due }, now } };
  }) };
  mocks.authenticate.mockResolvedValue({ user: { id: actor }, supabase: authClient });
  mocks.service.mockReturnValue(client);
});

const save = (input = body(), at = now) => saveManualVocabulary({ authClient, serviceClient: client, userId: actor, body: input, now: at });
const read = () => readVocabularyLearningSnapshot({ authClient, serviceClient: client, userId: actor });
const post = (input, extraHeaders = {}) => POST(new Request('https://fixture.test/api/learning/vocabulary', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(input),
}));

describe('complete scalar vocabulary snapshot', () => {
  it('uses one actor-bound RPC for raw rows and every legacy/enrolled metadata row', async () => {
    const result = await read();
    expect(result).toEqual(snapshot);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('fsrs_vocabulary_snapshot', { p_actor: actor });
    expect(authClient.rpc).not.toHaveBeenCalled();
  });
  it('disabled storage still retains the complete enrolled registry and excluded identities', async () => {
    snapshot.enabled = false; Object.assign(snapshot.registry[0], { eligible: false, excluded: true, known: true });
    expect(await read()).toMatchObject({ enabled: false, complete: true, registry: [{ enrolled: true, excluded: true }, { enrolled: false }] });
  });
  it('does not silently truncate more than a default PostgREST row limit', async () => {
    snapshot.rows = Array.from({ length: 1101 }, (_, i) => raw(`aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`));
    snapshot.registry = snapshot.rows.map(row => registry(row.id, false));
    expect((await read()).rows).toHaveLength(1101);
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(['owner', 'registry-owner', 'missing', 'extra', 'duplicate', 'incomplete', 'unknown-capability', 'invalid-card', 'invalid-time'])(
    'rejects %s rather than presenting missing enrollment as legacy or zero', async mutation => {
      if (mutation === 'owner') snapshot.rows[0].user_id = other;
      if (mutation === 'registry-owner') snapshot.registry[0].userId = other;
      if (mutation === 'missing') snapshot.registry.pop();
      if (mutation === 'extra') snapshot.registry.push(registry('cccccccc-cccc-4ccc-8ccc-cccccccccccc'));
      if (mutation === 'duplicate') snapshot.registry[1] = clone(snapshot.registry[0]);
      if (mutation === 'incomplete') snapshot.complete = false;
      if (mutation === 'unknown-capability') snapshot.enabled = null;
      if (mutation === 'invalid-card') snapshot.registry[0].card.state = 'Legacy';
      if (mutation === 'invalid-time') snapshot.now = '2026-02-30T00:00:00Z';
      await expect(read()).rejects.toMatchObject({ code: 'fsrs_snapshot_unavailable', status: 503 });
    });
  it('keeps unknown legacy language and source/time bytes while normalizing only SQL metadata safely', async () => {
    snapshot.rows[1].language = null;
    snapshot.rows[1].next_review_at = '2026-10-04T00:00:00.123456+00:00';
    snapshot.now = '2026-10-04T00:00:00.123456+00:00';
    snapshot.registry[0].nextQuestionAt = '2026-10-04T00:00:30.123456+00:00';
    const result = await read();
    expect(result.now).toBe('2026-10-04T00:00:00.123Z');
    expect(result.registry[0].nextQuestionAt).toBe('2026-10-04T00:00:30.124Z');
    expect(result.rows[1]).toEqual(snapshot.rows[1]);
  });
  it('preserves missing/failed contract as unavailable, never empty data', async () => {
    databaseError = { code: 'PGRST202', message: 'Missing fsrs_vocabulary_snapshot private details' };
    await expect(read()).rejects.toMatchObject({ code: 'fsrs_storage_unavailable' });
    client.rpc.mockRejectedValue(new Error('private URL and token'));
    await expect(read()).rejects.toMatchObject({ code: 'fsrs_storage_unavailable' });
  });
  it.each(['meaning', 'created_at', 'interval', 'last_reviewed_at', 'next_review_at', 'source_material_id'])(
    'does not accept incomplete raw display field %s as an empty value', async field => {
      delete snapshot.rows[0][field];
      await expect(read()).rejects.toMatchObject({ code: 'fsrs_snapshot_unavailable' });
    });
});

describe('atomic manual vocabulary save server boundary', () => {
  it('sends only normalized text intent and server-created full New state to one atomic RPC', async () => {
    const input = body(); input.vocabulary = { word_text: '  Cafe\u0301  ', meaning: ' coffee ', language: 'French' };
    const result = await save(input);
    expect(result).toMatchObject({ ok: true, created: true, enrolled: true, requestedCardId: cardId, vocabularyId: cardId });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('fsrs_save_manual_vocabulary', { p_actor: actor,
      p_request: { ...input, vocabulary: { word_text: 'Café', base_form: 'café', meaning: 'coffee', furigana: '', pos: '', language: 'French' } },
      p_initial_card: expect.objectContaining({ state: 'New', revision: 0, reps: 0, introducedAt: now, due: '2026-10-04T00:00:30.000Z' }),
    });
  });
  it('preserves an existing duplicate actual ID/meaning/source without enrolling or resetting it', async () => {
    receipt = { version: 1, actorId: actor, operationId: 'save-1', requestedCardId: cardId, vocabularyId: legacyId,
      created: false, enrolled: false, duplicate: false, row: { ...raw(legacyId), meaning: 'old personal meaning', interval: 9 },
      state: registry(legacyId, false), now };
    const result = await save();
    expect(result.row).toEqual(receipt.row); expect(result.vocabularyId).toBe(legacyId); expect(result.state.card).toBeNull();
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });
  it('matches normalized existing identity without rewriting the old Unicode/whitespace bytes', async () => {
    const input = body(); input.vocabulary = { word_text: 'Café', language: 'French' };
    receipt = { version: 1, actorId: actor, operationId: 'save-1', requestedCardId: cardId, vocabularyId: legacyId,
      created: false, enrolled: false, duplicate: false, row: { ...raw(legacyId), word_text: ' Cafe\u0301 ', language: 'French' },
      state: registry(legacyId, false), now };
    expect((await save(input)).row.word_text).toBe(' Cafe\u0301 ');
  });
  it('save retries accept current canonical state after later grading without trying to reset it', async () => {
    const graded = scheduleFsrsReview(introduceFsrsCard(now), 3, '2026-10-04T00:00:35.000Z').card;
    receipt = { version: 1, actorId: actor, operationId: 'save-1', requestedCardId: cardId, vocabularyId: cardId,
      created: true, enrolled: true, duplicate: true, row: { ...raw(), meaning: 'later edited meaning' }, state: { ...registry(), card: graded, nextQuestionAt: graded.due }, now };
    const result = await save(body(), '2026-10-05T00:00:00.000Z');
    expect(result.state.card).toEqual(graded); expect(result.duplicate).toBe(true);
  });
  it.each([{ nextCard: {} }, { now }, { userId: actor }, { operationId: '' }, { cardId: 'bad' }, { vocabulary: null },
    { vocabulary: { ...body().vocabulary, interval: 0 } }, { vocabulary: { ...body().vocabulary, meaning: null } },
    { vocabulary: { ...body().vocabulary, language: 'Unknown' } }, { vocabulary: { ...body().vocabulary, pos: [] } },
    { vocabulary: { ...body().vocabulary, word_text: 'x'.repeat(201) } }, { vocabulary: { ...body().vocabulary, meaning: 'x'.repeat(2001) } },
    { vocabulary: { ...body().vocabulary, word_text: '\u0000' } },
    { vocabulary: { ...body().vocabulary, meaning: '\ud800' } }])('rejects forged or unbounded input before persistence: %j', async patch => {
    await expect(save({ ...body(), ...patch })).rejects.toMatchObject({ status: 400 });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it('binds pending intent to the authenticated account and honors Korean readiness before a save', async () => {
    await expect(save({ ...body(), accountId: other })).rejects.toMatchObject({ code: 'fsrs_account_changed', status: 409 });
    authClient.rpc.mockResolvedValue({ data: { version: 1, languages: {} } });
    await expect(save()).rejects.toMatchObject({ code: 'fsrs_storage_unavailable' });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it.each(['fsrs_storage_disabled', 'fsrs_manual_save_replay_mismatch', 'vocabulary_excluded'])('does not fall back to any legacy insert on %s', async message => {
    databaseError = { code: '55000', message };
    await expect(save()).rejects.toMatchObject({ status: message.includes('disabled') ? 503 : 409 });
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });
  it('rejects a forged response identity and partial created-without-enrollment receipt', async () => {
    receipt = { version: 1, actorId: other, operationId: 'save-1', requestedCardId: cardId, vocabularyId: cardId,
      created: true, enrolled: true, duplicate: false, row: raw(), state: registry(), now };
    await expect(save()).rejects.toMatchObject({ code: 'fsrs_save_receipt_invalid' });
    receipt.actorId = actor; receipt.enrolled = false;
    await expect(save()).rejects.toMatchObject({ code: 'fsrs_save_receipt_invalid' });
  });
});

describe('vocabulary API new branches keep real authentication and old context contract', () => {
  it('does not construct the service client before successful cookie authentication', async () => {
    mocks.authenticate.mockResolvedValue({ error: 'login', status: 401 });
    expect((await GET(new Request('https://fixture.test/api/learning/vocabulary?view=learning'))).status).toBe(401);
    expect((await post(body())).status).toBe(401); expect(mocks.service).not.toHaveBeenCalled();
  });
  it('GET learning is complete/private and rejects mixed context parameters', async () => {
    const response = await GET(new Request('https://fixture.test/api/learning/vocabulary?view=learning'));
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual(snapshot);
    expect((await GET(new Request(`https://fixture.test/api/learning/vocabulary?view=learning&id=${cardId}`))).status).toBe(400);
  });
  it('summary returns only allowed scalar row fields and the same complete full-state registry', async () => {
    snapshot.rows[0].etymology = { secret: 'heavy field' };
    snapshot.rows[0].source_paragraph = 'heavy original';
    const response = await GET(new Request('https://fixture.test/api/learning/vocabulary?view=learning&fields=summary'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.rows[0]).toMatchObject({ id: cardId, user_id: actor, word_text: '책', meaning: '书' });
    expect(data.rows[0]).not.toHaveProperty('source_sentence'); expect(data.rows[0]).not.toHaveProperty('etymology');
    expect(data.rows[0]).not.toHaveProperty('source_paragraph'); expect(data.registry).toEqual(snapshot.registry);
    expect((await GET(new Request('https://fixture.test/api/learning/vocabulary?view=learning&fields=anything'))).status).toBe(400);
  });
  it('rejects cross-origin/non-JSON/oversized save before service persistence', async () => {
    expect((await post(body(), { Origin: 'https://other.test' })).status).toBe(403);
    expect((await post(body(), { 'Content-Type': 'text/plain' })).status).toBe(400);
    expect((await post({ ...body(), vocabulary: { ...body().vocabulary, meaning: 'x'.repeat(9000) } })).status).toBe(400);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it('bounds chunked JSON before parsing and retains null/array input as controlled 400', async () => {
    expect((await post(null)).status).toBe(400); expect((await post([])).status).toBe(400);
    expect((await post({ action: 'save', padding: 'x'.repeat(66000) })).status).toBe(400);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it('sanitizes snapshot/transaction failures instead of leaking SQL content or returning an empty success', async () => {
    databaseError = { message: 'secret SQL person content' };
    const response = await GET(new Request('https://fixture.test/api/learning/vocabulary?view=learning'));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ ok: false, code: 'fsrs_storage_unavailable' });
  });
  it('manual normalization is pure and preserves caller source object', () => {
    const input = body(), before = clone(input);
    expect(normalizeManualVocabularyRequest(input, actor).vocabulary.word_text).toBe('책');
    expect(input).toEqual(before);
    expect(() => validateVocabularyLearningSnapshot({ ...snapshot, actorId: other }, actor)).toThrow('fsrs_snapshot_unavailable');
  });
});
