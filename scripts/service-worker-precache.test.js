import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// SW-PRECACHE-001 (2026-10-23 KST 현장 감사 F7) — 설치 때 받는 것은 오프라인 대체 화면(/offline, 정적)과 그 화면의 정적 파일뿐이다.
// 예전 목록('/' · /home · /vocab · /materials · /auth)은 새 방문자 · 배포마다 서버 렌더 5회를 더 불렀다. 실제 워커를 vm에 올린다.
const OFFLINE_HTML = [
  '<!DOCTYPE html><html><head>',
  '<link rel="stylesheet" href="/_next/static/css/app-a1.css" data-precedence="next"/>',
  '<link rel="stylesheet" href="/_next/static/css/font-b2.css" data-precedence="next"/>',
  '<link rel="preload" href="/_next/static/media/noto-latin.woff2" as="font" crossorigin=""/>',
  '<script src="/_next/static/chunks/webpack-c3.js" async=""></script>',
  '<script src="/_next/static/chunks/app/(app)/offline/page-d4.js" async=""></script>',
  '<script src="/_next/static/chunks/webpack-c3.js" async=""></script>',
  '</head><body><h1>인터넷 연결을 확인해 주세요</h1></body></html>',
].join('');

async function install({ offlineFails = false, assetFails = false } = {}) {
  const handlers = new Map();
  const stored = new Map();
  const add = vi.fn(async (url) => {
    if (url === '/offline' && offlineFails) throw new TypeError('offline');
    if (url !== '/offline' && assetFails) throw new TypeError('asset 404');
    stored.set(url, url === '/offline' ? { text: async () => OFFLINE_HTML } : { body: url });
  });
  const cache = { add, match: vi.fn(async (url) => stored.get(url)), put: vi.fn() };
  const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => []), match: vi.fn(async (url) => stored.get(url) ?? null), delete: vi.fn() };
  const fetch = vi.fn(async () => { throw new TypeError('install must use cache.add only'); });
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const self = {
    addEventListener: (type, handler) => handlers.set(type, handler),
    clients: { claim: vi.fn(), matchAll: vi.fn(), openWindow: vi.fn() },
    location: { origin: 'https://manabi.example' },
    registration: { showNotification: vi.fn() },
    skipWaiting: vi.fn(),
  };
  vm.runInNewContext(source, { URL, console: { warn: vi.fn() }, self, caches, fetch });
  let waited;
  handlers.get('install')({ waitUntil: (p) => { waited = p; } });
  await waited;
  return { handlers, add, stored, fetch, self, caches };
}

describe('설치 사전 캐시 — 오프라인 대체 화면 하나', () => {
  it('문서는 /offline 하나만 받는다(동적 화면 · 리디렉트 문서 없음)', async () => {
    const { add } = await install();
    const urls = add.mock.calls.map(([url]) => url);
    expect(urls.filter((url) => !url.startsWith('/_next/static/'))).toEqual(['/offline']);
    for (const dynamic of ['/', '/home', '/vocab', '/materials', '/auth']) expect(urls).not.toContain(dynamic);
  });

  it('/offline이 부르는 CSS · JS(중복 없이)만 함께 받는다 — 글꼴 · 그 밖의 파일은 받지 않는다', async () => {
    const { add } = await install();
    expect(add.mock.calls.map(([url]) => url).slice(1).sort()).toEqual([
      '/_next/static/chunks/app/(app)/offline/page-d4.js',
      '/_next/static/chunks/webpack-c3.js',
      '/_next/static/css/app-a1.css',
      '/_next/static/css/font-b2.css',
    ]);
  });

  it('설치는 실패하지 않는다 — /offline · 정적 파일을 못 받아도 skipWaiting까지 간다', async () => {
    const a = await install({ offlineFails: true });
    expect(a.self.skipWaiting).toHaveBeenCalled();
    expect(a.add).toHaveBeenCalledTimes(1);
    const b = await install({ assetFails: true });
    expect(b.stored.has('/offline')).toBe(true);
  });

  it('끊긴 상태의 처음 가는 화면은 받아 둔 /offline으로 대체된다', async () => {
    const { handlers, stored } = await install();
    let responded;
    handlers.get('fetch')({
      request: { method: 'GET', mode: 'navigate', url: 'https://manabi.example/vocab' },
      preloadResponse: Promise.resolve(undefined),
      respondWith: (p) => { responded = Promise.resolve(p); },
    });
    expect(await responded).toBe(stored.get('/offline'));
  });

  it('워커 원본에 옛 사전 캐시 목록이 남지 않는다', async () => {
    const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
    expect(source).not.toContain('PRECACHE_URLS');
    expect(source).toContain("const OFFLINE_URL = '/offline';");
    // 대체 화면은 정적이어야 설치가 서버 렌더를 부르지 않는다(빌드 표 ○ /offline).
    const offline = await readFile(new URL('../src/app/(app)/offline/page.jsx', import.meta.url), 'utf8');
    expect(offline).not.toMatch(/export const (dynamic|revalidate)|cookies\(|headers\(|searchParams/);
  });
});
