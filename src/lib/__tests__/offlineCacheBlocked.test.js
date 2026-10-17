// a3ba 리뷰 ⑤ — offlineCache.openDb가 blocked(다른 탭이 옛 판 연결을 쥠)에서 끝나지 않아 캐시를 기다리는 화면이 묶였다.
// blocked면 실패로 끝내고 기억을 비워 다음 호출이 다시 연다. 막혔던 요청이 나중에 열리면 그 연결은 닫는다.
// (「loading」 상한 20초 → error · 다시 시도는 이번 범위 밖 — 메모.)
import { afterEach, describe, expect, it, vi } from 'vitest';

function fakeIndexedDb() {
  const requests = [];
  return { requests, api: { open: vi.fn(() => { const req = { result: { close: vi.fn(), objectStoreNames: { contains: () => true } } }; requests.push(req); return req; }) } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('offlineCache.openDb — blocked는 끝나는 실패', () => {
  it('blocked면 거절하고, 다음 호출은 새로 연다', async () => {
    const fake = fakeIndexedDb(); vi.stubGlobal('indexedDB', fake.api);
    const { openDb } = await import('../offlineCache.js');
    const first = openDb();
    fake.requests[0].onblocked();
    await expect(first).rejects.toThrow('IndexedDB blocked');
    const second = openDb();
    expect(fake.api.open).toHaveBeenCalledTimes(2);
    fake.requests[1].onsuccess();
    await expect(second).resolves.toBe(fake.requests[1].result);
  });
  it('막혔던 요청이 나중에 열리면 그 연결은 닫는다(쓰지 않음)', async () => {
    const fake = fakeIndexedDb(); vi.stubGlobal('indexedDB', fake.api);
    const { openDb } = await import('../offlineCache.js');
    const first = openDb();
    fake.requests[0].onblocked();
    await expect(first).rejects.toThrow('IndexedDB blocked');
    fake.requests[0].onsuccess();
    expect(fake.requests[0].result.close).toHaveBeenCalledTimes(1);
  });
  it('정상 열림은 그대로 한 번 열고 같은 연결을 돌려준다', async () => {
    const fake = fakeIndexedDb(); vi.stubGlobal('indexedDB', fake.api);
    const { openDb } = await import('../offlineCache.js');
    const a = openDb(), b = openDb();
    fake.requests[0].onsuccess();
    await expect(a).resolves.toBe(fake.requests[0].result);
    await expect(b).resolves.toBe(fake.requests[0].result);
    expect(fake.api.open).toHaveBeenCalledTimes(1);
    expect(fake.requests[0].result.close).not.toHaveBeenCalled();
  });
});
