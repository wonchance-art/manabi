// VIEWER-SEED-001 — 뷰어 본문을 첫 HTML에 싣는다(로그인 감사 F3② 2026-10-25 KST).
// 서버: 요청한 사람의 권한으로만 읽는다(쿠키 세션 = 그 토큰, 없으면 anon) · 화면 이동(RSC) · 숫자 아닌 id · 토큰 곧 만료 · 오류 · 다른 모양이면 싣지 않는다.
// 브라우저: 문서 하나에 한 번, 이 문서를 연 시각과 서버가 그린 시각이 가깝고 · 끊기지 않았고 · 지금 세션 계정 = 서버가 읽은 계정일 때만 쓴다.
// 그 밖에는 지금처럼 새로 받는다. 쓴 행은 지금 조회처럼 계정별 기기 사본으로 남긴다.
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const io = vi.hoisted(() => ({ calls: [], session: 'A', sessionThrows: false }));
vi.mock('../supabase', () => ({ supabase: { from: () => { throw new Error('network not used in this test'); },
  auth: { getSession: async () => { if (io.sessionThrows) throw new Error('auth'); return { data: { session: io.session ? { user: { id: io.session } } : null } }; } } } }));
vi.mock('../offlineCache', () => ({ cacheMaterial: async (...args) => { io.calls.push(['cacheMaterial', ...args]); }, getCachedMaterial: async () => null }));
vi.mock('../sharedStore', () => ({ getSharedCopy: async () => null }));
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ getAll: () => [], get: () => undefined }) }));
vi.mock('@/lib/supabaseServer', () => ({ requireUserClaims: async () => ({ error: 'x' }), createSupabasePublicClient: () => null }));

const server = await import('../server/viewerSeed');
const lib = await import('../viewerMaterial');
const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function client(result, calls = []) {
  const chain = {
    from: (t) => { calls.push(['from', t]); return chain; },
    select: (s) => { calls.push(['select', s]); return chain; },
    eq: (c, v) => { calls.push(['eq', c, v]); return chain; },
    abortSignal: () => chain,
    maybeSingle: async () => { if (result instanceof Error) throw result; return result; },
  };
  return chain;
}
const ROW = { id: 45, owner_id: 'A', visibility: 'private', title: '자료', raw_text: '本', processed_json: { sequence: [], dictionary: {} } };

describe('서버 — 누구의 권한으로 무엇을 싣나', () => {
  it('세션 쿠키가 있으면 그 계정 토큰 클라이언트로 읽고 계정을 함께 싣는다', async () => {
    const calls = [];
    const seed = await server.loadViewerSeed('45', { sessionCookie: true, auth: async () => ({ supabase: client({ data: ROW, error: null }, calls), user: { id: 'A' } }),
      publicClient: () => { throw new Error('anon not used'); }, now: () => 777 });
    expect(seed).toEqual({ id: '45', row: ROW, account: 'A', servedAt: 777 });
    expect(calls).toEqual([['from', 'reading_materials'], ['select', '*'], ['eq', 'id', '45']]);
  });
  it('세션 쿠키가 없으면 anon(쿠키를 읽지도 쓰지도 않는 클라이언트) — 계정 null', async () => {
    const seed = await server.loadViewerSeed('45', { auth: async () => { throw new Error('auth not used'); }, publicClient: () => client({ data: { ...ROW, visibility: 'public' }, error: null }), now: () => 1 });
    expect(seed.account).toBe(null);
    expect(seed.row.visibility).toBe('public');
  });
  it('쿠키는 있는데 토큰이 곧 만료 · 무효면(requireUserClaims 거절) anon으로 물러서지 않고 싣지 않는다 — 브라우저가 그 계정으로 받는다', async () => {
    expect(await server.loadViewerSeed('45', { sessionCookie: true, auth: async () => ({ error: '로그인이 필요해요.', status: 401 }), publicClient: () => client({ data: ROW, error: null }) })).toBe(null);
  });
  it('그 계정에게 보이는 행이 없으면 row null(제목은 기본값 · 본문은 싣지 않음)', async () => {
    const seed = await server.loadViewerSeed('45', { publicClient: () => client({ data: null, error: null }) });
    expect(seed.row).toBe(null);
    expect(await server.viewerSeedWithin('45', 800, async () => seed)).toBe(null);
  });
  it.each([
    ['화면 이동(RSC 요청)', '45', { rscRequest: true }],
    ['팀 사본', 'local:7', {}],
    ['숫자 아닌 id', 'abc', {}],
  ])('싣지 않는다: %s', async (_label, id, extra) => {
    expect(await server.loadViewerSeed(id, { ...extra, publicClient: () => { throw new Error('not read'); } })).toBe(null);
  });
  it('조회 오류 · 던짐 · 다른 id/부분 행(예: 제목만)이면 싣지 않는다', async () => {
    expect(await server.loadViewerSeed('45', { publicClient: () => client({ data: null, error: { message: 'x' } }) })).toBe(null);
    expect(await server.loadViewerSeed('45', { publicClient: () => client(new Error('net')) })).toBe(null);
    expect(await server.loadViewerSeed('45', { publicClient: () => client({ data: { id: 46, title: 'x' }, error: null }) })).toBe(null);
    expect(await server.loadViewerSeed('45', { publicClient: () => client({ data: { title: 'x' }, error: null }) })).toBe(null);
  });
  it('쪽은 예산(800ms) 안에 끝난 결과만 — 늦으면 싣지 않고 그대로 그린다', async () => {
    vi.useFakeTimers();
    try {
      const pending = server.viewerSeedWithin('45', 800, () => new Promise(() => {}));
      await vi.advanceTimersByTimeAsync(800);
      expect(await pending).toBe(null);
    } finally { vi.useRealTimers(); }
    expect(server.VIEWER_SEED_BUDGET_MS).toBe(800);
    expect(server.VIEWER_SEED_QUERY_TIMEOUT_MS).toBe(2500);
  });
  it('배선 — 한 요청에 한 번(React cache) · 제목도 같은 결과 · 쪽은 지금 첫 그림과 같은 대기 그림으로 기다린다', () => {
    const page = read('src/app/(app)/viewer/[id]/page.jsx');
    const src = read('src/lib/server/viewerSeed.js');
    expect(src).toContain('export const readViewerSeed = cache(async (id) => {');
    expect(src).toContain("rscRequest: !documentRequest(headerList), sessionCookie: hasSupabaseSessionInJar(jar)");
    // Next는 RSC 머리를 headers()에서 지운다 — 브라우저의 Sec-Fetch-Dest로 가른다(문서 이동 document · RSC fetch empty · 없으면 문서)
    expect(server.documentRequest(new Headers({ 'sec-fetch-dest': 'document' }))).toBe(true);
    expect(server.documentRequest(new Headers({ 'sec-fetch-dest': 'empty' }))).toBe(false);
    expect(server.documentRequest(new Headers())).toBe(true);
    const meta = sliceBetween(page, 'export async function generateMetadata', 'export default function Page');
    expect(meta).toContain('const seed = await readViewerSeed(id);');
    expect(meta).toContain('const data = seed ? seed.row : await (await createSupabaseServerClient())');
    expect(page).toContain('return <Suspense fallback={<ViewerLoading />}><SeededViewerPage params={params} /></Suspense>;');
    expect(page).toContain('return <ViewerPage seed={seed ?? undefined} />;');
    // 대기 그림은 뷰어 불러오기 갈래와 같은 마크업 — 서버가 읽는 동안에도 첫 HTML이 지금과 같다
    const viewer = read('src/views/ViewerPage.jsx');
    const loading = '<div className="page-container"><Spinner message="자료 불러오는 중…" /></div>';
    expect(viewer).toContain(`if (isLoading) return ${loading};`);
    expect(read('src/components/viewer/ViewerLoading.jsx')).toContain(`return ${loading};`);
    expect(viewer).toContain("useState(() => { if (typeof window !== 'undefined') adoptViewerSeed(seed, id); });");
    // 등록은 조회(useQuery)보다 먼저 — 조회는 효과에서 등록부를 본다
    expect(viewer.indexOf('adoptViewerSeed(seed, id)')).toBeLessThan(viewer.indexOf("queryKey: ['material', id],"));
  });
});

describe('브라우저 — 서버가 실은 행을 언제 쓰나(adoptViewerSeed)', () => {
  const seed = (over = {}) => ({ id: '45', row: ROW, account: 'A', servedAt: 10_000, ...over });
  const opts = (over = {}) => ({ now: 20_000, origin: 9_900, online: true, fetch: vi.fn(async () => ({ id: 45, fresh: true })), ...over });
  beforeEach(() => { lib.resetViewerSeedForTest(); lib.takeEarlyMaterial('45'); io.calls.length = 0; io.session = 'A'; io.sessionThrows = false; });

  it('같은 계정이면 그 행을 등록부로 넘기고(네트워크 0) 계정별 기기 사본으로 남긴다', async () => {
    const o = opts();
    expect(lib.adoptViewerSeed(seed(), '45', o)).toMatchObject({ id: '45', owner: 'A', at: 20_000 });
    expect(await lib.loadMaterial('45', { now: 20_100, owner: 'A' })).toBe(ROW);
    expect(o.fetch).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(io.calls).toEqual([['cacheMaterial', ROW, { owner: 'A' }]]));
  });
  it('손님 행(계정 null)은 손님 세션에서만', async () => {
    io.session = null;
    const o = opts();
    lib.adoptViewerSeed(seed({ account: null }), '45', o);
    expect(await lib.loadMaterial('45', { now: 20_100, owner: null })).toBe(ROW);
    expect(o.fetch).not.toHaveBeenCalled();
  });
  it.each([
    ['지금 세션이 다른 계정(B)', () => { io.session = 'B'; }],
    ['로그아웃한 기기(손님)에서 다시 연 A의 문서', () => { io.session = null; }],
    ['세션 확인 실패', () => { io.sessionThrows = true; }],
  ])('%s → 그 행을 버리고 지금처럼 새로 받는다', async (_label, arrange) => {
    arrange();
    const o = opts();
    lib.adoptViewerSeed(seed(), '45', o);
    expect(await lib.loadMaterial('45', { now: 20_100 })).toEqual({ id: 45, fresh: true });
    expect(o.fetch).toHaveBeenCalledWith('45');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(io.calls).toEqual([]); // A의 행을 B · 손님 몫 기기 사본으로 남기지 않는다
  });
  it.each([
    ['옛 문서(서버가 그린 지 30초 넘게 지나 연 문서 — 끊긴 채 워커가 돌려준 것)', seed({ servedAt: 9_900 - 30_001 }), {}],
    ['서버 시각이 이 문서보다 한참 뒤(시계 어긋남)', seed({ servedAt: 9_900 + 30_001 }), {}],
    ['끊김', seed(), { online: false }],
    ['다른 자료', seed({ id: '46' }), {}],
    ['행 없음', seed({ row: null }), {}],
    ['시각 모름', seed(), { origin: undefined }],
  ])('쓰지 않는다: %s', async (_label, s, over) => {
    expect(lib.adoptViewerSeed(s, '45', opts(over))).toBe(null);
    expect(lib.takeEarlyMaterial('45', 20_100)).toBe(null);
  });
  it('문서 하나에 한 번 — 뒤로 가기 등으로 첫 문서의 조각(옛 행)을 다시 그려도 넣지 않는다', () => {
    expect(lib.adoptViewerSeed(seed(), '45', opts())).not.toBe(null);
    lib.takeEarlyMaterial('45', 20_100);
    expect(lib.adoptViewerSeed(seed(), '45', opts())).toBe(null);
    expect(lib.takeEarlyMaterial('45', 20_200)).toBe(null);
  });
  it('받아 쓰는 길은 띄워 둔 조회와 같다 — 캐시가 있으면 쓰지 않고 · 10초가 지나면 · 화면 계정이 다르면 새로', async () => {
    const o = opts();
    lib.adoptViewerSeed(seed(), '45', o);
    expect(await lib.loadMaterial('45', { cached: true, fetch: o.fetch })).toEqual({ id: 45, fresh: true });
    lib.resetViewerSeedForTest();
    lib.adoptViewerSeed(seed(), '45', opts());
    expect(lib.takeEarlyMaterial('45', 20_000 + lib.EARLY_MATERIAL_MAX_AGE_MS + 1, { owner: 'A' })).toBe(null);
    lib.resetViewerSeedForTest();
    lib.adoptViewerSeed(seed(), '45', opts());
    expect(lib.takeEarlyMaterial('45', 20_100, { owner: 'B' })).toBe(null);
  });
  it('본문을 실어 온 문서면 모듈 평가 때의 조기 조회를 건너뛴다(같은 행을 두 번 받지 않음) — 실어 오지 않았거나 형식을 모르면 지금처럼 띄운다', () => {
    // 받은 화면 조각(Next self.__next_f — [종류, 글]) 안의 seed 속성. 서버 객체의 첫 키가 id다.
    const flight = (text) => [[0], [1, text]];
    const serverSeed = JSON.stringify({ seed: { id: '45', row: ROW, account: 'A', servedAt: 1 } });
    expect(serverSeed).toContain('"seed":{"id":"45",'); // 서버가 만드는 모양(loadViewerSeed 반환 — id가 첫 키)
    expect(lib.viewerSeedAdopted('/viewer/45?returnTo=%2Fmaterials', flight(`12:["$","$L1b",null,${serverSeed.slice(1, -1)}]`))).toBe(true);
    expect(lib.viewerSeedAdopted('/viewer/45', flight('12:["$","$L1b",null,{"seed":{"id":"450","row":{}}}]'))).toBe(false); // 다른 자료
    expect(lib.viewerSeedAdopted('/viewer/45', flight('12:["$","$L1b",null,{}]'))).toBe(false); // 실어 오지 않음(화면 이동 · 실패 · 시간 초과)
    expect(lib.viewerSeedAdopted('/viewer/45', undefined)).toBe(false); // 형식을 모름
    expect(lib.viewerSeedAdopted('/viewer/45', [null, 7, ['x']])).toBe(false);
    expect(lib.viewerSeedAdopted('/viewer/local%3A7', flight('"seed":{"id":"local:7",'))).toBe(false);
    // 첫 렌더가 받아들인 뒤에도 참(조각을 못 읽어도)
    lib.adoptViewerSeed(seed(), '45', opts());
    expect(lib.viewerSeedAdopted('/viewer/45', undefined)).toBe(true);
    expect(lib.viewerSeedAdopted('/viewer/46', undefined)).toBe(false);
    // 등록부도 같은 id · 계정 모름이면 받아들인 항목을 그대로 둔다(새로 받지 않음)
    const fetch = vi.fn(() => new Promise(() => {}));
    expect(lib.startEarlyMaterial('/viewer/45', 20_050, { owner: undefined, fetch })).toMatchObject({ owner: 'A' });
    expect(fetch).not.toHaveBeenCalled();
    expect(read('src/views/ViewerPage.jsx')).toContain("if (typeof window !== 'undefined' && !viewerSeedAdopted(window.location.pathname)) startEarlyMaterial(window.location.pathname);");
    expect(read('src/lib/server/viewerSeed.js')).toContain('return { id: key, row: data ?? null, account, servedAt: now() };');
  });
});
