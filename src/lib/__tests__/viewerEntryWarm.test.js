import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryObserver } from '@tanstack/query-core';
import { sliceBetween } from './helpers/sliceBetween';

// 서재 카드 → 뷰어 첫 글자(VIEWER-ENTRY R1 · R2, 2026-10-17 KST): 누른 뒤 뷰어 서버 응답 → JS 청크 15개 → 그제야 자료 조회였다.
//   R1 누르는 순간 자료 조회(lib/viewerMaterial 등록부) — 뷰어가 같은 id · 같은 계정 · 10초 안이면 받아 쓰고, 아니면 새로.
//   R2 머묾 80ms · 누름 · 키보드 포커스에 뷰어 모듈만 미리 import(서버 호출 없음).
//   (c) 행 Link의 화면 진입 prefetch를 끄고(no-store → 서재 bfcache 막힘 · 행마다 서버 렌더) 의도 시점에만 router.prefetch(auto).
// 서재 번들에 뷰어 JS가 끌려오지 않는다(정적 import 그래프) — 뷰어 모듈은 R2의 동적 import 한 곳으로만 닿는다.
vi.mock('../supabase', () => ({ supabase: { from: () => { throw new Error('network not used in this test'); }, auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('../offlineCache', () => ({ cacheMaterial: async () => {}, getCachedMaterial: async () => null }));
vi.mock('../sharedStore', () => ({ getSharedCopy: async () => null }));
const h = vi.hoisted(() => ({ links: [], pushed: [], cache: new Map(), prefetched: [] }));
vi.mock('next/link', () => ({ default: (props) => { h.links.push(props); return null; } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: (u) => h.pushed.push(u), prefetch: (...args) => h.prefetched.push(args) }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/materials' }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ getQueryData: (key) => h.cache.get(JSON.stringify(key)) }) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: null }) }));

const lib = await import('../viewerMaterial');
const { INTENT_DWELL_MS } = await import('../intentPrefetch');
const link = await import('../../components/web/LibraryReaderLink');
const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** 정적 import 그래프(동적 import()는 빼고) — '@/' · 상대 경로만 따라간다. */
function staticGraph(entry) {
  const seen = new Set(), queue = [entry];
  const resolve = (from, spec) => {
    const base = spec.startsWith('@/') ? path.join(ROOT, 'src', spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
    if (!base) return null;
    for (const cand of [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js'), path.join(base, 'index.jsx')]) if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
    return null;
  };
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
      const next = resolve(file, m[1]);
      if (next && !next.endsWith('.css')) queue.push(next);
    }
  }
  return [...seen].map((f) => path.relative(ROOT, f));
}

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

beforeEach(() => { lib.takeEarlyMaterial('__reset__'); lib.takeEarlyMaterial(lib.viewerMaterialId('/viewer/45') ?? ''); });

describe('서재 번들에 뷰어 JS가 끌려오지 않는다', () => {
  it('서재 링크 · 조회 모듈의 정적 import 그래프에 ViewerPage · 뷰어 부품이 없다', () => {
    for (const entry of ['src/components/web/LibraryReaderLink.jsx', 'src/lib/viewerMaterial.js', 'src/components/library/LibraryRow.jsx']) {
      const graph = staticGraph(path.join(ROOT, entry));
      expect(graph.filter((f) => f === 'src/views/ViewerPage.jsx' || f.startsWith('src/components/viewer/'))).toEqual([]);
    }
  });
  it('뷰어 모듈에 닿는 길은 R2의 동적 import 한 곳 — 조회 모듈은 동적 import도 없다', () => {
    const src = read('src/components/web/LibraryReaderLink.jsx');
    expect(src.match(/import\(/g)).toHaveLength(1);
    expect(src).toContain("load = () => import('@/views/ViewerPage')");
    // 조회 모듈의 동적 import는 그 길에 들어설 때만 받는 기기 캐시 · 팀 사본뿐 — 뷰어는 없다
    expect([...read('src/lib/viewerMaterial.js').matchAll(/\bimport\(\s*'([^']+)'/g)].map((m) => m[1]).sort()).toEqual(['./offlineCache', './offlineCache', './sharedStore']);
  });
  it('조회 모듈의 정적 의존은 허용 목록뿐 — 서재 링크를 쓰는 모든 화면에 수업 일정 · 공휴일 · 기기 캐시 · 팀 사본을 끌지 않는다', () => {
    expect(staticGraph(path.join(ROOT, 'src/lib/viewerMaterial.js')).sort()).toEqual(['src/lib/accountQueryCache.js', 'src/lib/bookMeta.js', 'src/lib/supabase.js', 'src/lib/viewerMaterial.js']);
  });
  it('팀 사본 판정(local:)은 classBoard.isLocalId와 같다', async () => {
    const board = await import('../classBoard');
    for (const id of ['local:7', 'local:', 'local:abc', 'Local:7', '7', 7, null, undefined, ' local:7', ['local:7'], { toString: () => 'local:7' }]) expect(lib.isLocalId(id), String(id)).toBe(board.isLocalId(id));
  });
  it('「← 돌아가기」는 따로 둔 파일 — 교재(SC 글꼴 범위 밖)가 불러도 뷰어 동적 import에 닿지 않는다(fontScope.test ②)', () => {
    const ret = read('src/components/web/LibraryReturnLink.jsx');
    expect(ret).toContain('export function LibraryReturnLink(');
    expect(ret).not.toMatch(/\bimport\s*\(|from ['"][^'"]*LibraryReaderLink['"]/);
    expect(read('src/components/web/LibraryReaderLink.jsx')).toContain("export { LibraryReturnLink } from './LibraryReturnLink';");
    for (const f of ['src/components/books/BookHome.jsx', 'src/components/books/BookReader.jsx']) expect(read(f), f).toContain("import {LibraryReturnLink} from '@/components/web/LibraryReturnLink';");
  });
});

describe('R1 조기 조회 등록부 — 받아 쓰기와 폴백', () => {
  const fetchOnce = () => { const calls = []; const fetch = (id) => { calls.push(id); return Promise.resolve({ id, n: calls.length }); }; return { calls, fetch }; };

  it('같은 id · 같은 계정 · 10초 안이면 서재가 띄운 조회를 뷰어가 받아 쓴다(새 요청 없음)', async () => {
    const f = fetchOnce();
    lib.startEarlyMaterial('/viewer/45?returnTo=%2Fmaterials', 1000, { owner: 'A', fetch: f.fetch });
    expect(await lib.loadMaterial('45', { owner: 'A', now: 1500, fetch: f.fetch })).toEqual({ id: '45', n: 1 });
    expect(f.calls).toEqual(['45']);
  });
  it('다른 id · 오래됨이면 새로 받는다', async () => {
    const f = fetchOnce();
    lib.startEarlyMaterial('/viewer/45', 1000, { owner: 'A', fetch: f.fetch });
    expect(await lib.loadMaterial('49', { owner: 'A', now: 1100, fetch: f.fetch })).toEqual({ id: '49', n: 2 });
    expect(await lib.loadMaterial('45', { owner: 'A', now: 1000 + lib.EARLY_MATERIAL_MAX_AGE_MS + 1, fetch: f.fetch })).toEqual({ id: '45', n: 3 });
  });
  it('계정 전환 · 로그아웃 사이에 남은 조기 결과는 다른 사용자가 받지 않는다(버리고 새로)', async () => {
    for (const viewer of ['B', null]) {
      const f = fetchOnce();
      lib.startEarlyMaterial('/viewer/45', 1000, { owner: 'A', fetch: f.fetch });
      expect(await lib.loadMaterial('45', { owner: viewer, now: 1200, fetch: f.fetch })).toEqual({ id: '45', n: 2 });
      expect(lib.takeEarlyMaterial('45', 1300, { owner: 'A' })).toBe(null); // 버렸다 — 원래 계정에도 다시 넘기지 않는다
    }
  });
  it('직접 진입(계정 모름)은 같은 첫 화면이라 그대로 받는다', async () => {
    const f = fetchOnce();
    lib.startEarlyMaterial('/viewer/45', 1000, { fetch: f.fetch });
    expect(await lib.loadMaterial('45', { owner: null, now: 1100, fetch: f.fetch })).toEqual({ id: '45', n: 1 });
  });
  it('띄운 조회가 실패하면 오류를 그대로 내고 따로 다시 받지 않는다 — 재시도는 react-query(retry 1)가, 그때는 새로 받는다(최악 2회)', async () => {
    const d = deferred(), calls = [];
    const fetch = (id) => { calls.push(id); return Promise.resolve({ id, fresh: true }); };
    lib.startEarlyMaterial('/viewer/45', 1000, { owner: 'A', fetch: () => d.promise });
    const loading = lib.loadMaterial('45', { owner: 'A', now: 1100, fetch });
    d.reject(Object.assign(new Error('fetch failed'), { code: 'NETWORK' }));
    await expect(loading).rejects.toMatchObject({ code: 'NETWORK' });
    expect(calls).toEqual([]);
    expect(await lib.loadMaterial('45', { owner: 'A', now: 1200, fetch })).toEqual({ id: '45', fresh: true }); // 재시도 = 등록부가 비어 새로
    expect(calls).toEqual(['45']);
  });
  it('캐시가 있으면(cached) 등록부를 쓰지 않고 늘 새로 받는다 · 그 id의 등록부는 버릴 수 있다', async () => {
    const f = fetchOnce();
    lib.startEarlyMaterial('/viewer/45', 1000, { owner: 'A', fetch: f.fetch });
    expect(await lib.loadMaterial('45', { owner: 'A', cached: true, now: 1100, fetch: f.fetch })).toEqual({ id: '45', n: 2 });
    lib.discardEarlyMaterial('49'); // 다른 id는 그대로
    expect(lib.takeEarlyMaterial('45', 1200, { owner: 'A' })).not.toBe(null);
    lib.startEarlyMaterial('/viewer/45', 1300, { owner: 'A', fetch: f.fetch });
    lib.discardEarlyMaterial('45');
    expect(lib.takeEarlyMaterial('45', 1400, { owner: 'A' })).toBe(null);
  });
  it('리뷰 차단 재현: 캐시가 신선한 채 다시 누르고 10초 안에 교정 → invalidate가 교정 전 응답으로 되돌리지 않는다', async () => {
    let server = { id: '45', v: 'v1' };
    const fetch = vi.fn(async () => ({ ...server }));
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 120000, retry: 1 } } });
    const key = ['material', '45'];
    // 뷰어(ViewerPage)와 같은 규칙: 마운트 때 캐시가 있으면 등록부를 버리고, queryFn은 캐시가 있으면 등록부를 쓰지 않는다.
    const mount = () => { if (qc.getQueryData(key) !== undefined) lib.discardEarlyMaterial('45'); const obs = new QueryObserver(qc, { queryKey: key, queryFn: () => lib.loadMaterial('45', { owner: 'A', cached: qc.getQueryData(key) !== undefined, fetch }) }); return obs.subscribe(() => {}); };
    // 서재 누름(서재 규칙: 캐시가 있으면 띄우지 않는다 — 여기서는 그 규칙이 빠져도 뷰어 쪽이 막는지 본다)
    lib.startEarlyMaterial('/viewer/45', Date.now(), { owner: 'A', fetch });
    let un = mount();
    await vi.waitFor(() => expect(qc.getQueryData(key)?.v).toBe('v1'));
    un();
    lib.startEarlyMaterial('/viewer/45', Date.now(), { owner: 'A', fetch }); // 신선한 캐시인데 다시 누름(최악)
    un = mount();
    expect(lib.takeEarlyMaterial('45', Date.now(), { owner: 'A' })).toBe(null); // 마운트가 버렸다 — 고아 없음
    server = { id: '45', v: 'v2' };
    qc.setQueryData(key, { id: '45', v: 'v2' });
    await qc.invalidateQueries({ queryKey: key });
    expect(qc.getQueryData(key)?.v).toBe('v2'); // 교정이 남는다(서버에서 새로 받음)
    expect(fetch).toHaveBeenCalledTimes(3);
    un();
  });
  it('같은 자료를 두 번 띄우지 않는다 — 서재가 띄운 뒤 뷰어 모듈 평가(계정 모름)가 와도 그대로 둔다', () => {
    const f = fetchOnce();
    const first = lib.startEarlyMaterial('/viewer/45', 1000, { owner: 'A', fetch: f.fetch });
    expect(lib.startEarlyMaterial('/viewer/45', 1200, { fetch: f.fetch })).toBe(first);
    expect(lib.startEarlyMaterial('/viewer/45', 1300, { owner: 'A', fetch: f.fetch })).toBe(first);
    expect(f.calls).toEqual(['45']);
    lib.startEarlyMaterial('/viewer/45', 1400, { owner: 'B', fetch: f.fetch }); // 다른 계정이면 새로
    expect(f.calls).toEqual(['45', '45']);
  });
  it('뷰어가 아닌 주소 · 팀 사본은 띄우지 않는다', () => {
    const f = fetchOnce();
    for (const href of ['/materials', '/pdf/7', '/conversation/9', '/viewer/45/edit', '/viewer/local%3A7']) expect(lib.startEarlyMaterial(href, 1000, { owner: 'A', fetch: f.fetch })).toBe(null);
    expect(f.calls).toEqual([]);
  });
  it('배선: 서재 링크가 누르는 순간 누른 계정으로 띄우고(새 탭 · 수정키는 제외), 뷰어는 지금 계정으로 받는다', () => {
    const src = read('src/components/web/LibraryReaderLink.jsx');
    const open = sliceBetween(src, 'const openReader = (href, event) => {', 'return { readerHref, openReader, router };');
    expect(open.indexOf('event.metaKey || event.ctrlKey')).toBeLessThan(open.indexOf('startEarlyMaterial(href, Date.now(), { owner: user?.id ?? null });'));
    expect(open.indexOf('startEarlyMaterial(')).toBeLessThan(open.indexOf('router.push('));
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("queryFn: () => loadMaterial(id, { owner: user?.id ?? null, cached: queryClient.getQueryData(['material', id]) !== undefined }),");
    expect(viewer).toContain("useEffect(() => { if (queryClient.getQueryData(['material', id]) !== undefined) discardEarlyMaterial(id); }, [id, queryClient]);");
  });
  it('서재 누름: 이 자료가 캐시에 있으면(다시 누름) 띄우지 않는다 · 없으면 띄운다 · 수정키 클릭은 아무것도 안 한다', () => {
    const click = (href, event = {}) => { h.links.length = 0; renderToStaticMarkup(createElement(link.default, { href }, 'x')); h.links[0].onClick({ preventDefault() {}, button: 0, ...event }); };
    vi.stubGlobal('window', { location: { pathname: '/materials', search: '' }, scrollY: 0 });
    vi.stubGlobal('navigator', { connection: { saveData: true } }); // 미리 받기(R2)는 여기서 보지 않는다 — 모듈 캐시를 남기지 않게
    h.cache.set(JSON.stringify(['material', '61']), { id: '61' });
    click('/viewer/61');
    expect(lib.takeEarlyMaterial('61')).toBe(null);
    click('/viewer/62', { metaKey: true });
    expect(lib.takeEarlyMaterial('62')).toBe(null);
    vi.unstubAllGlobals();
  });
});

describe('R2 뷰어 모듈 미리 받기 — 머묾 80ms · 누름 · 키보드 포커스(판정은 intentPrefetchProps 재사용)', () => {
  const env = () => { const timers = new Map(), queue = []; let warmed = 0;
    return { timers, queue, get warmed() { return warmed; }, opts: { warm: () => { warmed += 1; }, timers, schedule: (fn, ms) => { queue.push({ fn, ms }); return queue.length; }, cancel: (id) => { queue[id - 1].fn = null; } } }; };
  it('뷰어로 가는 링크에만 붙는다', () => {
    expect(link.viewerWarmProps('/pdf/7')).toEqual({});
    expect(Object.keys(link.viewerWarmProps('/viewer/45')).sort()).toEqual(['onFocus', 'onPointerDown', 'onPointerEnter', 'onPointerLeave']);
  });
  it('마우스가 80ms(INTENT_DWELL_MS) 머물면 받고, 그 전에 떠나면 받지 않는다 · 터치는 머묾으로 받지 않는다', () => {
    const e = env(), p = link.viewerWarmProps('/viewer/45', e.opts);
    p.onPointerEnter({ pointerType: 'mouse' });
    expect(e.queue[0].ms).toBe(INTENT_DWELL_MS);
    expect(INTENT_DWELL_MS).toBe(80);
    e.queue[0].fn(); expect(e.warmed).toBe(1);
    p.onPointerEnter({ pointerType: 'mouse' }); p.onPointerLeave({});
    expect(e.queue[1].fn).toBe(null);
    p.onPointerEnter({ pointerType: 'touch' }); expect(e.queue).toHaveLength(2);
  });
  it('마우스로 누르면 바로 받고(터치의 누름은 스크롤 시작일 수 있어 받지 않는다), 키보드 포커스(:focus-visible)에 받는다', () => {
    const e = env(), p = link.viewerWarmProps('/viewer/45', e.opts);
    p.onPointerDown({ pointerType: 'touch' }); expect(e.warmed).toBe(0);
    p.onPointerDown({ pointerType: 'mouse' }); expect(e.warmed).toBe(1);
    p.onFocus({ currentTarget: { matches: () => true } }); expect(e.warmed).toBe(2);
    p.onFocus({ currentTarget: { matches: () => false } }); expect(e.warmed).toBe(2);
  });
  it('터치는 실제 누름(click → openReader)에 받는다', () => {
    expect(sliceBetween(read('src/components/web/LibraryReaderLink.jsx'), 'const openReader = (href, event) => {', 'return { readerHref, openReader, router };')).toContain('warmViewer(); // R2');
  });
  it('모듈은 한 번만 받고(실패하면 다음 기회에 다시) · 데이터 절약 모드는 받지 않는다 · 서버 호출 없이 import만', async () => {
    expect(link.warmViewer({ load: () => Promise.resolve('x'), nav: { connection: { saveData: true } } })).toBe(null);
    let loads = 0;
    const failing = link.warmViewer({ load: () => { loads += 1; return Promise.reject(new Error('chunk')); }, nav: {} });
    await failing;
    const ok = link.warmViewer({ load: () => { loads += 1; return Promise.resolve('module'); }, nav: {} });
    expect(link.warmViewer({ load: () => { loads += 1; return Promise.resolve('again'); }, nav: {} })).toBe(ok);
    await ok;
    expect(loads).toBe(2);
  });
  it('판정 함수를 새로 만들지 않는다 — 머묾 · 포커스 판정은 intentPrefetchProps 한 곳(이 파일에 :focus-visible · 터치 판정 없음)', () => {
    const src = read('src/components/web/LibraryReaderLink.jsx');
    expect(src).not.toMatch(/focus-visible/);
    expect(src.match(/pointerType/g)).toHaveLength(1); // 터치 누름 규칙(7) 하나 — 머묾의 터치 제외는 intentPrefetchProps가
    expect(src.match(/intentPrefetchProps\(/g)).toHaveLength(2); // R2 · 라우트 의도 prefetch
  });
});

describe('(c) 서재 행 Link — 화면 진입 prefetch 끄고 의도 시점에만 router.prefetch(auto)', () => {
  const render = (props) => { h.links.length = 0; renderToStaticMarkup(createElement(link.default, props, 'x')); return h.links[0]; };
  beforeEach(() => { h.prefetched.length = 0; vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it('행 Link는 prefetch={false} — 화면에 들어와도 서버 렌더 · no-store 응답이 없다(서재 bfcache)', () => {
    expect(render({ href: '/viewer/45' }).prefetch).toBe(false);
  });
  it('마우스 80ms 머묾에 대기 화면까지(auto)만 받는다 · 그 전에 누르면 취소 · 터치는 받지 않는다', () => {
    const a = render({ href: '/viewer/46'  });
    a.onPointerEnter({ pointerType: 'mouse' });
    vi.advanceTimersByTime(INTENT_DWELL_MS);
    expect(h.prefetched).toEqual([[expect.stringMatching(/^\/viewer\/46\?returnTo=/), { kind: 'auto' }]]);
    const b = render({ href: '/viewer/47'  });
    b.onPointerEnter({ pointerType: 'mouse' }); b.onPointerDown({ pointerType: 'mouse' });
    vi.advanceTimersByTime(500);
    const c = render({ href: '/viewer/48'  });
    c.onPointerEnter({ pointerType: 'touch' }); vi.advanceTimersByTime(500);
    expect(h.prefetched).toHaveLength(1);
  });
  it('키보드 포커스(:focus-visible)는 바로 받는다 — 뷰어가 아닌 행(PDF · 대화)도 같은 규칙', () => {
    for (const href of ['/viewer/49', '/pdf/7']) render({ href  }).onFocus({ currentTarget: { matches: () => true } });
    expect(h.prefetched.map(([u]) => u.split('?')[0])).toEqual(['/viewer/49', '/pdf/7']);
  });
  it('받은 처리기는 그대로 불린다 · 부르는 쪽이 prefetch를 정하면 그 값을 따른다(의도 prefetch 없음)', () => {
    const seen = [];
    const a = render({ href: '/viewer/50', onFocus: () => seen.push('focus')  });
    a.onFocus({ currentTarget: { matches: () => false } });
    expect(seen).toEqual(['focus']);
    const b = render({ href: '/viewer/51', prefetch: true  });
    expect(b.prefetch).toBe(true);
    b.onFocus?.({ currentTarget: { matches: () => true } });
    expect(h.prefetched.filter(([u]) => u.startsWith('/viewer/51'))).toEqual([]);
  });
});
