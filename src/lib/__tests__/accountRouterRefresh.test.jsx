// AUTH-ROUTER-REFRESH-001 (2026-10-17 KST) — 계정이 바뀌면(A → 손님 · A → B) react-query 캐시(AUTH-CACHE-CLEAR-001)뿐 아니라
// 서버 컴포넌트가 쿠키 세션으로 그린 A의 데이터(RSC 페이로드 · 라우터 캐시)도 버린다. 그 데이터는 react-query 밖에 있다:
// 서재 HydrationBoundary(serverUserId=A) · /study 문단 · /study/library · /writing 최근 장 · /review/grammar 항목 · 관리 화면 · 뷰어 제목.
// 지금 화면과 뒤로 가기 캐시에 남아, 계정 삭제 뒤 signOut(새로고침 없음)이나 다른 탭 전환(SIGNED_OUT 없이 SIGNED_IN B)에서 B에게 보였다.
// 관문은 AuthContext 하나(adoptUser의 accountLeft와 같은 판정) — 그린 뒤 effect에서 onAccountLeft(providers: router.refresh) 한 번.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
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
      // 실제 SDK처럼 signOut 안에서 SIGNED_OUT을 먼저 알린다 — adoptUser(null)가 두 번(listener · signOut 끝) 불린다.
      signOut: vi.fn(async () => { h.session = null; h.listener?.('SIGNED_OUT', null); return {}; }),
    },
  };
  return { supabase: client, getSupabase: vi.fn(async () => client) };
});
vi.mock('../ToastContext', () => ({ useToast: () => vi.fn() }));
vi.mock('../refProgress', () => ({ pullProgress: vi.fn(async () => {}) }));
vi.mock('../drillSrs', () => ({ migrateGuestDrillQueue: vi.fn(async () => {}) }));
import { AuthProvider } from '../AuthContext';

const ROOT = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const user = id => ({ id, user_metadata: { name: id } });
let refresh, qc;
const render = () => { h.index = 0; return AuthProvider({ children: null, queryClient: qc, onAccountLeft: refresh }).props.value; };
async function effects() { for (const fn of h.effects.splice(0)) { const cleanup = fn(); if (cleanup) h.cleanups.push(cleanup); } await tick(); }
async function commit() { render(); await effects(); return render(); }
async function mount() { render(); await effects(); return commit(); }

beforeEach(() => {
  h.slots = []; h.index = 0; h.effects = []; h.cleanups = []; h.listener = null; h.session = { user: user('A') };
  refresh = vi.fn(); qc = new QueryClient();
  vi.stubGlobal('document', { cookie: 'sb-test-auth-token=x' });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(), location: { origin: 'http://fixture', pathname: '/home', search: '' } });
});
afterEach(() => { for (const fn of h.cleanups) fn(); vi.unstubAllGlobals(); });

describe('서버 렌더 관문 — 계정이 있다가 바뀌면 그린 뒤 한 번 router.refresh', () => {
  it('첫 복원(손님 → A)은 부르지 않는다 — 서버가 A로 그린 서재(HydrationBoundary)가 맞는 계정의 것이다', async () => {
    const auth = await mount();
    expect(auth.user.id).toBe('A');
    await commit();
    expect(refresh).not.toHaveBeenCalled();
  });
  it('같은 계정 토큰 갱신 · 거듭 온 SIGNED_IN은 부르지 않는다', async () => {
    await mount();
    await h.listener('TOKEN_REFRESHED', { user: user('A') }); await h.listener('SIGNED_IN', { user: user('A') }); await commit();
    expect(refresh).not.toHaveBeenCalled();
  });
  it('로그아웃(A → 손님 — 계정 삭제 뒤 signOut 포함): adoptUser 안에서 바로가 아니라 그린 뒤 effect에서, 두 번 불려도 한 번', async () => {
    const auth = await mount();
    const pushed = [];
    await auth.signOut(); pushed.push('/auth'); // 로그아웃 뒤 이동하는 화면이 생겨도: await signOut(); router.push(…)
    expect(refresh).not.toHaveBeenCalled(); // 이동이 먼저 나간다(새로고침이 이동에 버려지지 않게)
    const after = await commit();
    expect(after.user).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(pushed).toEqual(['/auth']);
    await commit();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('다른 탭에서 B로 바뀜(SIGNED_OUT 없이 SIGNED_IN B): 한 번 — A의 서버 렌더(serverUserId=A 페이로드)를 버린다', async () => {
    await mount();
    await h.listener('SIGNED_IN', { user: user('B') });
    const after = await commit();
    expect(after.user.id).toBe('B');
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('A → 손님 → B 로그인: 떠날 때 한 번뿐(손님 → B는 로그인 화면의 이동 + refresh가 맡는다)', async () => {
    const auth = await mount();
    await auth.signOut(); await commit();
    h.session = { user: user('B') };
    await h.listener('SIGNED_IN', { user: user('B') }); await commit();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('onAccountLeft 없이 그려도(기존 하네스) 그대로 동작한다', async () => {
    refresh = undefined;
    const auth = await mount();
    await auth.signOut();
    await expect(commit()).resolves.toBeTruthy();
  });
});

describe('배선 — 관문은 하나', () => {
  it('providers.jsx가 router.refresh를 넘긴다', () => {
    const src = read('src/app/providers.jsx');
    expect(src).toContain("import { useRouter } from 'next/navigation';");
    expect(src).toContain('onAccountLeft={() => router.refresh()}');
  });
  it('관문은 accountLeft와 같은 판정 자리에서 표시하고, user가 바뀐 뒤 effect에서 부른다', () => {
    const src = read('src/lib/AuthContext.jsx');
    const adopt = sliceBetween(src, 'function adoptUser(nextUser) {', 'setUser(nextUser ?? null);');
    expect(adopt).toContain('const left = accountLeft(actorRef.current, nextActor);');
    expect(adopt).toContain('if (left) accountLeftPendingRef.current = true;');
    expect(src).toContain(`  useEffect(() => {
    if (!accountLeftPendingRef.current) return;
    accountLeftPendingRef.current = false;
    onAccountLeftRef.current?.();
  }, [user]);`);
  });
  it('로그아웃 진입점은 내 정보 · 계정 삭제 · 임베드뿐이고, 모두 관문만 지난다(따로 router.refresh 없음 — 중복 금지)', () => {
    // 진입점 = signOut()을 부르는 화면 코드(정의 · 시험 제외). 새 진입점이 생기면 여기서 멈춘다 — 이동하는 로그아웃을 만들면 관문 effect가
    // 그 이동(push)보다 먼저 나가 Next 액션 큐에서 버려질 수 있으니(차단2) push 뒤 refresh를 함께 두고 이 목록에 이유를 적는다.
    const files = [];
    const walk = dir => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const rel = `${dir}/${e.name}`; if (e.isDirectory()) { if (e.name !== '__tests__') walk(rel); } else if (/\.(jsx?|mjs)$/.test(e.name)) files.push(rel); } };
    walk('src');
    const callers = files.filter(f => f !== 'src/lib/AuthContext.jsx' && /\bsignOut\(\)/.test(read(f))).sort();
    // 내 정보의 로그아웃 줄은 계정 묶음(AccountSettings)에 산다(PROFILE-REDESIGN-001) — 내 정보 화면 파일은 signOut을 넘기기만 한다.
    expect(callers).toEqual(['src/app/embed/review/EmbedReviewClient.jsx', 'src/components/AccountSettings.jsx']);
    for (const file of callers) expect(read(file), file).not.toMatch(/router\.refresh\(/);
    // 로그인 상태 머리말에는 로그아웃 단추가 없다 — 머리말 단추(handleAuthClick)는 손님 갈래에만 있고 로그인 진입만 한다.
    const layout = read('src/components/Layout.jsx');
    const code = layout.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/[^\n]*/gm, '$1'); // 주석은 이력을 적을 수 있다 — 코드만 본다
    expect(code).not.toMatch(/signOut|로그아웃|router\.refresh\(/);
    const userArea = sliceBetween(layout, '{user ? (', ') : (');
    expect(userArea).not.toContain('handleAuthClick');
    expect(sliceBetween(layout, 'function handleAuthClick() {', '\n  }')).toContain('router.push(authEntryHref(');
    // 계정 삭제도 같은 signOut을 지난다 — 예전에는 새로고침이 없어 삭제한 계정의 서버 렌더가 그대로 남았다.
    expect(sliceBetween(read('src/components/AccountSettings.jsx'), 'async function handleDeleteAccount() {', 'finally {')).toContain('await signOut();');
  });
});

/**
 * 쿠키 세션으로 계정 데이터를 서버에서 그리는 라우트 — 관문이 지키는 대상의 목록이다. 새 라우트가 서버에서 계정 데이터를 읽으면
 * 여기에 이유와 함께 넣는다(관문만으로 충분한지, 자체 대조가 더 있는지). 자체 대조는 관문과 별개로 남긴다(손님 → 계정 등 다른 경로).
 */
const ACCOUNT_SERVER_ROUTES = Object.freeze({
  'src/app/(app)/materials/page.jsx': '서재 HydrationBoundary(serverUserId) — 키에 ownerId가 있어 B의 서재는 B 키로 다시 받는다(자체 방어). 관문은 A 페이로드 · 뒤로 가기 캐시를 버린다',
  'src/app/(app)/study/page.jsx': '오늘 문단 · 단어(sessionUserId) — authLost가 기록을 멈추고 알림을 띄우지만 A의 문단은 그대로 보인다. 관문이 B로 다시 그린다',
  'src/app/(app)/study/library/page.jsx': '지난 문단 · 요약 — 자체 대조 없음. 관문이 버린다',
  'src/app/(app)/writing/page.jsx': '최근 장(recentChapters) — 자체 대조 없음. 관문이 버린다',
  'src/app/(app)/review/grammar/page.jsx': '문법 복습 항목 — 자체 대조 없음. 관문이 버린다',
  'src/app/(app)/japanese/reading/page.jsx': '읽기 트랙 통과 문항(viewerScope) — 어긋나면 스스로 router.refresh/replace(손님 → 계정도 덮음). 관문과 별개',
  'src/app/(app)/discover/classics/page.jsx': '고전 명작 카드의 읽은 자리(리본 퍼센트 · ✓ — 자기 reading_progress) — 자체 대조 없음. 관문이 버리고 B로 다시 그린다',
  'src/app/(app)/viewer/[id]/page.jsx': '자료 제목(generateMetadata — 비공개 제목이 <title>에) · 문서 요청의 본문(VIEWER-SEED-001 — 읽은 계정을 함께 싣고, 브라우저는 지금 세션 계정과 같을 때만 문서 하나에 한 번 쓴다 · 화면 이동/새로고침 관문의 RSC 요청에는 싣지 않는다) — 관문이 버린다',
  'src/app/(app)/admin/metrics/page.jsx': '관리자 지표 — 관리자 확인 뒤 서버 렌더. 관문이 B 권한으로 다시 그린다',
  'src/app/(app)/admin/llm-bench/page.jsx': '관리자 LLM 벤치 — 관문이 B 권한으로 다시 그린다',
  'src/app/(app)/admin/textbooks/page.jsx': '관리자 교재 편집 — 관문이 B 권한으로 다시 그린다',
  'src/app/(app)/admin/books/japanese-n5/page.jsx': '관리자 원고 편집 — 관문이 B 권한으로 다시 그린다',
  'src/app/(app)/admin/books/japanese-n4/page.jsx': '관리자 원고 편집 — 관문이 B 권한으로 다시 그린다',
  'src/app/(app)/admin/books/japanese-n3/page.jsx': 'N3 관리자 원고 편집 — 기존 계정 전환 관문이 새 계정의 관리자 권한으로 다시 그린다',
  'src/app/(app)/admin/legacy-textbooks/[[...path]]/page.jsx': '관리자 기존 교재 보관함 — 관문이 B 권한으로 다시 그린다',
});

describe('서버에서 계정 데이터를 그리는 라우트 목록', () => {
  it('쿠키 세션으로 계정 데이터를 읽는 page · layout은 모두 목록에 있고, 목록의 파일은 실제로 그렇다', () => {
    const found = [];
    const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'api') walk(p); } else if (/^(page|layout)\.jsx?$/.test(e.name)) found.push(path.relative(ROOT, p).replaceAll('\\', '/')); } };
    walk(path.join(ROOT, 'src/app'));
    const reads = found.filter(f => /user\.id|requireUserClaims|requireAdmin|prefetchLibraryShelf|createSupabaseServerClient|auth\.getUser\(/.test(read(f))).sort();
    expect(reads, '서버가 계정 데이터를 그리는 새 라우트 — ACCOUNT_SERVER_ROUTES에 이유와 함께 넣는다').toEqual(Object.keys(ACCOUNT_SERVER_ROUTES).sort());
    for (const reason of Object.values(ACCOUNT_SERVER_ROUTES)) expect(reason.length).toBeGreaterThan(10);
  });
  it('서재는 서버 계정과 지금 계정이 다르면 지금 계정으로 그린다(키에 계정) — 관문 전의 자체 방어', () => {
    const page = read('src/components/web/LibraryPage.jsx');
    expect(page).toContain('const shelfUser=user||(loading&&serverUserId?{id:serverUserId}:null);');
    expect(page).toContain('<LibraryShelf key={shelfUser.id} user={shelfUser}');
    expect(read('src/lib/libraryShelfQueries.js')).toContain("queryKey: ['personal-library', ownerId,");
  });
});
