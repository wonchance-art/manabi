'use client';

/**
 * 팀 자료 기기 사본(v2-AB R2 상세 5604199672 §3 · 정정 ③) — IndexedDB **별도 DB**.
 *
 * offlineCache(`anatomy-offline-cache`)의 materials 저장소에 넣지 않는 이유 두 가지:
 *  ① 자동 캐시 상한(3)·핀(10)의 축출 계산에 끼면 학생이 받아 둔 과가 조용히 밀려나거나,
 *     거꾸로 「최근 연 자료」 캐시를 죽인다. ② 핀은 TTL 밖이라 「로그인 안 하면 7일 뒤 소멸」이 깨진다.
 * 그래서 사본은 TTL 7일만 있고 상한·핀이 없는 자기 DB를 가진다(기존 저장소 계약 무변경 —
 * DB_VERSION 2는 손대지 않는다). 실패는 전부 조용히(학습 흐름을 막지 않는다).
 */

const DB_NAME = 'anatomy-class-shared';
const STORE = 'copies';
const DB_VERSION = 1;
export const SHARED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let _db = null;

function openDb() {
  if (_db) return _db;
  _db = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
  });
  _db.catch(() => { _db = null; });
  return _db;
}

/** 순수 — 만료 판정. */
export function isCopyExpired(entry, now = Date.now(), ttl = SHARED_TTL_MS) {
  return !entry || !Number.isFinite(entry.savedAt) || now - entry.savedAt > ttl;
}

/** 순수 — 남은 일수(표시용, 최소 0). */
export function copyDaysLeft(entry, now = Date.now(), ttl = SHARED_TTL_MS) {
  if (!entry || !Number.isFinite(entry.savedAt)) return 0;
  return Math.max(0, Math.ceil((entry.savedAt + ttl - now) / 86_400_000));
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    try { result = fn(store); } catch { resolve(null); return; }
    t.oncomplete = () => resolve(result?.result ?? result ?? null);
    t.onerror = () => resolve(null);
    t.onabort = () => resolve(null);
  })).catch(() => null);
}

/* ── 계정 경계(OFFLINE-ACCOUNT-SCOPE-001 · 팀 사본, 2026-10-17 KST) ──
 * 사본이 계정을 몰라, 같은 기기에서 A(로그인 학생)가 받은 팀 자료 사본을 B가 local: 뷰어 · 팀 페이지 목록으로 열었다.
 * 로그인 계정의 사본은 계정을 붙인 키(`acct:<계정>:<id>`)로 따로 둔다 — 같은 과를 A · B가 각자 받아도 서로 덮지 않고(본인 사본 보존),
 * 읽을 때 지금 계정의 것만 보인다(남에게 숨김). 지우지 않는다 — A가 다시 로그인하면 그대로(만료 7일은 그대로).
 * 손님 사본(로그인 없이 팀 암호로 받은 것)과 이 판 이전 사본은 지금처럼 id 키 · 누구에게나 — 팀 해제(class_unlock)가 기기 단위라
 * 손님 사본은 원래 그 기기의 몫이다. 키 경로(id) · DB 판(1)은 그대로다(판 올림 없음).
 */
const accountOf = (account) => (typeof account === 'string' && account ? account : null);
/** 저장 키 — 로그인 계정이면 계정을 붙이고, 손님이면 자료 id 그대로(이전 판과 같은 자리). */
export const copyKey = (id, owner) => (accountOf(owner) ? `acct:${accountOf(owner)}:${id}` : id);
/** 이 사본을 지금 계정이 볼 수 있나 — 계정 사본은 그 계정만, 손님 · 이전 판 사본은 누구나. */
export function copyVisible(entry, account) {
  if (!entry) return false;
  return !entry.owner || entry.owner === accountOf(account);
}
const view = (entry) => (entry && Object.prototype.hasOwnProperty.call(entry, 'copyId') ? { ...entry, id: entry.copyId } : entry);

/** 사본 저장 — { id, team, updatedAt, material, owner }. owner = 받은 계정(손님 null). */
export async function putSharedCopy({ id, team, updatedAt = null, contentRevision = null, material, owner = null }) {
  if (!id || !material) return false;
  const who = accountOf(owner);
  const r = await tx('readwrite', (store) => store.put({ id: copyKey(id, who), copyId: id, owner: who, team, updatedAt, contentRevision, material, savedAt: Date.now() }));
  return r !== null;
}

/** 사본 조회 — 지금 계정(account)의 사본이 먼저, 없으면 손님 · 이전 판 사본. 만료분은 지우고 건너뛴다. */
export async function getSharedCopy(id, { account = null } = {}) {
  const who = accountOf(account);
  for (const key of who ? [copyKey(id, who), id] : [id]) {
    const entry = await tx('readonly', (store) => store.get(key));
    if (!entry || !copyVisible(entry, who)) continue;
    if (isCopyExpired(entry)) { await tx('readwrite', (store) => store.delete(key)); continue; }
    return view(entry);
  }
  return null;
}

/** 지금 계정이 볼 수 있는 살아 있는 사본(만료분은 지운다 — 누구 것이든 7일 규칙 그대로). 같은 과는 계정 사본을 앞세운다. */
export async function listSharedCopies({ account = null } = {}) {
  const who = accountOf(account);
  const all = (await tx('readonly', (store) => store.getAll())) || [];
  const byId = new Map();
  for (const e of all) {
    if (isCopyExpired(e)) { await tx('readwrite', (store) => store.delete(e.id)); continue; }
    if (!copyVisible(e, who)) continue;
    const entry = view(e), seen = byId.get(String(entry.id));
    if (!seen || (!seen.owner && entry.owner)) byId.set(String(entry.id), entry);
  }
  return [...byId.values()];
}

/** 사본 지우기 — 그 계정(account)의 자리만(손님이면 id 자리). */
export async function deleteSharedCopy(id, { account = null } = {}) {
  await tx('readwrite', (store) => store.delete(copyKey(id, account)));
}
