// OFFLINE-ACCOUNT-SCOPE-001 (2026-10-17 KST) — 기기 오프라인 캐시(IndexedDB anatomy-offline-cache)의 자료 기록이 계정을 몰라,
// 같은 기기에서 B가 오프라인일 때 A가 받아 둔 비공개 자료가 뷰어 폴백(getCachedMaterial)으로 열렸다.
// 기록에 받은 계정(owner)을 적고 읽을 때 지금 계정과 비교한다 · 계정이 바뀌면 새 계정이 열 수 없는 기록과 남의 단어장 스냅샷을 지운다.
// 대기 연산(outbox — 복습 · FSRS)은 지우지 않는다: A의 안 보낸 채점은 A가 다시 로그인하면 보내고, B에게는 보이지도 보내지지도 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryIndexedDb } from './helpers/memoryIndexedDb';
import { sliceBetween } from './helpers/sliceBetween';

const ROOT = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const privateOf = (owner, id = 'X') => ({ id, owner_id: owner, visibility: 'private', title: `${owner}의 비공개 자료`, raw_text: `${owner}의 본문` });
const publicMaterial = { id: 'P', owner_id: 'A', visibility: 'public', title: '공개 자료', raw_text: '공개 본문' };
let idb, cache;

beforeEach(async () => {
  vi.resetModules();
  idb = memoryIndexedDb();
  vi.stubGlobal('indexedDB', idb.api);
  cache = await import('../offlineCache');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('재현 — 이 판 이전 기록(계정 없음)은 아무 계정에나 열렸다', () => {
  it('A가 받아 둔 비공개 자료(옛 기록 꼴)를 B · 손님은 열지 못하고, A는 연다', async () => {
    // 옛 cacheMaterial이 남긴 꼴 그대로: { id, material, savedAt } — owner 없음
    const db = await cache.openDb();
    await new Promise(r => { const tx = db.transaction('materials', 'readwrite'); tx.objectStore('materials').put({ id: 'X', material: privateOf('A'), savedAt: Date.now() }); tx.oncomplete = r; });
    expect(await cache.getCachedMaterial('X', { account: 'B' })).toBeNull();
    expect(await cache.getCachedMaterial('X')).toBeNull(); // 계정을 안 넘긴 옛 호출 = 손님
    expect((await cache.getCachedMaterial('X', { account: 'A' })).raw_text).toBe('A의 본문'); // 자기가 만든 자료는 그대로
  });
});

describe('기록에 계정을 적고 읽을 때 비교한다', () => {
  it('A가 받은 자료(다른 사람 자료라도 A가 읽을 수 있던 것)는 A만 연다', async () => {
    await cache.cacheMaterial(privateOf('teacher', 'T'), { owner: 'A' }); // 반 · 모둠으로 A에게 보이던 남의 자료
    expect((await cache.getCachedMaterial('T', { account: 'A' })).id).toBe('T');
    expect(await cache.getCachedMaterial('T', { account: 'B' })).toBeNull();
    expect(await cache.getCachedMaterial('T', { account: 'teacher' })).toBeNull(); // 만든 사람이라도 이 기기에서 받은 계정이 아니면
    expect(await cache.getCachedMaterial('T', { account: null })).toBeNull();
  });
  it('손님 캐시는 공개 자료만 담고 누구에게나 열린다(그대로)', async () => {
    await cache.cacheMaterial(publicMaterial, { owner: null });
    for (const who of [null, 'A', 'B']) expect((await cache.getCachedMaterial('P', { account: who })).id).toBe('P');
    await cache.cacheMaterial(privateOf('A', 'Q'), { owner: null }); // 계정을 모르는 비공개 행은 손님 몫으로 남기지 않는다
    expect(idb.rows('anatomy-offline-cache', 'materials').map(r => r.id)).not.toContain('Q');
  });
  it('받아두기 · 배지도 계정별 — B는 A의 핀을 보지도 풀지도 못한다', async () => {
    expect(await cache.pinMaterial(privateOf('A'), { owner: 'A' })).toBe(true);
    expect([...(await cache.pinnedMaterialIds('A'))]).toEqual(['X']);
    expect([...(await cache.pinnedMaterialIds('B'))]).toEqual([]);
    expect([...(await cache.pinnedMaterialIds({ queryKey: ['library-pinned', 'B'] }))]).toEqual([]); // 쿼리 문맥 객체 = 손님
    expect(await cache.unpinMaterial('X', { owner: 'B' })).toBe(false);
    expect([...(await cache.pinnedMaterialIds('A'))]).toEqual(['X']);
  });
  it('B가 같은 공개 자료를 열어도 A의 핀을 넘겨받지 않는다', async () => {
    await cache.pinMaterial(publicMaterial, { owner: 'A' });
    await cache.cacheMaterial(publicMaterial, { owner: 'B' });
    const row = idb.rows('anatomy-offline-cache', 'materials').find(r => r.id === 'P');
    expect(row.owner).toBe('B'); expect(row.pinned).toBeUndefined();
  });
  it('같은 계정이 다시 열면 핀을 지킨다(기존 계약)', async () => {
    await cache.pinMaterial(privateOf('A'), { owner: 'A' });
    await cache.cacheMaterial(privateOf('A'), { owner: 'A' });
    expect(idb.rows('anatomy-offline-cache', 'materials')[0]).toMatchObject({ owner: 'A', pinned: true });
  });
});

describe('계정이 바뀌면 지운다 — 대기 연산은 보존', () => {
  const grade = (operationId) => ({ action: 'grade', cardId: 'card-1', operationId, expectedRevision: 1, attemptId: 'attempt-1', rating: 3 });
  it('A → 손님: A의 자료 · 스냅샷을 지우고 공개분 · 손님 캐시는 남긴다. A의 안 보낸 FSRS 채점은 남고 B에게는 보이지 않는다', async () => {
    const { createFsrsOperationOutbox } = await import('../fsrsOperationOutbox');
    const outbox = createFsrsOperationOutbox({ open: cache.openDb });
    await cache.pinMaterial(privateOf('A'), { owner: 'A' });
    await cache.cacheMaterial(publicMaterial, { owner: null });
    await cache.cacheVocabSnapshot('A', [{ id: 1 }]);
    await cache.cacheVocabSnapshot('learning:A', [{ id: 1 }]);
    await outbox.append({ accountId: 'A', payload: grade('op-1') });
    const removed = await cache.purgeOfflineForAccount(null);
    expect(removed).toEqual({ materials: 1, snapshots: 2 });
    expect(idb.rows('anatomy-offline-cache', 'materials').map(r => r.id)).toEqual(['P']);
    expect(await cache.getCachedVocabSnapshot('A')).toBeNull();
    expect((await outbox.list('A')).map(e => e.operationId)).toEqual(['op-1']); // A가 다시 들어오면 보낼 것
    expect(await outbox.list('B')).toEqual([]); // B에게는 보이지도(보내지지도) 않는다
  });
  it('A → B: B의 자료 · 스냅샷은 남기고 A의 것만 지운다', async () => {
    await cache.cacheMaterial(privateOf('A', 'XA'), { owner: 'A' });
    await cache.cacheMaterial(privateOf('B', 'XB'), { owner: 'B' });
    await cache.cacheVocabSnapshot('A', [1]); await cache.cacheVocabSnapshot('B', [2]);
    await cache.purgeOfflineForAccount('B');
    expect(idb.rows('anatomy-offline-cache', 'materials').map(r => r.id)).toEqual(['XB']);
    expect(await cache.getCachedVocabSnapshot('B')).toEqual([2]);
    expect(await cache.getCachedVocabSnapshot('A')).toBeNull();
  });
  it('옛 복습 큐(reviewOutbox)도 계정으로 걸러 읽는다 — 지우지 않음', async () => {
    const db = await cache.openDb();
    await new Promise(r => { const tx = db.transaction('outbox', 'readwrite'); tx.objectStore('outbox').add({ userId: 'A', itemKey: 'w1', reviewedAt: '2026-10-17T00:00:00.000Z', source: 'vocab', detail: {} }); tx.oncomplete = r; });
    await cache.purgeOfflineForAccount('B');
    const { pendingReviews } = await import('../reviewOutbox');
    expect(await pendingReviews('B')).toEqual([]);
    expect((await pendingReviews('A')).map(e => e.itemKey)).toEqual(['w1']);
  });
  it('DB 판은 그대로(2) — 판 올림이 없어 onblocked 경로와 맞물리지 않는다', () => {
    const src = read('src/lib/offlineCache.js');
    expect(src).toContain('const DB_VERSION = 2;');
    expect(src).toContain('req.onblocked = () => {');
  });
});

describe('배선', () => {
  it('뷰어 조회는 요청과 함께 계정을 잡아 적고, 폴백은 화면 계정(없으면 그 세션 계정)으로 읽는다', () => {
    const fetch = sliceBetween(read('src/views/ViewerPage.jsx'), 'async function fetchMaterial(id) {', '// 직접 진입 첫 조회');
    expect(fetch.indexOf('const accountRequest = supabase.auth.getSession()')).toBeLessThan(fetch.indexOf(".from('reading_materials')"));
    expect(fetch).toContain('cacheMaterial(data, { owner: await accountRequest })');
    expect(fetch).toContain('getCachedMaterial(id, { account: shown !== undefined ? shown : await accountRequest })');
  });
  it('받아두기 · 배지 호출부가 계정을 넘긴다', () => {
    const page = read('src/views/MaterialsPage.jsx');
    expect(page).toContain('pinnedMaterialIds(user?.id ?? null)');
    expect(page).toContain('await cache.pinMaterial(data, { owner: user?.id ?? null });');
    expect(page).toContain('cache.unpinMaterial(id, { owner: user?.id ?? null })');
    expect(read('src/components/library/LibraryShelf.jsx')).toContain('queryFn:()=>pinnedMaterialIds(user.id)');
  });
  it('계정이 바뀌는 곳(adoptUser)이 react-query와 기기 캐시를 함께 비우고, 화면 계정을 적는다', () => {
    const adopt = sliceBetween(read('src/lib/AuthContext.jsx'), 'function adoptUser(nextUser) {', 'setUser(nextUser ?? null);');
    expect(adopt).toContain('noteAccount(nextActor);');
    expect(adopt).toContain("import('./offlineCache').then((cache) => cache.purgeOfflineForAccount(nextActor))");
  });
  it('남은 호출부가 계정 없는 옛 꼴로 부르지 않는다(소스 전체)', () => {
    const files = [];
    const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); } else if (/\.(jsx?|mjs)$/.test(e.name)) files.push(p); } };
    walk(path.join(ROOT, 'src'));
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/getCachedMaterial\(id\)|cacheMaterial\(data\)|pinMaterial\(data\)|pinnedMaterialIds\(\)|queryFn:\s*pinnedMaterialIds\b/);
    }
  });
});
