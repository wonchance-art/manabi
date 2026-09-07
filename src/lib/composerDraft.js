const DB = 'manabi-composer-drafts-v1';
const STORE = 'drafts';
const FILES = 'originals';
let connection;

function open() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); request.result.createObjectStore(FILES); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = null; reject(request.error); };
  });
  return connection;
}

// Blob attachments never go to localStorage. Writes resolve at transaction commit,
// not request success, so quota/abort failures cannot falsely say "draft saved".
async function run(ownerId, mode, operation) {
  if (!ownerId) throw new Error('ACCOUNT_REQUIRED');
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = operation(tx.objectStore(STORE), ownerId);
    tx.oncomplete = () => resolve(request.result ?? null);
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error || new Error('초안 저장이 중단됐어요.'));
  });
}
export async function readComposerDraft(ownerId) {
  const draft = await run(ownerId, 'readonly', (store, key) => store.get(key));
  if (!draft) return null;
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES, 'readonly');
    const files = draft.files.map(file => ({ ...file }));
    files.forEach(file => {
      const request = tx.objectStore(FILES).get(`${ownerId}/${draft.id}/${file.hash}`);
      request.onsuccess = () => { file.blob = request.result; };
    });
    tx.oncomplete = () => resolve({ ...draft, files });
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function writeComposerDraft(ownerId, draft) {
  if (!ownerId) throw new Error('ACCOUNT_REQUIRED');
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, FILES], 'readwrite');
    const files = tx.objectStore(FILES);
    draft.files.forEach(file => {
      const key = `${ownerId}/${draft.id}/${file.hash}`;
      const request = files.getKey(key);
      request.onsuccess = () => { if (!request.result && file.blob) files.put(file.blob, key); };
    });
    tx.objectStore(STORE).put({ ...draft, files: draft.files.map(({ blob, ...file }) => file) }, ownerId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('DRAFT_ABORTED'));
  });
}

export async function removeComposerDraft(ownerId) {
  if (!ownerId) throw new Error('ACCOUNT_REQUIRED');
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, FILES], 'readwrite');
    tx.objectStore(STORE).delete(ownerId);
    const cursor = tx.objectStore(FILES).openCursor(IDBKeyRange.bound(`${ownerId}/`, `${ownerId}/\uffff`));
    cursor.onsuccess = () => { if (cursor.result) { cursor.result.delete(); cursor.result.continue(); } };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
