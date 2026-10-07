'use client';
/**
 * 팀 페이지 오너 뷰의 '교재 설명' 관리 — 목록·수정·보관/복원·이력·저장 대기 복구.
 * 새 설명(원문 위치 지정)은 원문을 선택할 수 있는 수업 화면에만 둔다.
 * 조회는 펼친 뒤 고른 과 1건만 한다. 네트워크는 교재 설명 API(useTextbookAnnotations)와
 * 과 본문 RLS 조회(fetchChapterText)뿐이고, 편집 가능 여부는 서버 canEdit이 정한다.
 */
import {useCallback,useMemo,useState} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {useTextbookAnnotations} from '../../lib/useTextbookAnnotations';
import {groupTextbookNotes,textbookSaveRequest} from '../../lib/textbookAnnotationSync';
import {fetchChapterText,chapterLabel} from '../../lib/classTeamQueries';
import {classWorkspaceHref} from '../../lib/classWorkspace';
import {todayKey} from '../../lib/classBoard';

export default function ClassTextbookNotes({user,teamKey,chapters,initialId}) {
 const [open,setOpen]=useState(false);
 const [chapterId,setChapterId]=useState(()=>String(initialId||chapters[0]?.id||''));
 if(!chapters.length)return null;
 const chapter=chapters.find(c=>String(c.id)===chapterId)||chapters[0];
 return <section className="class-textbook-notes" aria-labelledby="class-textbook-notes-title">
  <h2 id="class-textbook-notes-title"><button className="class-textbook-notes__toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>교재 설명<span>{open?'접기':'펼치기'}</span></button></h2>
  {open&&<>
   <label>과 선택<select value={String(chapter.id)} onChange={e=>setChapterId(e.target.value)}>{chapters.map(c=><option key={c.id} value={String(c.id)}>{chapterLabel(c.title)}</option>)}</select></label>
   <ChapterNotes key={`${user.id}:${teamKey}:${chapter.id}`} user={user} teamKey={teamKey} chapter={chapter}/>
  </>}
 </section>;
}

function NoteHistory({history,id}) {
 const rows=history.filter(h=>h.annotation_id===id);
 return <details><summary>수정 이력</summary>{rows.length?rows.map(h=><p key={h.snapshot.revision}><time>{new Date(h.created_at).toLocaleDateString('ko-KR')}</time> · {h.snapshot.body}</p>):<p>아직 수정 이력이 없어요.</p>}</details>;
}

export function ChapterNotes({user,teamKey,chapter}) {
 const [editor,setEditor]=useState(null);
 const closeEditor=useCallback(()=>setEditor(null),[]);
 const text=useQuery({queryKey:['class-chapter-text',user.id,String(chapter.id)],queryFn:()=>fetchChapterText(chapter.id),retry:false,staleTime:60000});
 const {query,data,rows,canEdit,history,pending,busy,message,save,retry,resolveConflict}=useTextbookAnnotations({materialId:chapter.id,team:teamKey,user,onSaved:closeEditor});
 const {placed,unplaced,archived}=useMemo(()=>groupTextbookNotes(text.data,rows),[text.data,rows]);
 const href=classWorkspaceHref(chapter.id,teamKey,todayKey());
 const locked=busy||!!pending;
 function submit(e){e.preventDefault();const body=editor?.body.trim();if(!body||locked)return;save(textbookSaveRequest(editor,{body,archived:false}));}
 const form=editor&&<form onSubmit={submit}>
  <label>이 부분의 설명<textarea autoFocus aria-label="교재 설명 입력" value={editor.body} disabled={!!pending} maxLength={2000} rows={4} onChange={e=>setEditor(v=>({...v,body:e.target.value}))}/></label>
  <footer><button className="classroom-button" disabled={locked||!editor.body.trim()}>교재에 저장</button><button type="button" className="classroom-text-button" disabled={locked} onClick={closeEditor}>취소</button></footer>
 </form>;
 const loading=query.isLoading||text.isLoading,failed=!loading&&!!(query.error||text.error),ready=!loading&&!failed;
 const editingPlaced=editor&&placed.some(p=>p.row.id===editor.id);
 // 조회가 실패해도 이 기기의 저장 대기분은 보여 준다 — 보관돼 있다는 사실이 복구의 출발점이다.
 return <div className="class-textbook-notes__body">
  {loading&&<p className="classroom-status" role="status">교재 설명을 불러오는 중…</p>}
  {failed&&<p className="classroom-notice" role="alert">교재 설명을 불러오지 못했어요. <button onClick={()=>{query.refetch();text.refetch();}}>다시 확인</button></p>}
  {ready&&!placed.length&&!unplaced.length&&<p className="class-textbook-notes__empty">이 과에는 아직 교재 설명이 없어요.</p>}
  {ready&&placed.map(({row})=><article key={row.id}>
   <q>{row.anchor.exact}</q>
   {editor?.id===row.id?form:<p>{row.body}</p>}
   {canEdit&&editor?.id!==row.id&&<div className="class-textbook-notes__actions"><button className="classroom-text-button" disabled={locked||!!editor} onClick={()=>setEditor(row)}>수정</button><button className="classroom-text-button" disabled={locked||!!editor} onClick={()=>save(textbookSaveRequest(row,{archived:true}))}>보관</button></div>}
   {canEdit&&<NoteHistory history={history} id={row.id}/>}
  </article>)}
  {ready&&editor&&!editingPlaced&&<article><q>{editor.anchor?.exact}</q>{form}</article>}
  {pending&&<div className="classroom-notice" role="status"><p>{pending.conflict?'다른 수정과 겹쳤어요. 입력은 보관돼 있습니다.':'이 기기에 보관됨 · 서버 저장 확인 대기'}</p><pre>{pending.annotation.body}</pre>{pending.conflict?<button disabled={busy} onClick={()=>resolveConflict(setEditor)}>최신 내용 확인하고 다시 편집</button>:<button disabled={busy} onClick={retry}>저장 재시도</button>}</div>}
  {message&&<p className="classroom-status" role="status">{message}</p>}
  {ready&&canEdit&&archived.length>0&&<details><summary>보관한 설명 {archived.length}개</summary>{archived.map(({row,location})=><article key={row.id}><q>{row.anchor.exact}</q><p>{row.body}</p>{location?<button className="classroom-text-button" disabled={locked||!!editor} onClick={()=>save(textbookSaveRequest(row,{archived:false}))}>다시 표시</button>:<small>원문 위치가 바뀌어 다시 표시할 수 없어요.</small>}</article>)}</details>}
  {ready&&unplaced.length>0&&<details><summary>원문 위치 확인이 필요한 설명 {unplaced.length}개</summary><p className="class-textbook-notes__hint">수업 화면에서 원문을 선택해 다시 연결해 주세요.</p>{unplaced.map(({row})=><article key={row.id}><q>{row.anchor.exact}</q><p>{row.body}</p></article>)}</details>}
  {ready&&(canEdit?<p className="class-textbook-notes__hint">새 설명은 수업 화면에서 원문을 선택해 추가해요.{href&&<> <Link href={href}>이 과 수업 화면 열기 →</Link></>}</p>
   :data&&<p className="class-textbook-notes__hint">이 교재의 설명은 읽기만 할 수 있어요.</p>)}
 </div>;
}
