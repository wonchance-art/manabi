'use client';
import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/lib/supabase';
import {addToCollection,createCollection,fetchCollections,removeFromCollection} from '@/lib/personalLibrary';

export function useCollections(ownerId){
 return useQuery({queryKey:['library-collections',ownerId],enabled:!!ownerId,queryFn:()=>fetchCollections(supabase,ownerId),staleTime:30000});
}
export function LibraryDialog({title,children,onClose}){
 const dialog=useRef(null);
 useEffect(()=>{const opener=document.activeElement;const node=dialog.current;node?.showModal();return()=>{node?.close();requestAnimationFrame(()=>{if(document.activeElement===document.body&&opener?.isConnected)opener.focus({preventScroll:true});});};},[]);
 return <dialog ref={dialog} className="shelf-dialog" aria-label={title} onCancel={onClose} onClose={onClose}><div className="shelf-dialog-head"><h2>{title}</h2><button type="button" aria-label="닫기" onClick={onClose}>×</button></div>{children}</dialog>;
}
export default function LibraryCollections({ownerId,target=null,onClose,onSelect}){
 const collections=useCollections(ownerId),cache=useQueryClient();
 const [name,setName]=useState(''),[search,setSearch]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(null),[deleting,setDeleting]=useState(null);
 const attempt=useRef(null);
 const memberships=useQuery({queryKey:['library-memberships',ownerId,target?.target_kind,target?.target_id],enabled:!!target,
  queryFn:async()=>{const {data,error}=await supabase.from('library_collection_items').select('collection_id').eq('owner_id',ownerId).eq('target_kind',target.target_kind).eq('target_id',String(target.target_id));if(error)throw error;return (data||[]).map(x=>x.collection_id);}});
 const refresh=()=>Promise.all([cache.invalidateQueries({queryKey:['library-collections',ownerId]}),cache.invalidateQueries({queryKey:['library-memberships',ownerId]}),cache.invalidateQueries({queryKey:['personal-library',ownerId]})]);
 async function run(operation){if(busy)return;setBusy(true);setError('');try{await operation();await refresh();return true;}catch{setError('변경을 저장하지 못했어요. 다시 시도해 주세요.');return false;}finally{setBusy(false);}}
 async function toggleMembership(item,checked){
  const key=['library-memberships',ownerId,target.target_kind,target.target_id];
  const previous=memberships.data||[];
  cache.setQueryData(key,checked?[...new Set([...previous,item.id])]:previous.filter(id=>id!==item.id));
  const ok=await run(()=>checked?addToCollection(supabase,ownerId,item.id,target):removeFromCollection(supabase,ownerId,item.id,target));
  if(!ok)cache.setQueryData(key,previous);
 }
 async function create(event){event.preventDefault();if(!name.trim())return;
  if(!attempt.current||attempt.current.name!==name.trim())attempt.current={id:crypto.randomUUID(),name:name.trim()};
  await run(async()=>{const value=await createCollection(supabase,ownerId,attempt.current.name,attempt.current.id);setName('');attempt.current=null;if(target)await addToCollection(supabase,ownerId,value.id,target);});
 }
 const items=(collections.data||[]).filter(item=>item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 return <LibraryDialog title={target?'모음집에 담기':'내 모음집'} onClose={onClose}>
  {target&&<p className="shelf-dialog-intro">{target.title}</p>}
  {collections.isPending&&<p role="status">모음집을 불러오고 있어요…</p>}
  {collections.isError&&<p role="alert">모음집을 불러오지 못했어요. <button onClick={()=>collections.refetch()}>다시 불러오기</button></p>}
  {(collections.data?.length||0)>6&&<input className="shelf-input" aria-label="모음집 이름 검색" type="search" placeholder="모음집 이름 찾기" value={search} onChange={e=>setSearch(e.target.value)}/>}
  {memberships.isError&&<p role="alert">담긴 모음집을 확인하지 못했어요. <button onClick={()=>memberships.refetch()}>다시 확인</button></p>}
  <div className="shelf-collection-list">{items.map(item=><div key={item.id} className="shelf-collection-item">
   {target?<label><input type="checkbox" checked={memberships.data?.includes(item.id)||false} disabled={busy||!memberships.isSuccess} onChange={e=>toggleMembership(item,e.target.checked)}/><span>{item.name}</span></label>:<button className="shelf-collection-name" onClick={()=>{onSelect?.(item.id);onClose();}}>{item.name}<span aria-hidden="true">↗</span></button>}
   {!target&&<><button aria-label={`${item.name} 이름 변경`} disabled={busy} onClick={()=>{setEditing({id:item.id,name:item.name});setDeleting(null);}}>이름</button><button aria-label={`${item.name} 모음집 삭제`} disabled={busy} onClick={()=>{setDeleting(item);setEditing(null);}}>삭제</button></>}
   {editing?.id===item.id&&<form className="shelf-collection-edit" onSubmit={e=>{e.preventDefault();if(!editing.name.trim())return;run(async()=>{const {error}=await supabase.from('library_collections').update({name:editing.name.trim()}).eq('id',item.id).eq('owner_id',ownerId);if(error)throw error;setEditing(null);});}}><input aria-label="새 모음집 이름" maxLength={80} value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/><button disabled={busy}>이름 저장</button><button type="button" onClick={()=>setEditing(null)}>취소</button></form>}
   {deleting?.id===item.id&&<div className="shelf-collection-edit"><p>이 모음집만 삭제합니다. 담긴 자료와 읽기·복습 기록은 남아요.</p><button disabled={busy} onClick={()=>run(async()=>{const {error}=await supabase.from('library_collections').delete().eq('id',item.id).eq('owner_id',ownerId);if(error)throw error;setDeleting(null);onSelect?.('');})}>모음집 삭제</button><button disabled={busy} onClick={()=>setDeleting(null)}>취소</button></div>}
  </div>)}</div>
  {collections.isSuccess&&!collections.data.length&&<p className="shelf-muted">이름을 정하면 첫 모음집이 생겨요.</p>}
  {error&&<p role="alert">{error}</p>}
  <form className="shelf-create-collection" onSubmit={create}><label htmlFor="collection-name">새 모음집</label><div><input id="collection-name" maxLength={80} autoComplete="off" placeholder="모음집 이름" value={name} onChange={e=>setName(e.target.value)} disabled={busy}/><button disabled={busy||!name.trim()}>{busy?'저장 중…':'만들기'}</button></div></form>
  <p className="shelf-muted">모음집은 나에게만 보입니다. 같은 자료를 여러 곳에 담을 수 있어요.</p>
 </LibraryDialog>;
}
