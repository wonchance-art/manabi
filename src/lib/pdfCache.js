'use client';

// 간단한 IndexedDB 래퍼 — PDF 버퍼를 pdfId 키로 캐시
// 만료: 7일 (오래된 것 자동 삭제)

const DB_NAME = 'anatomy-pdf-cache';
const STORE = 'pdfs';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일
const MAX_ENTRIES = 20; // LRU 상한

let _dbPromise = null;

function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'pdfId' });
      }
    };
  });
  return _dbPromise;
}

/** PDF 버퍼 조회 (만료된 것은 null 반환) */
export async function getCachedPdf(pdfId) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(pdfId);
      req.onsuccess = () => {
        const entry = req.result;
        if (!entry) return resolve(null);
        if (Date.now() - entry.savedAt > TTL_MS) return resolve(null);
        resolve(entry.buffer);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** PDF 버퍼 저장 (LRU: 상한 초과 시 가장 오래된 것 삭제) */
export async function cachePdf(pdfId, buffer) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.put({ pdfId, buffer, savedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = resolve; // 실패해도 조용히
    });

    // LRU 정리
    await cleanupOldEntries();
  } catch {
    /* storage quota 초과 등 — 무시 */
  }
}

async function cleanupOldEntries() {
  try {
    const db = await openDb();
    const entries = await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    // 만료된 것 먼저 제거
    const now = Date.now();
    const toDelete = entries.filter(e => now - e.savedAt > TTL_MS).map(e => e.pdfId);

    // 상한 초과 시 오래된 것부터 추가 삭제
    if (entries.length - toDelete.length > MAX_ENTRIES) {
      const remaining = entries
        .filter(e => !toDelete.includes(e.pdfId))
        .sort((a, b) => a.savedAt - b.savedAt);
      const extraToDelete = remaining.slice(0, remaining.length - MAX_ENTRIES);
      toDelete.push(...extraToDelete.map(e => e.pdfId));
    }

    if (toDelete.length > 0) {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      toDelete.forEach(id => store.delete(id));
    }
  } catch {/* ignore */}
}

/** 특정 PDF 캐시 제거 (삭제 시 호출) */
export async function removeCachedPdf(pdfId) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(pdfId);
    await new Promise(resolve => { tx.oncomplete = resolve; tx.onerror = resolve; });
  } catch {/* ignore */}
}
