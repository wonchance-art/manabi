// AUTH-CACHE-CLEAR-001 (2026-10-17 KST) — react-query 캐시 키 다수가 계정을 모른다(['material', id] 등). 전역 staleTime 2분이라
// 같은 탭에서 A 로그아웃 → B 로그인(router.push — 새로 읽기 없음) 뒤 B가 같은 주소를 열면 A의 비공개 자료가 서버 없이 캐시로 그려졌다.
// 계정이 있다가 바뀌는 순간(A → 손님 · A → B) AuthContext adoptUser 한 곳에서 계정에 딸린 캐시를 비운다(기본 전부 · 공개 정적만 남김).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/query-core';
import { sliceBetween } from './helpers/sliceBetween';

const h = vi.hoisted(() => ({ slots: [], index: 0, effects: [], cleanups: [], listener: null, session: null }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual,
    useState(initial) { const i = h.index++; if (!(i in h.slots)) h.slots[i] = initial; return [h.slots[i], value => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; }]; },
    useRef(initial) { const i = h.index++; if (!(i in h.slots)) h.slots[i] = { current: initial }; return h.slots[i]; },
    useEffect(fn, deps) { const i = h.index++; const previous = h.slots[i]; if (!previous || deps?.some((value, j) => value !== previous[j])) { h.effects.push(fn); h.slots[i] = deps; } },
  };
});
vi.mock('../supabase', () => {
  const client = {
    from() { const q = { select: () => q, eq: () => q, single: async () => ({ data: null, error: { code: 'PGRST116' } }), update: () => q, upsert: async () => ({ error: null }), then: (resolve, reject) => Promise.resolve({ error: null }).then(resolve, reject) }; return q; },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: h.session } })),
      onAuthStateChange: vi.fn(fn => { h.listener = fn; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
      signOut: vi.fn(async () => { h.session = null; h.listener?.('SIGNED_OUT', null); return {}; }),
    },
  };
  return { supabase: client, getSupabase: vi.fn(async () => client) };
});
vi.mock('../ToastContext', () => ({ useToast: () => vi.fn() }));
vi.mock('../refProgress', () => ({ pullProgress: vi.fn(async () => {}) }));
vi.mock('../drillSrs', () => ({ migrateGuestDrillQueue: vi.fn(async () => {}) }));
import { AuthProvider } from '../AuthContext';
import { ACCOUNT_FREE_QUERY_ROOTS, accountCacheReset, accountLeft, accountSwitchedIn, clearAccountQueries, isAccountFreeQuery, knownAccount } from '../accountQueryCache';

const ROOT = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const user = id => ({ id, user_metadata: { name: id } });
let qc;
const render = () => { h.index = 0; return AuthProvider({ children: null, queryClient: qc }).props.value; };
async function effects() { for (const fn of h.effects.splice(0)) { const cleanup = fn(); if (cleanup) h.cleanups.push(cleanup); } await tick(); }
async function mount() { render(); await effects(); return render(); }

// RLS 흉내 — A의 비공개 자료 X는 A 세션에만 보인다(B · 손님은 NOT_FOUND). 키는 계정을 모른다(뷰어와 같은 ['material', id]).
const server = { actor: 'A' };
const materialFetch = vi.fn(async () => { if (server.actor !== 'A') { const err = new Error('NOT_FOUND'); err.code = 'NOT_FOUND'; throw err; } return { id: 'X', owner: 'A', raw_text: 'A의 비공개 본문' }; });
const newClient = () => new QueryClient({ defaultOptions: { queries: { staleTime: 1000 * 60 * 2, retry: false } } }); // providers.jsx와 같은 staleTime
async function openViewer() {
  const observer = new QueryObserver(qc, { queryKey: ['material', 'X'], queryFn: materialFetch });
  const seen = [];
  const un = observer.subscribe(result => seen.push(result));
  await vi.waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe('idle'));
  const result = observer.getCurrentResult(); un();
  return { data: result.data, error: result.error, seen };
}

beforeEach(() => {
  h.slots = []; h.index = 0; h.effects = []; h.cleanups = []; h.listener = null; h.session = { user: user('A') };
  server.actor = 'A'; materialFetch.mockClear(); qc = newClient();
  vi.stubGlobal('document', { cookie: 'sb-test-auth-token=x' });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(), location: { origin: 'http://fixture', pathname: '/home', search: '' } });
});
afterEach(() => { for (const fn of h.cleanups) fn(); vi.unstubAllGlobals(); });

describe('재현 — 키가 계정을 모르면 B가 A의 비공개 자료를 캐시로 본다', () => {
  it('비우지 않으면: A가 연 X를 로그아웃 → B 로그인 뒤 B가 열어도 서버를 거치지 않고 A의 본문이 나온다', async () => {
    expect((await openViewer()).data.raw_text).toBe('A의 비공개 본문');
    server.actor = 'B'; // 같은 탭 로그아웃 → B 로그인(router.push — 새로 읽기 없음, 캐시 그대로)
    const asB = await openViewer();
    expect(asB.data.raw_text).toBe('A의 비공개 본문');
    expect(materialFetch).toHaveBeenCalledTimes(1);
  });
  it('비우면: B는 서버에 다시 묻고 NOT_FOUND를 받는다(A의 본문이 한 번도 그려지지 않는다)', async () => {
    await openViewer();
    server.actor = 'B'; clearAccountQueries(qc);
    const asB = await openViewer();
    expect(asB.data).toBeUndefined(); expect(asB.error.code).toBe('NOT_FOUND');
    expect(asB.seen.some(r => r.data?.raw_text)).toBe(false);
    expect(materialFetch).toHaveBeenCalledTimes(2);
  });
});

describe('AuthContext adoptUser — 계정이 있다가 바뀌는 순간 한 곳에서 비운다', () => {
  const seed = () => {
    qc.setQueryData(['material', 'X'], { id: 'X', owner: 'A' });
    qc.setQueryData(['vocab-words', 'A'], [{ id: 1 }]);
    qc.setQueryData(['materials'], [{ id: 'X' }]);
    for (const root of ACCOUNT_FREE_QUERY_ROOTS) qc.setQueryData([root, 'k'], { shared: true });
  };
  const keys = () => qc.getQueryCache().getAll().map(q => q.queryKey[0]).sort();

  it('첫 복원(손님 → A)은 비우지 않는다 — 서버가 미리 받아 넣은 서재(HydrationBoundary)를 지우지 않는다', async () => {
    qc.setQueryData(['personal-library', 'A'], { hydrated: true });
    const auth = await mount();
    expect(auth.user.id).toBe('A');
    expect(qc.getQueryData(['personal-library', 'A'])).toEqual({ hydrated: true });
  });
  it('같은 계정 토큰 갱신 · 거듭 온 SIGNED_IN은 그대로 둔다', async () => {
    await mount(); seed();
    await h.listener('TOKEN_REFRESHED', { user: user('A') }); await h.listener('SIGNED_IN', { user: user('A') }); await tick();
    expect(qc.getQueryData(['material', 'X'])).toBeTruthy();
  });
  it('로그아웃(A → 손님): 계정에 딸린 캐시를 모두 지우고 공개 정적 캐시만 남긴다', async () => {
    const auth = await mount(); seed();
    await auth.signOut(); await tick();
    expect(render().user).toBeNull();
    expect(keys()).toEqual([...ACCOUNT_FREE_QUERY_ROOTS].sort());
  });
  it('다른 탭에서 B로 바뀜(A → B, SIGNED_OUT 없이 SIGNED_IN B)도 지운다', async () => {
    await mount(); seed();
    await h.listener('SIGNED_IN', { user: user('B') }); await tick();
    expect(render().user.id).toBe('B');
    expect(qc.getQueryData(['material', 'X'])).toBeUndefined();
    expect(qc.getQueryData(['vocab-words', 'A'])).toBeUndefined();
  });
  it('끝에서 끝: A가 연 X → 로그아웃 → B 로그인 → B가 X를 열면 서버에 묻고 A의 본문을 보지 않는다', async () => {
    const auth = await mount();
    await openViewer();
    await auth.signOut(); server.actor = null; await tick();
    h.session = { user: user('B') }; server.actor = 'B';
    await h.listener('SIGNED_IN', { user: user('B') }); await tick();
    const asB = await openViewer();
    expect(asB.error?.code).toBe('NOT_FOUND'); expect(asB.seen.some(r => r.data?.raw_text)).toBe(false);
  });
  it('⑤ 늦은 쓰기: 로그아웃 뒤 A의 mutation onSuccess가 다시 넣은 자료는 B가 들어오는 순간 지운다', async () => {
    const auth = await mount();
    await auth.signOut(); await tick();
    qc.setQueryData(['material', 'X'], { id: 'X', owner: 'A', raw_text: 'A의 비공개 본문' }); // 로그아웃 전에 떠난 교정의 onSuccess
    await h.listener('SIGNED_IN', { user: user('B') }); await tick();
    expect(render().user.id).toBe('B');
    expect(qc.getQueryData(['material', 'X'])).toBeUndefined();
  });
  it('⑤ 같은 A가 다시 들어오면(A → 손님 → A) A 자신의 늦은 쓰기는 그대로 둔다', async () => {
    const auth = await mount();
    await auth.signOut(); await tick();
    qc.setQueryData(['material', 'X'], { id: 'X', owner: 'A' });
    await h.listener('SIGNED_IN', { user: user('A') }); await tick();
    expect(qc.getQueryData(['material', 'X'])).toEqual({ id: 'X', owner: 'A' });
  });
  it('화면 계정을 적는다(기기 캐시 읽기가 쓴다) — 로그아웃이면 손님', async () => {
    const auth = await mount();
    expect(knownAccount()).toBe('A');
    await auth.signOut(); await tick();
    expect(knownAccount()).toBe(null);
  });
  it('queryClient 없이 그려도(기존 하네스 · 시험) 아무것도 하지 않는다', () => {
    expect(() => clearAccountQueries(undefined)).not.toThrow();
  });
});

describe('판정 · 남기는 키 목록', () => {
  it('accountLeft: 계정이 있다가 바뀔 때만 참', () => {
    expect(accountLeft(null, 'A')).toBe(false);
    expect(accountLeft('A', 'A')).toBe(false);
    expect(accountLeft('A', null)).toBe(true);
    expect(accountLeft('A', undefined)).toBe(true);
    expect(accountLeft('A', 'B')).toBe(true);
  });
  it('accountSwitchedIn · accountCacheReset: 손님 → B는 앞서 다른 계정이 있었을 때만', () => {
    expect(accountSwitchedIn(null, null, 'A')).toBe(false); // 첫 복원 · 첫 로그인
    expect(accountSwitchedIn('A', null, 'A')).toBe(false);  // 같은 계정 다시
    expect(accountSwitchedIn('A', null, 'B')).toBe(true);
    expect(accountSwitchedIn('A', 'A', 'B')).toBe(false);   // 이건 accountLeft 몫
    expect(accountCacheReset(null, null, 'A')).toBe(false);
    expect(accountCacheReset('A', 'A', 'B')).toBe(true);
    expect(accountCacheReset('A', null, 'B')).toBe(true);
    expect(accountCacheReset('A', 'A', 'A')).toBe(false);
  });
  it('남기는 뿌리는 확인한 셋뿐 — 계정 id · RLS에 기대는 자료(material 등)는 들이지 않는다', () => {
    expect([...ACCOUNT_FREE_QUERY_ROOTS]).toEqual(['goal-catalog', 'zh-hsk-levels', 'guest-book-chapter']);
    for (const root of ['material', 'materials', 'token-dict', 'pdf-url', 'pdf-info', 'group-members', 'vocab-words', 'personal-library']) expect(isAccountFreeQuery([root])).toBe(false);
  });
  it('남기는 뿌리의 queryFn이 계정에 기대지 않는다(정적 응답 · 번들 JSON · 공개 RPC)', () => {
    expect(read('src/app/api/goal-catalog/route.js')).toMatch(/export const dynamic = 'force-static'/);
    expect(read('src/components/learn/GoalTrackTile.jsx')).toContain("queryKey: ['goal-catalog'], queryFn: fetchGoalCatalog");
    expect(read('src/lib/zhHskLevel.js')).toMatch(/import\('\.\/data\/zhHsk2026Level\.json'\)/);
    const viewer = read('src/views/ViewerPage.jsx');
    const guest = sliceBetween(viewer, "queryKey: ['guest-book-chapter', id]", 'return catalogError');
    expect(guest).toContain("supabase.rpc('public_book_catalog'");
  });
  it('남기는 뿌리를 쓰는 곳이 키에 계정을 넣지 않는다(넣으면 계정 자료라는 뜻 — 남기기 목록에서 빼야 한다)', () => {
    const files = [];
    const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p); } else if (/\.(jsx?|mjs)$/.test(e.name)) files.push(p); } };
    walk(path.join(ROOT, 'src'));
    for (const root of ACCOUNT_FREE_QUERY_ROOTS) {
      const uses = files.flatMap(f => [...fs.readFileSync(f, 'utf8').matchAll(new RegExp(`queryKey:\\s*\\['${root}'([^\\]]*)\\]`, 'g'))].map(m => m[1]));
      expect(uses.length).toBeGreaterThan(0);
      for (const rest of uses) expect(rest).not.toMatch(/user|owner|actor|account/i);
    }
  });
});

describe('배선', () => {
  it('providers.jsx가 앱의 QueryClient를 AuthProvider에 넘긴다', () => {
    expect(read('src/app/providers.jsx')).toContain('<AuthProvider queryClient={queryClient} onAccountLeft={() => router.refresh()}>{children}</AuthProvider>');
  });
  it('계정이 바뀌는 곳은 adoptUser 하나 — setUser는 거기서만, 비우기는 setUser 전에', () => {
    const src = read('src/lib/AuthContext.jsx');
    expect(src.match(/setUser\(/g)).toHaveLength(1);
    const adopt = sliceBetween(src, 'function adoptUser(nextUser) {', 'setUser(nextUser ?? null);');
    expect(adopt).toContain('if (accountCacheReset(lastSignedInRef.current, actorRef.current, nextActor)) {');
    expect(adopt.indexOf('accountCacheReset(')).toBeLessThan(adopt.indexOf('clearAccountQueries(queryClient)'));
    expect(adopt.indexOf('clearAccountQueries(queryClient)')).toBeLessThan(adopt.indexOf('if (nextActor) lastSignedInRef.current = nextActor;'));
    expect(adopt.indexOf('clearAccountQueries(queryClient)')).toBeLessThan(adopt.indexOf('actorRef.current = nextUser?.id ?? null;'));
  });
});
