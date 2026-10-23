import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// OFFLINE-SWEEP-001 — /offline 대체 화면은 문서만이 아니라 그 문서가 부르는 조각까지 설치 때 받아 둔다.
// 390 실측(2026-10-23 KST): 받아 둔 적 없는 화면을 끊긴 채 열면 워커가 /offline 문서를 주지만 그 화면 조각
// (app/(app)/offline/page-*.js)이 캐시에 없어 ChunkLoadError → 대체 화면 대신 오류 화면이었다.
const OFFLINE_HTML = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="/_next/static/css/0d39cdf0982fbeb8.css" data-precedence="next"/>
<link rel="preload" href="/_next/static/media/3b7f680d40bad81e-s.p.woff2" as="font"/>
<script src="/_next/static/chunks/webpack-38be21ce365a2c51.js" async=""></script>
<script src="/_next/static/chunks/app/(app)/offline/page-1c85f5a3786bca83.js" async=""></script>
<script src="/_next/static/chunks/app/(app)/layout-91e826ae73eb532d.js" async=""></script>
<script src="/_next/static/chunks/webpack-38be21ce365a2c51.js" async=""></script>
<link rel="manifest" href="/manifest.webmanifest"/><script src="https://plausible.io/js/script.js"></script>
</head><body></body></html>`;

async function install({ offlineHtml = OFFLINE_HTML, failAdd = () => false } = {}) {
  const handlers = new Map();
  const added = [];
  const cache = {
    add: vi.fn(async (url) => { if (failAdd(url)) throw new Error('404'); added.push(url); }),
    match: vi.fn(async (url) => (url === '/offline' && added.includes('/offline') && offlineHtml != null ? { text: async () => offlineHtml } : undefined)),
    put: vi.fn(),
  };
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const self = {
    addEventListener: (type, handler) => handlers.set(type, handler),
    clients: { claim: vi.fn(), matchAll: vi.fn(), openWindow: vi.fn() },
    location: { origin: 'https://manabi.example' },
    registration: { showNotification: vi.fn() },
    skipWaiting: vi.fn(),
  };
  vm.runInNewContext(source, { URL, console: { warn: vi.fn() }, self, caches: { open: vi.fn(async () => cache), keys: vi.fn(async () => []), match: vi.fn() }, fetch: vi.fn() });
  let done;
  handlers.get('install')({ waitUntil: (p) => { done = p; } });
  await done;
  return { added, cache };
}

describe('설치 — /offline 대체 화면의 조각까지 받아 둔다', () => {
  it('문서가 부르는 /_next/static 조각 · 스타일을 한 번씩 받는다(글꼴 · 바깥 주소 · 매니페스트 제외 — SW-PRECACHE-001과 같은 범위)', async () => {
    const { added } = await install();
    expect(added).toEqual(expect.arrayContaining([
      '/offline',
      '/_next/static/chunks/app/(app)/offline/page-1c85f5a3786bca83.js',
      '/_next/static/chunks/app/(app)/layout-91e826ae73eb532d.js',
      '/_next/static/chunks/webpack-38be21ce365a2c51.js',
      '/_next/static/css/0d39cdf0982fbeb8.css',
    ]));
    expect(added.filter((u) => u.includes('webpack-'))).toHaveLength(1);
    expect(added.some((u) => u.includes('plausible') || u.includes('manifest'))).toBe(false);
  });

  it('조각 하나를 못 받아도 설치는 끝난다(나머지는 받는다)', async () => {
    const { added } = await install({ failAdd: (url) => url.includes('layout-') });
    expect(added).toContain('/_next/static/chunks/app/(app)/offline/page-1c85f5a3786bca83.js');
    expect(added.some((u) => u.includes('layout-'))).toBe(false);
  });

  it('/offline 문서를 못 받았으면 조각도 받지 않고 설치는 끝난다', async () => {
    const { added } = await install({ failAdd: (url) => url === '/offline' });
    expect(added.some((u) => u.startsWith('/_next/'))).toBe(false);
    // 설치 때 받는 문서는 /offline 하나뿐이다(SW-PRECACHE-001) — 그것을 못 받으면 아무것도 남지 않는다.
    expect(added).toEqual([]);
  });
});

describe('/offline 대체 화면 — 연결되면 같은 주소를 다시 연다', () => {
  it('online 이벤트에 새로 고침을 걸고(떠날 때 뗀다) · 문구가 그 약속을 말한다', async () => {
    const page = await readFile(new URL('../src/app/(app)/offline/page.jsx', import.meta.url), 'utf8');
    expect(page).toMatch(/window\.addEventListener\('online', reopen\)/);
    expect(page).toMatch(/window\.removeEventListener\('online', reopen\)/);
    expect(page).toMatch(/const reopen = \(\) => window\.location\.reload\(\)/);
    expect(page).toContain('연결되면 이 화면을 다시 열어요.');
    expect(page).not.toContain('연결되면 다시 시도해 주세요');
  });
});
