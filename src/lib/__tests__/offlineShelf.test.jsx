// 끊긴 서재의 「이 기기에 받아 둔 자료」(OFFLINE-SWEEP-001 P1, 2026-10-24 KST).
// 끊긴 채 연 서재는 읽던 곳 · 폴더 · 목록 세 칸이 모두 「불러오지 못했어요」였고 이 기기에 남은 자료로 갈 길이 없었다(390 실측 #6).
// 지킬 것: ① 목록은 지금 계정의 기기 사본만(다른 계정 · 손님 기록 · 지난 자동 기록 0) — 그리고 올린 것은 뷰어 폴백이 실제로 연다
// ② 그릴 목록이 없이 끊겼을 때만 바꾼다(연결된 화면 · 이미 받은 목록 무변화) ③ 연결되면 서재가 스스로 다시 읽는다
// ④ 행은 서재와 같은 여는 길(LibraryReaderLink → /viewer/:id) ⑤ 끊긴 채 누른 뷰어 주소는 질의가 달라도 받아 둔 같은 자료 문서를 연다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { memoryIndexedDb } from './helpers/memoryIndexedDb';

vi.mock('../../components/web/LibraryReaderLink', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));
vi.mock('../supabase', () => ({ supabase: {} }));

const { deviceShelfShown, DeviceShelfView } = await import('../../components/library/DeviceShelf');

const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const DAY = 24 * 60 * 60 * 1000;
const material = (id, owner, extra = {}) => ({ id, owner_id: owner, visibility: 'private', title: `${owner}의 ${id}`, raw_text: `${id} 본문`,
  processed_json: { status: 'completed', metadata: { language: 'Japanese' }, sequence: [], dictionary: {} }, ...extra });
let idb, cache;

beforeEach(async () => {
  vi.resetModules();
  idb = memoryIndexedDb();
  vi.stubGlobal('indexedDB', idb.api);
  cache = await import('../offlineCache');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

/** 저장소에 기록을 그대로 넣는다(이 판 이전 꼴 · 시각 조작용). */
async function putRaw(row) {
  const db = await cache.openDb();
  await new Promise((r) => { const tx = db.transaction('materials', 'readwrite'); tx.objectStore('materials').put(row); tx.oncomplete = r; });
}

describe('① 목록은 지금 계정의 기기 사본만 — 계정 경계(OFFLINE-ACCOUNT-SCOPE-001)', () => {
  async function seed() {
    await cache.cacheMaterial(material('A1', 'A'), { owner: 'A' });                       // A가 연 자기 자료(자동)
    await cache.cacheMaterial(material('T1', 'teacher'), { owner: 'A' });                 // A가 연 남의 자료(반 · 모둠)
    await cache.pinMaterial(material('A2', 'A', { title: '받아 둔 것' }), { owner: 'A' });    // A가 받아 둔 자료
    await cache.cacheMaterial(material('B1', 'B'), { owner: 'B' });                       // B의 자료
    // 손님 기록(공개 · 누구나 열림) — cacheMaterial 꼴 그대로 넣는다(자동 상한 3이 기기 전체라 다섯째 자동 기록은 가장 오래된 것을 밀어낸다)
    await putRaw({ id: 'P1', materialId: 'P1', owner: null, material: material('P1', 'A', { visibility: 'public' }), savedAt: Date.now() });
    await putRaw({ id: 'L1', material: material('L1', 'A'), savedAt: Date.now() });        // 이 판 이전 기록 · A가 만든 자료
    await putRaw({ id: 'L2', material: material('L2', 'teacher'), savedAt: Date.now() });  // 이전 기록 · 남의 비공개
    await putRaw({ id: 'L3', material: material('L3', 'B', { visibility: 'public' }), savedAt: Date.now() }); // 이전 기록 · 공개
  }
  it('A: 자기 계정 기록 + 자기가 만든 이전 기록만. B · 손님 기록 · 남의 이전 기록은 올리지 않는다', async () => {
    await seed();
    const ids = (await cache.listDeviceMaterials('A')).map((r) => r.id);
    expect(ids[0]).toBe('A2'); // 받아 둔 자료가 먼저
    expect([...ids].sort()).toEqual(['A1', 'A2', 'L1', 'T1']);
    // B: 자기 계정 기록 + 이전 기록 중 B가 만든 공개 자료(L3 — 자료가 스스로 말해 주는 주인). A가 연 자료 · 손님 기록은 없다.
    expect((await cache.listDeviceMaterials('B')).map((r) => r.id).sort()).toEqual(['B1', 'L3']);
  });
  it('손님 · 모르는 계정 값(쿼리 문맥 객체)은 빈 목록 — 서재는 로그인 화면이다', async () => {
    await seed();
    expect(await cache.listDeviceMaterials(null)).toEqual([]);
    expect(await cache.listDeviceMaterials(undefined)).toEqual([]);
    expect(await cache.listDeviceMaterials({ queryKey: ['library-device', 'A'] })).toEqual([]);
  });
  it('올린 것은 모두 그 계정의 뷰어 폴백(getCachedMaterial)이 실제로 연다', async () => {
    await seed();
    for (const who of ['A', 'B']) {
      for (const row of await cache.listDeviceMaterials(who)) {
        expect((await cache.getCachedMaterial(row.id, { account: who }))?.id, `${who} ${row.id}`).toBe(row.id);
      }
    }
  });
  it('7일 지난 자동 기록은 올리지 않고(폴백도 열지 않는다), 받아 둔 자료는 7일이 지나도 올린다', async () => {
    const old = Date.now() - 8 * DAY;
    await putRaw({ id: 'acct:A:OLD', materialId: 'OLD', owner: 'A', material: material('OLD', 'A'), savedAt: old });
    await putRaw({ id: 'acct:A:PIN', materialId: 'PIN', owner: 'A', material: material('PIN', 'A'), savedAt: old, pinned: true });
    expect((await cache.listDeviceMaterials('A')).map((r) => r.id)).toEqual(['PIN']);
    expect(await cache.getCachedMaterial('OLD', { account: 'A' })).toBeNull();
  });
  it('같은 자료의 계정 키 기록이 있으면 그것이 먼저 — 한 줄만, 열리는 기록 기준', async () => {
    await putRaw({ id: 'X', material: material('X', 'A'), savedAt: Date.now(), pinned: true }); // 이전 판 핀
    await cache.cacheMaterial(material('X', 'A'), { owner: 'A' });                             // 같은 자료를 A 계정 키로
    const rows = await cache.listDeviceMaterials('A');
    expect(rows.map((r) => r.id)).toEqual(['X']);
    expect(rows[0].pinned).toBe(false); // 폴백이 여는 기록(계정 키 · 자동)의 상태
  });
  it('계정이 바뀌어 숨긴 받아 둔 자료는 새 계정 목록에 없고, 앞 계정이 돌아오면 그대로 있다', async () => {
    await cache.pinMaterial(material('A2', 'A'), { owner: 'A' });
    await cache.purgeOfflineForAccount('B');
    expect(await cache.listDeviceMaterials('B')).toEqual([]);
    expect((await cache.listDeviceMaterials('A')).map((r) => r.id)).toEqual(['A2']);
  });
  it('목록 한 줄에 필요한 것만 — 본문 · 토큰 사전은 싣지 않는다', async () => {
    await cache.cacheMaterial(material('A1', 'A', { document_json: { version: 1, language: 'Chinese' } }), { owner: 'A' });
    const [row] = await cache.listDeviceMaterials('A');
    expect(Object.keys(row).sort()).toEqual(['id', 'language', 'pinned', 'savedAt', 'title']);
    expect(row).toMatchObject({ id: 'A1', title: 'A의 A1', language: 'Chinese', pinned: false }); // 작성 문서의 언어가 먼저
  });
  it('기기 저장소를 못 열면 빈 목록(조용한 실패 — 서재를 막지 않는다)', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    const fresh = await import('../offlineCache');
    expect(await fresh.listDeviceMaterials('A')).toEqual([]);
  });
});

describe('② 언제 바꾸나 — 그릴 목록이 없이 끊겼을 때만', () => {
  const failed = (message) => ({ data: undefined, isError: true, error: { message } });
  it('브라우저가 끊김 + 목록 없음(받는 중 · 실패) → 바꾼다', () => {
    expect(deviceShelfShown({ data: undefined, isPending: true }, true)).toBe(true);
    expect(deviceShelfShown(failed('boom'), true)).toBe(true);
  });
  it('「연결됨」인데 응답을 못 받은 실패(거짓 연결) → 바꾼다. 서버가 돌려준 오류(권한 · 준비 중)는 그대로 세 칸 안내', () => {
    expect(deviceShelfShown(failed('TypeError: Failed to fetch'), false)).toBe(true);
    expect(deviceShelfShown(failed('permission denied for function personal_library_page_v2'), false)).toBe(false);
    expect(deviceShelfShown(failed('INVALID_LIBRARY_PAGE'), false)).toBe(false);
  });
  it('목록을 이미 받았으면 끊겨도 그대로 둔다(연결된 화면 · CLS 무변화)', () => {
    expect(deviceShelfShown({ data: { pages: [] }, isSuccess: true }, true)).toBe(false);
    expect(deviceShelfShown({ data: { pages: [] }, isError: true, error: { message: 'Failed to fetch' } }, true)).toBe(false);
    expect(deviceShelfShown({ data: undefined, isPending: true }, false)).toBe(false);
  });
  it('연결 실패 판정은 오류 안내 표와 같은 표지 하나(errorMessage NETWORK_PATTERN)', async () => {
    const { isNetworkError, friendlyError } = await import('../errorMessage');
    for (const message of ['TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'offline']) {
      expect(isNetworkError({ message })).toBe(true);
      expect(friendlyError({ message }).cause).toBe('인터넷 연결을 확인해 주세요.');
    }
    expect(isNetworkError(null)).toBe(false);
    expect(read('src/lib/errorMessage.js')).toContain('{ match: NETWORK_PATTERN,');
  });
});

describe('③ 서재 배선 — 세 칸 대신 · 연결되면 다시 읽기', () => {
  const shelf = read('src/components/library/LibraryShelf.jsx');
  it('판정은 한 곳(deviceShelfShown)이고, 바꿀 때 읽던 곳 · 대화 · 목록(폴더 · 기기 보관 · 목록 실패 안내 포함) 대신 그린다', () => {
    expect(shelf).toContain('const deviceShelf=deviceShelfShown(list,useBrowserOffline());');
    expect(shelf).toContain('{deviceShelf?<DeviceShelf ownerId={user.id} onRetry={()=>invalidateLibrary(cache,user.id)}/>:<>{bodyWaiting?<LibraryShelfBodySkeleton/>:<>');
  });
  it('연결되면(online) 서재 쿼리를 다시 읽는다 — 끊긴 채 연 문서는 react-query가 「연결됨」으로 시작해 스스로 다시 읽지 않는다', () => {
    expect(shelf).toContain("useEffect(()=>{if(!deviceShelf)return;const reread=()=>invalidateLibrary(cache,user.id);window.addEventListener('online',reread);return()=>window.removeEventListener('online',reread);},[deviceShelf,cache,user.id]);");
    const core = read('node_modules/@tanstack/query-core/build/modern/onlineManager.js');
    expect(core).toContain('#online = true;'); // 첫 값은 navigator.onLine을 보지 않는다 — 이 전제가 바뀌면 다시 읽기를 재검토
  });
  it('기기 목록은 화면 계정(user.id)으로 읽는다 — 받아두기 배지(pinnedMaterialIds(user.id))와 같은 기준, 계정이 바뀌면 서재가 key로 새로 선다', () => {
    expect(read('src/components/library/DeviceShelf.jsx')).toContain('listDeviceMaterials(ownerId)');
    expect(read('src/components/web/LibraryPage.jsx')).toContain('<LibraryShelf key={shelfUser.id} user={shelfUser}');
  });
});

describe('④ 목록 그림 — 서재 행과 같은 여는 길 · 문구', () => {
  const html = (rows) => renderToStaticMarkup(createElement(DeviceShelfView, { rows, onRetry: () => {} }));
  it('행 = 서재 링크(/viewer/:id) · 언어 · 받아둠/최근 연 자료, 아래에 「연결 없이 열 수 있어요.」', () => {
    const out = html([{ id: 94101, title: '오프라인 점검 자료', language: 'Japanese', pinned: true }, { id: 'a b', title: '', language: null, pinned: false }]);
    expect(out).toContain('<h2 id="shelf-device-title">이 기기에 받아 둔 자료</h2>');
    expect(out).toContain('href="/viewer/94101"');
    expect(out).toContain('href="/viewer/a%20b"');
    expect(out).toContain('<h3 lang="ja">오프라인 점검 자료</h3><small>일본어 · 받아둠</small>');
    expect(out).toContain('<h3>제목 없는 자료</h3><small>언어 미지정 · 최근 연 자료</small>');
    expect(out).toContain('연결 없이 열 수 있어요.');
  });
  it('비었으면 빈 상태 두 문장, 읽는 중(null)이면 제목만', () => {
    expect(html([])).toContain('아직 이 기기에 받아 둔 자료가 없어요. 연결된 동안 연 자료는 이 기기에 남아요.');
    expect(html(null)).not.toContain('shelf-rows');
    expect(html(null)).not.toContain('아직');
  });
  it('세 칸 실패 대신 안내 한 줄(두 문장 · status — 띠가 이미 alert) + 다시 시도', () => {
    const out = html([]);
    expect(out).toContain('<div class="shelf-query-error" role="status"><p>서재 목록을 불러오지 못했어요. 연결되면 다시 불러와요.</p><button>다시 시도</button></div>');
    expect(out).not.toContain('role="alert"');
    for (const sentence of out.match(/<p[^>]*>([^<]+)<\/p>/g)) expect(sentence.split(/[.?!](?:\s|<)/).length - 1).toBeLessThanOrEqual(2);
  });
});

describe('⑤ 끊긴 채 누른 뷰어 주소 — 질의가 달라도 받아 둔 같은 자료 문서(서비스 워커)', () => {
  async function offlineNavigation(url, cached) {
    const handlers = new Map();
    const match = vi.fn(async (request, options = {}) => {
      const key = typeof request === 'string' ? request : request.url;
      const strip = (u) => { const x = new URL(u, 'https://manabi.example'); return options.ignoreSearch ? x.origin + x.pathname : x.href; };
      const hit = [...cached.keys()].find((k) => strip(k) === strip(key));
      return hit ? cached.get(hit) : undefined;
    });
    const source = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
    const self = { addEventListener: (type, h) => handlers.set(type, h), clients: { claim() {} }, location: { origin: 'https://manabi.example' }, registration: {}, skipWaiting() {} };
    vm.runInNewContext(source, { URL, console, self, caches: { keys: async () => [], match, open: async () => ({ put: async () => {} }) }, fetch: async () => { throw new TypeError('Failed to fetch'); } });
    let response;
    handlers.get('fetch')({ request: { method: 'GET', mode: 'navigate', url }, respondWith: (p) => { response = Promise.resolve(p); } });
    return { response: await response, match };
  }
  const viewerDoc = { doc: 'viewer 94101' }, offlineDoc = { doc: '/offline' };
  const cached = new Map([['https://manabi.example/viewer/94101?returnTo=%2Fmaterials%3FrestoreY%3D320', viewerDoc], ['https://manabi.example/offline', offlineDoc], ['https://manabi.example/materials', { doc: 'materials' }]]);
  it('들를 때와 돌아갈 곳(?returnTo · restoreY)이 달라도 같은 자료의 받아 둔 뷰어 문서', async () => {
    expect((await offlineNavigation('https://manabi.example/viewer/94101?returnTo=%2Fmaterials%3FrestoreY%3D0', cached)).response).toBe(viewerDoc);
    expect((await offlineNavigation('https://manabi.example/viewer/94101', cached)).response).toBe(viewerDoc);
  });
  it('다른 자료 · 다른 화면은 정확히 맞춘다 — 없으면 /offline 대체 화면(질의가 서버 그림을 바꾸는 화면을 섞지 않는다)', async () => {
    expect((await offlineNavigation('https://manabi.example/viewer/94102?returnTo=%2Fmaterials', cached)).response).toBe(offlineDoc);
    const materials = await offlineNavigation('https://manabi.example/materials?q=x', cached);
    expect(materials.response).toBe(offlineDoc);
    expect(materials.match.mock.calls.some(([, options]) => options?.ignoreSearch)).toBe(false);
  });
});
