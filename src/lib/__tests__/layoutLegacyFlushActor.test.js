import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';

const source = readFileSync(new URL('../../components/Layout.jsx', import.meta.url), 'utf8');
const section = sliceBetween(source, '// 미전송 복습 동기화', '\n  // 복습 알림');
const effect = sliceBetween(section, '  useEffect(() => {').replaceAll('import(', 'loadModule(');
const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
function fixture() {
  const events = new Map(), toast = vi.fn(), dispatchEvent = vi.fn();
  let cleanup;
  const flushReviews = vi.fn(async () => ({ sent: 1 }));
  const c = { user: { id: 'actor-a' }, reviewActorRef: { current: 'actor-a' }, supabase: {}, toast,
    window: { addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key), dispatchEvent },
    CustomEvent: class { constructor(type) { this.type = type; } },
    loadModule: vi.fn(async () => ({ flushReviews, persistVocabGrade: vi.fn() })),
    useEffect: fn => { cleanup = fn(); } };
  const mount = () => new Function(...Object.keys(c), effect)(...Object.values(c));
  return { c, mount, flushReviews, cleanup: () => cleanup(), events, toast, dispatchEvent };
}

describe('automatic legacy flush follows the live Layout actor', () => {
  it('passes a live getter and suppresses stale notifications after an actor switch', async () => {
    const f = fixture(), reply = deferred(); f.flushReviews.mockReturnValue(reply.promise);
    f.mount(); await tick();
    const [client, actor, options] = f.flushReviews.mock.calls[0];
    expect(client).toBe(f.c.supabase); expect(actor).toBe('actor-a');
    expect(options.getAccountId()).toBe('actor-a');
    f.c.reviewActorRef.current = 'actor-b'; expect(options.getAccountId()).toBe('actor-b');
    reply.resolve({ sent: 1 }); await tick();
    expect(f.toast).not.toHaveBeenCalled(); expect(f.dispatchEvent).not.toHaveBeenCalled(); f.cleanup();
  });
  it('does not launch an old flush after an import resolves following cleanup', async () => {
    const f = fixture(), loaded = deferred(); f.c.loadModule.mockReturnValue(loaded.promise);
    f.mount(); f.cleanup(); loaded.resolve({ flushReviews: f.flushReviews, persistVocabGrade: vi.fn() });
    await tick(); expect(f.flushReviews).not.toHaveBeenCalled(); expect(f.events.size).toBe(0);
  });
  it('invalidates the getter on cleanup and keeps current-actor successful notifications', async () => {
    const f = fixture(); f.mount(); await tick();
    expect(f.toast).toHaveBeenCalledWith('복습 1개를 저장했어요.', 'success');
    expect(f.dispatchEvent).toHaveBeenCalledTimes(1);
    const options = f.flushReviews.mock.calls[0][2]; f.cleanup(); expect(options.getAccountId()).toBeNull();
  });
});
