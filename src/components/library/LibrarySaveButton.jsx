'use client';
import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabase';
import LibraryCollections from './LibraryCollections';
import './library.css';
// Whole-reading bookmark and expression saving deliberately have different controls and tables.
export default function LibrarySaveButton({material=null,edition=null}){
 const {user}=useAuth(),cache=useQueryClient();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const publicMaterial=!!material&&material.visibility==='public'&&material.owner_id!==user?.id;
 const bookmark=useQuery({queryKey:['library-bookmark',user?.id,material?.id],enabled:!!user&&publicMaterial,
  queryFn:async()=>{const {data,error}=await supabase.from('library_bookmarks').select('material_id').eq('owner_id',user.id).eq('material_id',material.id).maybeSingle();if(error)throw error;return !!data;}});
 if(!user||(!publicMaterial&&!edition))return null;
 const target=edition?{target_kind:'edition',target_id:edition,title:'일본어 N5'}:{target_kind:'material',target_id:String(material.id),title:material.title};
 async function toggle(){setBusy(true);setError('');try{
  const query=bookmark.data?supabase.from('library_bookmarks').delete().eq('owner_id',user.id).eq('material_id',material.id):supabase.from('library_bookmarks').upsert({owner_id:user.id,material_id:material.id},{onConflict:'owner_id,material_id',ignoreDuplicates:true});
  const {error}=await query;if(error)throw error;
  await cache.invalidateQueries({queryKey:['library-bookmark',user.id,material.id]});cache.invalidateQueries({queryKey:['personal-library',user.id]});
 }catch{setError('서재 보관을 변경하지 못했어요. 다시 시도해 주세요.');}finally{setBusy(false);}}
 return <div className="library-save-control">{publicMaterial&&<button onClick={toggle} disabled={busy||bookmark.isPending||bookmark.isError} aria-pressed={!!bookmark.data}>{busy?'저장 중…':bookmark.data?'서재에 담김 ✓':'서재에 담기'}</button>}<button onClick={()=>setOpen(true)}>모음집에 담기</button>{bookmark.isError&&<button onClick={()=>bookmark.refetch()}>보관 상태 다시 확인</button>}{error&&<p role="alert">{error}</p>}{open&&<LibraryCollections ownerId={user.id} target={target} onClose={()=>setOpen(false)}/>}</div>;
}
