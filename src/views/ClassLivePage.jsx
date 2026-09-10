'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { getTeam,todayKey,dayLabel,patchTeamRoot } from '../lib/classBoard';
import { fetchTeamRoot,fetchBookChapters,chapterLabel } from '../lib/classTeamQueries';
import { classLanguage,classroomScope,classroomEntries,classViewerHref,classroomError,saveClassroomMetadata,classMeaningPatch,classroomPlainText } from '../lib/classroomModel';
import { readClassDraft,writeClassDraft,canDiscardClassOperation } from '../lib/classroomOutbox';
import { useClassroomSession } from '../lib/useClassroomSession';
import { ClassroomShell,ClassroomState,ClassEntryDisplay,ClassBack } from '../components/classroom/ClassroomUI';

export default function ClassLivePage() {
  const {team:key}=useParams(); const params=useSearchParams();
  const {user,loading}=useAuth();
  const [day]=useState(()=>/^\d{4}-\d{2}-\d{2}$/.test(params.get('day')||'')?params.get('day'):todayKey());
  const root=useQuery({queryKey:['class-root',user?.id,key],queryFn:()=>fetchTeamRoot(user.id,key),enabled:!!user?.id&&!!key});
  if(loading||root.isLoading) return <ClassroomState title="수업을 불러오고 있어요."/>;
  if(root.error) return <ClassroomState title="수업을 불러오지 못했어요." retry={root.refetch}/>;
  if(!user) return <ClassroomState title="선생님 계정으로 수업을 열어 주세요."><Link className="classroom-button" href={`/auth?from=${encodeURIComponent(`/class/${key}/live?day=${day}`)}`}>로그인</Link></ClassroomState>;
  if(!root.data||root.data.owner_id!==user.id) return <ClassroomState title="이 수업의 선생님만 진행할 수 있어요."><ClassBack team={key}/></ClassroomState>;
  return <LiveSession key={`${user.id}:${key}:${day}`} ownerId={user.id} root={root.data} day={day}/>;
}
function LiveSession({ownerId,root,day}) {
  const team=getTeam(root.processed_json.metadata); const client=useQueryClient();
  const session=useClassroomSession({ownerId,team:team.key,rootId:root.id,day});
  const {data:chapters=[]}=useQuery({queryKey:['class-book-chapters',ownerId,team.bookKey],queryFn:()=>fetchBookChapters(team.bookKey),enabled:!!team.bookKey});
  const entries=useMemo(()=>classroomEntries(session.note),[session.note]);
  const [text,setText]=useState(''); const [adding,setAdding]=useState(false); const [message,setMessage]=useState('');
  const [selected,setSelected]=useState(root.processed_json?.metadata?.classPresentation?.day===day?root.processed_json.metadata.classPresentation.entryId:null); const [editing,setEditing]=useState(null); const [meaning,setMeaning]=useState(''); const [saving,setSaving]=useState(false);
  const composition=useRef(false); const input=useRef(null);
  const draftScope=classroomScope(ownerId,team.key,day);
  const [draftReady,setDraftReady]=useState(false);
  useEffect(()=>{let alive=true;readClassDraft(draftScope).then(row=>{if(alive&&row?.text)setText(row.text);}).catch(error=>{if(alive)setMessage(classroomError(error));}).finally(()=>{if(alive)setDraftReady(true);});return()=>{alive=false;};},[draftScope]);
  function changeText(value){setText(value);void writeClassDraft(draftScope,value).catch(error=>setMessage(classroomError(error)));}
  const current=entries.find(e=>e.id===selected)||entries.at(-1);
  const queue=session.queue;
  async function add(event) {
    event?.preventDefault(); if(adding||composition.current||!text.trim())return;
    const original=text; setAdding(true); setMessage('');
    try {await session.add(original);setSelected(null);setText(value=>value===original?'':value);await writeClassDraft(draftScope,'');input.current?.focus();}
    catch(error){setMessage(classroomError(error));}finally{setAdding(false);}
  }
  async function present(entry) {
    setSelected(entry.id); setMessage('');
    try {
      const fresh=await fetchTeamRoot(ownerId,team.key);
      const record=await saveClassroomMetadata(supabase,fresh,{classPresentation:{day,entryId:entry.id,revision:crypto.randomUUID()}});
      client.setQueryData(['class-root',ownerId,team.key],record);
      session.notify();
    }catch(error){setMessage(classroomError(error));}
  }
  async function saveMeaning(event) {
    event.preventDefault(); if(!session.note||!editing)return;setSaving(true);setMessage('');
    try {const record=await saveClassroomMetadata(supabase,session.note,classMeaningPatch(session.note,editing,meaning));session.accept(record);setEditing(null);}
    catch(error){setMessage(classroomError(error));}finally{setSaving(false);}
  }
  async function changeChapter(event) {
    const chapterId=event.target.value;
    try {
      const fresh=await fetchTeamRoot(ownerId,team.key);
      const patched=patchTeamRoot(fresh.processed_json,{chapterId:chapterId||null});
      const record=await saveClassroomMetadata(supabase,fresh,patched.metadata);
      client.setQueryData(['class-root',ownerId,team.key],record);
      session.notify();
    }catch(error){setMessage(classroomError(error));}
  }
  async function copy() {
    try{await navigator.clipboard.writeText(classroomPlainText(session.note));setMessage('서버에 저장된 수업 노트를 복사했어요.');}
    catch{setMessage('복사하지 못했어요. 수업 노트를 열어 직접 복사해 주세요.');}
  }
  return <ClassroomShell lang={team.lang}>
    <header className="classroom-header classroom-header--live"><div><ClassBack team={team.key}/><span className="classroom-eyebrow">{dayLabel(day)} · {classLanguage(team.lang).label}</span><h1>{team.name}<span className="classroom-heading-note">수업 진행</span></h1></div>
      <Link className="classroom-button classroom-button--quiet" href={`/class/${team.key}/board?day=${day}`}>함께 보는 화면 ↗</Link></header>
    {chapters.length>0&&<div className="classroom-chapter"><label htmlFor="class-chapter">오늘 교재</label><select id="class-chapter" value={team.chapterId||''} onChange={changeChapter}><option value="">선택 안 함</option>{chapters.map(ch=><option value={String(ch.id)} key={ch.id}>{ch.order}. {chapterLabel(ch.title)}</option>)}</select>{team.chapterId&&<Link href={classViewerHref(team.chapterId,team.key,day)}>본문 열기 ↗</Link>}</div>}
    <div className="classroom-live-grid"><section className="classroom-workspace" aria-label="수업 입력">
      <form className="classroom-composer" onSubmit={add}>
        <label htmlFor="class-expression">지금 함께 공부할 표현</label>
        <textarea ref={input} id="class-expression" value={text} disabled={!draftReady||adding} maxLength={5000} rows={2} placeholder="단어·표현·문장을 입력하세요" onChange={e=>changeText(e.target.value)} onCompositionStart={()=>{composition.current=true;}} onCompositionEnd={()=>{composition.current=false;}}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&!composition.current&&e.keyCode!==229){e.preventDefault();void add();}}}/>
        <div className="classroom-composer-footer"><span>Enter 추가 · Shift + Enter 줄바꿈</span><button className="classroom-button" disabled={adding||!text.trim()}>{adding?'기기에 보관 중…':'추가 ↑'}</button></div>
      </form>
      <div className="classroom-status" role="status">{!session.online?'오프라인 · 입력은 이 기기에 보관됩니다':queue.length?`${queue.length}개 서버 저장 대기`:session.isLoading?'노트를 불러오는 중':session.note?'서버에 저장된 수업 노트':'첫 표현을 입력하면 오늘 노트가 만들어집니다'}{session.analysis.running&&' · 뜻 준비 중'}</div>
      {(message||session.storeError)&&<p className="classroom-notice" role="status">{message||session.storeError}</p>}
      {session.error&&<div className="classroom-notice" role="alert">기존 노트를 불러오지 못했어요. <button onClick={()=>session.refetch()}>다시 불러오기</button></div>}
      {session.analysis.error&&<div className="classroom-notice">원문은 저장됐지만 뜻을 준비하지 못했어요. <button onClick={session.reanalyze}>뜻 다시 찾기</button><details><summary>자세히</summary>{session.analysis.error}</details></div>}
      <ol className="classroom-entry-list">
        {[...queue].reverse().map(row=><li key={row.id} className="classroom-pending"><strong lang={classLanguage(team.lang).code}>{row.text}</strong><span>{row.status==='error'?row.error:'이 기기에 보관됨 · 서버 저장 대기'}</span>{row.status==='error'&&<button onClick={()=>session.retry(row.id).catch(e=>setMessage(classroomError(e)))}>저장 재시도</button>}{canDiscardClassOperation(row)&&<button onClick={()=>session.discard(row.id).catch(e=>setMessage(classroomError(e)))}>입력 취소</button>}</li>)}
        {[...entries].reverse().map((entry,i)=><li key={entry.id} className={`classroom-entry${current?.id===entry.id?' is-current':''}`}>
          <span className="classroom-entry-number">{String(entries.length-i).padStart(2,'0')}</span><div className="classroom-entry-content"><button className="classroom-entry-select" aria-pressed={current?.id===entry.id} onClick={()=>present(entry)} lang={classLanguage(team.lang).code}>{entry.text}</button>
          {entry.reading&&<p className="classroom-reading">{entry.reading}</p>}
          {editing?.id===entry.id?<form className="classroom-meaning-form" onSubmit={saveMeaning}><label htmlFor="class-meaning">대표 뜻</label><input id="class-meaning" autoFocus value={meaning} maxLength={500} onChange={e=>setMeaning(e.target.value)} placeholder="이 표현의 핵심 뜻을 적어 주세요"/><div className="classroom-actions"><button disabled={saving} className="classroom-button">{saving?'저장 중…':'뜻 저장'}</button><button type="button" className="classroom-button classroom-button--quiet" onClick={()=>setEditing(null)}>취소</button></div></form>
          :<button className={`classroom-meaning-edit${entry.primary?'':' is-empty'}`} onClick={()=>{setEditing(entry);setMeaning(entry.primary);}}>{entry.primary||'대표 뜻 적기'}<span aria-hidden="true"> ↗</span></button>}
          {entry.analyzed&&entry.tokens.length>1&&<details className="classroom-details"><summary>단어별 해설</summary>{entry.tokens.filter(t=>t.meaning).map((t,n)=><p key={n}><b>{t.text}</b> {t.meaning}</p>)}</details>}
          {(!entry.analyzed||entry.missingMeanings)&&!session.analysis.running&&<button className="classroom-text-button" onClick={session.reanalyze}>뜻 다시 찾기</button>}
          </div><span className="classroom-entry-marker" aria-hidden="true">{current?.id===entry.id?'↗':''}</span>
        </li>)}
      </ol>
      {!entries.length&&!queue.length&&!session.isLoading&&<div className="classroom-empty"><b>한 표현에서 시작하는 수업.</b><p>원문은 먼저 저장하고, 뜻은 이어서 준비할게요.</p></div>}
      {session.note&&<footer className="classroom-note-footer"><Link href={classViewerHref(session.note.id,team.key,day)}>수업 노트 읽기 →</Link><button onClick={copy}>노트 복사</button>{queue.length>0&&<small>대기 중인 입력은 노트에 아직 포함되지 않았어요.</small>}</footer>}
    </section><aside className="classroom-preview" aria-label="선택한 표현 미리보기"><span className="classroom-eyebrow">함께 보는 표현</span><ClassEntryDisplay entry={current} lang={team.lang}/><p className="classroom-preview-hint">항목을 누르면 함께 보는 화면에도 선택을 전달합니다.<br/>큰 화면에서 지난 항목을 보고 있다면 그대로 유지됩니다.</p></aside></div>
  </ClassroomShell>;
}
