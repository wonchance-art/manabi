// One protocol for single/bulk changes. Persist request IDs and direction, never source contents.
import {libraryKey} from './personalLibrary';
export const operationTarget=row=>({target_kind:row.target_kind,target_id:String(row.target_id),revision:row.revision||0});
export function uniqueTargets(rows){return [...new Map(rows.map(row=>[libraryKey(row),operationTarget(row)])).values()];}
export async function libraryRpc(client,name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
export function operationCounts(result){return (result?.items||[]).reduce((a,item)=>{a[item.status]=(a[item.status]||0)+1;return a;},{});}
export async function continueOperation(client,id,{undo=false,onProgress=()=>{}}={}){
 let result=await libraryRpc(client,'library_operation_status',{p_id:id});
 if(!result)throw new Error('library_operation_missing');
 const remaining=()=>result.items.some(item=>item.status===(undo?'success':'pending'));
 while(remaining()){
  const count=result.items.filter(item=>item.status===(undo?'success':'pending')).length;
  result=await libraryRpc(client,'library_operation_apply',{p_id:id,p_undo:undo});onProgress(result);
  if(result.items.filter(item=>item.status===(undo?'success':'pending')).length>=count)throw new Error('library_no_progress');
 }
 return result;
}
export async function prepareOperation(client,id,action,rows,options={}){
 return libraryRpc(client,'library_operation_prepare',{p_id:id,p_action:action,p_targets:uniqueTargets(rows),p_options:options});
}
export async function runLibraryOperation(client,action,rows,options={}){
 const id=crypto.randomUUID();await prepareOperation(client,id,action,rows,options);return continueOperation(client,id);
}
export async function currentLibraryTarget(client,target){
 const canonical=await libraryRpc(client,'library_canonical_target',{p_kind:target.target_kind,p_id:String(target.target_id)});
 const {data,error}=await client.from('library_item_state').select('state,revision').eq('target_kind',canonical.target_kind).eq('target_id',canonical.target_id).maybeSingle();
 if(error)throw error;return {...canonical,state:data?.state||'active',revision:data?.revision||0};
}
export async function invalidateLibrary(cache,owner){
 await Promise.all(['personal-library','library-recent','library-collections','library-memberships','library-bookmark','library-item-state','library-children','my-pdfs'].map(key=>cache.invalidateQueries({queryKey:[key,owner]})));
 await cache.invalidateQueries({queryKey:['materials']});
}
export function libraryOperationError(error){
 const message=error?.message||'';
 if(message.includes('duplicate'))return '같은 이름의 폴더가 있어요.';
 if(message.includes('cycle'))return '하위 폴더 안으로 옮길 수 없어요.';
 if(message.includes('selection_limit'))return '한 번에 5,000개까지 선택할 수 있어요.';
 if(/conflict|expired/.test(message))return '다른 변경이 있습니다. 새로 확인해 주세요.';
 if(['PGRST202','42P01','42703'].includes(error?.code))return '서재 업데이트 준비 중입니다. 잠시 후 다시 시도해 주세요.';
 return '저장 결과를 확인하지 못했어요. 다시 확인해 주세요.';
}
export function folderPaths(folders){
 const byId=new Map(folders.map(folder=>[folder.id,folder]));
 const path=folder=>{const names=[folder.name],seen=new Set([folder.id]);let parent=byId.get(folder.parent_id);while(parent&&!seen.has(parent.id)){names.unshift(parent.name);seen.add(parent.id);parent=byId.get(parent.parent_id);}return names.join(' / ');};
 return folders.map(folder=>({...folder,path:path(folder)}));
}
export function pendingOperationKey(owner){return `manabi:library-operation:${owner}`;}
export function parsePendingOperation(value){
 if(!value)return null;
 try{const request=JSON.parse(value);return typeof request.id==='string'?{id:request.id,undo:request.undo===true}:null;}catch{return /^[0-9a-f-]{36}$/i.test(value)?{id:value,undo:false}:null;}
}
export function selectedRange(items,selected,key,anchor,checked,shift){
 const next=new Map(selected.map(item=>[libraryKey(item),item]));
 const start=items.findIndex(item=>libraryKey(item)===anchor),end=items.findIndex(item=>libraryKey(item)===key);
 const rows=shift&&start>=0&&end>=0?items.slice(Math.min(start,end),Math.max(start,end)+1):items.filter(item=>libraryKey(item)===key);
 for(const row of rows){if(checked)next.set(libraryKey(row),operationTarget(row));else next.delete(libraryKey(row));}return [...next.values()];
}
export async function filterActiveSources(client,owner,rows,kind='material'){
 const hidden=new Set();
 for(let offset=0;;offset+=1000){const {data,error}=await client.from('library_item_state').select('target_kind,target_id').eq('owner_id',owner).neq('state','active').range(offset,offset+999);if(error)throw error;for(const row of data||[])hidden.add(libraryKey(row));if((data||[]).length<1000)break;}
 return rows.filter(row=>{const meta=row.processed_json?.metadata||{};const key=kind==='pdf'?`pdf:${row.id}`:meta.book?.key?`book:${meta.book.key}`:row.source_pdf_id?`pdf:${row.source_pdf_id}`:`material:${meta.composer?.role==='study'?meta.composer.parentId:row.id}`;return !hidden.has(key);});
}
