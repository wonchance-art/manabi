import fs from 'node:fs';
import path from 'node:path';
import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 계약: 아는 단어(O) 낙관 갱신 — 누른 순간 두 캐시에 반영, 실패하면 그 요청 몫만 되돌리고 알린다.
// 같은 단어 요청은 하나만(mutateAsync는 진행 중 약속을 다시 준다). 레벨 목록의 「풀고 담기」는 서버가 푼 뒤에만 담는다.

const h = vi.hoisted(() => ({ calls: [], gate: null }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../ToastContext', () => ({ useToast: () => () => {} }));
vi.mock('../knownWords', () => ({
  fetchKnownWords: vi.fn(async () => []),
  markKnown: vi.fn((...args) => { h.calls.push(['mark', ...args]); return h.gate(args); }),
  unmarkKnown: vi.fn((...args) => { h.calls.push(['unmark', ...args]); return h.gate(args); }),
}));
const { knownWordsMutationOptions, createKnownWordRequests } = await import('../useKnownWords.js');

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const ja = ['known-words', 'u1', 'ja'], all = ['known-words-all', 'u1'];
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const flush = () => new Promise((r) => setTimeout(r, 0));

let client, toast, gates;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  toast = vi.fn();
  gates = [];
  h.calls = [];
  h.gate = () => { const d = deferred(); gates.push(d); return d.promise; };
});
afterEach(() => client.clear());

const observer = () => new MutationObserver(client, knownWordsMutationOptions({ client, toast, isActiveOwner: (id) => id === 'u1' }));

describe('낙관 반영 · 되돌리기', () => {
  it('표시는 누른 순간 두 캐시에 들어가고, 성공하면 그대로 확정 · 재조회한다', async () => {
    client.setQueryData(ja, [{ lang: 'ja', word_text: '猫' }]);
    client.setQueryData(all, [{ lang: 'zh', word_text: '学' }, { lang: 'ja', word_text: '猫' }]);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const done = observer().mutate({ accountId: 'u1', lang: 'ja', wordText: '犬', known: true });
    await flush();
    expect(client.getQueryData(ja)).toEqual([{ lang: 'ja', word_text: '猫' }, { lang: 'ja', word_text: '犬' }]);
    expect(client.getQueryData(all)).toContainEqual({ lang: 'ja', word_text: '犬' });
    expect(gates).toHaveLength(1); // 서버 응답 전
    gates[0].resolve();
    await done;
    expect(client.getQueryData(ja)).toEqual([{ lang: 'ja', word_text: '猫' }, { lang: 'ja', word_text: '犬' }]);
    expect(invalidate.mock.calls.map(([arg]) => arg.queryKey[0])).toEqual(expect.arrayContaining(['known-words', 'known-words-all', 'vocabulary-exclusions', 'due-vocab-index']));
    expect(toast).not.toHaveBeenCalled();
  });

  it('쓰기가 나가 있는 동안만 track되고 응답 뒤(성공 · 실패) 빠진다', async () => {
    const live = new Set();
    const track = vi.fn((body) => { live.add(body.wordText); return () => live.delete(body.wordText); });
    const obs = new MutationObserver(client, knownWordsMutationOptions({ client, toast, isActiveOwner: () => true, track }));
    const ok = obs.mutate({ accountId: 'u1', lang: 'ja', wordText: '犬', known: true });
    await flush();
    expect([...live]).toEqual(['犬']);
    gates[0].resolve();
    await ok;
    expect(live.size).toBe(0);
    const bad = obs.mutate({ accountId: 'u1', lang: 'ja', wordText: '猫', known: false, removeKeys: ['猫'] }).catch((e) => e);
    await flush();
    expect([...live]).toEqual(['猫']);
    gates[1].reject(new Error('offline'));
    await bad;
    expect(live.size).toBe(0);
    expect(track).toHaveBeenCalledTimes(2);
  });

  it('실패하면 되돌리고 한 번 알린다 — 해제 실패면 지운 줄이 돌아온다', async () => {
    client.setQueryData(ja, [{ lang: 'ja', word_text: '猫' }, { lang: 'ja', word_text: '犬' }]);
    const done = observer().mutate({ accountId: 'u1', lang: 'ja', wordText: '犬', known: false, removeKeys: ['犬'] }).catch((e) => e);
    await flush();
    expect(client.getQueryData(ja)).toEqual([{ lang: 'ja', word_text: '猫' }]);
    gates[0].reject(new Error('offline'));
    expect(await done).toBeInstanceOf(Error);
    expect(client.getQueryData(ja)).toEqual([{ lang: 'ja', word_text: '猫' }, { lang: 'ja', word_text: '犬' }]);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][1]).toBe('error');
  });

  it('되돌리기는 그 요청 몫만 — 함께 진행 중인 다른 단어의 반영은 남긴다', async () => {
    client.setQueryData(ja, []);
    const first = observer().mutate({ accountId: 'u1', lang: 'ja', wordText: '犬', known: true }).catch(() => {});
    const second = observer().mutate({ accountId: 'u1', lang: 'ja', wordText: '鳥', known: true });
    await flush();
    expect(client.getQueryData(ja)).toEqual([{ lang: 'ja', word_text: '犬' }, { lang: 'ja', word_text: '鳥' }]);
    gates[0].reject(new Error('offline'));
    await first;
    expect(client.getQueryData(ja)).toEqual([{ lang: 'ja', word_text: '鳥' }]);
    gates[1].resolve();
    await second;
    expect(client.getQueryData(ja)).toEqual([{ lang: 'ja', word_text: '鳥' }]);
  });

  it('받지 않은 캐시는 낙관 반영으로 만들지 않는다(한 줄짜리 목록이 60초 동안 정본처럼 보이지 않게)', async () => {
    client.setQueryData(ja, []);
    const done = observer().mutate({ accountId: 'u1', lang: 'ja', wordText: '犬', known: true });
    await flush();
    expect(client.getQueryData(all)).toBeUndefined();
    gates[0].resolve();
    await done;
  });

  it('다른 계정 화면이 된 뒤의 실패는 알리지 않는다', async () => {
    const options = knownWordsMutationOptions({ client, toast, isActiveOwner: () => false });
    const done = new MutationObserver(client, options).mutate({ accountId: 'u1', lang: 'ja', wordText: '犬', known: true }).catch(() => {});
    await flush();
    gates[0].reject(new Error('offline'));
    await done;
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('같은 단어 요청은 하나', () => {
  const setup = (owner = 'u1') => {
    const mutateAsync = vi.fn(() => { const d = deferred(); gates.push(d); return d.promise; });
    const changes = [];
    const requests = createKnownWordRequests({ getOwner: () => owner, mutateAsync, onPendingChange: (keys) => changes.push([...keys]) });
    return { requests, mutateAsync, changes };
  };

  it('같은 방향이면 진행 중 약속을 다시 주고(요청 1회), 반대 방향이면 거절한다', async () => {
    const { requests, mutateAsync, changes } = setup();
    const a = requests.mutateAsync({ lang: 'ja', wordText: '犬', known: true });
    const b = requests.mutateAsync({ lang: 'ja', wordText: '犬', known: true });
    requests.mutate({ lang: 'ja', wordText: '犬', known: true });
    expect(b).toBe(a);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ accountId: 'u1', lang: 'ja', wordText: '犬', known: true });
    await expect(requests.mutateAsync({ lang: 'ja', wordText: '犬', known: false })).rejects.toThrow('known_words_busy');
    expect(changes.at(-1)).toEqual(['u1:ja:犬']);
    gates[0].resolve('ok');
    await expect(a).resolves.toBe('ok');
    expect(changes.at(-1)).toEqual([]);
    requests.mutateAsync({ lang: 'ja', wordText: '犬', known: false });
    expect(mutateAsync).toHaveBeenCalledTimes(2); // 끝난 뒤에는 다시 보낸다
  });

  it('로그인 전에는 보내지 않는다 · mutate는 실패를 흘리지 않는다', async () => {
    const { requests, mutateAsync } = setup(null);
    await expect(requests.mutateAsync({ lang: 'ja', wordText: '犬', known: true })).rejects.toThrow('known_words_signed_out');
    expect(() => requests.mutate({ lang: 'ja', wordText: '犬', known: true })).not.toThrow();
    expect(mutateAsync).not.toHaveBeenCalled();
    const signed = setup();
    signed.requests.mutate({ lang: 'ja', wordText: '犬', known: true });
    gates[0].reject(new Error('offline'));
    await flush(); // 처리되지 않은 거절 없음
  });
});

describe('레벨 목록 배선', () => {
  const page = read('src/views/LevelListPage.jsx');

  it('「풀고 담기」와 옮김 토스트는 서버 응답을 기다린다 — 화면 상태(effect)로 기다리지 않는다', () => {
    expect(page).not.toMatch(/pendingStudy|pendingExclude/);
    const markX = page.match(/const markX = async \(entry\) => \{[\s\S]*?\n {2}\};/)?.[0];
    expect(markX).toMatch(/try \{ await known\.mutation\.mutateAsync\(unmarkRequest\(entry\.key\)\); \} catch \{ return undefined; \}\n\s*return save\(entry\);/);
    const exclude = page.match(/const exclude = \(entry\) => \{[\s\S]*?\n {2}\};/)?.[0];
    expect(exclude).toContain('known.mutation.mutateAsync({ lang: conf.langCode, wordText: key, known: true }).then(() => {');
    expect(exclude).toContain("if (prefsRef.current.hideKnown) setToast({ message: '아는 단어로 옮겼어요'");
  });

  it('훅은 mutate · mutateAsync · isPending을 함께 내준다(뷰어 · 단어장 · 아는 단어 목록 그대로)', () => {
    const hook = read('src/lib/useKnownWords.js');
    expect(hook).toContain('mutation: { ...mutation, mutate: requests.current.mutate, mutateAsync: requests.current.mutateAsync } };');
    expect(read('src/views/ViewerPage.jsx')).toContain('knownState.mutation.mutate({ lang: knownLangCode, wordText: selectedKnownWord,');
    expect(read('src/components/VocabularyExclusionList.jsx')).toContain('disabled={known.mutation.isPending');
    expect(read('src/views/VocabPage.jsx')).toContain('knownDisabled={knownWords.mutation.isPending}');
  });
});
