// 계정 경계 순서표(ACCOUNT-BOUNDARY-MATRIX, 2026-10-17 KST) — AuthContext adoptUser 최종본 하나가 장면마다 무엇을 하는지 한 장에 고정한다.
// 열: 화면 캐시(react-query) · 오프라인 정리(purgeOfflineForAccount) · 진도 수령(손님 몫 레퍼런스 진도) · 넘겨줄 글 삭제(study_source_*) ·
//     mutation 감시(앞 계정이 시작해 뒤에 끝난 쓰기) · 화면 계정(knownAccount) · refresh 표시(aafb ②) · SC 힌트.
// 아직 통합본에 없는 칸(PENDING)은 비워 둔다 — aafb ②(refresh) · a0a4 sc-link-3(SC 힌트 쿠키)이 들어오면 아래 「대기 칸」 계약이 깨져 채우라고 알린다.
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
const PENDING = '② 대기';

/** 순서표 — 각 장면의 마지막 전환에서 일어나는 일. 값: 'yes' · 'no' · 손님/계정 표기 · PENDING. */
export const ACCOUNT_BOUNDARY_MATRIX = [
  { scene: '첫 복원(손님 → A, 이 기기 처음)', cache: 'keep', purge: 'no', claim: 'yes', source: 'keep', mutation: '해당 없음', shown: 'A', refresh: PENDING, scHint: PENDING },
  { scene: '같은 계정 갱신(A → A, TOKEN_REFRESHED)', cache: 'keep', purge: 'no', claim: 'no', source: 'keep', mutation: 'keep', shown: 'A', refresh: PENDING, scHint: PENDING },
  { scene: 'A → 손님(로그아웃)', cache: 'clear', purge: '손님', claim: 'no', source: 'clear', mutation: 'clear', shown: '손님', refresh: PENDING, scHint: PENDING },
  { scene: 'A → B(다른 탭 SIGNED_IN B)', cache: 'clear', purge: 'B', claim: 'no', source: 'clear', mutation: 'clear', shown: 'B', refresh: PENDING, scHint: PENDING },
  { scene: '손님 → B(앞서 A)', cache: 'clear', purge: 'B', claim: 'no', source: 'clear', mutation: 'clear', shown: 'B', refresh: PENDING, scHint: PENDING },
  { scene: 'A → 손님 → A', cache: 'keep', purge: 'no', claim: 'yes', source: 'keep', mutation: 'keep', shown: 'A', refresh: PENDING, scHint: PENDING },
];

let qc, data;
const render = () => { h.index = 0; return AuthProvider({ children: null, queryClient: qc }).props.value; };
async function effects() { for (const fn of h.effects.splice(0)) { const cleanup = fn(); if (cleanup) h.cleanups.push(cleanup); } await tick(); }
async function mount() { render(); await effects(); return render(); }
async function rerender() { render(); await effects(); }

beforeEach(() => {
  h.slots = []; h.index = 0; h.effects = []; h.cleanups = []; h.listener = null; h.session = { user: user('A') };
  purge.calls = [];
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
  purge.calls = [];
}
function observe(target) {
  return {
    cache: qc.getQueryData(['material', 'X']) ? 'keep' : 'clear',
    purge: purge.calls.length ? (purge.calls[0] === null ? '손님' : purge.calls[0]) : 'no',
    claim: target && data.has(`ja_read_chapters:${target}`) && !data.has('ja_read_chapters') ? 'yes' : 'no',
    source: data.has('study_source_Japanese') ? 'keep' : 'clear',
    shown: knownAccount() === null ? '손님' : knownAccount(),
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
      const want = { cache: row.cache, purge: row.purge, claim: row.claim, source: row.source, mutation: row.mutation, shown: row.shown };
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

describe('대기 칸 — 통합본에 아직 없는 열', () => {
  it('refresh 표시(aafb ② AUTH-ROUTER-REFRESH-001)가 들어오면 이 계약이 깨진다 — 그때 표의 refresh 칸을 채우고 이 검사를 실제 검사로 바꾼다', () => {
    expect(read('src/lib/AuthContext.jsx')).not.toContain('onAccountLeft');
    expect(read('src/app/providers.jsx')).not.toContain('onAccountLeft');
    expect(ACCOUNT_BOUNDARY_MATRIX.every(r => r.refresh === PENDING)).toBe(true);
  });
  it('SC 힌트 칸(a0a4 sc-link-3 — 중국어 글꼴 힌트 쿠키 `manabi_sc=1`, 로그아웃 · 계정 이탈 때 syncScHintCookie(false)로 지워야 함)이 들어오면 이 계약이 깨진다 — 그때 표의 scHint 칸(A → 손님 · A → B · 손님 → B는 지움)을 채우고 실제 검사로 바꾼다', () => {
    const files = [];
    const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); } else if (/\.(jsx?|mjs)$/.test(e.name)) files.push(p); } };
    walk(path.join(ROOT, 'src'));
    const withHint = files.filter(f => /syncScHintCookie|manabi_sc\b/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(ROOT, f));
    expect(withHint, 'sc-link-3이 들어왔다 — SC 힌트 칸을 채운다').toEqual([]);
    expect(ACCOUNT_BOUNDARY_MATRIX.every(r => r.scHint === PENDING)).toBe(true);
  });
});
