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

/** 사본 저장 — { id, team, updatedAt, material }. */
export async function putSharedCopy({ id, team, updatedAt = null, material }) {
  if (!id || !material) return false;
  const r = await tx('readwrite', (store) => store.put({ id, team, updatedAt, material, savedAt: Date.now() }));
  return r !== null;
}

/** 사본 조회 — 만료분은 지우고 null. */
export async function getSharedCopy(id) {
  const entry = await tx('readonly', (store) => store.get(id));
  if (!entry) return null;
  if (isCopyExpired(entry)) { await deleteSharedCopy(id); return null; }
  return entry;
}

/** 살아 있는 사본 전부(만료분은 지운다). */
export async function listSharedCopies() {
  const all = (await tx('readonly', (store) => store.getAll())) || [];
  const alive = [];
  for (const e of all) {
    if (isCopyExpired(e)) await deleteSharedCopy(e.id);
    else alive.push(e);
  }
  return alive;
}

export async function deleteSharedCopy(id) {
  await tx('readwrite', (store) => store.delete(id));
}
