'use client';
import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabase';
import {currentLibraryTarget,runLibraryOperation,invalidateLibrary,libraryOperationError} from '@/lib/libraryOperations';
import {lazyPanel} from '@/lib/lazyPanel';
import {onIdle} from '@/lib/viewerHanjaPanel';
import {libraryToggleOp,queuedPressStep} from '@/lib/pendingPress';
import './library.css';
// Whole-source organization remains separate from expression saving and FSRS.
// 폴더 창은 「폴더에 추가」를 눌러야 열린다 — 뷰어 · 책 첫 로드에서 빼고(VIEWER-JS-001), 버튼이 보이면 유휴 시간에 받아 둔다(끊긴 채 처음 눌러도 오류 화면 0).
const LibraryCollections=lazyPanel(()=>import('./LibraryCollections'));
// pendingAccount = 서버가 세션 쿠키로 읽은 계정(뷰어 서버 그림 · VIEWER-MEMBER-SSR-001) — 계정 확인 전에도 버튼을 제자리에 그린다(흐리게).
// 확인 전 · 담김 상태를 받기 전의 누름은 버리지 않고 「담기」로 기다렸다가 확인되면 한 번 한다(이미 담겼으면 그대로 · 휴지통이면 복원).
export default function LibrarySaveButton({material=null,edition=null,bookTitle='일본어 N5',pendingAccount=null}){
 const {user}=useAuth(),cache=useQueryClient();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [queued,setQueued]=useState(null); // 기다리는 누름의 계정 — 확인된 계정이 다르면 버린다
 const account=user?.id??pendingAccount;
 const publicMaterial=!!material&&material.visibility==='public'&&material.owner_id!==account;
 const target=edition?{target_kind:'edition',target_id:edition,title:bookTitle}:{target_kind:'material',target_id:String(material?.id),title:material?.title};
 const bookmark=useQuery({queryKey:['library-bookmark',user?.id,target.target_kind,target.target_id],enabled:!!user&&(publicMaterial||!!edition),queryFn:async()=>{
  const state=await currentLibraryTarget(supabase,target);
  if(state.revision)return {...state,saved:state.state==='active'};
  const query=edition?supabase.from('library_collection_items').select('collection_id').eq('owner_id',user.id).eq('target_kind','edition').eq('target_id',edition).limit(1):supabase.from('library_bookmarks').select('material_id').eq('owner_id',user.id).eq('material_id',material.id);
  const {data,error}=await query;if(error)throw error;return {...state,saved:!!data?.length};
 }});
 const folderShown=bookmark.data?.state==='active';
 useEffect(()=>folderShown?onIdle(()=>{LibraryCollections.preload().catch(()=>{});}):undefined,[folderShown]);
 const ready=!!user&&bookmark.isSuccess;
 // intent 'save' = 확인 전에 누른 「서재에 담기」 — 확인해 보니 이미 담겼으면 그대로 둔다(누른 뜻과 반대로 빼지 않는다, lib/pendingPress).
 async function toggle(intent=null){if(busy)return;const row=bookmark.data,op=libraryToggleOp(row,intent);if(!op)return;setBusy(true);setError('');try{
  const result=await runLibraryOperation(supabase,op,[row]);
  if(result.items.some(x=>x.status!=='success'))throw new Error('library_conflict');await invalidateLibrary(cache,user.id);
 }catch(e){setError(libraryOperationError(e));await bookmark.refetch();}finally{setBusy(false);}}
 // 기다리던 누름 — 계정 · 담김 상태가 확인되면 한 번. 다른 계정으로 확인되면 버린다(남의 누름을 대신하지 않는다).
 useEffect(()=>{
  const step=queuedPressStep({queued,account:user?.id,ready,busy});
  if(step==='drop')setQueued(null);
  else if(step==='run'){setQueued(null);toggle('save');}
 },[queued,user,ready,busy]); // eslint-disable-line react-hooks/exhaustive-deps -- toggle은 렌더마다 새로 만든다(같은 bookmark.data를 읽는다)
 if((!user&&!pendingAccount)||(!publicMaterial&&!edition))return null;
 const press=()=>{if(ready)toggle();else if(!busy&&!bookmark.isError)setQueued(account);};
 return <div className="library-save-control"><button onClick={press} disabled={busy} data-pending={ready?undefined:''} aria-busy={queued?true:undefined} aria-pressed={!!bookmark.data?.saved}>{busy?'저장 중…':bookmark.data?.state==='trashed'?'복원해 담기':bookmark.data?.saved?'서재에 담김 ✓':'서재에 담기'}</button>{bookmark.data?.state==='active'&&<button onClick={()=>setOpen(true)}>폴더에 추가</button>}{bookmark.isError&&<button onClick={()=>bookmark.refetch()}>다시 시도</button>}{error&&<p role="alert">{error}</p>}{open&&<LibraryCollections ownerId={user.id} target={target} onClose={()=>setOpen(false)}/>}</div>;
}
