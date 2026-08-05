import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

async function loadFetchHandler({ fetchResponse, putError }) {
  const handlers = new Map();
  const put = vi.fn(async () => {
    if (putError) throw putError;
  });
  const open = vi.fn(async () => ({ put }));
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const self = {
    addEventListener: (type, handler) => handlers.set(type, handler),
    clients: { claim: vi.fn(), matchAll: vi.fn(), openWindow: vi.fn() },
    location: { origin: 'https://manabi.example' },
    registration: { showNotification: vi.fn() },
    skipWaiting: vi.fn(),
  };
  vm.runInNewContext(source, {
    URL,
    console,
    self,
    caches: { keys: vi.fn(async () => []), match: vi.fn(async () => null), open },
    fetch: vi.fn(async () => fetchResponse),
  });
  return { handler: handlers.get('fetch'), open, put };
}

async function dispatchNavigation(handler, url = 'https://manabi.example/broken') {
  let responsePromise;
  handler({
    request: { method: 'GET', mode: 'navigate', url },
    respondWith: (promise) => { responsePromise = Promise.resolve(promise); },
  });
  return responsePromise;
}

describe('service worker navigation cache', () => {
  it.each([404, 500])('%i 실패 응답은 offline cache에 쓰지 않는다', async (status) => {
    const response = { ok: false, redirected: false, status, type: 'basic', url: 'https://manabi.example/broken', clone: vi.fn() };
    const { handler, open, put } = await loadFetchHandler({ fetchResponse: response });
    expect(await dispatchNavigation(handler)).toBe(response);
    expect(open).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('same-origin 200 navigation만 cache에 쓴다', async () => {
    const clone = { body: 'cached' };
    const response = { ok: true, redirected: false, status: 200, type: 'basic', url: 'https://manabi.example/home', clone: vi.fn(() => clone) };
    const { handler, open, put } = await loadFetchHandler({ fetchResponse: response });
    expect(await dispatchNavigation(handler, response.url)).toBe(response);
    expect(open).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(expect.objectContaining({ url: response.url }), clone);
  });

  it('redirected 200 navigation은 cache에 쓰지 않는다', async () => {
    const response = { ok: true, redirected: true, status: 200, type: 'basic', url: 'https://manabi.example/auth', clone: vi.fn() };
    const { handler, open } = await loadFetchHandler({ fetchResponse: response });
    expect(await dispatchNavigation(handler)).toBe(response);
    expect(open).not.toHaveBeenCalled();
  });

  it('cache 저장 실패가 정상 network 응답을 가리지 않는다', async () => {
    const response = { ok: true, redirected: false, status: 200, type: 'basic', url: 'https://manabi.example/home', clone: vi.fn(() => ({})) };
    const { handler, put } = await loadFetchHandler({ fetchResponse: response, putError: new Error('quota') });
    expect(await dispatchNavigation(handler, response.url)).toBe(response);
    expect(put).toHaveBeenCalledTimes(1);
  });
});
