import {documentOf} from './materialDocument';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const integer=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
export const originalSyncKey=(owner,id)=>`manabi-original-sync:v1:${owner}:${id}`;
export function positionSourceKey(source){
 if(source?.kind==='body'&&(source.revision===null||UUID.test(source.revision||'')))return `body:${source.revision||'original'}`;
 if(['pdf','epub'].includes(source?.kind)&&HASH.test(source.assetHash||''))return `asset:${source.assetHash}`;
 return null;
}
export function originalPositionSources(material,retainedHash){
 const doc=documentOf(material);if(!doc)return [];
 const assets=[...(doc.assets||[]),...(doc.retainedAssets||[]).filter(a=>a.hash===retainedHash)];
 return [...(doc.body?.trim()?[{kind:'body',revision:doc.revision||null}]:[]),...assets.map(a=>({kind:a.kind,assetHash:a.hash}))];
}
export function validPositionLocator(source,value){
 if(!value||typeof value!=='object')return null;
 if(source?.kind==='pdf')return integer(value.page,999999)&&value.page>0?{page:value.page}:null;
 if(!integer(value.offset,source?.kind==='body'?9999999:99999999))return null;
 if(source?.kind==='body')return {offset:value.offset};
 if(source?.kind==='epub'&&integer(value.chapter,999999)&&value.chapter>0&&integer(value.spineIndex,999999)&&typeof value.spinePath==='string'&&value.spinePath.length>0&&value.spinePath.length<=2048&&!/[\u0000-\u001f\u007f]/u.test(value.spinePath))return {chapter:value.chapter,spinePath:value.spinePath,spineIndex:value.spineIndex,offset:value.offset};
 return null;
}
export function positionLabel(point){
 if(point?.source?.kind==='pdf')return `PDF ${point.locator.page}쪽`;
 if(point?.source?.kind==='epub')return `EPUB ${point.locator.chapter}장`;
 return '작성한 본문의 읽던 곳';
}
const samePoint=(a,b)=>!!a&&!!b&&positionSourceKey(a.source)===positionSourceKey(b.source)&&JSON.stringify(a.locator)===JSON.stringify(b.locator);
function validPoint(value,sources){
 const key=positionSourceKey(value?.source),source=sources.find(s=>positionSourceKey(s)===key);
 const locator=source&&validPositionLocator(source,value?.locator);
 return locator?{source,locator}:null;
}
function validRecord(value,owner,id){
 const source_key=positionSourceKey(value?.source),locator=source_key&&validPositionLocator(value.source,value.locator);
 return value?.owner_id===owner&&String(value.material_id)===String(id)&&value.source_key===source_key&&locator&&integer(value.version,Number.MAX_SAFE_INTEGER)&&value.version>0&&UUID.test(value.write_id||'')?{...value,locator}:null;
}

// One queue per original. A server revision spans its sources, so an offline PDF
// cannot silently replace a more recent EPUB resume target. No device clock ordering.
export function createOriginalPositionSession({client,ownerId,materialId,sources,storage,onChange=()=>{},onSaved=()=>{},uuid=()=>crypto.randomUUID(),delay=500,timeout=4000}){
 const key=originalSyncKey(ownerId,materialId),allowed=new Set(sources.map(positionSourceKey)),writer=uuid();
 let records=[],head=null,local={},lastKey=null,pending=null,queued=null,ready=false,phase='loading',remote=null,localAvailable=!!storage;
 let timer=null,running=null,refreshing=null,closed=false,initialized=false,errorCode='';
 const version=()=>head?.version||0;
 const report=()=>{if(!closed)onChange(snapshot());};
 const persist=(claim=false)=>{try{if(!storage)throw new Error('NO_STORAGE');const current=JSON.parse(storage.getItem(key)||'null');if(!claim&&current?.writer&&current.writer!==writer)return;storage.setItem(key,JSON.stringify({version:1,writer,records,head,local,lastKey,pending,queued}));localAvailable=true;}catch{localAvailable=false;}};
 const remember=row=>{records=[row,...records.filter(item=>item.source_key!==row.source_key)].filter(item=>allowed.has(item.source_key));};
 try{
  const cache=JSON.parse(storage?.getItem(key)||'null');
  if(cache?.version===1){
   records=(cache.records||[]).map(r=>validRecord(r,ownerId,materialId)).filter(r=>r&&allowed.has(r.source_key));
   head=validRecord(cache.head,ownerId,materialId);
   for(const [sourceKey,value] of Object.entries(cache.local||{})){const p=validPoint(value,sources);if(p&&positionSourceKey(p.source)===sourceKey)local[sourceKey]=p;}
   lastKey=allowed.has(cache.lastKey)?cache.lastKey:null;
   const p=validPoint(cache.pending,sources);
   if(p&&UUID.test(cache.pending.writeId||'')&&integer(cache.pending.baseVersion,Number.MAX_SAFE_INTEGER))pending={...p,writeId:cache.pending.writeId,baseVersion:cache.pending.baseVersion};
   queued=validPoint(cache.queued,sources);
  }
 }catch{localAvailable=false;}
 // A later reader owns the shared cache. Older replies must not erase its pending location.
 persist(true);
 function snapshot(){return {ready,phase,remote,localAvailable,errorCode,head,records:[...records],local:{...local},lastKey,pending:!!(pending||queued)};}
 function selected(sourceKey){
  if(sourceKey){const p=(pending||queued)&&local[sourceKey];return p||records.find(r=>r.source_key===sourceKey)||local[sourceKey]||null;}
  if((pending||queued)&&lastKey&&local[lastKey])return local[lastKey];
  if(head)return allowed.has(head.source_key)?head:null;
  return records[0]||(lastKey&&local[lastKey])||null;
 }
 async function request(name,args){
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),timeout);
  try{return await client.rpc(name,args).abortSignal(abort.signal);}finally{clearTimeout(timer);}
 }
 function failure(error){errorCode=error?.message||'';phase=/POSITION_SOURCE_CHANGED|POSITION_ACCESS/.test(errorCode)?'unavailable':'offline';persist();report();}
 async function refresh(){
  if(closed)return;if(refreshing)return refreshing;
  refreshing=(async()=>{
   if(running)await running;
   try{
    const {data,error}=await request('get_original_reading_positions',{p_owner:ownerId,p_material:String(materialId),p_keys:[...allowed]});
    if(closed)return;
    if(error)throw error;if(!Array.isArray(data?.records))throw new Error('POSITION_UNAVAILABLE');
    const nextHead=data.head===null?null:validRecord(data.head,ownerId,materialId);
    if(data.head&&!nextHead)throw new Error('POSITION_INVALID_RESPONSE');
    const next=(data.records||[]).map(r=>validRecord(r,ownerId,materialId)).filter(r=>r&&allowed.has(r.source_key));
    const previousVersion=version();records=next;errorCode='';
    const acknowledgement=pending&&next.find(r=>r.write_id===pending.writeId&&samePoint(r,pending));
    if(acknowledgement){pending=null;if(!queued)lastKey=acknowledgement.source_key;}
    const expected=pending?.baseVersion??previousVersion;
    if((pending||queued)&&(nextHead?.version||0)!==expected&&!(acknowledgement&&nextHead?.write_id===acknowledgement.write_id)){
     head=nextHead;remote=nextHead;phase='conflict';
    }else if(initialized&&!pending&&!queued&&(nextHead?.version||0)>previousVersion&&!samePoint(nextHead,head)&&!(acknowledgement&&nextHead?.write_id===acknowledgement.write_id)){
     head=nextHead;remote=nextHead;phase='conflict';
    }else{head=nextHead;remote=null;phase='synced';}
    ready=true;initialized=true;persist();report();
    if(phase!=='conflict'&&(pending||queued))await flush();
   }catch(error){if(!closed){ready=true;initialized=true;failure(error);}}
  })();
  try{await refreshing;}finally{refreshing=null;}
 }
 function record(source,locator){
  const point=validPoint({source,locator},sources);if(closed||!ready||!point||phase==='unavailable')return;
  lastKey=positionSourceKey(point.source);local[lastKey]=point;
  if(!pending&&!queued&&samePoint(point,head)){persist(true);report();return;}
  if(samePoint(point,queued)||(!queued&&samePoint(point,pending))){persist(true);return;}
  queued=point;persist(true);report();
  clearTimeout(timer);if(phase!=='conflict')timer=setTimeout(()=>{void flush();},delay);
 }
 async function flush(){
  clearTimeout(timer);if(running)return running;if(!ready||phase==='conflict'||phase==='unavailable')return;
  running=(async()=>{
   while(pending||queued){
    if(!pending){pending={...queued,baseVersion:version(),writeId:uuid()};queued=null;}
    const operation=pending;phase='saving';persist();report();
    try{
     const {data,error}=await request('save_original_reading_position',{p_owner:ownerId,p_material:String(materialId),p_source:operation.source,p_locator:operation.locator,p_version:operation.baseVersion,p_write:operation.writeId});
     if(error)throw error;
     const saved=validRecord(data?.record,ownerId,materialId);
     if(data?.saved===false){head=saved;remote=saved;phase='conflict';persist();report();break;}
     if(data?.saved!==true||!saved||saved.write_id!==operation.writeId||!samePoint(saved,operation))throw new Error('POSITION_UNCERTAIN');
     const nextHead=validRecord(data.head,ownerId,materialId);if(!nextHead)throw new Error('POSITION_UNCERTAIN');
     remember(saved);pending=null;head=nextHead;errorCode='';
     if(nextHead.version>saved.version){remote=nextHead;phase='conflict';persist();report();break;}
     phase='synced';remote=null;persist();report();onSaved(saved);
    }catch(error){failure(error);break;}
   }
  })();try{await running;}finally{running=null;}
 }
 function acceptRemote(){
  const point=remote&&allowed.has(remote.source_key)?remote:null;
  pending=null;queued=null;remote=null;phase='synced';
  if(point){local[point.source_key]={source:point.source,locator:point.locator};lastKey=point.source_key;remember(point);}
  persist(true);report();return point;
 }
 function keepCurrent(source,locator){
  const point=validPoint({source,locator},sources);if(!point)return;
  pending=null;queued=null;remote=null;phase='synced';record(point.source,point.locator);void flush();
 }
 return {snapshot,selected,refresh,record,flush,acceptRemote,keepCurrent,
  dispose(){closed=true;clearTimeout(timer);void flush();}};
}
