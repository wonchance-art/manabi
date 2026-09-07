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
function draftKey(ownerId, scope) { return scope ? `${ownerId}/edit/${scope}` : ownerId; }

export async function readComposerDraft(ownerId, scope = '') {
  const draft = await run(ownerId, 'readonly', store => store.get(draftKey(ownerId, scope)));
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

export async function writeComposerDraft(ownerId, draft, scope = '') {
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
    tx.objectStore(STORE).put({ ...draft, files: draft.files.map(({ blob, ...file }) => file) }, draftKey(ownerId, scope));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('DRAFT_ABORTED'));
  });
}

export async function removeComposerDraft(ownerId, scope = '') {
  if (!ownerId) throw new Error('ACCOUNT_REQUIRED');
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, FILES], 'readwrite');
    const drafts = tx.objectStore(STORE);
    const stored = drafts.get(draftKey(ownerId, scope));
    stored.onsuccess = () => {
      drafts.delete(draftKey(ownerId, scope));
      if (!stored.result) return;
      const prefix = `${ownerId}/${stored.result.id}/`;
      const cursor = tx.objectStore(FILES).openCursor(IDBKeyRange.bound(prefix, `${prefix}\uffff`));
      cursor.onsuccess = () => { if (cursor.result) { cursor.result.delete(); cursor.result.continue(); } };
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
