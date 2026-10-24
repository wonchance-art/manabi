import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// PWA-SHELL-001 ⑤ — 화면 조각(RSC)은 network-first, 문서 이동은 탐색 미리 받기 응답을 먼저 쓴다.
// 실제 워커를 vm에 올려 fetch · activate 처리기를 직접 부른다(service-worker-cache.test.js와 같은 방식).
async function loadWorker({ fetchImpl, cached = null, navigationPreload } = {}) {
  const handlers = new Map();
  const put = vi.fn(async () => {});
  const open = vi.fn(async () => ({ put }));
  const match = vi.fn(async () => cached);
  const fetch = vi.fn(fetchImpl || (async () => { throw new TypeError('offline'); }));
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const self = {
    addEventListener: (type, handler) => handlers.set(type, handler),
    clients: { claim: vi.fn(), matchAll: vi.fn(), openWindow: vi.fn() },
    location: { origin: 'https://manabi.example' },
    registration: { showNotification: vi.fn(), navigationPreload },
    skipWaiting: vi.fn(),
  };
  const ErrorResponse = { error: () => ({ type: 'error' }) };
  vm.runInNewContext(source, { URL, console, self, caches: { keys: vi.fn(async () => []), match, open, delete: vi.fn() }, fetch, Response: ErrorResponse });
  return { handlers, fetch, put, open, match };
}

const ok = (url) => ({ ok: true, redirected: false, status: 200, type: 'basic', url, clone: vi.fn(() => ({ body: 'copy' })) });
function dispatch(handler, request, extra = {}) {
  let responded;
  handler({ request, respondWith: (p) => { responded = Promise.resolve(p); }, ...extra });
  return responded;
}
const rscRequest = (url, headers = {}) => ({ method: 'GET', mode: 'cors', url, headers: { get: (k) => headers[k] ?? null } });

describe('화면 조각(RSC) — network-first', () => {
  it('연결되면 캐시를 읽지 않고 서버 응답을 준다(지난번 조각이 먼저 나가지 않는다)', async () => {
    const url = 'https://manabi.example/materials?_rsc=abc';
    const stale = { body: 'STALE' };
    const { handlers, match, put } = await loadWorker({ fetchImpl: async () => ok(url), cached: stale });
    const response = await dispatch(handlers.get('fetch'), rscRequest(url));
    expect(response.url).toBe(url);
    expect(match).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('_rsc 없이 RSC: 1 머리만 있어도 화면 조각으로 본다', async () => {
    const url = 'https://manabi.example/home';
    const { handlers, match } = await loadWorker({ fetchImpl: async () => ok(url), cached: { body: 'STALE' } });
    const response = await dispatch(handlers.get('fetch'), rscRequest(url, { RSC: '1' }));
    expect(response.url).toBe(url);
    expect(match).not.toHaveBeenCalled();
  });

  it('끊기면 남은 조각, 없으면 실패 응답(라우터가 문서 이동으로 바꿔 /offline 규칙을 탄다)', async () => {
    const url = 'https://manabi.example/home?_rsc=abc';
    const kept = { body: 'kept' };
    const a = await loadWorker({ cached: kept });
    expect(await dispatch(a.handlers.get('fetch'), rscRequest(url))).toBe(kept);
    const b = await loadWorker({ cached: null });
    expect(await dispatch(b.handlers.get('fetch'), rscRequest(url))).toEqual({ type: 'error' });
  });

  it('리다이렉트 · 실패 조각은 캐시에 쓰지 않는다', async () => {
    const url = 'https://manabi.example/materials?_rsc=abc';
    const { handlers, put } = await loadWorker({ fetchImpl: async () => ({ ...ok(url), redirected: true }) });
    await dispatch(handlers.get('fetch'), rscRequest(url));
    expect(put).not.toHaveBeenCalled();
  });

  it('관리자 조각은 여전히 워커가 손대지 않는다', async () => {
    const { handlers, fetch } = await loadWorker({});
    const respondWith = vi.fn();
    handlers.get('fetch')({ request: rscRequest('https://manabi.example/admin?_rsc=x'), respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('탐색 미리 받기', () => {
  it('activate가 navigationPreload를 켠다(지원 안 하는 브라우저는 건너뛴다)', async () => {
    const enable = vi.fn(async () => {});
    const { handlers } = await loadWorker({ navigationPreload: { enable } });
    let waited;
    handlers.get('activate')({ waitUntil: (p) => { waited = p; } });
    await waited;
    expect(enable).toHaveBeenCalledTimes(1);
    const bare = await loadWorker({});
    let waitedBare;
    bare.handlers.get('activate')({ waitUntil: (p) => { waitedBare = p; } });
    await expect(waitedBare).resolves.toBeDefined();
  });

  it('문서 이동은 미리 받은 응답을 쓰고 두 번 받지 않는다', async () => {
    const url = 'https://manabi.example/home';
    const preloaded = ok(url);
    const { handlers, fetch } = await loadWorker({ fetchImpl: async () => ok(url) });
    const response = await dispatch(handlers.get('fetch'), { method: 'GET', mode: 'navigate', url }, { preloadResponse: Promise.resolve(preloaded) });
    expect(response).toBe(preloaded);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('미리 받은 응답이 없으면(undefined) 직접 받는다', async () => {
    const url = 'https://manabi.example/home';
    const { handlers, fetch } = await loadWorker({ fetchImpl: async () => ok(url) });
    const response = await dispatch(handlers.get('fetch'), { method: 'GET', mode: 'navigate', url }, { preloadResponse: Promise.resolve(undefined) });
    expect(response.url).toBe(url);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
