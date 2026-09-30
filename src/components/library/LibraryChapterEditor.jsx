'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {readComposerDraft,writeComposerDraft,removeComposerDraft} from '@/lib/composerDraft';
import {libraryRpc} from '@/lib/libraryOperations';
import {prepareChapterItems,splitChapterDraft,chapterError,validChapterOrder} from '@/lib/libraryBookChapters';
import {LibraryDialog} from './LibraryCollections';
import LibraryReaderLink from '@/components/web/LibraryReaderLink';

export default function LibraryChapterEditor({ownerId,bookKey,title,nextOrder,chapter=null,onClose,onSaved}) {
 const scope=`book-chapters:${bookKey}`;
 const [draft,setDraft]=useState({version:1,files:[],id:null,order:String(chapter?.order??nextOrder),title:'',text:'',parts:null,frozen:null});
 const [ready,setReady]=useState(!!chapter),[busy,setBusy]=useState(false),[failure,setFailure]=useState(null),[draftError,setDraftError]=useState(false),[lines,setLines]=useState('16');
 const queue=useRef(Promise.resolve()),pending=useRef(false),closing=useRef(false),orderInput=useRef(null),initialOrder=useRef(nextOrder);
 useEffect(()=>{
  if(chapter)return;
  let alive=true,release;
  async function acquire(lock){
   if(!alive)return;
   if(!lock){setFailure({message:'다른 창에서 이 책을 작성 중이에요.'});return;}
   try{const stored=await readComposerDraft(ownerId,scope);if(alive){setDraft(stored||{version:1,files:[],id:crypto.randomUUID(),order:String(initialOrder.current),title:'',text:'',parts:null,frozen:null});setReady(true);}}
   catch{if(alive)setFailure({message:'초안을 불러오지 못했어요. 다시 열어 주세요.'});}
   await new Promise(resolve=>{release=resolve;if(!alive)resolve();});
  }
  if(navigator.locks)navigator.locks.request(`manabi:${ownerId}:${scope}`,{ifAvailable:true},acquire).catch(()=>{if(alive)setFailure({message:'작성 중인 창을 확인해 주세요.'});});
  else setFailure({message:'이 브라우저에서는 안전한 초안 저장을 지원하지 않아요.'});
  return()=>{alive=false;release?.();};
 },[ownerId,scope,chapter]);
 function persist(value){
  if(chapter)return Promise.resolve();
  const write=queue.current.catch(()=>{}).then(()=>writeComposerDraft(ownerId,value,scope));queue.current=write;
  write.then(()=>setDraftError(false),()=>setDraftError(true));return write;
 }
 function update(patch){const next={...draft,...patch};setDraft(next);setFailure(null);void persist(next).catch(()=>{});}
 async function close(){if(pending.current||closing.current)return;closing.current=true;await queue.current.catch(()=>{});onClose();}
 async function save(e){
  e.preventDefault();if(pending.current||!ready)return;
  pending.current=true;setBusy(true);setFailure(null);
  let saved;
  try{
   if(chapter){
    if(!validChapterOrder(draft.order)){setFailure({message:'과 번호는 1~9999로 입력해 주세요.'});return;}
    saved=await libraryRpc(supabase,'library_book_set_order',{p_key:bookKey,p_id:chapter.id,p_order:Number(draft.order),p_expected:chapter.order});
   }else{
    let items;
    try{items=draft.frozen||prepareChapterItems(draft);}catch(error){setFailure({message:error.message});return;}
    const frozen={...draft,frozen:items};setDraft(frozen);await persist(frozen);
    const result=await libraryRpc(supabase,'library_book_add_chapters',{p_key:bookKey,p_request:draft.id,p_items:items});
    saved=result.items[0];
    await queue.current.catch(()=>{});await removeComposerDraft(ownerId,scope);
   }
  }catch(error){
   setFailure(chapterError(error));
   // PostgreSQL rejected the entire statement: keep the text but allow correction.
   if(['23505','22023','42501','40001'].includes(error.code)&&!chapter){const next={...draft,frozen:null};setDraft(next);void persist(next).catch(()=>{});}
  }finally{pending.current=false;setBusy(false);}
  if(saved)onSaved(saved.id);
 }
 function split(){try{const parts=splitChapterDraft(draft,lines);if(!parts.length||parts.length>50)throw new Error('한 번에 1~50과로 나눠 주세요.');update({parts});}catch(error){setFailure({message:error.message});}}
 const locked=!ready||busy||!!draft.frozen;
 return <LibraryDialog title={chapter?'과 번호 수정':'과 추가'} onClose={close}>
  <p className="shelf-chapter-book">{title}</p>
  <form className="shelf-chapter-form" onSubmit={save}>
   <fieldset disabled={locked}>
   {!draft.parts&&<label className="shelf-chapter-number">과<input ref={orderInput} aria-label="과 번호" type="number" min="1" max="9999" step="1" value={draft.order} onChange={e=>update({order:e.target.value})}/></label>}
   {!chapter&&<>
    {!draft.parts&&<><label>제목<input aria-label="과 제목" maxLength={200} value={draft.title} onChange={e=>update({title:e.target.value})}/></label><label>내용<textarea aria-label="과 내용" rows={9} maxLength={200000} value={draft.text} onChange={e=>update({text:e.target.value})}/></label>
    <details className="shelf-chapter-split"><summary>여러 과로 나누기</summary><div><label>과당 문장<input aria-label="과당 문장 수" type="number" min="1" max="100" value={lines} onChange={e=>setLines(e.target.value)}/></label><button type="button" disabled={!draft.text.trim()} onClick={split}>나누기</button></div></details></>}
    {draft.parts&&<><div className="shelf-chapter-parts">{draft.parts.map((part,index)=><div key={index}><input aria-label={`${index+1}번째 과 번호`} type="number" min="1" max="9999" value={part.order} onChange={e=>update({parts:draft.parts.map((item,i)=>i===index?{...item,order:e.target.value}:item)})}/><input aria-label={`${index+1}번째 과 제목`} placeholder="제목" maxLength={200} value={part.title} onChange={e=>update({parts:draft.parts.map((item,i)=>i===index?{...item,title:e.target.value}:item)})}/><p>{part.text}</p></div>)}</div><button type="button" onClick={()=>update({parts:null})}>내용 수정</button></>}
   </>}
   </fieldset>
   {draftError&&<p role="alert">이 기기에 초안을 보관하지 못했어요. 내용을 복사해 두세요.</p>}
   {failure&&<p role="alert">{failure.message}{failure.id&&<LibraryReaderLink href={`/viewer/${failure.id}`}> 열기</LibraryReaderLink>}</p>}
   <div className="shelf-dialog-actions"><button type="button" disabled={busy} onClick={close}>취소</button><button type="submit" className="manabi-button" disabled={!ready||busy}>{busy?'저장 중…':draft.frozen?'다시 확인':chapter?'저장':'추가'}</button></div>
  </form>
 </LibraryDialog>;
}
