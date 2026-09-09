// Each operation is a separate IDB record; tabs cannot overwrite a whole queue snapshot.
const DB = 'manabi-classroom-outbox';
const STORE = 'entries';
let opened;
function open() {
  if (!opened) opened = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('이 기기에 입력을 보관할 수 없어요. 원문을 복사해 주세요.')); return; }
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('다른 창을 닫고 기기 보관을 다시 시도해 주세요.'));
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); opened = null; }; resolve(request.result); };
  }).catch(error => { opened = null; throw error; });
  return opened;
}
async function transaction(mode, action) {
  const db = await open();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(STORE,mode);
    let request;
    try { request = action(tx.objectStore(STORE)); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(request?.result);
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('기기에 보관하지 못했어요. 입력창의 원문을 복사해 주세요.'));
  });
}
export const putClassOperation = row => transaction('readwrite', store => store.put(row));
export const deleteClassOperation = id => transaction('readwrite', store => store.delete(id));
export async function listClassOperations(scope) {
  const all = await transaction('readonly', store => store.getAll());
  return all.filter(row => row.scope === scope).sort((a,b) => a.createdAt-b.createdAt || a.id.localeCompare(b.id));
}
