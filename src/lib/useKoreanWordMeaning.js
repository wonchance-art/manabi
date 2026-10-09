'use client';
import {useEffect, useRef, useState} from 'react';
import {callGemini} from './gemini';
import {viewerCacheKey} from './viewerReliability';
import {buildKoreanWordMeaningPrompt, parseKoreanWordMeaning, KOREAN_WORD_MEANING_VERSION} from './koreanWordMeaning';

const idle = Object.freeze({status: 'idle', lexicalMeaning: ''});
const aborted = () => Object.assign(new Error('Korean meaning request cancelled'), {name: 'AbortError'});

// One page owns the store. Consumers share a request, never another account's active state.
export function createKoreanWordMeaningStore({generate = callGemini, cacheKey = viewerCacheKey,
  storage = () => globalThis.localStorage, current = () => true, changed = () => {}, timeoutMs = 30000} = {}) {
  const entries = new Map();
  const peek = input => input && current(input) ? entries.get(input.key)?.state || idle : idle;
  function acquire(input) {
    if (!input || !current(input)) return {promise: Promise.reject(aborted()), release() {}};
    let entry = entries.get(input.key);
    if (entry?.state.status === 'ready') return {promise: Promise.resolve(entry.state), release() {}};
    if (!entry?.pending) {
      const controller = new AbortController();
      entry = {controller, users: 0, pending: true, state: {...idle, status: 'loading'}};
      entries.set(input.key, entry);
      const valid = () => !controller.signal.aborted && entries.get(input.key) === entry && current(input);
      let timer;
      const cancelled = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(aborted()), {once: true}));
      const work = (async () => {
        const key = await cacheKey(KOREAN_WORD_MEANING_VERSION, input.accountId, input.key);
        if (!valid()) throw aborted();
        try {
          const cached = storage()?.getItem(key);
          if (cached) {
            const result = parseKoreanWordMeaning(cached, input.lemma);
            if (result.lemmaStatus === 'matched') return result;
          }
        } catch { /* Invalid or unavailable caches never supply a contextual fallback. */ }
        const raw = await generate(buildKoreanWordMeaningPrompt(input), controller.signal, {responseMimeType: 'application/json', temperature: 0});
        if (!valid()) throw aborted();
        const result = parseKoreanWordMeaning(raw, input.lemma);
        if (result.lemmaStatus === 'matched') {
          try { storage()?.setItem(key, JSON.stringify(result)); } catch { /* Reading works without storage. */ }
        }
        return result;
      })();
      timer = setTimeout(() => { entry.timedOut = true; controller.abort(); }, timeoutMs);
      entry.promise = Promise.race([work, cancelled]).then(result => {
        if (!valid()) throw aborted();
        entry.state = {...result, status: result.lemmaStatus === 'matched' ? 'ready' : 'uncertain'};
        return entry.state;
      }).catch(error => {
        if (entries.get(input.key) === entry && current(input)) entry.state = {...idle, status: 'error'};
        throw error;
      }).finally(() => { clearTimeout(timer); entry.pending = false; changed(); });
      changed();
    }
    entry.users += 1;
    let released = false;
    return {promise: entry.promise, release() {
      if (released) return;
      released = true; entry.users -= 1;
      if (entry.users === 0 && entry.pending) {
        if (entries.get(input.key) === entry) entries.delete(input.key);
        entry.controller.abort();
      }
    }};
  }
  function cancelAll() { for (const entry of entries.values()) entry.controller?.abort(); entries.clear(); }
  return {peek, acquire, cancelAll};
}

export function useKoreanWordMeaning({ownerScope, input, enabled}) {
  const [, render] = useState(0), [retry, setRetry] = useState(0);
  const latest = useRef(ownerScope); latest.current = ownerScope;
  const storeRef = useRef(null);
  // Scope comparison is synchronous: effects must not expose the old ready value for one render.
  if (!storeRef.current || storeRef.current.ownerScope !== ownerScope) {
    storeRef.current?.store.cancelAll();
    const scope = ownerScope;
    storeRef.current = {ownerScope, store: createKoreanWordMeaningStore({current: () => latest.current === scope,
      changed: () => { if (latest.current === scope) render(value => value + 1); }})};
  }
  const store = storeRef.current.store;
  useEffect(() => () => store.cancelAll(), [store]);
  const key = enabled ? input?.key || '' : '';
  useEffect(() => {
    if (!key) return;
    const request = store.acquire(input);
    request.promise.catch(() => {});
    return request.release;
  // The input key contains its complete immutable snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, key, retry]);
  return {selected: enabled ? store.peek(input) : idle, peek: store.peek,
    ensure: async candidate => {
      const request = store.acquire(candidate);
      try { return await request.promise; } finally { request.release(); }
    },
    retry: () => setRetry(value => value + 1)};
}
