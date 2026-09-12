import {validateBoard} from './teachingBoard';

const NAME = 'manabi-teaching-boards';
let opened;
function open() {
  if (!opened) opened = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('이 기기에서 설명판을 보관할 수 없어요.')); return; }
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('boards', {keyPath: 'id'});
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('다른 창을 닫고 다시 시도해 주세요.'));
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); opened = null; };
      resolve(request.result);
    };
  }).catch(error => { opened = null; throw error; });
  return opened;
}

export async function readTeachingBoard(scope) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('boards', 'readonly'), request = tx.objectStore('boards').get(scope);
    tx.oncomplete = () => { try { const row = request.result; resolve(row ? {...row, document: validateBoard(row.document)} : null); } catch (error) { reject(error); } };
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('설명판을 불러오지 못했어요.'));
  });
}

export async function readTeachingBoardRecoveries(scope) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('boards','readonly');
    const request=tx.objectStore('boards').getAll(IDBKeyRange.bound(`${scope}:recovery:`,`${scope}:recovery:\uffff`));
    tx.oncomplete=()=>resolve(request.result.flatMap(row=>{
      try{return [{...row,document:validateBoard(row.document)}];}catch{return [];}
    }).sort((a,b)=>b.updatedAt-a.updatedAt));
    tx.onerror=tx.onabort=()=>reject(tx.error || new Error('복구할 판을 불러오지 못했어요.'));
  });
}

// Compare inside a single transaction: another tab's successful save is never overwritten.
export async function saveTeachingBoard(scope, expected, document, writer) {
  const clean = validateBoard(document), db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('boards', 'readwrite'), store = tx.objectStore('boards');
    const request = store.get(scope);
    let result, problem;
    request.onsuccess = () => {
      const current = request.result;
      if ((current?.revision || null) !== expected) {
        problem = new Error('다른 창에서 이 판을 수정했어요. 내 내용은 백업한 뒤 최신 판을 열어 주세요.');
        problem.code = 'board_conflict';
        // Preserve this writer's draft separately for recovery; never replace the shared head.
        store.put({id: `${scope}:recovery:${writer}`, scope, document: clean, revision: crypto.randomUUID(), updatedAt: Date.now()});
        return;
      }
      result = {id: scope, scope, revision: crypto.randomUUID(), document: clean, updatedAt: Date.now()};
      store.put(result);
    };
    tx.oncomplete = () => problem ? reject(problem) : resolve(result);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('설명판을 기기에 보관하지 못했어요. 백업을 내려받아 주세요.'));
  });
}
