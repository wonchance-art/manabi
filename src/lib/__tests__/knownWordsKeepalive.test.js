import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';

// 계약: 아는 단어 낙관 갱신(42d6ece9)은 화면을 먼저 바꾼다 — 응답 전에 탭을 닫거나 새로 고치면 쓰기가 말없이 사라질 수 있었다.
// 나가 있는 쓰기만 목록에 두고 pagehide에서 같은 PostgREST 요청을 keepalive로 다시 보낸다. 같은 단어는 마지막 쓰기만.

const session = { access_token: 'tok-u1', user: { id: 'u1' } };
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session } }) } } }));
vi.mock('../refVocabLookup', () => ({ encounterLookupLang: () => 'ja' }));
const { createKnownWordBeacon, sendKnownWordKeepalive } = await import('../knownWords.js');

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const target = () => { const listeners = {}; return { listeners, addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); } }; };
const add = (word, extra = {}) => ({ accountId: 'u1', lang: 'ja', wordText: word, known: true, ...extra });
const remove = (word, keys = [word], extra = {}) => ({ accountId: 'u1', lang: 'ja', wordText: word, known: false, removeKeys: keys, ...extra });
const opts = (fetchImpl) => ({ accessToken: 'tok', url: 'https://x.supabase.co', apiKey: 'anon', fetchImpl });

describe('sendKnownWordKeepalive — markKnown · unmarkKnown과 같은 요청을 keepalive로', () => {
  it('표시: upsert(on_conflict · ignore-duplicates) POST — 다시 보내도 한 줄', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    expect(await sendKnownWordKeepalive(add('猫'), opts(fetchImpl))).toBe(true);
    const [href, init] = fetchImpl.mock.calls[0];
    const u = new URL(href);
    expect(u.origin + u.pathname).toBe('https://x.supabase.co/rest/v1/user_known_words');
    expect(u.searchParams.get('on_conflict')).toBe('user_id,lang,word_text');
    expect(init).toMatchObject({ method: 'POST', keepalive: true });
    expect(init.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer tok', Prefer: 'resolution=ignore-duplicates,return=minimal' });
    expect(JSON.parse(init.body)).toEqual({ user_id: 'u1', lang: 'ja', word_text: '猫' });
  });

  it('해제: 지우는 키 전부를 in.(…)로 DELETE — 쉼표 · 따옴표가 든 표기도 한 값', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    expect(await sendKnownWordKeepalive(remove('猫', ['猫', 'a,b', 'say "hi"']), opts(fetchImpl))).toBe(true);
    const [href, init] = fetchImpl.mock.calls[0];
    const u = new URL(href);
    expect(Object.fromEntries(u.searchParams)).toEqual({ user_id: 'eq.u1', lang: 'eq.ja', word_text: 'in.("猫","a,b","say \\"hi\\"")' });
    expect(init).toMatchObject({ method: 'DELETE', keepalive: true });
    expect(init.body).toBeUndefined();
  });

  it('토큰 · 키가 없거나 응답 실패 · 예외면 false', async () => {
    const ok = vi.fn(async () => ({ ok: true }));
    expect(await sendKnownWordKeepalive(add('猫'), { ...opts(ok), accessToken: null })).toBe(false);
    expect(await sendKnownWordKeepalive(remove('猫', []), opts(ok))).toBe(false);
    expect(ok).not.toHaveBeenCalled();
    expect(await sendKnownWordKeepalive(add('猫'), opts(async () => ({ ok: false })))).toBe(false);
    expect(await sendKnownWordKeepalive(add('猫'), opts(async () => { throw new TypeError('offline'); }))).toBe(false);
  });
});

describe('createKnownWordBeacon — 나가 있는 쓰기만 · 같은 단어는 마지막 쓰기만', () => {
  it('track한 쓰기는 pagehide에서 그 계정 토큰으로 보내고, 응답 뒤 빠진 것은 보내지 않는다', async () => {
    const send = vi.fn(async () => true), t = target();
    const beacon = createKnownWordBeacon({ send, target: t });
    const untrackCat = beacon.track(add('猫'));
    beacon.track(add('犬'));
    await flush();
    untrackCat(); // 猫는 서버가 받았다
    expect(t.listeners.pagehide).toHaveLength(1);
    t.listeners.pagehide[0]();
    expect(send.mock.calls).toEqual([[add('犬'), { accessToken: 'tok-u1' }]]);
  });

  it('같은 단어의 나중 해제가 앞선 표시를 대신한다 — 닫혀도 지운 단어를 되살리지 않는다', async () => {
    const send = vi.fn(async () => true), t = target();
    const beacon = createKnownWordBeacon({ send, target: t });
    beacon.track(add('猫'));
    beacon.track(remove('猫', ['猫', 'ねこ']));
    beacon.track(add('ねこ')); // 해제가 지우던 키 하나를 다시 표시 — 그 해제도 이번 표시가 대신한다
    await flush();
    expect(beacon.size()).toBe(1);
    t.listeners.pagehide[0]();
    expect(send.mock.calls.map(([body]) => [body.wordText, body.known])).toEqual([['ねこ', true]]);
  });

  it('다른 계정 · 다른 언어 쓰기는 서로 대신하지 않는다 · 토큰은 그 계정 세션일 때만', async () => {
    const send = vi.fn(async () => true), t = target();
    const beacon = createKnownWordBeacon({ send, target: t });
    beacon.track(add('猫'));
    beacon.track(add('猫', { lang: 'zh' }));
    beacon.track(add('猫', { accountId: 'u2' })); // 지금 세션은 u1 — u2 토큰이 없어 보내지 않는다
    await flush();
    expect(beacon.size()).toBe(3);
    t.listeners.pagehide[0]();
    expect(send.mock.calls.map(([body, o]) => [body.accountId, body.lang, o.accessToken])).toEqual([['u1', 'ja', 'tok-u1'], ['u1', 'zh', 'tok-u1']]);
  });

  it('리스너는 하나 · 아무것도 없으면 보내지 않는다', async () => {
    const send = vi.fn(async () => true), t = target();
    const beacon = createKnownWordBeacon({ send, target: t });
    beacon.track(add('猫'))();
    beacon.track(add('犬'))();
    expect(t.listeners.pagehide).toHaveLength(1);
    t.listeners.pagehide[0]();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('배선 — 모든 아는 단어 쓰기(뷰어 · 단어 목록 · 단어장)가 지나는 mutationFn', () => {
  const hook = read('src/lib/useKnownWords.js');
  it('쓰기가 나가 있는 동안만 track하고, 성공이든 실패든 응답 뒤 뺀다', () => {
    const fn = sliceBetween(hook, 'mutationFn: async body => {', 'onMutate:');
    expect(fn).toMatch(/const untrack = track\(body\);\s*try \{\s*if \(body\.known\) await markKnown\(body\.accountId, body\.lang, body\.wordText\);\s*else await unmarkKnown\(body\.accountId, body\.lang, body\.removeKeys\);\s*\} finally \{ untrack\(\); \}/);
  });
  it('훅은 화면 공통 목록 하나(knownWordBeacon)에 track한다', () => {
    expect(hook).toContain('const knownWordBeacon = () => (beacon ||= createKnownWordBeacon());');
    expect(sliceBetween(hook, 'export function useKnownWords', 'return {')).toContain('track: body => knownWordBeacon().track(body)');
  });
});
