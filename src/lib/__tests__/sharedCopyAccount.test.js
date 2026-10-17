// OFFLINE-ACCOUNT-SCOPE-001 · 팀 사본(2026-10-17 KST) — anatomy-class-shared의 사본이 계정을 몰라, 같은 기기에서 A(로그인 학생)가
// 받은 팀 자료 사본을 B가 local: 뷰어 · 팀 페이지 목록으로 열었다. 계정 사본은 계정을 붙인 키로 따로 두고(본인 사본 보존 —
// 서로 덮지 않음 · 지우지 않음) 지금 계정의 것만 보인다(남에게 숨김). 손님 사본 · 이전 판 사본은 지금처럼 누구에게나.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryIndexedDb } from './helpers/memoryIndexedDb';
import { sliceBetween } from './helpers/sliceBetween';

const ROOT = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const material = (who) => ({ id: 41, title: '3과', raw_text: `${who}가 받은 사본` });
let idb, store;

beforeEach(async () => {
  vi.resetModules();
  idb = memoryIndexedDb();
  vi.stubGlobal('indexedDB', idb.api);
  store = await import('../sharedStore');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('계정 사본은 그 계정에게만', () => {
  it('A가 받은 사본을 B · 손님은 열지 못하고(목록에도 없음), A는 그대로 연다', async () => {
    await store.putSharedCopy({ id: 41, team: 't1', material: material('A'), owner: 'A' });
    expect(await store.getSharedCopy(41, { account: 'B' })).toBeNull();
    expect(await store.getSharedCopy(41)).toBeNull(); // 계정을 안 넘긴 옛 호출 = 손님
    expect(await store.listSharedCopies({ account: 'B' })).toEqual([]);
    const mine = await store.getSharedCopy(41, { account: 'A' });
    expect(mine).toMatchObject({ id: 41, team: 't1', owner: 'A' });
    expect(mine.material.raw_text).toBe('A가 받은 사본');
    expect((await store.listSharedCopies({ account: 'A' })).map(e => e.id)).toEqual([41]);
  });
  it('같은 과를 A · B가 각자 받아도 서로 덮지 않는다 — 계정이 바뀌어도 A의 사본은 남는다', async () => {
    await store.putSharedCopy({ id: 41, team: 't1', material: material('A'), owner: 'A' });
    await store.putSharedCopy({ id: 41, team: 't1', material: material('B'), owner: 'B' });
    expect((await store.getSharedCopy(41, { account: 'A' })).material.raw_text).toBe('A가 받은 사본');
    expect((await store.getSharedCopy(41, { account: 'B' })).material.raw_text).toBe('B가 받은 사본');
    expect(idb.rows('anatomy-class-shared', 'copies')).toHaveLength(2);
  });
  it('손님 사본 · 이전 판 사본(계정 없음)은 지금처럼 누구에게나 — 계정 사본이 있으면 그것을 앞세운다', async () => {
    await store.putSharedCopy({ id: 41, team: 't1', material: material('손님') });
    for (const who of [null, 'A', 'B']) expect((await store.getSharedCopy(41, { account: who })).material.raw_text).toBe('손님가 받은 사본');
    await store.putSharedCopy({ id: 41, team: 't1', material: material('A'), owner: 'A' });
    expect((await store.getSharedCopy(41, { account: 'A' })).material.raw_text).toBe('A가 받은 사본');
    expect((await store.listSharedCopies({ account: 'A' })).map(e => e.material.raw_text)).toEqual(['A가 받은 사본']);
    expect((await store.listSharedCopies({ account: 'B' })).map(e => e.material.raw_text)).toEqual(['손님가 받은 사본']);
  });
  it('이전 판 기록(키 = id · owner · copyId 없음)도 그대로 열린다', async () => {
    const db = await new Promise((resolve) => { const r = indexedDB.open('anatomy-class-shared', 1); r.onupgradeneeded = () => r.result.createObjectStore('copies', { keyPath: 'id' }); r.onsuccess = () => resolve(r.result); });
    await new Promise(r => { const tx = db.transaction('copies', 'readwrite'); tx.objectStore('copies').put({ id: 41, team: 't1', material: material('옛'), savedAt: Date.now() }); tx.oncomplete = r; });
    expect((await store.getSharedCopy(41, { account: 'A' })).id).toBe(41);
  });
  it('만료(7일)는 누구 것이든 그대로 지운다 — 기존 규칙', async () => {
    await store.putSharedCopy({ id: 41, team: 't1', material: material('A'), owner: 'A' });
    const row = idb.rows('anatomy-class-shared', 'copies')[0];
    row.savedAt = Date.now() - store.SHARED_TTL_MS - 1;
    const db = await new Promise((resolve) => { const r = indexedDB.open('anatomy-class-shared', 1); r.onsuccess = () => resolve(r.result); });
    await new Promise(r => { const tx = db.transaction('copies', 'readwrite'); tx.objectStore('copies').put(row); tx.oncomplete = r; });
    expect(await store.listSharedCopies({ account: 'B' })).toEqual([]);
    expect(idb.rows('anatomy-class-shared', 'copies')).toHaveLength(0);
  });
});

describe('배선', () => {
  it('받기(ensureSharedCopy)가 받는 계정으로 찾고 적는다', () => {
    const fn = sliceBetween(read('src/lib/classClient.js'), 'export async function ensureSharedCopy(', 'export function recentClassVisits');
    expect(fn).toContain("const existing = await getSharedCopy(entry.id, { account: owner });");
    expect(fn).toMatch(/material: payload, owner \};/);
  });
  it('팀 페이지가 계정을 넘긴다 — 목록 · 받기 둘 다', () => {
    const page = read('src/views/ClassTeamPage.jsx');
    expect(page).toContain('listSharedCopies({ account: copyAccount.current })');
    expect(page).toContain('await ensureSharedCopy(teamKey, unlock.token, entry, {refresh:true, owner:user?.id ?? null});');
    expect(page).toContain('await ensureSharedCopy(teamKey, unlock.token, n, {owner:user?.id ?? null});');
    expect(page).toContain('useEffect(() => { refreshCopies(); }, [user?.id, refreshCopies]);');
  });
  it('local: 뷰어가 화면 계정(아직 모르면 정해질 때까지)으로 연다 — 세션 조회 없이(네트워크 0)', () => {
    const fn = sliceBetween(read('src/views/ViewerPage.jsx'), 'async function fetchMaterial(id) {', '// 직접 진입 첫 조회');
    const local = sliceBetween(fn, 'if (isLocalId(id)) {', "return { ...copy.material, __local: true, __team: copy.team };");
    expect(local).toContain('const account = shown !== undefined ? shown : await whenAccountKnown();');
    expect(local).toContain('const copy = await getSharedCopy(parseLocalId(id), { account });');
    expect(local).not.toContain('getSession');
  });
  it('화면 계정은 adoptUser · 손님 확정 · 복원 포기 셋에서 정해진다(기다리는 읽기가 영원히 묶이지 않게)', async () => {
    const src = read('src/lib/AuthContext.jsx');
    expect(src.match(/noteAccount\(/g)).toHaveLength(3);
    expect(sliceBetween(src, 'if (!hasSessionCookie) {', 'return () => { cancelled = true; stopWaiting(); };')).toContain('noteAccount(null);');
    expect(sliceBetween(src, 'if (!restored && retries < AUTH_RESTORE_RETRY_MS.length)', 'window.addEventListener')).toContain('noteAccount(null);');
    vi.resetModules();
    const q = await import('../accountQueryCache');
    const waiting = q.whenAccountKnown();
    q.noteAccount('A');
    await expect(waiting).resolves.toBe('A');
    await expect(q.whenAccountKnown()).resolves.toBe('A');
  });
  it('남은 호출부가 계정 없는 옛 꼴로 부르지 않는다', () => {
    for (const f of ['src/views/ClassTeamPage.jsx', 'src/lib/classClient.js', 'src/views/ViewerPage.jsx']) {
      expect(read(f), f).not.toMatch(/listSharedCopies\(\)|getSharedCopy\(entry\.id\)|getSharedCopy\(parseLocalId\(id\)\)/);
    }
  });
  it('DB 판 · 키 경로 그대로(1 · id) — 판 올림 없음', () => {
    const src = read('src/lib/sharedStore.js');
    expect(src).toContain('const DB_VERSION = 1;');
    expect(src).toContain("db.createObjectStore(STORE, { keyPath: 'id' })");
  });
});
