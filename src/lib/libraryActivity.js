import {readingProgressKey,validReadingProgress} from './bookNavigation';
import {bookHref} from './textbook/contract';
import {libraryItemHref} from './personalLibrary';
export const legacyPdfPositionKey=(ownerId,pdfId)=>`manabi-pdf-position:${ownerId}:${pdfId}`;
export const originalPositionKey=(ownerId,materialId,hash)=>`manabi-original-position:${ownerId}:${materialId}:${hash}`;
export function materialActivity(material,mode='text',assetHash=null,revision=null,ownerId=material?.owner_id){
 if(!material?.id)return null;
 const meta=material.processed_json?.metadata||{},composer=meta.composer;
 const book=material.owner_id===ownerId?meta.book:null;
 const pdf=material.owner_id===ownerId?material.source_pdf_id:null;
 const target_kind=composer?.role==='study'?'material':book?.key?'book':pdf?'pdf':'material';
 const target_id=composer?.role==='study'?composer.parentId:book?.key||pdf||String(material.id);
 const context={materialId:String(material.id),mode};
 if(assetHash)context.assetHash=assetHash;if(revision)context.revision=revision;
 return {target_kind,target_id:String(target_id),context};
}
const pendingOpens=new WeakMap();
export async function recordLibraryOpen(client,ownerId,activity){
 if(!ownerId||!activity)return;
 let pending=pendingOpens.get(client);if(!pending){pending=new Map();pendingOpens.set(client,pending);}
 const key=`${ownerId}:${activity.target_kind}:${activity.target_id}`;
 // An earlier body request must not finish after a newly selected attachment.
 const operation=(pending.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
  const {error}=await client.from('library_reading_activity').upsert({owner_id:ownerId,...activity},{onConflict:'owner_id,target_kind,target_id'});
  if(error)throw error;
 });
 pending.set(key,operation);
 try{await operation;}finally{if(pending.get(key)===operation)pending.delete(key);}
}
export function libraryResume(row,ownerId,storage){
 const context=row.context||{};
 let href=libraryItemHref(row),label='자료 열기';
 if(row.target_kind==='edition'){
  let value=null;
  try{value=JSON.parse(storage?.getItem(readingProgressKey(row.target_id,ownerId))||'null');}catch{/* Device-local position is optional. */}
  if(value?.page===validReadingProgress(value).page){href=bookHref(row.target_id,value.page);label=`${Number(value.page.slice(1,3))}과부터 · 이 기기`;}
  else {href=bookHref(row.target_id,context.page||'cover');label=context.page?'읽던 과 열기':'책 열기';}
 }else if(row.target_kind==='pdf'&&!context.materialId){
  let page=null;try{page=Number(storage?.getItem(legacyPdfPositionKey(ownerId,row.target_id)));}catch{/* Exact position is optional. */}
  href=`/pdf/${encodeURIComponent(row.target_id)}?pdfjs=1${Number.isSafeInteger(page)&&page>0?`&page=${page}`:''}`;
  label=Number.isSafeInteger(page)&&page>0?`${page}쪽부터 · 이 기기`:'PDF 열기';
 }else if(context.mode==='original'&&context.materialId&&String(context.materialId)!==String(row.target_id)&&row.target_kind==='material'){
  href=`/viewer/${encodeURIComponent(row.target_id)}?passage=${encodeURIComponent(context.materialId)}`;label='원본의 학습 구간 열기';
 }else if(context.mode==='original'&&context.materialId&&String(context.materialId)===String(row.target_id)&&row.target_kind==='material'){
  const fallback=(row.assets||[]).some(asset=>asset.hash===context.assetHash)?`&asset=${context.assetHash}`:'';
  href=`/viewer/${encodeURIComponent(row.target_id)}?resume=1${fallback}`;label='읽던 위치에서 이어 읽기';
 }else if(context.assetHash){
  const asset=(row.assets||[]).find(a=>a.hash===context.assetHash);
  if(asset){
   href=`/viewer/${encodeURIComponent(row.target_id)}?asset=${asset.hash}`;
   let position=null;try{position=storage?.getItem(originalPositionKey(ownerId,row.target_id,asset.hash));}catch{/* Readable without storage. */}
   const number=Number(position);
   if(position!==null&&Number.isSafeInteger(number)&&number>0)label=`${number}${asset.kind==='epub'?'장':'쪽'}부터 · 이 기기`;
   else label='첨부 원본 열기';
  }
 }else if(context.materialId){
  href=`/viewer/${encodeURIComponent(context.materialId)}${context.mode==='study'?'?study=1':''}`;
  label=context.mode==='study'?'학습하던 본문':context.mode==='original'?'작성한 글 열기':'저장된 문장부터';
 }
 return {href,label};
}
