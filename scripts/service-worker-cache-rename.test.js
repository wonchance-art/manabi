import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// LAUNCH-META-001 SW 이름 — 캐시 이름 앞부분을 anatomy-studio-v에서 manabi-v로 바꿨다. 새 워커는 활성화 때 다른 이름의 캐시를 지운다 —
// 지우기 전에 우리 캐시(새 · 옛 접두)에서 끊긴 채 여는 뷰어 문서와 그 문서의 조각 · 스타일, 글꼴을 새 캐시로 옮겨야
// 이름 바꿈(그리고 매 배포) 뒤 첫 오프라인에서 받아 둔 자료가 /offline으로 떨어지지 않는다.
const ORIGIN = 'https://manabi.example';
const VIEWER_HTML = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="/_next/static/css/old.css" data-precedence="next"/>
<script src="/_next/static/chunks/webpack-old.js" async=""></script>
<script src="/_next/static/chunks/app/(app)/viewer/%5Bid%5D/page-old.js" async=""></script>
</head><body></body></html>`;

const res = (body) => ({ body, clone() { return res(body); }, text: async () => body });
const req = (path, headers = {}) => ({ url: `${ORIGIN}${path}`, headers: new Headers(headers) });
const keyOf = (r) => (typeof r === 'string' ? (r.startsWith('http') ? r : `${ORIGIN}${r}`) : r.url);

function fakeCaches(initial) {
  const store = new Map(Object.entries(initial).map(([name, entries]) => [name, new Map(entries.map(([r, body]) => [keyOf(r), { request: typeof r === 'string' ? req(r) : r, response: res(body) }]))]));
  const deleted = [];
  const open = vi.fn(async (name) => {
    if (!store.has(name)) store.set(name, new Map());
    const map = store.get(name);
    return {
      keys: async () => [...map.values()].map((e) => e.request),
      match: async (r) => map.get(keyOf(r))?.response,
      put: async (r, response) => { map.set(keyOf(r), { request: typeof r === 'string' ? req(new URL(keyOf(r)).pathname + new URL(keyOf(r)).search) : r, response }); },
    };
  });
  return {
    store, deleted,
    api: {
      open,
      keys: async () => [...store.keys()],
      delete: async (name) => { deleted.push(name); return store.delete(name); },
      match: vi.fn(),
    },
  };
}

async function activate(initial, { breakOld } = {}) {
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const cacheName = /^const CACHE_NAME = '([^']+)';/m.exec(source)[1];
  const caches = fakeCaches(initial(cacheName));
  if (breakOld) {
    const open = caches.api.open;
    caches.api.open = vi.fn(async (name) => { const c = await open(name); return name === breakOld ? { ...c, keys: async () => { throw new Error('broken'); } } : c; });
  }
  const handlers = new Map();
  const self = {
    addEventListener: (type, handler) => handlers.set(type, handler),
    clients: { claim: vi.fn(), matchAll: vi.fn(), openWindow: vi.fn() },
    location: { origin: ORIGIN },
    registration: { showNotification: vi.fn(), navigationPreload: { enable: vi.fn(async () => {}) } },
    skipWaiting: vi.fn(),
  };
  vm.runInNewContext(source, { URL, Headers, console, self, caches: caches.api, fetch: vi.fn() });
  let done;
  handlers.get('activate')({ waitUntil: (p) => { done = p; } });
  await done;
  const current = caches.store.get(cacheName);
  return { cacheName, current: current ? [...current.keys()].map((k) => k.slice(ORIGIN.length)) : [], body: (p) => current?.get(`${ORIGIN}${p}`)?.response.body, deleted: caches.deleted, names: [...caches.store.keys()] };
}

describe('캐시 이름 — manabi-v', () => {
  it('sw.js · 버전 스크립트가 같은 접두를 쓴다(옛 접두는 옮겨 담기 목록에만)', async () => {
    const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
    expect(source).toMatch(/^const CACHE_NAME = 'manabi-v[0-9a-f]+';/m);
    expect(source).toContain("const CACHE_PREFIXES = ['manabi-v', 'anatomy-studio-v'];");
    const script = await readFile(new URL('./update-sw-version.mjs', import.meta.url), 'utf8');
    expect(script).toContain("const CACHE_PREFIX = 'manabi-v';");
  });
});

describe('활성화 — 지우기 전에 뷰어 문서를 옮긴다', () => {
  const OLD = 'anatomy-studio-vbdd053027c5755a9';
  const oldEntries = [
    ['/viewer/45?returnTo=%2Fmaterials', VIEWER_HTML],
    ['/_next/static/css/old.css', 'css'],
    ['/_next/static/chunks/webpack-old.js', 'webpack'],
    ['/_next/static/chunks/app/(app)/viewer/%5Bid%5D/page-old.js', 'viewer-page'],
    ['/_next/static/chunks/unrelated-old.js', 'unrelated'],
    ['/_next/static/media/noto-kr.woff2', 'font'],
    ['/home', '<html>home</html>'],
    [req('/viewer/45?_rsc=abc', { RSC: '1' }), 'rsc'],
    ['/api/level-words/japanese/n5', '{}'],
  ];

  it('옛 이름(anatomy-studio-v) 캐시의 뷰어 문서 · 그 조각 · 스타일 · 글꼴을 새 캐시로 옮기고, 옛 캐시는 지운다', async () => {
    const out = await activate((name) => ({ [OLD]: oldEntries, [name]: [['/offline', '<html>offline</html>']] }));
    expect(out.cacheName).not.toBe(OLD);
    expect(out.current).toEqual(expect.arrayContaining([
      '/offline',
      '/viewer/45?returnTo=%2Fmaterials',
      '/_next/static/css/old.css',
      '/_next/static/chunks/webpack-old.js',
      '/_next/static/chunks/app/(app)/viewer/%5Bid%5D/page-old.js',
      '/_next/static/media/noto-kr.woff2',
    ]));
    expect(out.body('/viewer/45?returnTo=%2Fmaterials')).toBe(VIEWER_HTML);
    // 뷰어 문서가 부르지 않는 조각 · 다른 화면 문서 · 화면 조각(RSC) · API는 옮기지 않는다(배포마다 쌓이지 않게)
    for (const p of ['/_next/static/chunks/unrelated-old.js', '/home', '/viewer/45?_rsc=abc', '/api/level-words/japanese/n5']) expect(out.current).not.toContain(p);
    expect(out.deleted).toEqual([OLD]);
    expect(out.names).toEqual([out.cacheName]);
  });

  it('지난 배포(manabi-v…)의 캐시에서도 옮긴다 — 배포 뒤 첫 오프라인', async () => {
    const out = await activate((name) => ({ 'manabi-v0000000000000000': oldEntries.slice(0, 4), [name]: [] }));
    expect(out.current).toEqual(expect.arrayContaining(['/viewer/45?returnTo=%2Fmaterials', '/_next/static/chunks/webpack-old.js']));
    expect(out.deleted).toEqual(['manabi-v0000000000000000']);
  });

  it('새 캐시에 이미 있는 문서(새로 받은 것)는 옛것으로 덮지 않는다', async () => {
    const out = await activate((name) => ({ [OLD]: oldEntries, [name]: [['/viewer/45?returnTo=%2Fmaterials', '<html>new</html>']] }));
    expect(out.body('/viewer/45?returnTo=%2Fmaterials')).toBe('<html>new</html>');
  });

  it('우리 이름이 아닌 캐시는 옮기지 않고 지운다', async () => {
    const out = await activate((name) => ({ 'someone-else': [['/viewer/45', VIEWER_HTML]], [name]: [] }));
    expect(out.current).toEqual([]);
    expect(out.deleted).toEqual(['someone-else']);
  });

  it('옮기다 실패해도 지우기는 끝난다(활성화를 막지 않는다)', async () => {
    const out = await activate((name) => ({ [OLD]: oldEntries, [name]: [] }), { breakOld: OLD });
    expect(out.deleted).toEqual([OLD]);
  });
});
