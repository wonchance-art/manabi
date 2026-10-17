import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

// 서재 카드 → 뷰어 첫 글자(VIEWER-ENTRY R1 · R2, 2026-10-17 KST): 누른 뒤 뷰어 서버 응답 → JS 청크 15개 → 그제야 자료 조회였다.
//   R1 누르는 순간 자료 조회(lib/viewerMaterial 등록부) — 뷰어가 같은 id · 같은 계정 · 10초 안이면 받아 쓰고, 아니면 새로.
//   R2 머묾 80ms · 누름 · 키보드 포커스에 뷰어 모듈만 미리 import(서버 호출 없음).
// 서재 번들에 뷰어 JS가 끌려오지 않는다(정적 import 그래프) — 뷰어 모듈은 R2의 동적 import 한 곳으로만 닿는다.
vi.mock('../supabase', () => ({ supabase: { from: () => { throw new Error('network not used in this test'); }, auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('../offlineCache', () => ({ cacheMaterial: async () => {}, getCachedMaterial: async () => null }));
vi.mock('../sharedStore', () => ({ getSharedCopy: async () => null }));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({}), useSearchParams: () => new URLSearchParams(), usePathname: () => '/materials' }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: null }) }));

const lib = await import('../viewerMaterial');
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
    expect(read('src/lib/viewerMaterial.js')).not.toMatch(/import\(/);
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
  it('띄운 조회가 실패하면 한 번 새로 받는다 — 없음(NOT_FOUND) · 팀 사본 없음은 그대로 오류', async () => {
    const d = deferred(), calls = [];
    lib.startEarlyMaterial('/viewer/45', 1000, { owner: 'A', fetch: () => d.promise });
    const loading = lib.loadMaterial('45', { owner: 'A', now: 1100, fetch: (id) => { calls.push(id); return Promise.resolve({ id, fresh: true }); } });
    d.reject(Object.assign(new Error('fetch failed'), { code: 'NETWORK' }));
    expect(await loading).toEqual({ id: '45', fresh: true });
    expect(calls).toEqual(['45']);
    for (const code of ['NOT_FOUND', 'LOCAL_MISSING']) {
      lib.startEarlyMaterial('/viewer/45', 2000, { owner: 'A', fetch: () => Promise.reject(Object.assign(new Error(code), { code })) });
      await expect(lib.loadMaterial('45', { owner: 'A', now: 2100, fetch: () => Promise.resolve('unused') })).rejects.toMatchObject({ code });
    }
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
    const open = sliceBetween(src, 'const openReader = (href, event) => {', 'return { readerHref, openReader };');
    expect(open.indexOf('event.metaKey || event.ctrlKey')).toBeLessThan(open.indexOf('startEarlyMaterial(href, Date.now(), { owner: user?.id ?? null });'));
    expect(open.indexOf('startEarlyMaterial(')).toBeLessThan(open.indexOf('router.push('));
    expect(read('src/views/ViewerPage.jsx')).toContain('queryFn: () => loadMaterial(id, { owner: user?.id ?? null }),');
  });
});

describe('R2 뷰어 모듈 미리 받기 — 머묾 80ms · 누름 · 키보드 포커스', () => {
  const env = () => { const timers = new Map(), queue = []; let warmed = 0;
    return { timers, queue, get warmed() { return warmed; }, opts: { warm: () => { warmed += 1; }, timers, schedule: (fn, ms) => { queue.push({ fn, ms }); return queue.length; }, cancel: (id) => { queue[id - 1].fn = null; } } }; };
  it('뷰어로 가는 링크에만 붙는다', () => {
    expect(link.viewerWarmProps('/pdf/7')).toEqual({});
    expect(Object.keys(link.viewerWarmProps('/viewer/45'))).toEqual(['onPointerEnter', 'onPointerLeave', 'onPointerDown', 'onFocus']);
  });
  it('마우스가 80ms 머물면 받고, 그 전에 떠나면 받지 않는다 · 터치는 머묾으로 받지 않는다', () => {
    const e = env(), p = link.viewerWarmProps('/viewer/45', {}, e.opts);
    p.onPointerEnter({ pointerType: 'mouse' });
    expect(e.queue[0].ms).toBe(link.VIEWER_WARM_DWELL_MS);
    expect(link.VIEWER_WARM_DWELL_MS).toBe(80);
    e.queue[0].fn(); expect(e.warmed).toBe(1);
    p.onPointerEnter({ pointerType: 'mouse' }); p.onPointerLeave({});
    expect(e.queue[1].fn).toBe(null);
    p.onPointerEnter({ pointerType: 'touch' }); expect(e.queue).toHaveLength(2);
  });
  it('누르면(터치 포함) 바로 받고, 키보드 포커스(:focus-visible)에 받는다 — 마우스로 누를 때 생기는 포커스는 건너뛴다', () => {
    const e = env(), p = link.viewerWarmProps('/viewer/45', {}, e.opts);
    p.onPointerDown({ pointerType: 'touch' }); expect(e.warmed).toBe(1);
    p.onFocus({ currentTarget: { matches: () => true } }); expect(e.warmed).toBe(2);
    p.onFocus({ currentTarget: { matches: () => false } }); expect(e.warmed).toBe(2);
  });
  it('받은 처리기(props)는 그대로 부른다', () => {
    const e = env(), seen = [];
    const p = link.viewerWarmProps('/viewer/45', { onFocus: () => seen.push('focus'), onPointerDown: () => seen.push('down') }, e.opts);
    p.onFocus({ currentTarget: { matches: () => false } }); p.onPointerDown({});
    expect(seen).toEqual(['focus', 'down']);
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
    expect(read('src/components/web/LibraryReaderLink.jsx')).not.toMatch(/router\.prefetch/);
  });
  it('배선: 서재 링크가 미리 받기 이벤트를 단다', () => {
    expect(read('src/components/web/LibraryReaderLink.jsx')).toContain('<Link {...props} {...viewerWarmProps(href, props)} href={readerHref(href)}');
  });
});
