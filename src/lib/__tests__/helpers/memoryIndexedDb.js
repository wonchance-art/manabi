/**
 * 계약 테스트용 메모리 IndexedDB(open · onupgradeneeded · objectStore put/get/getAll/delete/add · 트랜잭션 oncomplete).
 * offlineCache처럼 판 올림 · 여러 저장소 트랜잭션을 쓰는 모듈을 실제 경로 그대로 돌리기 위한 최소 구현이다(fake-indexeddb 미설치).
 * `databases`로 저장 내용을 들여다본다. 비동기 콜백은 queueMicrotask — 실제 IDB처럼 요청 콜백 뒤에 트랜잭션 완료가 온다.
 */
export function memoryIndexedDb() {
  const databases = new Map(); // name → { version, stores: Map(name → { keyPath, autoIncrement, seq, rows: Map }) }
  const later = (fn) => queueMicrotask(fn);
  function connection(db) {
    return {
      objectStoreNames: { contains: (name) => db.stores.has(name) },
      createObjectStore(name, { keyPath, autoIncrement = false } = {}) {
        db.stores.set(name, { keyPath, autoIncrement, seq: 0, rows: new Map() });
      },
      close() {},
      transaction(names, _mode) {
        const list = Array.isArray(names) ? names : [names];
        let pending = 0, done = false;
        const tx = { error: null };
        const settle = () => { if (!done && pending === 0) { done = true; later(() => tx.oncomplete?.()); } };
        const track = (work) => { pending += 1; const req = {}; later(() => { req.result = work(); req.onsuccess?.(); pending -= 1; settle(); }); return req; };
        tx.objectStore = (name) => {
          if (!list.includes(name)) throw new Error(`store not in transaction: ${name}`);
          const store = db.stores.get(name);
          const keyOf = (value) => value[store.keyPath];
          const clone = (v) => (v === undefined ? undefined : structuredClone(v));
          return {
            put: (value) => track(() => { const row = structuredClone(value); if (store.autoIncrement && row[store.keyPath] == null) row[store.keyPath] = ++store.seq; store.rows.set(keyOf(row), row); return keyOf(row); }),
            add: (value) => track(() => { const row = structuredClone(value); if (store.autoIncrement && row[store.keyPath] == null) row[store.keyPath] = ++store.seq; store.rows.set(keyOf(row), row); return keyOf(row); }),
            get: (key) => track(() => clone(store.rows.get(key))),
            getAll: () => track(() => [...store.rows.values()].map(clone)),
            delete: (key) => track(() => { store.rows.delete(key); }),
          };
        };
        later(settle); // 요청이 하나도 없는 트랜잭션도 끝난다
        return tx;
      },
    };
  }
  const api = {
    open(name, version = 1) {
      const req = {};
      later(() => {
        let db = databases.get(name);
        const upgrade = !db || db.version < version;
        if (!db) { db = { version: 0, stores: new Map() }; databases.set(name, db); }
        req.result = connection(db);
        if (upgrade) { db.version = version; req.onupgradeneeded?.({ target: req }); }
        req.onsuccess?.();
      });
      return req;
    },
  };
  const rows = (dbName, store) => [...(databases.get(dbName)?.stores.get(store)?.rows.values() || [])];
  return { api, databases, rows };
}
