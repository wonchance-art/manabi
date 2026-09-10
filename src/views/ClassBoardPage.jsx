'use client';
// This surface only reads remote data. Display controls remain local to this screen.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { getTeam,todayKey,dayLabel,BOARD_POLL_MS } from '../lib/classBoard';
import { fetchTeamRoot,fetchDayNote } from '../lib/classTeamQueries';
import { classroomEntries,classLanguage } from '../lib/classroomModel';
import { openClassChannel } from '../lib/classRealtime';
import { ClassroomShell,ClassroomState,ClassEntryDisplay } from '../components/classroom/ClassroomUI';
export default function ClassBoardPage(){
  const {team:key}=useParams();const search=useSearchParams();const {user,loading}=useAuth();
  const [day]=useState(()=>/^\d{4}-\d{2}-\d{2}$/.test(search.get('day')||'')?search.get('day'):todayKey());
  const root=useQuery({queryKey:['class-root',user?.id,key],queryFn:()=>fetchTeamRoot(user.id,key),enabled:!!user?.id,refetchInterval:BOARD_POLL_MS});
  if(loading||root.isLoading)return <ClassroomState title="함께 볼 수업을 불러오고 있어요."/>;
  if(root.error)return <ClassroomState title="수업을 불러오지 못했어요." retry={root.refetch}/>;
  if(!user||!root.data||root.data.owner_id!==user.id)return <ClassroomState title="선생님 계정으로 함께 보는 화면을 열어 주세요."><Link className="classroom-button" href={!user?`/auth?from=${encodeURIComponent(`/class/${key}/board?day=${day}`)}`:`/class/${key}`}>{user?'수업 홈':'로그인'}</Link></ClassroomState>;
  return <Board key={`${user.id}:${key}:${day}`} user={user} root={root.data} refreshRoot={root.refetch} day={day}/>;
}
function Board({user,root,refreshRoot,day}){
  const team=getTeam(root.processed_json.metadata);
  const note=useQuery({queryKey:['class-note',user.id,team.key,day],queryFn:()=>fetchDayNote(user.id,team.key,day),refetchInterval:BOARD_POLL_MS});
  const entries=useMemo(()=>classroomEntries(note.data),[note.data]);
  const [follow,setFollow]=useState(true),[selection,setSelection]=useState(null),[hidden,setHidden]=useState(false),[list,setList]=useState(false),[size,setSize]=useState('normal');
  const [connection,setConnection]=useState('connecting'),[online,setOnline]=useState(true),[notice,setNotice]=useState('');
  const frame=useRef(null);const presentedRevision=useRef(null);const revision=root.processed_json.metadata.classPresentation;
  const {refetch}=note;
  useEffect(()=>{
    const ch=openClassChannel(team.key,{onEntry:()=>{refetch();refreshRoot();},onStatus:setConnection});
    const net=()=>setOnline(navigator.onLine);net();window.addEventListener('online',net);window.addEventListener('offline',net);
    return()=>{ch.close();window.removeEventListener('online',net);window.removeEventListener('offline',net);};
  },[team.key,refetch,refreshRoot]);
  const latestId=entries.at(-1)?.id||null;
  useEffect(()=>{if(follow)setSelection(latestId);},[latestId,follow]);
  useEffect(()=>{if(presentedRevision.current===revision?.revision)return;presentedRevision.current=revision?.revision;if(follow&&revision?.day===day&&revision?.entryId)setSelection(revision.entryId);},[revision?.revision,revision?.day,revision?.entryId,day,follow]);
  const selected=entries.find(e=>e.id===selection)||entries.at(-1);
  const position=entries.findIndex(e=>e.id===selected?.id);
  function choose(entry){setFollow(false);setSelection(entry.id);}
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(frame.current?.requestFullscreen)await frame.current.requestFullscreen();else setNotice('이 브라우저에서는 전체 화면을 지원하지 않아요.');}catch{setNotice('전체 화면을 열지 못했어요.');}}
  return <ClassroomShell lang={team.lang} board><div ref={frame} className="classroom-board-frame" data-size={size}>
    <header className="classroom-board-header"><Link href={`/class/${team.key}/live?day=${day}`} className="classroom-back">← 수업 진행</Link><div><span className="classroom-eyebrow">manabi / class</span><strong>{team.name}</strong><span>{dayLabel(day)} · {classLanguage(team.lang).label}</span></div><button className="classroom-text-button" onClick={fullscreen}>전체 화면 ↗</button></header>
    <div className="classroom-board-toolbar"><div className="classroom-segment"><button aria-pressed={!list} onClick={()=>setList(false)}>한 표현</button><button aria-pressed={list} onClick={()=>setList(true)}>목록</button></div><button className="classroom-button classroom-button--quiet" aria-pressed={hidden} onClick={()=>setHidden(!hidden)}>{hidden?'뜻 보기':'뜻 가리기'}</button><label className="classroom-size-label">글자 크기<select value={size} onChange={e=>setSize(e.target.value)}><option value="normal">기본</option><option value="large">크게</option><option value="largest">더 크게</option></select></label></div>
    {note.error&&<div className="classroom-notice" role="alert">새 내용을 불러오지 못했어요. 마지막으로 받은 내용을 보여 드립니다. <button onClick={()=>note.refetch()}>다시 연결</button></div>}
    {notice&&<p role="status">{notice}</p>}
    {list?<ol className="classroom-board-list">{entries.map((e,i)=><li key={e.id}><button aria-pressed={e.id===selected?.id} onClick={()=>{choose(e);setList(false);}}><span>{String(i+1).padStart(2,'0')}</span><b lang={classLanguage(team.lang).code}>{e.text}</b><span>{hidden?'뜻 가림':e.primary||(e.analyzed?'대표 뜻 없음':'뜻 준비 중')}</span></button></li>)}</ol>:<div className="classroom-board-stage" aria-live="polite" aria-atomic="true"><ClassEntryDisplay entry={selected} lang={team.lang} hidden={hidden}/></div>}
    <footer className="classroom-board-footer"><div className="classroom-actions"><button className="classroom-square" aria-label="이전 표현" disabled={position<=0} onClick={()=>choose(entries[position-1])}>←</button><span>{entries.length?`${position+1} / ${entries.length}`:'입력 대기'}</span><button className="classroom-square" aria-label="다음 표현" disabled={position<0||position>=entries.length-1} onClick={()=>choose(entries[position+1])}>→</button></div><button className={`classroom-button ${follow?'classroom-button--quiet':''}`} aria-pressed={follow} onClick={()=>{setFollow(!follow);if(!follow)setSelection(entries.at(-1)?.id);}}>{follow?'최신 따라가는 중':'최신 따라가기'}</button><span className="classroom-status" role="status">{!online?'오프라인 · 마지막 수신 내용':note.error?'내용 갱신 지연':connection==='SUBSCRIBED'?'실시간 알림 수신 중':'주기적으로 새 내용 확인 중'}</span></footer>
  </div></ClassroomShell>;
}
