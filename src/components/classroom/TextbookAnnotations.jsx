'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {makeTextbookAnchor,resolveTextbookAnchor,sameTextbookAnchor} from '../../lib/textbookAnnotations';
import {useTextbookAnnotations} from '../../lib/useTextbookAnnotations';
import TeachingPresentation from './TeachingPresentation';
import './textbook-annotations.css';

export default function TextbookAnnotations({material,user,team,first,last,blocked,onClose,onPresenting,children}) {
 const id=String(material?.id||''),json=material?.processed_json;
 const enabled=!!id&&!!json?.sequence?.length&&!!(json.metadata?.book||json.metadata?.source_ref||json.metadata?.team);
 const [active,setActive]=useState(null),[editor,setEditor]=useState(null),[presentation,setPresentation]=useState(null);
 const closeEditor=useCallback(()=>setEditor(null),[]);
 const {query,data,rows,canEdit,pending,busy,message,save,resolveConflict}=useTextbookAnnotations({materialId:id,team,user,enabled,local:!!material?.__local,localAnnotations:material?.textbookAnnotations,onSaved:closeEditor});
 const anchor=useMemo(()=>makeTextbookAnchor(json,first,last||first),[json,first,last]);
 const seen=useRef(new Set());
 const closePresentation=useCallback(()=>setPresentation(null),[]);
 useEffect(()=>{onPresenting?.(!!presentation);return()=>onPresenting?.(false);},[presentation,onPresenting]);
 useEffect(()=>{if(anchor&&!editor&&!pending)setActive(anchor);},[anchor,editor,pending]);
 useEffect(()=>{
  if(blocked||editor||pending||first)return;
  const valid=rows.filter(r=>!r.archived).map(r=>({row:r,location:resolveTextbookAnchor(json,r.anchor)})).filter(r=>r.location).sort((a,b)=>a.location.start-b.location.start);
  const observer=new IntersectionObserver(entries=>{for(const e of entries){if(!e.isIntersecting)continue;const target=valid.find(v=>v.location.first===e.target.dataset.tid);if(target&&!seen.current.has(target.row.id)){seen.current.add(target.row.id);setActive(target.row.anchor);break;}}},{rootMargin:'-140px 0px -45% 0px',threshold:.6});
  valid.forEach(v=>{const el=document.querySelector(`[data-tid="${CSS.escape(v.location.first)}"]`);if(el)observer.observe(el);});
  return()=>observer.disconnect();
 },[rows,json,blocked,editor,pending,first]);
 const current=active===false?null:active||anchor,matching=rows.filter(r=>!r.archived&&sameTextbookAnchor(r.anchor,current));
 const hiddenCount=rows.filter(r=>!r.archived&&!resolveTextbookAnchor(json,r.anchor)).length;
 function submit(e){e.preventDefault();if(!editor?.body.trim()||busy||pending)return;save({operation:crypto.randomUUID(),annotation:{id:editor.id||crypto.randomUUID(),revision:editor.revision||0,anchor:editor.anchor,body:editor.body.trim(),archived:false}});}
 const close=()=>{if(!editor&&!pending){setActive(false);matching.forEach(r=>seen.current.add(r.id));}};
 const visible=!!editor||!!pending||matching.length>0;
 const content=enabled?<section className="textbook-notes" aria-label="교재 설명" onMouseUp={e=>e.stopPropagation()}>
  <header><b>교재 설명</b>{matching.length>0&&<small>{matching.length}</small>}{visible&&!editor&&!pending&&<button onClick={close}>접기</button>}{canEdit&&anchor&&!editor&&!pending&&<button onClick={()=>{setActive(anchor);setEditor({anchor,body:''});}}>설명 추가</button>}</header>
  {material?.__local?<small>받아 둔 교재의 주의점 · 수업 페이지에서 다시 받으면 최신 설명을 볼 수 있어요.</small>:query.isLoading?<p role="status">주의점 확인 중…</p>:query.error?<p role="status">{query.error.message} <button onClick={()=>query.refetch()}>다시 확인</button></p>:null}
  {matching.map(row=><article key={row.id}><small>{row.anchor.exact}</small><p>{row.body}</p><div><button onClick={()=>setPresentation({text:row.anchor.exact,meaning:row.body})}>크게 보여주기</button>{canEdit&&!editor&&!pending&&<button onClick={()=>setEditor(row)}>수정</button>}</div>{canEdit&&<details><summary>수정 이력</summary>{(data.history||[]).filter(h=>h.annotation_id===row.id).map(h=><p key={h.snapshot.revision}><time>{new Date(h.created_at).toLocaleDateString('ko-KR')}</time> · {h.snapshot.body}</p>)}</details>}</article>)}
  {editor&&<form onSubmit={submit}><label>이 부분의 설명 <small>{editor.anchor.exact}</small><textarea autoFocus aria-label="교재 설명 입력" value={editor.body} disabled={!!pending} maxLength={2000} rows={4} onChange={e=>setEditor(v=>({...v,body:e.target.value}))}/></label><footer><button disabled={busy||!!pending||!editor.body.trim()}>교재에 저장</button><button type="button" disabled={busy||!!pending} onClick={()=>setEditor(null)}>취소</button>{editor.id&&<button type="button" disabled={busy||!!pending} onClick={()=>save({operation:crypto.randomUUID(),annotation:{id:editor.id,revision:editor.revision,anchor:editor.anchor,body:editor.body,archived:true}})}>보관</button>}</footer></form>}
  {pending&&<div role="status"><p>{pending.conflict?'다른 수정과 겹쳤어요. 입력은 보관돼 있습니다.':'이 기기에 보관됨 · 서버 저장 확인 대기'}</p><pre>{pending.annotation.body}</pre>{pending.conflict?<button disabled={busy} onClick={()=>resolveConflict(setEditor)}>최신 내용 확인하고 다시 편집</button>:<button disabled={busy} onClick={()=>save(pending)}>저장 재시도</button>}</div>}
  {message&&<p role="status">{message}</p>}
  {canEdit&&rows.some(r=>r.archived)&&<details><summary>보관한 설명</summary>{rows.filter(r=>r.archived).map(r=><article key={r.id}><small>{r.anchor.exact}</small><p>{r.body}</p><button disabled={busy||!!pending} onClick={()=>save({operation:crypto.randomUUID(),annotation:{id:r.id,revision:r.revision,anchor:r.anchor,body:r.body,archived:false}})}>다시 표시</button></article>)}</details>}
  {hiddenCount>0&&<details><summary>원문 위치 확인이 필요한 설명 {hiddenCount}개</summary>{rows.filter(r=>!r.archived&&!resolveTextbookAnchor(json,r.anchor)).map(r=><article key={r.id}><small>{r.anchor.exact}</small><p>{r.body}</p>{canEdit&&anchor&&!editor&&!pending&&<button onClick={()=>setEditor({...r,anchor})}>선택한 위치에 연결</button>}</article>)}</details>}
  {canEdit&&current&&!matching.length&&!editor&&<p className="textbook-notes__hint">교재의 해당 위치에 함께 읽을 설명을 남깁니다.</p>}
 </section>:null;
 return <>{children(content,visible,()=>{close();onClose?.();})}{presentation&&<TeachingPresentation entry={presentation} lang={json?.metadata?.language} onClose={closePresentation}/>}</>;
}
