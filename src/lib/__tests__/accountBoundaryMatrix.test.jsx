// 계정 경계 순서표(ACCOUNT-BOUNDARY-MATRIX, 2026-10-17 KST) — AuthContext adoptUser 최종본 하나가 장면마다 무엇을 하는지 한 장에 고정한다.
// 열: 화면 캐시(react-query) · 오프라인 정리(purgeOfflineForAccount) · 진도 수령(손님 몫 레퍼런스 진도) · 넘겨줄 글 삭제(study_source_*) ·
//     mutation 감시(앞 계정이 시작해 뒤에 끝난 쓰기) · 화면 계정(knownAccount) · refresh 표시(aafb ②) · SC 힌트.
// refresh 표시(aafb ② — onAccountLeft → router.refresh) · SC 힌트(a0a4 sc-link-3 — syncScHintCookie(false))도 이제 실제로 돌려 칸을 채운다
// (통합 next-staging-2, 2026-10-18 KST — 대기 칸 계약이 깨져 채움). SC 힌트 지움은 화면 캐시 비우기와 같은 판정(accountCacheReset) 자리다.
// 표의 각 칸은 실제 AuthProvider(훅 대역)를 돌려 확인한다 — 문서가 아니라 계약이다.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MutationObserver, QueryClient } from '@tanstack/query-core';
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
const purge = vi.hoisted(() => ({ calls: [] }));
const hint = vi.hoisted(() => ({ calls: [] }));
// SC 힌트 쿠키 — 지우는 호출만 센다(대역 document.cookie는 문자열이라 실제로 쓰면 세션 쿠키 흉내가 지워진다). 쿠키 쓰기 자체는 scHintAccountBoundary가 본다.
vi.mock('../scFontHint', async importOriginal => ({ ...(await importOriginal()), syncScHintCookie: vi.fn(on => { hint.calls.push(on); return true; }) }));
vi.mock('../offlineCache', () => ({ purgeOfflineForAccount: vi.fn(async next => { purge.calls.push(next); return { materials: 0 }; }) }));
vi.mock('../ToastContext', () => ({ useToast: () => vi.fn() }));
vi.mock('../refProgress', () => ({ pullProgress: vi.fn(async () => {}) }));
vi.mock('../drillSrs', () => ({ migrateGuestDrillQueue: vi.fn(async () => {}) }));
import { AuthProvider } from '../AuthContext';
import { knownAccount } from '../accountQueryCache';

const ROOT = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const user = id => ({ id, user_metadata: { name: id } });

/** 순서표 — 각 장면의 마지막 전환에서 일어나는 일. 값: 'yes' · 'no' · 'keep' · 'clear' · 손님/계정 표기.
 *  refresh = 서버 렌더 버리기(계정이 떠날 때만 — A → 손님 · A → B). scHint = 간체 글꼴 힌트 쿠키(화면 캐시와 같은 판정에서 지움). */
export const ACCOUNT_BOUNDARY_MATRIX = [
  { scene: '첫 복원(손님 → A, 이 기기 처음)', cache: 'keep', purge: 'no', claim: 'yes', source: 'keep', mutation: '해당 없음', shown: 'A', refresh: 'no', scHint: 'keep' },
  { scene: '같은 계정 갱신(A → A, TOKEN_REFRESHED)', cache: 'keep', purge: 'no', claim: 'no', source: 'keep', mutation: 'keep', shown: 'A', refresh: 'no', scHint: 'keep' },
  { scene: 'A → 손님(로그아웃)', cache: 'clear', purge: '손님', claim: 'no', source: 'clear', mutation: 'clear', shown: '손님', refresh: 'yes', scHint: 'clear' },
  { scene: 'A → B(다른 탭 SIGNED_IN B)', cache: 'clear', purge: 'B', claim: 'no', source: 'clear', mutation: 'clear', shown: 'B', refresh: 'yes', scHint: 'clear' },
  { scene: '손님 → B(앞서 A)', cache: 'clear', purge: 'B', claim: 'no', source: 'clear', mutation: 'clear', shown: 'B', refresh: 'no', scHint: 'clear' },
  { scene: 'A → 손님 → A', cache: 'keep', purge: 'no', claim: 'yes', source: 'keep', mutation: 'keep', shown: 'A', refresh: 'no', scHint: 'keep' },
];

let qc, data, refreshes;
const onAccountLeft = () => { refreshes += 1; };
const render = () => { h.index = 0; return AuthProvider({ children: null, queryClient: qc, onAccountLeft }).props.value; };
async function effects() { for (const fn of h.effects.splice(0)) { const cleanup = fn(); if (cleanup) h.cleanups.push(cleanup); } await tick(); }
async function mount() { render(); await effects(); return render(); }
async function rerender() { render(); await effects(); }

beforeEach(() => {
  h.slots = []; h.index = 0; h.effects = []; h.cleanups = []; h.listener = null; h.session = { user: user('A') };
  purge.calls = []; hint.calls = []; refreshes = 0;
  qc = new QueryClient({ defaultOptions: { queries: { staleTime: 120000, retry: false }, mutations: { retry: false } } });
  data = new Map();
  vi.stubGlobal('localStorage', { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) });
  vi.stubGlobal('document', { cookie: 'sb-test-auth-token=x' });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(), location: { origin: 'http://fixture', pathname: '/home', search: '' } });
});
afterEach(() => { for (const fn of h.cleanups) fn(); vi.unstubAllGlobals(); });

/** 앞 계정이 시작한 교정 — 전환 뒤에 끝나며 setQueryData로 쓴다(MUTATION-ACCOUNT-GEN-001이 지워야 하는 늦은 쓰기). */
function startLateWrite() {
  let resolve;
  const observer = new MutationObserver(qc, { mutationFn: () => new Promise(r => { resolve = r; }), onSuccess: () => qc.setQueryData(['material', 'M'], { late: true }) });
  const un = observer.subscribe(() => {});
  const run = observer.mutate({});
  return async () => { resolve({ ok: true }); await run; await tick(); un(); await wait(5); };
}
/** 전환 직전에 심는 것 — 칸마다 무엇이 바뀌었는지 본다. */
function seed() {
  qc.setQueryData(['material', 'X'], { id: 'X' });
  data.set('ja_read_chapters', JSON.stringify(['n5-01'])); // 손님 몫(옛 키)
  data.set('study_source_Japanese', JSON.stringify({ owner: null, at: Date.now(), text: '넘겨줄 글' }));
  purge.calls = []; hint.calls = []; refreshes = 0;
}
function observe(target) {
  return {
    cache: qc.getQueryData(['material', 'X']) ? 'keep' : 'clear',
    purge: purge.calls.length ? (purge.calls[0] === null ? '손님' : purge.calls[0]) : 'no',
    claim: target && data.has(`ja_read_chapters:${target}`) && !data.has('ja_read_chapters') ? 'yes' : 'no',
    source: data.has('study_source_Japanese') ? 'keep' : 'clear',
    shown: knownAccount() === null ? '손님' : knownAccount(),
    refresh: refreshes > 0 ? 'yes' : 'no',
    scHint: hint.calls.includes(false) ? 'clear' : 'keep',
  };
}

const SCENES = {
  '첫 복원(손님 → A, 이 기기 처음)': async () => {
    seed();
    await mount();
    await tick();
    return { ...observe('A'), mutation: '해당 없음' };
  },
  '같은 계정 갱신(A → A, TOKEN_REFRESHED)': async () => {
    await mount();
    const finish = startLateWrite();
    seed();
    await h.listener('TOKEN_REFRESHED', { user: user('A') }); await tick(); await rerender();
    const cells = observe('A');
    await finish();
    return { ...cells, mutation: qc.getQueryData(['material', 'M']) ? 'keep' : 'clear' };
  },
  'A → 손님(로그아웃)': async () => {
    const auth = await mount();
    const finish = startLateWrite();
    seed();
    await auth.signOut(); await tick(); await rerender();
    const cells = observe(null);
    await finish();
    return { ...cells, mutation: qc.getQueryData(['material', 'M']) ? 'keep' : 'clear' };
  },
  'A → B(다른 탭 SIGNED_IN B)': async () => {
    await mount();
    const finish = startLateWrite();
    seed();
    await h.listener('SIGNED_IN', { user: user('B') }); await tick(); await rerender();
    const cells = observe('B');
    await finish();
    return { ...cells, mutation: qc.getQueryData(['material', 'M']) ? 'keep' : 'clear' };
  },
  '손님 → B(앞서 A)': async () => {
    const auth = await mount();
    const finish = startLateWrite();
    await auth.signOut(); await tick(); await rerender();
    seed(); // 로그아웃 뒤에 늦게 들어온 캐시 · 손님 진도 · 손님이 넘긴 글
    await h.listener('SIGNED_IN', { user: user('B') }); await tick(); await rerender();
    const cells = observe('B');
    await finish();
    return { ...cells, mutation: qc.getQueryData(['material', 'M']) ? 'keep' : 'clear' };
  },
  'A → 손님 → A': async () => {
    const auth = await mount();
    const finish = startLateWrite();
    await auth.signOut(); await tick(); await rerender();
    seed();
    await h.listener('SIGNED_IN', { user: user('A') }); await tick(); await rerender();
    const cells = observe('A');
    await finish();
    return { ...cells, mutation: qc.getQueryData(['material', 'M']) ? 'keep' : 'clear' };
  },
};

describe('계정 경계 순서표 — 장면마다 실제로 돌려 표와 맞춘다', () => {
  for (const row of ACCOUNT_BOUNDARY_MATRIX) {
    it(row.scene, async () => {
      const got = await SCENES[row.scene]();
      const want = { cache: row.cache, purge: row.purge, claim: row.claim, source: row.source, mutation: row.mutation, shown: row.shown, refresh: row.refresh, scHint: row.scHint };
      expect(got).toEqual(want);
    });
  }
  it('표의 장면은 여섯 · 장면마다 실행기가 있다', () => {
    expect(ACCOUNT_BOUNDARY_MATRIX.map(r => r.scene)).toEqual(Object.keys(SCENES));
  });
});

describe('순서 — adoptUser 안에서 이 차례로 한다(새 user로 그리기 전에)', () => {
  it('화면 계정 → 전환 판정 → 캐시 비우기 · 오프라인 정리 · 넘겨줄 글 삭제 → 진도 수령 → 마지막 계정 → setUser', () => {
    const src = read('src/lib/AuthContext.jsx');
    const adopt = sliceBetween(src, 'function adoptUser(nextUser) {', 'if (!profileReaderRef.current) {');
    const order = ['noteAccount(nextActor);', 'if (accountCacheReset(', 'clearAccountQueries(queryClient);', "import('./offlineCache').then((cache) => cache.purgeOfflineForAccount(nextActor))",
      'clearAllStudySources();', 'if (nextActor) claimGuestRefProgress(nextActor);', 'if (nextActor) lastSignedInRef.current = nextActor;', 'setUser(nextUser ?? null);'];
    const at = order.map(s => adopt.indexOf(s));
    expect(at.every(i => i >= 0), `빠진 단계: ${order.filter((s, i) => at[i] < 0).join(' · ')}`).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it('mutation 감시는 AuthProvider가 받은 queryClient에 effect로 건다', () => {
    expect(read('src/lib/AuthContext.jsx')).toContain('useEffect(() => (queryClient ? watchAccountMutations(queryClient) : undefined), [queryClient]);');
  });
});

describe('refresh · SC 힌트 칸 — 배선과 장면 밖 경우', () => {
  it('refresh 표시는 계정이 떠날 때만 세우고(left), 그리기가 끝난 뒤 effect에서 한 번 부른다 — 「비우기 → setUser → effect에서 refresh」', () => {
    const src = read('src/lib/AuthContext.jsx');
    const adopt = sliceBetween(src, 'function adoptUser(nextUser) {', 'if (!profileReaderRef.current) {');
    const at = ['const left = accountLeft(actorRef.current, nextActor);', 'clearAccountQueries(queryClient);', 'if (left) accountLeftPendingRef.current = true;', 'setUser(nextUser ?? null);'].map(x => adopt.indexOf(x));
    expect(at.every(i => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(read('src/app/providers.jsx')).toContain('<AuthProvider queryClient={queryClient} onAccountLeft={() => router.refresh()}>');
  });
  it('SC 힌트 지움은 화면 캐시 비우기와 같은 판정(accountCacheReset) 안에 있다', () => {
    const adopt = sliceBetween(read('src/lib/AuthContext.jsx'), 'if (accountCacheReset(', 'if (left) accountLeftPendingRef.current = true;');
    expect(adopt).toContain('clearAccountQueries(queryClient);');
    expect(adopt).toContain('syncScHintCookie(false);');
  });
  it('손님 확정(세션 쿠키 없음 — 만료 · 다른 탭 로그아웃 뒤 첫 진입)은 힌트를 지우고 refresh는 부르지 않는다', async () => {
    h.session = null;
    vi.stubGlobal('document', { cookie: '' });
    await mount();
    expect(hint.calls).toContain(false);
    expect(refreshes).toBe(0);
  });
});
