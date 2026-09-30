'use client';
import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabase';
import {currentLibraryTarget,runLibraryOperation,invalidateLibrary,libraryOperationError} from '@/lib/libraryOperations';
import LibraryCollections from './LibraryCollections';
import './library.css';
// Whole-source organization remains separate from expression saving and FSRS.
export default function LibrarySaveButton({material=null,edition=null}){
 const {user}=useAuth(),cache=useQueryClient();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const publicMaterial=!!material&&material.visibility==='public'&&material.owner_id!==user?.id;
 const target=edition?{target_kind:'edition',target_id:edition,title:'일본어 N5'}:{target_kind:'material',target_id:String(material?.id),title:material?.title};
 const bookmark=useQuery({queryKey:['library-bookmark',user?.id,target.target_kind,target.target_id],enabled:!!user&&(publicMaterial||!!edition),queryFn:async()=>{
  const state=await currentLibraryTarget(supabase,target);
  if(state.revision)return {...state,saved:state.state==='active'};
  const query=edition?supabase.from('library_collection_items').select('collection_id').eq('owner_id',user.id).eq('target_kind','edition').eq('target_id',edition).limit(1):supabase.from('library_bookmarks').select('material_id').eq('owner_id',user.id).eq('material_id',material.id);
  const {data,error}=await query;if(error)throw error;return {...state,saved:!!data?.length};
 }});
 if(!user||(!publicMaterial&&!edition))return null;
 async function toggle(){if(busy)return;setBusy(true);setError('');try{
  const row=bookmark.data,result=await runLibraryOperation(supabase,row.saved?'trash':row.state==='trashed'?'restore':'save',[row]);
  if(result.items.some(x=>x.status!=='success'))throw new Error('library_conflict');await invalidateLibrary(cache,user.id);
 }catch(e){setError(libraryOperationError(e));await bookmark.refetch();}finally{setBusy(false);}}
 return <div className="library-save-control"><button onClick={toggle} disabled={busy||!bookmark.isSuccess} aria-pressed={!!bookmark.data?.saved}>{busy?'저장 중…':bookmark.data?.state==='trashed'?'복원해 담기':bookmark.data?.saved?'서재에 담김 ✓':'서재에 담기'}</button>{bookmark.data?.state==='active'&&<button onClick={()=>setOpen(true)}>폴더에 추가</button>}{bookmark.isError&&<button onClick={()=>bookmark.refetch()}>다시 확인</button>}{error&&<p role="alert">{error}</p>}{open&&<LibraryCollections ownerId={user.id} target={target} onClose={()=>setOpen(false)}/>}</div>;
}
