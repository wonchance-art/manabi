// MUTATION-ACCOUNT-GEN-001 (2026-10-17 KST) — 로그아웃 · 다른 계정 로그인을 가로질러 실행 중이던 A의 mutation이 끝나며 onSuccess ·
// onError(되돌리기) · onSettled · mutate(…, { onSuccess })에서 setQueryData로 A의 자료를 다시 넣는다(계정을 모르는 키 — B가 그린다).
// react-query 내부 · mutation 옵션을 바꾸지 않고 mutation 캐시 이벤트로 시작 계정을 적어, 끝날 때 계정이 다르면 다음 차례에 한 번 더 비운다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { MutationObserver, QueryClient } from '@tanstack/query-core';
import { sliceBetween } from './helpers/sliceBetween';
import { ACCOUNT_FREE_QUERY_ROOTS, clearAccountQueries, watchAccountMutations } from '../accountQueryCache';

const ROOT = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const A_ROW = { id: 'X', owner: 'A', raw_text: 'A의 교정 결과' };

function setup({ guard = true } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 120000, retry: false }, mutations: { retry: false } } });
  const who = { current: 'A' };
  const later = [];
  const unsubscribe = guard ? watchAccountMutations(qc, { currentAccount: () => who.current, schedule: fn => later.push(fn) }) : () => {};
  // adoptUser 흉내 — 계정이 바뀌는 순간 비우고(AUTH-CACHE-CLEAR-001) 화면 계정을 바꾼다.
  const switchTo = next => { clearAccountQueries(qc); who.current = next; };
  const flush = () => { for (const fn of later.splice(0)) fn(); };
  return { qc, who, switchTo, flush, later, unsubscribe };
}
function startCorrection(qc, { write = 'onSuccess', fail = false } = {}) {
  const done = deferred();
  const options = { mutationFn: () => done.promise };
  if (write === 'onSuccess') options.onSuccess = () => qc.setQueryData(['material', 'X'], A_ROW);
  if (write === 'onSettled') options.onSettled = () => qc.setQueryData(['material', 'X'], A_ROW);
  if (write === 'onError') options.onError = () => qc.setQueryData(['material', 'X'], A_ROW); // 낙관적 쓰기 되돌리기
  const observer = new MutationObserver(qc, options);
  const unsub = observer.subscribe(() => {});
  const mutateOptions = write === 'mutate' ? { onSuccess: () => qc.setQueryData(['material', 'X'], A_ROW) } : undefined;
  const run = observer.mutate({ tokenId: 't1' }, mutateOptions).catch(() => {});
  return { finish: async () => { if (fail) done.reject(new Error('boom')); else done.resolve({ ok: true }); await run; await tick(); unsub(); } };
}

describe('재현 — 계정을 가로지른 mutation이 A의 자료를 다시 넣는다', () => {
  it('지킴 없이: 로그아웃 → B 로그인 뒤 끝난 A의 교정 onSuccess가 ["material","X"]에 A의 자료를 남긴다', async () => {
    const { qc, switchTo } = setup({ guard: false });
    const m = startCorrection(qc);
    switchTo(null); switchTo('B');
    await m.finish();
    expect(qc.getQueryData(['material', 'X'])).toEqual(A_ROW);
  });
});

describe('지킴 — 끝날 때 계정이 시작 때와 다르면 다음 차례에 한 번 더 비운다', () => {
  for (const write of ['onSuccess', 'onSettled', 'mutate']) {
    it(`${write}에서 쓴 A의 자료를 지운다`, async () => {
      const { qc, switchTo, flush, later } = setup();
      const m = startCorrection(qc, { write });
      switchTo(null); switchTo('B');
      await m.finish();
      expect(qc.getQueryData(['material', 'X'])).toEqual(A_ROW); // 콜백이 다 돌 때까지는 기다린다
      expect(later).toHaveLength(1);
      flush();
      expect(qc.getQueryData(['material', 'X'])).toBeUndefined();
    });
  }
  it('기본 차례(setTimeout 0)로도 mutate(…, { onSuccess })의 쓰기까지 지운다 — 실제 순서', async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const who = { current: 'A' };
    watchAccountMutations(qc, { currentAccount: () => who.current });
    const m = startCorrection(qc, { write: 'mutate' });
    clearAccountQueries(qc); who.current = 'B';
    await m.finish();
    await new Promise(r => setTimeout(r, 5));
    expect(qc.getQueryData(['material', 'X'])).toBeUndefined();
  });
  it('실패 뒤 onError의 되돌리기 쓰기(낙관적 업데이트 복원)도 지운다', async () => {
    const { qc, switchTo, flush } = setup();
    const m = startCorrection(qc, { write: 'onError', fail: true });
    switchTo('B');
    await m.finish(); flush();
    expect(qc.getQueryData(['material', 'X'])).toBeUndefined();
  });
  it('공개 정적 캐시(남기는 뿌리)는 그대로 둔다', async () => {
    const { qc, switchTo, flush } = setup();
    const m = startCorrection(qc);
    switchTo('B');
    for (const root of ACCOUNT_FREE_QUERY_ROOTS) qc.setQueryData([root], { shared: true });
    await m.finish(); flush();
    for (const root of ACCOUNT_FREE_QUERY_ROOTS) expect(qc.getQueryData([root])).toEqual({ shared: true });
  });
});

describe('지우지 않는 경우', () => {
  it('같은 계정 안에서 끝난 mutation은 아무것도 하지 않는다', async () => {
    const { qc, flush, later } = setup();
    const m = startCorrection(qc);
    await m.finish();
    expect(later).toEqual([]); // 차례를 잡지도 않는다(비우기 전에 확인)
    flush();
    expect(qc.getQueryData(['material', 'X'])).toEqual(A_ROW);
  });
  it('A → 손님 → A로 돌아온 뒤 끝난 것은 A 자신의 것이라 그대로', async () => {
    const { qc, switchTo, flush } = setup();
    const m = startCorrection(qc);
    switchTo(null); switchTo('A');
    await m.finish(); flush();
    expect(qc.getQueryData(['material', 'X'])).toEqual(A_ROW);
  });
  it('끝난 뒤 다음 차례 전에 A가 돌아왔으면 지우지 않는다', async () => {
    const { qc, switchTo, flush, who } = setup();
    const m = startCorrection(qc);
    switchTo(null);
    await m.finish();
    who.current = 'A';
    flush();
    expect(qc.getQueryData(['material', 'X'])).toEqual(A_ROW);
  });
  it('손님으로 시작한 mutation(공개 자료)은 로그인 뒤 끝나도 비우지 않는다 — 서버가 넣은 서재를 지우지 않게', async () => {
    const { qc, who, flush, later } = setup();
    who.current = null;
    const m = startCorrection(qc);
    who.current = 'A';
    qc.setQueryData(['personal-library', 'A'], { hydrated: true });
    await m.finish();
    expect(later).toEqual([]); // 차례를 잡지도 않는다(비우기 전에 확인)
    flush();
    expect(qc.getQueryData(['personal-library', 'A'])).toEqual({ hydrated: true });
  });
  it('B가 시작해 B로 끝난 mutation은 그대로(시작 계정은 mutate 순간에 적는다)', async () => {
    const { qc, switchTo, flush, later } = setup();
    switchTo('B');
    const m = startCorrection(qc);
    await m.finish();
    expect(later).toEqual([]); // 차례를 잡지도 않는다(비우기 전에 확인)
    flush();
  });
  it('구독 해제 뒤에는 아무것도 하지 않는다 · queryClient 없음도 안전', async () => {
    const { qc, switchTo, flush, later, unsubscribe } = setup();
    unsubscribe();
    const m = startCorrection(qc);
    switchTo('B');
    await m.finish();
    expect(later).toEqual([]); // 차례를 잡지도 않는다(비우기 전에 확인)
    flush();
    expect(() => watchAccountMutations(undefined)()).not.toThrow();
  });
});

describe('배선', () => {
  it('AuthProvider가 받은 queryClient에 지킴을 건다(구독 해제는 effect 정리)', () => {
    const src = read('src/lib/AuthContext.jsx');
    expect(src).toContain('useEffect(() => (queryClient ? watchAccountMutations(queryClient) : undefined), [queryClient]);');
    expect(src).toContain("import { watchAccountMutations } from './accountQueryCache';");
  });
  it('react-query 내부 · mutation 옵션을 바꾸지 않는다 — mutation 캐시 구독만', () => {
    const fn = sliceBetween(read('src/lib/accountQueryCache.js'), 'export function watchAccountMutations(', '/** 계정에 딸린 캐시를 모두 지운다.');
    expect(fn).toContain('cache.subscribe(');
    expect(fn).not.toMatch(/\.options\s*=|setMutationDefaults|config\.on|defaultMutationOptions/);
  });
  it('기본 계정 판정은 화면 계정(knownAccount — adoptUser가 적는 값)', () => {
    expect(read('src/lib/accountQueryCache.js')).toContain('export function watchAccountMutations(queryClient, { currentAccount = knownAccount, schedule = (fn) => setTimeout(fn, 0) } = {}) {');
    vi.restoreAllMocks();
  });
});
