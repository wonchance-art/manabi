import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from '../src/lib/__tests__/helpers/sliceBetween.js';

// 레벨 단어 묶음 오프라인(LEVEL-LIST-RSC-001 후속) — 항목이 문서 밖 /api/level-words/{lang}/{level}?v=판 으로 옮겨 가,
// /api/ 전체 건너뛰기만 두면 받아 둔 단어 화면을 끊긴 채 열 때 「다시 시도」였다(전에는 문서에 항목이 있어 그대로 열렸다).
// 이 주소만 network-first + 질의 없는 열쇠(레벨마다 한 칸)로 남기고 끊기면 돌려준다. 다른 /api/는 그대로 건너뛴다. 되돌리면 ①–③이 깨진다.
const ORIGIN = 'https://manabi.example';

async function loadWorker({ fetchImpl }) {
  const store = new Map(); // 열쇠(문자열 URL) → 응답 — 한 판(CACHE_NAME)의 캐시
  const keyOf = (req) => (typeof req === 'string' ? req : req.url);
  const cache = { put: vi.fn(async (req, res) => { store.set(keyOf(req), res); }) };
  const handlers = new Map();
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const self = {
    addEventListener: (type, handler) => handlers.set(type, handler),
    clients: { claim: vi.fn(), matchAll: vi.fn(), openWindow: vi.fn() },
    location: { origin: ORIGIN },
    registration: { showNotification: vi.fn() },
    skipWaiting: vi.fn(),
  };
  const caches = { keys: vi.fn(async () => []), open: vi.fn(async () => cache), match: vi.fn(async (req) => store.get(keyOf(req)) ?? undefined) };
  vm.runInNewContext(source, { URL, Response, console, self, caches, fetch: vi.fn(fetchImpl) });
  const dispatch = (url, extra = {}) => {
    let responded = null;
    handlers.get('fetch')({ request: { method: 'GET', mode: 'cors', url, headers: { get: () => null }, ...extra }, respondWith: (p) => { responded = Promise.resolve(p); } });
    return responded;
  };
  return { dispatch, store, cache, caches };
}

// Response의 url · type은 읽기 전용 접근자라 시험용으로 감싼다.
function basic(url, body, status = 200) {
  const res = new Response(JSON.stringify(body), { status });
  return new Proxy(res, { get: (t, k) => (k === 'url' ? url : k === 'type' ? 'basic' : k === 'redirected' ? false : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
}

describe('서비스 워커 — 레벨 단어 묶음(/api/level-words)', () => {
  it('① 연결 중: 그물 먼저 · 성공 응답을 질의 없는 열쇠 하나에 남긴다 — 배포 판(?v=)이 바뀌어도 레벨마다 한 칸', async () => {
    let n = 0;
    const { dispatch, store } = await loadWorker({ fetchImpl: async (req) => basic(req.url, { version: 1, groups: [{ name: `g${++n}`, entries: [] }] }) });
    const a = await dispatch(`${ORIGIN}/api/level-words/japanese/n3?v=aaaaaaa`);
    expect((await a.json()).groups[0].name).toBe('g1');
    await dispatch(`${ORIGIN}/api/level-words/japanese/n3?v=bbbbbbb`);
    await dispatch(`${ORIGIN}/api/level-words/chinese/h7?v=bbbbbbb`);
    expect([...store.keys()].sort()).toEqual([`${ORIGIN}/api/level-words/chinese/h7`, `${ORIGIN}/api/level-words/japanese/n3`]);
    expect((await store.get(`${ORIGIN}/api/level-words/japanese/n3`).json()).groups[0].name).toBe('g2'); // 마지막 판이 남는다
  });

  it('② 끊김: 남긴 묶음을 판과 상관없이 돌려준다 · 남긴 게 없으면 실패(화면은 다시 시도)', async () => {
    let online = true;
    const { dispatch } = await loadWorker({ fetchImpl: async (req) => { if (!online) throw new TypeError('Failed to fetch'); return basic(req.url, { version: 1, groups: [{ name: 'n3', entries: [] }] }); } });
    await dispatch(`${ORIGIN}/api/level-words/japanese/n3?v=aaaaaaa`);
    online = false;
    const offline = await dispatch(`${ORIGIN}/api/level-words/japanese/n3?v=ccccccc`);
    expect((await offline.json()).groups[0].name).toBe('n3');
    const none = await dispatch(`${ORIGIN}/api/level-words/japanese/n1?v=ccccccc`);
    expect(none.type).toBe('error');
  });

  it('③ 실패 응답은 남기지 않는다', async () => {
    const { dispatch, store } = await loadWorker({ fetchImpl: async (req) => basic(req.url, { error: 'x' }, 503) });
    expect((await dispatch(`${ORIGIN}/api/level-words/japanese/n3?v=a`)).status).toBe(503);
    expect(store.size).toBe(0);
  });

  it('④ 다른 /api/ 주소는 그대로 건너뛴다(캐시를 읽지도 쓰지도 않는다) · 다른 출처는 이 칸을 쓰지 않는다', async () => {
    const { dispatch, caches } = await loadWorker({ fetchImpl: async () => { throw new Error('should not fetch'); } });
    for (const url of [`${ORIGIN}/api/level-tiles/japanese/n3`, `${ORIGIN}/api/learning/vocabulary?view=learning`, `${ORIGIN}/api/level-index/japanese`,
      `${ORIGIN}/api/level-words/japanese/n3/extra`, `${ORIGIN}/api/level-words-x/japanese/n3`]) {
      expect(dispatch(url), url).toBeNull();
    }
    expect(caches.open).not.toHaveBeenCalled();
    expect(caches.match).not.toHaveBeenCalled();
    // 다른 출처의 같은 경로는 이 규칙이 아니라 기존 규칙(그 밖 요청)을 탄다 — 이 칸에 쓰지 않는다.
    const src = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
    expect(src).toContain('if (url.origin === self.location.origin && LEVEL_WORDS_PATH.test(url.pathname)) {');
    expect(src.indexOf('LEVEL_WORDS_PATH.test(url.pathname)')).toBeLessThan(src.indexOf("if (url.pathname.startsWith('/api/')) return;"));
  });

  it('⑤ 묶음 응답은 공개 정적 응답 — middleware(쿠키 갱신) 밖 · 쿠키를 싣지 않는다', async () => {
    const mw = await readFile(new URL('../src/middleware.js', import.meta.url), 'utf8');
    const matcher = sliceBetween(mw, 'export const config');
    expect(matcher).not.toMatch(/'\/api/);
    const route = await readFile(new URL('../src/app/api/level-words/[lang]/[level]/route.js', import.meta.url), 'utf8');
    expect(route).toContain("export const dynamic = 'force-static';");
    expect(route).not.toMatch(/cookies|headers\(\)|set-cookie|supabase/i);
  });
});

