import {afterEach, describe, expect, it, vi} from 'vitest';
vi.mock('../gemini', () => ({callGemini:vi.fn()}));
vi.mock('../viewerReliability', () => ({viewerCacheKey:vi.fn()}));
import {createKoreanWordMeaningStore} from '../useKoreanWordMeaning';

const input = {key:'alice:second:ko',accountId:'alice',surface:'갔어요',lemma:'가다',sentence:'어제 갔어요.',locale:'ko',pos:'동사'};
const raw = patch => JSON.stringify({lemma:'가다',lemmaStatus:'matched',lexicalMeaning:'다른 곳으로 이동하다',...patch});
const tick = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(yes=>{resolve=yes;}); return {promise,resolve}; };
function fixture(options = {}) {
  const cache = new Map(), generate = vi.fn(async()=>raw());
  const store = createKoreanWordMeaningStore({generate,cacheKey:async(_,actor,key)=>`${actor}:${key}`,
    storage:()=>({getItem:key=>cache.get(key),setItem:(key,value)=>cache.set(key,value)}),...options});
  return {store,cache,generate};
}
afterEach(()=>vi.useRealTimers());

describe('Korean lexical request lifecycle', () => {
  it('generates lexical help even in the source locale, then reuses a validated cache', async () => {
    const f=fixture(), first=f.store.acquire(input);
    expect((await first.promise).lexicalMeaning).toBe('다른 곳으로 이동하다'); first.release();
    const second=f.store.acquire(input); await second.promise; second.release();
    expect(f.generate).toHaveBeenCalledTimes(1); expect(f.cache.size).toBe(1);
    f.store.cancelAll();
    const third=f.store.acquire(input); await third.promise; third.release();
    expect(f.generate).toHaveBeenCalledTimes(1);
  });
  it('shares a pending request between the card display and its save action without cancelling the latter', async () => {
    const pending=deferred(), f=fixture({generate:vi.fn(()=>pending.promise)});
    const card=f.store.acquire(input), list=f.store.acquire(input);
    await tick(); card.release();
    pending.resolve(raw());
    expect((await list.promise).status).toBe('ready'); list.release();
    expect(await card.promise).toEqual(f.store.peek(input));
  });
  it('aborts an abandoned card even if the provider ignores cancellation', async () => {
    const pending=deferred(), f=fixture({generate:()=>pending.promise});
    const request=f.store.acquire(input), rejected=expect(request.promise).rejects.toMatchObject({name:'AbortError'});
    await tick(); request.release(); await rejected;
    pending.resolve(raw()); await tick();
    expect(f.store.peek(input).status).toBe('idle'); expect(f.cache.size).toBe(0);
  });
  it('hides old ready help synchronously on account/source/locale scope changes', async () => {
    let current=true;
    const f=fixture({current:()=>current}), request=f.store.acquire(input);
    await request.promise; request.release(); current=false;
    expect(f.store.peek(input).status).toBe('idle');
    await expect(f.store.acquire(input).promise).rejects.toMatchObject({name:'AbortError'});
  });
  it('discards an old account response before caching it', async () => {
    let current=true;
    const pending=deferred(), f=fixture({current:()=>current,generate:()=>pending.promise});
    const request=f.store.acquire(input), rejected=expect(request.promise).rejects.toMatchObject({name:'AbortError'});
    await tick(); current=false; pending.resolve(raw()); await rejected; request.release();
    expect(f.cache.size).toBe(0); expect(f.store.peek(input).status).toBe('idle');
  });
  it('ends loading at the deadline and never saves a late result', async () => {
    vi.useFakeTimers();
    const pending=deferred(), f=fixture({generate:()=>pending.promise,timeoutMs:30000});
    const request=f.store.acquire(input), rejected=expect(request.promise).rejects.toMatchObject({name:'AbortError'});
    await tick(); await vi.advanceTimersByTimeAsync(30000); await rejected; request.release();
    expect(f.store.peek(input).status).toBe('error');
    pending.resolve(raw()); await tick(); expect(f.cache.size).toBe(0);
  });
  it('regenerates malformed/old contextual caches and does not cache uncertainty', async () => {
    const f=fixture(); f.cache.set(`${input.accountId}:${input.key}`,JSON.stringify({meaning:'갔다'}));
    const a=f.store.acquire(input); await a.promise; a.release(); expect(f.generate).toHaveBeenCalledTimes(1);
    const uncertain=fixture({generate:()=>Promise.resolve(raw({lemmaStatus:'uncertain',lexicalMeaning:''}))});
    const b=uncertain.store.acquire(input); expect((await b.promise).status).toBe('uncertain'); b.release();
    expect(uncertain.cache.size).toBe(0);
  });
  it('supports explicit retry after provider failure without falling back to the contextual meaning', async () => {
    const generate=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(raw());
    const f=fixture({generate}), first=f.store.acquire(input);
    await expect(first.promise).rejects.toThrow('offline'); first.release();
    expect(f.store.peek(input).lexicalMeaning).toBe('');
    const second=f.store.acquire(input); expect((await second.promise).status).toBe('ready'); second.release();
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
