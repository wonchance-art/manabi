import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertCachedLegacyFsrsAllowed, assertLegacyFsrsAllowed, isFsrsLegacyWriteError, rememberFsrsEnrollments } from '../fsrsLegacyBoundary';
import { flushReviews } from '../reviewOutbox';

describe('legacy full-state isolation boundary', () => {
  afterEach(() => vi.unstubAllGlobals());
  const request = { userId: 'boundary-alice', cardId: 'boundary-word', itemKey: 'word', language: 'English' };
  it('checks the real RPC actor and complete response before allowing a legacy write', async () => {
    const client = { rpc: vi.fn(async () => ({ data: { version: 1, actorId: request.userId, enrolled: false } })) };
    await expect(assertLegacyFsrsAllowed(client, request)).resolves.toBeUndefined();
    expect(client.rpc).toHaveBeenCalledWith('fsrs_legacy_boundary', { p_card_id: request.cardId, p_item_key: 'word', p_language: 'English' });
    client.rpc.mockResolvedValue({ data: { version: 1, actorId: 'different-account', enrolled: false } });
    await expect(assertLegacyFsrsAllowed(client, request)).rejects.toMatchObject({ code: 'fsrs_account_changed' });
  });
  it('keeps unknown responses and outages closed, allowing only exact missing-contract compatibility', async () => {
    for (const response of [{}, { data: { version: 1, enrolled: false } }, { error: { code: '401' } },
      { error: { code: 'PGRST202', message: 'missing learning_language_capabilities' } }]) {
      await expect(assertLegacyFsrsAllowed({ rpc: async () => response }, request)).rejects.toMatchObject({ code: 'fsrs_boundary_unavailable' });
    }
    await expect(assertLegacyFsrsAllowed({ rpc: async () => { throw Error('offline'); } }, request)).rejects.toThrow();
    await expect(assertLegacyFsrsAllowed({ rpc: async () => ({ error: { code: 'PGRST202', message: 'Could not find function public.fsrs_legacy_boundary in the schema cache' } }) }, request)).resolves.toBeUndefined();
  });
  it('positive enrollment evidence never downgrades to legacy even if the endpoint later disappears', async () => {
    const actor = 'sticky-alice', card = 'sticky-card';
    await expect(assertLegacyFsrsAllowed({ rpc: async () => ({ data: { version: 1, actorId: actor, enrolled: true } }) },
      { userId: actor, cardId: card })).rejects.toMatchObject({ code: 'fsrs_legacy_write_blocked' });
    expect(() => assertCachedLegacyFsrsAllowed(actor, card)).toThrow();
    const client = { rpc: vi.fn() };
    await expect(assertLegacyFsrsAllowed(client, { userId: actor, cardId: card })).rejects.toThrow();
    expect(client.rpc).not.toHaveBeenCalled();
    expect(() => assertCachedLegacyFsrsAllowed('other-actor', card)).not.toThrow();
    rememberFsrsEnrollments(actor, []);
    expect(() => assertCachedLegacyFsrsAllowed(actor, card)).toThrow();
  });
  it.each(['fsrs_legacy_write_blocked', 'fsrs_legacy_review_blocked', 'fsrs_legacy_event_blocked', 'fsrs_enrolled_card_protected'])(
    'treats SQL %s as terminal, never a queued transient success', message => {
      expect(isFsrsLegacyWriteError({ code: '55000', message })).toBe(true);
    });
  it('retains positive evidence after module reload and scopes it to its account', async () => {
    const data = new Map();
    vi.stubGlobal('localStorage', { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) });
    rememberFsrsEnrollments('reload-alice', ['reload-card']);
    vi.resetModules();
    const reloaded = await import('../fsrsLegacyBoundary');
    expect(() => reloaded.assertCachedLegacyFsrsAllowed('reload-alice', 'reload-card')).toThrow('fsrs_legacy_write_blocked');
    expect(() => reloaded.assertCachedLegacyFsrsAllowed('reload-bob', 'reload-card')).not.toThrow();
    reloaded.rememberFsrsEnrollments('reload-alice', []);
    expect(() => reloaded.assertCachedLegacyFsrsAllowed('reload-alice', 'reload-card')).toThrow();
  });
  it('does not mistake blocked local storage for permission to write an enrolled card', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('quota'); } });
    rememberFsrsEnrollments('limited-alice', ['limited-card']);
    expect(() => assertCachedLegacyFsrsAllowed('limited-alice', 'limited-card')).toThrow();
    await expect(assertLegacyFsrsAllowed({ rpc: async () => { throw Error('offline'); } },
      { userId: 'unseen-alice', cardId: 'unseen-card' })).rejects.toThrow('fsrs_boundary_unavailable');
  });
  it('legacy flush never consumes tagged revisioned operations, even with injected loaders', async () => {
    const client = { from: vi.fn(), rpc: vi.fn() }, remove = vi.fn();
    const result = await flushReviews(client, 'alice', {
      load: async () => [{ seq: 4, userId: 'alice', kind: 'fsrs-operation-v1', accountId: 'alice' }], remove,
    });
    expect(result).toEqual({ sent: 0, kept: 0, applied: 0 });
    expect(client.from).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
