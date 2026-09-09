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
  return all.filter(row => row.scope === scope && row.kind !== 'draft').sort((a,b) => a.createdAt-b.createdAt || a.id.localeCompare(b.id));
}

export const readClassDraft = scope => transaction('readonly',store=>store.get(`draft:${scope}`));
export const writeClassDraft = (scope,text) => putClassOperation({id:`draft:${scope}`,scope,kind:'draft',text,updatedAt:Date.now()});

export function canDiscardClassOperation(row) {
  return !!row && (!row.attempted || ['PGRST202','PGRST301','22023','42501'].includes(row.errorCode));
}
async function changeOperation(id, change) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
    let result=null,problem;
    const request=store.get(id);
    request.onsuccess=()=>{
      try {const next=change(request.result);result=next;if(next===false)store.delete(id);else if(next)store.put(next);}
      catch(error){problem=error;tx.abort();}
    };
    tx.oncomplete=()=>resolve(result);
    tx.onerror=tx.onabort=()=>reject(problem||tx.error||new Error('대기 중인 입력을 변경하지 못했어요.'));
  });
}
export function claimClassOperation(id) {
  return changeOperation(id,row=>!row||row.kind==='draft'||row.status==='error'?null:{...row,attempted:true,status:'sending',errorCode:'',error:''});
}
export function discardClassOperation(id) {
  return changeOperation(id,row=>{
    if(!row)return null;
    if(!canDiscardClassOperation(row))throw new Error('서버 저장 여부를 먼저 재시도로 확인해 주세요.');
    return false;
  });
}
