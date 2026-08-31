'use client';

/**
 * 오프라인 학습 캐시 (v2-N R1, #1077 — 오너 착수 승인 2026-08-30 "N R1 ㄱㄱ").
 *
 * 서비스워커가 캐시하는 것은 앱 껍데기뿐이라, 비행기·지하철·로밍 없는 해외에서
 * "앱은 열리는데 단어장이 비어 있고 본문이 없다". 어학연수 앱의 실사용 맥락과
 * 정면으로 어긋나는 이 구멍을 IndexedDB 학습 데이터층으로 메운다.
 *   SW = 앱 껍데기 · IndexedDB = 학습 데이터 — 층이 다르다(설계 §6 위험표).
 *
 * pdfCache.js의 검증된 패턴(TTL·LRU·조용한 실패)을 그대로 복제한다. 다른 점은
 * 자료 본문(processed_json = 토큰 사전이라 크다)이 대상이라 상한을 3으로 조인 것뿐.
 * 읽기는 **네트워크 실패 시에만** 쓴다(계약 6: 온라인이면 항상 네트워크 우선) —
 * 그래서 스테일 위험이 구조적으로 성립하지 않는다.
 */

const DB_NAME = 'anatomy-offline-cache';
const STORE_MATERIALS = 'materials';
const STORE_SNAPSHOTS = 'snapshots';
/** 미전송 복습(v2-N R2). 같은 DB를 쓴다 — 두 번째 DB를 열면 버전·업그레이드가 갈린다. */
export const STORE_OUTBOX = 'outbox';
const DB_VERSION = 2;
export const TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7일 — pdfCache와 같은 값
export const MAX_MATERIALS = 3;                  // 설계 §2: 최근 연 자료 3개
/**
 * 받아둔 자료 상한(v2-N R3). 자동분(3)과 **별개**다 — 핀이 자동 상한을 먹으면
 * 3개를 받아두는 순간 "최근 연 자료" 캐시가 죽어 R1이 무력화된다.
 * 10인 근거: `processed_json`은 토큰별 사전이라 자료 하나가 대략 0.1~0.6MB이고,
 * IndexedDB 할당량은 보통 수십 MB 이상이라 10개(≈6MB 상한)는 여유 안이다.
 */
export const MAX_PINNED = 10;
const MAX_SNAPSHOTS = 4;                  // 사용자당 1행 — 기기 공유 여지만 남긴다

let _dbPromise = null;

/**
 * DB 하나를 공유한다(reviewOutbox도 이 함수를 쓴다) — 모듈마다 DB를 열면 버전이
 * 갈려 한쪽 업그레이드가 다른 쪽을 blocked 상태로 세운다. 스토어 추가는 여기서만.
 */
export function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_MATERIALS)) {
        db.createObjectStore(STORE_MATERIALS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
      }
      // v2 — 미전송 복습 큐. autoIncrement라 같은 단어를 여러 번 채점해도 각각 남는다
      // (복습 이력은 덮어쓰기가 아니라 append다).
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: 'seq', autoIncrement: true });
      }
    };
  });
  return _dbPromise;
}

/** 저장 — 실패는 전부 조용히 삼킨다(계약 4: 캐시 쓰기가 학습 흐름을 막지 않는다). */
async function put(store, entry, max) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put({ ...entry, savedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = resolve;   // quota 초과 등 — 조용히
    });
    await cleanup(store, max);
  } catch { /* IndexedDB 자체 불가(사생활 모드 등) */ }
}

/** 조회 — 만료분은 없는 셈. 실패는 null(호출부가 원래 에러 경로로 간다). */
async function get(store, key) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => {
        const entry = req.result;
        if (!entry) return resolve(null);
        if (Date.now() - entry.savedAt > TTL_MS) return resolve(null);
        resolve(entry);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * 축출 대상 산정(순수) — ① TTL 만료분 전부 ② 남은 것이 상한을 넘으면 오래된 것부터.
 * 용량 폭주 금지(계약 1)가 이 함수 하나로 검증된다 — IndexedDB 트랜잭션과 분리해 둔
 * 이유이고, 저장 대상이 processed_json(토큰 사전)이라 상한이 실제로 물어야 한다.
 * @returns {Array} 삭제할 키 배열
 */
export function pickEvictions(entries, {
  now = Date.now(), ttl = TTL_MS, max, keyPath = 'id', maxPinned = MAX_PINNED,
} = {}) {
  const list = Array.isArray(entries) ? entries : [];
  // 사용자가 고른 것(v2-N R3)은 TTL·자동 상한 **양쪽에서 빠진다**. 자동 캐시는 "최근 연
  // 것"이라 낡으면 버리는 게 맞지만, 받아둔 자료는 "비행기에서 읽으려고 챙긴 것"이라
  // 7일 뒤에 사라지면 정확히 그 상황에서 없다. 대신 핀에도 개수 상한은 둔다.
  const pinned = list.filter((e) => e.pinned);
  const auto = list.filter((e) => !e.pinned);

  const expired = auto.filter((e) => now - e.savedAt > ttl);
  const toDelete = expired.map((e) => e[keyPath]);
  const alive = auto.filter((e) => now - e.savedAt <= ttl);
  if (Number.isFinite(max) && alive.length > max) {
    const oldestFirst = [...alive].sort((a, b) => a.savedAt - b.savedAt);
    toDelete.push(...oldestFirst.slice(0, alive.length - max).map((e) => e[keyPath]));
  }
  if (Number.isFinite(maxPinned) && pinned.length > maxPinned) {
    const oldestFirst = [...pinned].sort((a, b) => a.savedAt - b.savedAt);
    toDelete.push(...oldestFirst.slice(0, pinned.length - maxPinned).map((e) => e[keyPath]));
  }
  return toDelete;
}

/** TTL 만료분 제거 후, 상한 초과분을 오래된 것부터 제거(LRU — pdfCache 선례). */
async function cleanup(store, max) {
  try {
    const db = await openDb();
    const keyPath = store === STORE_MATERIALS ? 'id' : 'key';
    const entries = await new Promise((resolve) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    const toDelete = pickEvictions(entries, { max, keyPath });
    if (toDelete.length > 0) {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      toDelete.forEach((k) => os.delete(k));
    }
  } catch { /* ignore */ }
}

/* ── 자료(본문 + processed_json) ── */

/** TTL을 적용하지 않는 원시 조회 — 핀 판정과 핀 항목 읽기에 쓴다. */
async function getRaw(store, key) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function cacheMaterial(material) {
  if (!material?.id) return;
  // 핀을 보존한다 — 받아둔 자료를 뷰어에서 열면 자동 캐시가 같은 키를 덮어쓰는데,
  // 그때 pinned가 떨어지면 사용자가 챙긴 자료가 조용히 자동 축출 대상이 된다.
  const prev = await getRaw(STORE_MATERIALS, material.id);
  await put(
    STORE_MATERIALS,
    { id: material.id, material, ...(prev?.pinned ? { pinned: true } : {}) },
    MAX_MATERIALS,
  );
}

export async function getCachedMaterial(id) {
  // 핀은 TTL 밖이다 — 7일 지난 '받아둔 자료'가 안 열리면 받아둔 의미가 없다.
  const raw = await getRaw(STORE_MATERIALS, id);
  if (raw?.pinned) return raw.material || null;
  const entry = await get(STORE_MATERIALS, id);
  return entry?.material || null;
}

/* ── 받아두기(v2-N R3) — 사용자가 고른 자료를 자동 축출에서 지킨다 ── */

/**
 * 자료 하나를 받아둔다. `material`은 **뷰어가 읽는 필드를 다 갖춘 행**이어야 한다
 * (실측: 자료실 목록 조회에는 `raw_text`·`source_pdf_id`·`page_start`·`page_end`·
 * `status`가 없다 — 목록 행을 그대로 넣으면 오프라인 뷰어에 빈 칸이 생긴다).
 */
export async function pinMaterial(material) {
  if (!material?.id) return false;
  await put(STORE_MATERIALS, { id: material.id, material, pinned: true }, MAX_MATERIALS);
  return true;
}

/** 받아두기 해제 — 본문은 남기되 자동 축출 대상으로 되돌린다. */
export async function unpinMaterial(id) {
  if (!id) return false;
  const prev = await getRaw(STORE_MATERIALS, id);
  if (!prev) return false;
  await put(STORE_MATERIALS, { id, material: prev.material }, MAX_MATERIALS);
  return true;
}

/** 받아둔 자료 id 집합 — 자료실이 배지·필터에 쓴다. */
export async function pinnedMaterialIds() {
  try {
    const db = await openDb();
    const all = await new Promise((resolve) => {
      const tx = db.transaction(STORE_MATERIALS, 'readonly');
      const req = tx.objectStore(STORE_MATERIALS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    return new Set(all.filter((e) => e.pinned).map((e) => e.id));
  } catch {
    return new Set();
  }
}

/* ── 단어장 스냅샷 — next_review_at을 포함한 전체 행이라 '오늘 due'가 여기서 파생된다
      (별도 due 캐시를 두지 않는 이유 — 중복 신설 금지). ── */

export async function cacheVocabSnapshot(userId, rows) {
  if (!userId || !Array.isArray(rows)) return;
  await put(STORE_SNAPSHOTS, { key: `vocab:${userId}`, rows }, MAX_SNAPSHOTS);
}

export async function getCachedVocabSnapshot(userId) {
  if (!userId) return null;
  const entry = await get(STORE_SNAPSHOTS, `vocab:${userId}`);
  return entry?.rows || null;
}

/** 캐시가 담긴 시각(오프라인 안내 문구용) — 없으면 null. */
export async function cachedVocabSavedAt(userId) {
  if (!userId) return null;
  const entry = await get(STORE_SNAPSHOTS, `vocab:${userId}`);
  return entry?.savedAt || null;
}
