'use client';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {useQuery} from '@tanstack/react-query';
import {fetchVocab} from '@/lib/vocabIO';
import {useAuth} from '@/lib/AuthContext';
import {BOARD_LANGUAGES} from '@/lib/teachingBoard';
import {newStudyNote, noteScope, collectNoteExpressions, mergeNoteCandidates} from '@/lib/studyNotes';
import useStudyNote, {requestNote} from '@/lib/useStudyNote';
import {textbookThemeStyle} from '@/lib/textbookTheme';
import {langNameKo} from '@/lib/constants';
import NoteVocabulary from './NoteVocabulary';
import '@/components/classroom/teaching-board.css';
import './study-notes.css';

const Canvas = dynamic(()=>import('@/components/classroom/TeachingBoardCanvas').then(module=>module.SharedBoardCanvas), {ssr:false,loading:()=> <p className="note-loading" role="status">노트를 펼치고 있어요…</p>});
const noop=()=>{};

export default function StudyNotePage({id}) {
  const {user,loading}=useAuth();
  if(loading)return <p className="manabi-page" role="status">내 노트를 확인하고 있어요…</p>;
  if(!user)return <section className="manabi-page note-gate"><h1>나만의 학습 노트<span>.</span></h1><p>듣고 적은 표현을 모아 내 단어장으로 이어가세요.</p><Link className="manabi-button" href={`/auth?from=${encodeURIComponent(`/notes/${id}`)}`}>로그인하고 노트 열기 ↗</Link></section>;
  return id==='new'?<CreateNote key={user.id}/>:<NoteEditor key={`${user.id}:${id}`} owner={user.id} id={id}/>;
}

function CreateNote() {
  const params=useSearchParams(),router=useRouter(),attempt=useRef(null);
  const [title,setTitle]=useState(''),[language,setLanguage]=useState(BOARD_LANGUAGES.includes(params.get('language'))?params.get('language'):'Japanese'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function create(event){
    event.preventDefault();if(busy)return;setBusy(true);setError('');
    try{
      if(!attempt.current){const document=newStudyNote(crypto.randomUUID(),crypto.randomUUID(),language);if(/^\d+$/.test(params.get('material')||''))document.origin={materialId:params.get('material'),title:''};attempt.current={title:title.trim()||'새 학습 노트',document};}
      const result=await requestNote('/api/notes',{method:'POST',body:JSON.stringify(attempt.current)});router.replace(`/notes/${result.id}`);
    }catch(cause){if([400,403,404,413].includes(cause.status))attempt.current=null;setError(cause.message);setBusy(false);}
  }
  return <main className="manabi-page note-create" style={textbookThemeStyle(language)}><Link className="manabi-link" href="/materials">← 내 서재</Link><small>PERSONAL NOTEBOOK</small><h1>듣고, 적고.<br/>내 것으로<span>.</span></h1><p>자유롭게 필기하고, 배운 표현은 한 번에 정리하세요.</p><form onSubmit={create}><label>노트 제목<input autoFocus maxLength={200} placeholder="오늘 배운 일본어" value={title} disabled={busy||!!attempt.current} onChange={event=>setTitle(event.target.value)}/></label><label>공부하는 언어<select value={language} disabled={busy||!!attempt.current} onChange={event=>setLanguage(event.target.value)}>{BOARD_LANGUAGES.map(lang=><option key={lang} value={lang}>{langNameKo(lang)}</option>)}</select></label>{params.get('material')&&<p>열어 둔 교재를 이 노트의 출처로 연결합니다.</p>}<button className="manabi-button" disabled={busy}>{busy?'노트 만드는 중…':error?'같은 노트 다시 저장':'노트 펼치기 ↗'}</button>{error&&<p role="alert">{error}</p>}</form><small>내 계정에만 보관됩니다. 수업 팀에 자동 공유되지 않아요.</small></main>;
}

function NoteEditor({owner,id}) {
  const store=useStudyNote(owner,id),actions=useRef(null),router=useRouter(),params=useSearchParams();
  const saved=useQuery({queryKey:['vocab',owner],queryFn:()=>fetchVocab(owner)});
  const vocabularyIndex=useMemo(()=>({byKey:new Map((saved.data||[]).map(row=>[row.id,row]))}),[saved.data]);
  const [review,setReview]=useState(false),[message,setMessage]=useState(''),[ready,setReady]=useState(false),[forking,setForking]=useState(false);
  const focused=useRef(false),root=useRef(null);
  const {current:readCurrent,change}=store;
  const saveBoard=useCallback(board=>{const current=readCurrent();if(current)change({document:{...current.document,board}});},[change,readCurrent]);
  function organize(){try{actions.current?.flush();const current=store.current();if(!current)return;const candidates=mergeNoteCandidates(current.document.candidates,collectNoteExpressions(current.document));store.change({document:{...current.document,candidates}});setReview(true);}catch(error){setMessage(error.message);}}
  const focus=useCallback(row=>{if(root.current?.clientWidth<900)setReview(false);if(actions.current?.focus(row.pageId,row.elementIds)===false)setMessage('원래 페이지가 지워졌어요. 정리 목록의 원문은 그대로 보관됩니다.');},[]);
  useEffect(()=>{
    const canvas=root.current?.querySelector('.personal-note-canvas'),panel=root.current?.querySelector('.note-review');
    if(!review||!canvas||!panel)return;
    const resize=()=>{canvas.inert=root.current.clientWidth<900;panel.setAttribute('role',canvas.inert?'dialog':'complementary');if(canvas.inert)panel.setAttribute('aria-modal','true');else panel.removeAttribute('aria-modal');};
    const keys=event=>{
      if(!canvas.inert||event.key!=='Tab')return;
      const items=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),summary,a[href]')].filter(el=>el.getClientRects().length);
      const first=items[0],last=items.at(-1);
      if(event.shiftKey&&(window.document.activeElement===first||window.document.activeElement===panel)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&window.document.activeElement===last){event.preventDefault();first?.focus();}
    };
    resize();panel.focus({preventScroll:true});panel.addEventListener('keydown',keys);
    const observer=new ResizeObserver(resize);observer.observe(root.current);
    return()=>{observer.disconnect();canvas.inert=false;panel.removeEventListener('keydown',keys);};
  },[review]);
  const closeReview=()=>{setReview(false);requestAnimationFrame(()=>root.current?.querySelector('.board-today-trigger button')?.focus({preventScroll:true}));};
  useEffect(()=>{
    if(!ready||focused.current||!store.value)return;
    const row=store.value.document.candidates.find(item=>item.id===params.get('candidate'));
    if(row){focused.current=true;setReview(true);focus(row);setMessage('이 표현을 적었던 노트입니다. 원문이 바뀌었다면 저장 당시 문장을 함께 확인하세요.');}
  },[ready,store.value,params,focus]);
  const team=useMemo(()=>({key:`personal-${id}`,name:store.value?.title||'내 학습 노트',lang:store.value?.document.language||'Japanese'}),[id,store.value?.title,store.value?.document.language]);
  function backup(){const current=store.current();if(!current)return;actions.current?.flush();const blob=new Blob([JSON.stringify({format:'manabi-personal-note',...store.current()})],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`manabi-note-${id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function fork(){if(forking)return;setForking(true);try{actions.current?.flush();const current=store.current();const document={...current.document,key:crypto.randomUUID()};const result=await requestNote('/api/notes',{method:'POST',body:JSON.stringify({title:`${current.title} · 내 초안`,document})});router.push(`/notes/${result.id}`);}catch(error){setMessage(error.message);}finally{setForking(false);}}
  const leave=async()=>{actions.current?.flush();try{await store.sync();router.push('/materials?view=notes');}catch(error){setMessage(`${error.message} 노트 정보에서 백업하거나 다시 저장해 주세요.`);}};
  if(!store.ready)return <section className="manabi-page note-gate"><p role={store.error?'alert':'status'}>{store.error||'개인 노트를 불러오고 있어요…'}</p><Link href="/materials">내 서재</Link><button onClick={()=>window.location.reload()}>다시 열기</button></section>;
  const value=store.value,saveLabel=store.error?'저장 확인 필요':store.saving?'저장 중…':'계정에 저장됨';
  return <main ref={root} className="personal-note" style={textbookThemeStyle(value.document.language)} data-review={review}>
    <div className="personal-note-canvas"><Canvas owner={owner} team={team} day="개인 노트" vocabularyIndex={vocabularyIndex} scope={noteScope(owner,id)} store={{ready:true,document:value.document.board,save:saveBoard,saving:store.saving,error:store.error}}
      actionsRef={actions} onLayout={noop} onClose={leave} onReady={setReady} personal={{onOrganize:organize,onLeave:leave,onBackup:backup,saveLabel}}
      navigation={<div className="note-information"><label>노트 제목<input aria-label="노트 제목" maxLength={200} value={value.title} onChange={event=>store.change({title:event.target.value})}/></label><p>나에게만 보이는 학습 노트</p><p role="status">{saveLabel}</p><button onClick={()=>{actions.current?.flush();store.sync().catch(error=>setMessage(error.message));}}>계정에 저장</button><button onClick={backup}>노트와 정리 목록 백업</button>{value.document.origin&&<Link href={`/viewer/${value.document.origin.materialId}`}>연결한 교재 · {value.document.origin.title} ↗</Link>}{store.conflict&&<button disabled={forking} onClick={fork}>{forking?'내 초안 보관 중…':'내 초안을 새 노트로 보관'}</button>}<p>펜은 자유 필기, 글자 도구는 텍스트 입력입니다. 일본어 입력창에서 기기의 필기 입력을 사용할 수 있어요.</p></div>}/></div>
    {review&&<NoteVocabulary saved={saved} noteId={id} note={value.document} sync={store.sync} onClose={closeReview} onFocus={focus} onChange={updater=>{const current=store.current();store.change({document:{...current.document,candidates:updater(current.document.candidates)}});}}/>}
    {message&&<div className="note-notice" role="status">{message}<button aria-label="안내 닫기" onClick={()=>setMessage('')}>×</button></div>}
  </main>;
}
