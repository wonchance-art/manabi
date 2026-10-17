import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, hashKey, hydrate } from '@tanstack/react-query';

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

import { prefetchLibraryShelf, shelfQueries } from '../server/libraryPrefetch';
import { libraryCollectionsQuery, libraryListQuery, libraryRecentQuery } from '../libraryShelfQueries';
import { libraryFilters } from '../personalLibrary';

// LIBRARY-PREFETCH-001 — 서재 첫 화면을 서버가 미리 받는다(「읽던 곳 없음」 접힘 · 대화 묶음 밀림은 서버가 이미 안다).
// 계약: ⑴ 서버와 브라우저가 같은 키 · 같은 가져오기 함수(정본 libraryShelfQueries — 가져오기 로직 중복 0)
// ⑵ 실패 · 손님 · 시간 초과면 null(지금처럼 브라우저가 받고 골격이 대신) ⑶ 페이지를 막지 않는다(예산 안에서 끝난 것만).
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const RECENT = { items: [{ target_kind: 'material', target_id: '1', title: '읽던 글', opened_at: '2026-10-17T00:00:00Z' }], total: 1 };
const PAGE = { items: [{ target_kind: 'material', target_id: '2', title: '목록 글' }], total: 1 };
/** Supabase 흉내 — 체이닝은 자기 자신을 돌려주고, await하면 표(rpc 이름 · 테이블)별 결과. */
function fakeClient({ rpc = (name, args) => ({ data: args.p_filters.recent ? RECENT : PAGE, error: null }), tables = {} } = {}) {
  const chain = (table) => {
    const proxy = new Proxy({}, { get: (_, prop) => (prop === 'then'
      ? (resolve, reject) => Promise.resolve(tables[table] ? tables[table]() : { data: [], error: null }).then(resolve, reject)
      : () => proxy) });
    return proxy;
  };
  return { rpc: (name, args) => Promise.resolve(rpc(name, args)), from: chain };
}
const signedIn = (client) => async () => ({ supabase: client, user: { id: 'u1' } });

describe('⑴ 같은 키 · 같은 가져오기 함수', () => {
  it('브라우저 화면들과 서버 미리 받기가 모두 정본(libraryShelfQueries)에서 쿼리를 만든다', () => {
    const shelf = read('src/components/library/LibraryShelf.jsx');
    expect(shelf).toContain('const recent=useQuery(libraryRecentQuery(supabase,user.id));');
    // 튜터 대화는 서재에 두지 않는다(CONV-CHAT-001 8차) — 대화 묶음 쿼리가 없다.
    expect(shelf).not.toMatch(/libraryConversationsQuery|ConversationShelf/);
    expect(shelf).toContain('const listQuery=libraryListQuery(supabase,user.id,filters,pinned.data)');
    expect(read('src/components/library/LibraryCollections.jsx')).toContain('return useQuery(libraryCollectionsQuery(supabase,ownerId));');
    const server = read('src/lib/server/libraryPrefetch.js');
    expect(server).toContain("import { libraryCollectionsQuery, libraryListQuery, libraryRecentQuery } from '@/lib/libraryShelfQueries';");
    // 가져오기 로직은 정본 한 곳 — 화면 · 서버 어디에도 직접 부르는 자리가 없다.
    for (const file of ['src/components/library/LibraryShelf.jsx', 'src/components/library/LibraryCollections.jsx', 'src/lib/server/libraryPrefetch.js']) {
      expect(read(file), file).not.toMatch(/fetchLibraryPage\(|fetchConversations\(|fetchCollections\(/);
    }
  });
  it('서버가 담은 결과를 브라우저 키로 그대로 찾는다(hydrate → getQueryData)', async () => {
    const result = await prefetchLibraryShelf({}, { auth: signedIn(fakeClient()) });
    expect(result.userId).toBe('u1');
    const filters = libraryFilters(new URLSearchParams());
    const keys = [libraryRecentQuery(null, 'u1'), libraryCollectionsQuery(null, 'u1'), libraryListQuery(null, 'u1', filters, undefined)]
      .map((q) => q.queryKey);
    expect(result.state.queries.map((q) => q.queryHash).sort()).toEqual(keys.map(hashKey).sort());
    const browser = new QueryClient();
    hydrate(browser, JSON.parse(JSON.stringify(result.state))); // RSC 경계를 건너는 직렬화
    expect(browser.getQueryData(keys[0])).toEqual(RECENT);
    expect(browser.getQueryData(keys[2]).pages[0]).toEqual(PAGE);
  });
  it('화면이 실제로 부르는 것만: 좁힌 조건은 읽던 곳 없음, ?pinned=1은 목록 없음(기기 목록이 키에 든다)', () => {
    const names = (params) => shelfQueries(null, 'u1', new URLSearchParams(params)).map((q) => q.queryKey[0]);
    expect(names('')).toEqual(['library-collections', 'library-recent', 'personal-library']);
    expect(names('q=駅')).toEqual(['library-collections', 'personal-library']);
    expect(names('pinned=1')).toEqual(['library-collections']);
  });
});

describe('⑵ 실패하면 지금처럼(null → 브라우저가 받고 골격)', () => {
  it('손님 · 인증 오류 · 인증 예외 · 서재 밖 화면', async () => {
    expect(await prefetchLibraryShelf({}, { auth: async () => ({ error: '로그인이 필요해요.', status: 401 }) })).toBeNull();
    expect(await prefetchLibraryShelf({}, { auth: async () => { throw new Error('auth down'); } })).toBeNull();
    const auth = vi.fn(signedIn(fakeClient()));
    for (const params of [{ tools: '1' }, { sort: 'fit' }, { tab: 'public' }]) expect(await prefetchLibraryShelf(params, { auth })).toBeNull();
    expect(auth).not.toHaveBeenCalled();
  });
  it('쿼리가 모두 실패하면 null, 일부만 실패하면 성공한 것만 싣는다(실패한 쿼리는 브라우저가 다시 받는다)', async () => {
    const down = fakeClient({ rpc: () => ({ data: null, error: { message: 'down' } }), tables: { library_collections: () => ({ data: null, error: { message: 'down' } }), reading_materials: () => ({ data: null, error: { message: 'down' } }) } });
    expect(await prefetchLibraryShelf({}, { auth: signedIn(down) })).toBeNull();
    const partial = fakeClient({ tables: { reading_materials: () => ({ data: null, error: { message: 'down' } }) } });
    const result = await prefetchLibraryShelf({}, { auth: signedIn(partial) });
    expect(result.state.queries.map((q) => q.queryKey[0]).sort()).toEqual(['library-collections', 'library-recent', 'personal-library']);
  });
});

describe('⑶ 페이지를 막지 않는다 — 예산 안에서 끝난 것만', () => {
  // 가짜 시계로 잰다 — 실제 시계(< 250ms)는 전체 게이트 병렬 부하에서 흔들릴 후보다(libraryPrefetchWait 6e58b301 선례).
  // 예산만큼만 시간을 흘렸을 때 이미 끝나 있어야 한다(예산을 무시하고 멈춘 쿼리를 기다리면 끝나지 않는다).
  async function settleWithin(budgetMs, run) {
    vi.useFakeTimers();
    try {
      const outcome = { done: false, value: undefined };
      run().then((value) => { Object.assign(outcome, { done: true, value }); });
      await vi.advanceTimersByTimeAsync(budgetMs);
      return outcome;
    } finally {
      vi.useRealTimers();
    }
  }
  it('목록 RPC가 멈춰도 예산(여기선 60ms) 안에 돌아오고, 끝난 폴더만 싣는다', async () => {
    const stuck = fakeClient({ rpc: () => new Promise(() => {}) });
    const { done, value: result } = await settleWithin(60, () => prefetchLibraryShelf({}, { auth: signedIn(stuck), budgetMs: 60 }));
    expect(done).toBe(true);
    expect(result.state.queries.map((q) => q.queryKey[0]).sort()).toEqual(['library-collections']);
  });
  it('인증이 예산을 넘기면 null', async () => {
    const outcome = await settleWithin(40, () => prefetchLibraryShelf({}, { auth: () => new Promise(() => {}), budgetMs: 40 }));
    expect(outcome).toEqual({ done: true, value: null });
  });
  it('기본 예산 800ms · page.jsx는 실패 시 그대로 LibraryPage, 성공 시 HydrationBoundary + serverUserId', () => {
    expect(read('src/lib/server/libraryPrefetch.js')).toContain('export const LIBRARY_PREFETCH_BUDGET_MS = 800;');
    const page = read('src/app/(app)/materials/page.jsx');
    expect(page).toContain("import { HydrationBoundary } from '@tanstack/react-query';");
    // 미리 받지 못했으면 세션 쿠키 유무(이름만, 배움 B1과 같은 함수)를 넘긴다 — 손님은 로그인 서재 골격 없이 손님 화면.
    expect(page).toContain('if (!prefetched) return <LibraryPage sessionHint={hasSupabaseSessionInJar(await cookies())} />;');
    expect(page).toContain("import { hasSupabaseSessionInJar } from '@/lib/authCookie';");
    expect(page).toContain('<HydrationBoundary state={prefetched.state}><LibraryPage serverUserId={prefetched.userId} /></HydrationBoundary>');
    // 브라우저 첫 그림 = 서버 HTML(#418 없음): 로그인 확인 전에도 서버가 확인한 계정의 서재를 그린다.
    const libraryPage = read('src/components/web/LibraryPage.jsx');
    expect(libraryPage).toContain('const shelfUser=user||(loading&&serverUserId?{id:serverUserId}:null);');
    expect(libraryPage).toContain('export default function LibraryPage({serverUserId=null,sessionHint}){');
    expect(libraryPage).toContain('{loading&&!shelfUser&&sessionHint!==false?<LibraryShelfSkeleton/>:');
    expect(libraryPage).toContain('<LibraryShelf key={shelfUser.id} user={shelfUser}/>');
  });
});
