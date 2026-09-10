// An explicit login action owns one request. Merely signing in never imports cached class materials.
const TTL=7*86400000;
let opened;
function db(){
  if(!opened)opened=new Promise((resolve,reject)=>{const r=indexedDB.open('manabi-class-save-intents',1);r.onupgradeneeded=()=>r.result.createObjectStore('intents',{keyPath:'id'});r.onblocked=()=>reject(new Error('저장 창을 준비하지 못했어요. 다른 탭을 닫은 뒤 다시 시도해 주세요.'));r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();opened=null;};resolve(r.result);};r.onerror=()=>reject(r.error);}).catch(e=>{opened=null;throw e;});
  return opened;
}
async function transaction(id,change){
  const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('intents',change?'readwrite':'readonly'),store=tx.objectStore('intents');let result,error;const r=store.get(id);
    r.onsuccess=()=>{try{result=change?change(r.result):r.result;if(change){if(result===null)store.delete(id);else store.put(result);}}catch(e){error=e;tx.abort();}};
    tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(error||tx.error);});
}
export async function createClassSaveIntent(data){
  const id=crypto.randomUUID(),row={...data,id,at:Date.now(),ownerId:null};
  await transaction(id,()=>row);
  // A separate tab cannot silently consume the request. Failure leaves the original page visible.
  sessionStorage.setItem(`class-save-login:${id}`,'requested');
  return id;
}
export async function claimClassSaveIntent(id,ownerId){
  if(sessionStorage.getItem(`class-save-login:${id}`)!=='requested')throw new Error('이 탭에서 요청한 저장이 아니에요. 자료에서 표현을 다시 선택해 주세요.');
  return transaction(id,row=>{
    if(!row||Date.now()-row.at>TTL)throw new Error('저장 요청이 만료됐어요. 표현을 다시 선택해 주세요.');
    if(row.ownerId&&row.ownerId!==ownerId)throw new Error('다른 계정에서 시작한 저장 요청이에요.');
    return {...row,ownerId};
  });
}
export async function finishClassSaveIntent(id){await transaction(id,()=>null);sessionStorage.removeItem(`class-save-login:${id}`);}
