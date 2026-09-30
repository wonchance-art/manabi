'use client';
import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/lib/supabase';
import {fetchCollections} from '@/lib/personalLibrary';
import {currentLibraryTarget,runLibraryOperation,libraryRpc,invalidateLibrary,libraryOperationError,folderPaths} from '@/lib/libraryOperations';
export function useCollections(ownerId){return useQuery({queryKey:['library-collections',ownerId],enabled:!!ownerId,queryFn:()=>fetchCollections(supabase,ownerId),staleTime:30000});}
export function LibraryDialog({title,children,onClose}){
 const dialog=useRef(null);
 useEffect(()=>{const opener=document.activeElement,node=dialog.current;node?.showModal();return()=>{node?.close();requestAnimationFrame(()=>{if(document.activeElement===document.body&&opener?.isConnected)opener.focus({preventScroll:true});});};},[]);
 return <dialog ref={dialog} className="shelf-dialog" aria-label={title} onCancel={e=>{e.preventDefault();onClose();}} onClose={onClose}><div className="shelf-dialog-head"><h2>{title}</h2><button type="button" aria-label="닫기" onClick={onClose}>×</button></div>{children}</dialog>;
}
export default function LibraryCollections({ownerId,target=null,onClose,onSelect,initialParent=null}){
 const collections=useCollections(ownerId),cache=useQueryClient(),attempt=useRef(null);
 const [name,setName]=useState(''),[parent,setParent]=useState(initialParent||''),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[undo,setUndo]=useState(null);
 const folders=folderPaths(collections.data||[]);
 const memberships=useQuery({queryKey:['library-memberships',ownerId,target?.target_kind,target?.target_id],enabled:!!target,queryFn:async()=>{const {data,error}=await supabase.from('library_collection_items').select('collection_id').eq('owner_id',ownerId).eq('target_kind',target.target_kind).eq('target_id',String(target.target_id));if(error)throw error;return (data||[]).map(x=>x.collection_id);}});
 async function run(fn){if(busy)return;setBusy(true);setError('');try{await fn();await invalidateLibrary(cache,ownerId);}catch(e){setError(libraryOperationError(e));await invalidateLibrary(cache,ownerId);}finally{setBusy(false);}}
 async function change(action,folder,values={}){
 const args={p_action:action,p_id:folder?.id||crypto.randomUUID(),p_revision:folder?.revision||0,p_name:values.name||null,p_parent:values.parent||null};
 // Preserve the exact request until a successful response, including create IDs.
 const fingerprint=JSON.stringify({action,folder:folder?.id,name:values.name,parent:values.parent});
 if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,args:{...args,p_request:crypto.randomUUID()}};
 const result=await libraryRpc(supabase,'library_folder_change',attempt.current.args);attempt.current=null;setUndo(result.id);setEditing(null);
 }
 return <LibraryDialog title={target?'폴더에 추가':'폴더'} onClose={()=>!busy&&onClose()}>
 {collections.isError&&<p role="alert">폴더를 불러오지 못했어요. <button onClick={()=>collections.refetch()}>다시 시도</button></p>}
 <div className="shelf-collection-list">{folders.map(folder=><div className="shelf-collection-item" key={folder.id}>
 {target?<label><input type="checkbox" checked={memberships.data?.includes(folder.id)||false} disabled={busy||!memberships.isSuccess} onChange={e=>{const checked=e.target.checked;run(async()=>{const t=await currentLibraryTarget(supabase,target);const result=await runLibraryOperation(supabase,checked?'add':'remove',[t],checked?{folder:folder.id}:{source:folder.id});if(result.items.some(x=>x.status!=='success'))throw new Error('library_conflict');});}}/><span>{folder.path}</span></label>:<><button className="shelf-collection-name" onClick={()=>{onSelect?.(folder.id);onClose();}}>{folder.path}</button><button aria-label={`${folder.name} 폴더 설정`} disabled={busy} onClick={()=>setEditing({...folder,action:'rename',parent:folder.parent_id||''})}>···</button></>}
 {editing?.id===folder.id&&<form className="shelf-collection-edit" onSubmit={e=>{e.preventDefault();run(()=>change(editing.action,folder,{name:editing.name,parent:editing.parent}));}}>
 <select aria-label="폴더 동작" value={editing.action} onChange={e=>setEditing({...editing,action:e.target.value})}><option value="rename">이름 변경</option><option value="move">이동</option><option value="trash">폴더 삭제</option></select>
 {editing.action==='rename'&&<input aria-label="폴더 이름" maxLength={80} value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/>}
 {editing.action==='move'&&<select aria-label="상위 폴더" value={editing.parent} onChange={e=>setEditing({...editing,parent:e.target.value})}><option value="">내 서재</option>{folders.filter(f=>f.id!==folder.id).map(f=><option key={f.id} value={f.id}>{f.path}</option>)}</select>}
 {editing.action==='trash'&&<p>하위 폴더도 삭제됩니다. 자료는 남습니다.</p>}
 <button disabled={busy||!editing.name.trim()}>{editing.action==='trash'?'폴더 삭제':'저장'}</button><button type="button" onClick={()=>setEditing(null)}>취소</button></form>}
 </div>)}</div>
 {error&&<p role="alert">{error}</p>}
 {undo&&<div className="shelf-notice" role="status">저장됨 <button disabled={busy} onClick={()=>run(async()=>{await libraryRpc(supabase,'library_folder_undo',{p_request:undo});setUndo(null);})}>실행 취소</button></div>}
 <form className="shelf-create-collection" onSubmit={e=>{e.preventDefault();run(async()=>{await change('create',null,{name:name.trim(),parent});setName('');});}}>
 <label htmlFor="collection-name">새 폴더</label><div><input id="collection-name" maxLength={80} value={name} autoComplete="off" placeholder="이름" onChange={e=>setName(e.target.value)} disabled={busy}/><button disabled={busy||!name.trim()}>만들기</button></div>
 <label className="shelf-sr" htmlFor="folder-parent">상위 폴더</label><select id="folder-parent" value={parent} onChange={e=>setParent(e.target.value)}><option value="">내 서재</option>{folders.map(f=><option key={f.id} value={f.id}>{f.path}</option>)}</select>
 </form></LibraryDialog>;
}
