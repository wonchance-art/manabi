// The catalog is a projection over existing sources, never a second copy of a reading material.
import {safeLibraryReturn} from './libraryReturn';
export const LIBRARY_PAGE_SIZE=20;
export const LIBRARY_LANGUAGES=['Japanese','Chinese','English','French'];
export const COLLECTION_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const collectionId=value=>COLLECTION_ID.test(value||'')?value:null;
export const libraryKey=row=>`${row.target_kind}:${row.target_id}`;
export function libraryFilters(params){
 const language=params.get('lang')||'';
 const sort=params.get('sort')||'newest';
 const kind=params.get('view')==='notes'?'note':params.get('kind')||'';
 const shown=Number(params.get('shown'));
 return {query:(params.get('q')||'').trim().slice(0,120),language:[...LIBRARY_LANGUAGES,'unknown'].includes(language)?language:'',
  collection:collectionId(params.get('collection')),sort:['newest','title','opened','level'].includes(sort)?sort:'newest',
  kind:['note','book','pdf','epub','text','link'].includes(kind)?kind:'',
  state:params.get('unread')==='1'?'unread':['opened','completed','unread'].includes(params.get('state'))?params.get('state'):'',
  level:(params.get('level')||'').slice(0,30),pinned:params.get('pinned')==='1',shown:Number.isInteger(shown)?Math.max(20,Math.min(100000,shown)):20};
}
export const libraryNarrowed=f=>!!(f.query||f.language||f.collection||f.kind||f.state||f.level||f.pinned);
export function libraryPageArgs(filters,offset=0,{recent=false,pinned=null}={}){
 return {p_query:filters.query||'',p_language:filters.language||'',p_kind:filters.kind||'',p_collection:filters.collection||null,
  p_sort:filters.sort||'newest',p_state:filters.state||'',p_level:filters.level||'',p_offset:Math.max(0,offset),p_limit:recent?3:LIBRARY_PAGE_SIZE,p_recent:recent,p_pinned:filters.pinned?(pinned||[]).map(String):null};
}
export async function fetchLibraryPage(client,filters,offset=0,options={}){
 const {data,error}=await client.rpc('personal_library_page',libraryPageArgs(filters,offset,options));
 if(error)throw error;
 if(!data||!Array.isArray(data.items)||!Number.isSafeInteger(data.total))throw new Error('INVALID_LIBRARY_PAGE');
 return data;
}
export async function fetchCollections(client,ownerId){
 const {data,error}=await client.from('library_collections').select('id,name,created_at').eq('owner_id',ownerId).order('created_at',{ascending:true});
 if(error)throw error;return data||[];
}
export async function createCollection(client,ownerId,name,id){
 const clean=name.trim();if(!clean||clean.length>80||!collectionId(id))throw new Error('INVALID_COLLECTION');
 const {data,error}=await client.from('library_collections').insert({id,owner_id:ownerId,name:clean}).select('id,name,created_at').single();
 if(error?.code==='23505'){
  const existing=await client.from('library_collections').select('id,name,created_at').eq('id',id).eq('owner_id',ownerId).single();
  if(!existing.error&&existing.data)return existing.data;
 }
 if(error)throw error;return data;
}
export async function addToCollection(client,ownerId,id,target){
 if(!collectionId(id)||!['material','pdf','book','edition'].includes(target.target_kind)||!target.target_id)throw new Error('INVALID_COLLECTION_TARGET');
 const {error}=await client.from('library_collection_items').upsert({owner_id:ownerId,collection_id:id,target_kind:target.target_kind,target_id:String(target.target_id)},{onConflict:'owner_id,collection_id,target_kind,target_id',ignoreDuplicates:true});
 if(error)throw error;
}
export async function removeFromCollection(client,ownerId,id,target){
 const {error}=await client.from('library_collection_items').delete().eq('owner_id',ownerId).eq('collection_id',id).eq('target_kind',target.target_kind).eq('target_id',String(target.target_id));
 if(error)throw error;
}
export function libraryItemHref(row){
 if(row.target_kind==='pdf')return `/pdf/${encodeURIComponent(row.target_id)}?pdfjs=1`;
 if(row.target_kind==='edition')return `/books/japanese-n5?edition=${encodeURIComponent(row.target_id)}#cover`;
 return `/viewer/${encodeURIComponent(row.material_id||row.target_id)}`;
}
export function libraryComposerHref(returnTo,collection){
 const params=new URLSearchParams({returnTo:safeLibraryReturn(returnTo)});
 if(collectionId(collection))params.set('collection',collection);
 return `/materials/add?${params}`;
}
export const libraryError=error=>['PGRST202','42P01'].includes(error?.code)?'서재 기능을 준비하고 있어요. 잠시 후 다시 열어 주세요.':'불러오지 못했어요. 저장된 자료는 그대로 있습니다.';
