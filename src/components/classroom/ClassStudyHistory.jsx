'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {classHistoryReturn,classHistoryState} from '../../lib/classHistoryNavigation';
import {filterClassHistory} from '../../lib/classStudyHistory';
import {dayLabel} from '../../lib/classBoard';
import {chapterLabel} from '../../lib/classTeamQueries';

export default function ClassStudyHistory({notes,coverage=[],chapters,onOpen,onCopy,disabled=()=>false,remote=null,showEmpty=true}) {
  const params=useSearchParams(),initial=classHistoryState(params),restored=useRef(false);
  const [localSearch,setLocalSearch]=useState(initial.search);
  const [localExtras,setLocalExtras]=useState(initial.extras);
  const search=remote?.search??localSearch,extras=remote?.extras??localExtras;
  const setSearch=remote?.setSearch||setLocalSearch,setExtras=remote?.setExtras||setLocalExtras;
  const rows=useMemo(()=>filterClassHistory(notes,search,extras),[notes,search,extras]);
  const confirmed=coverage.filter(c=>c.material_ids?.length);
  const dates=[...new Set([...rows.map(n=>n.day),...(!search&&!extras?confirmed.map(c=>c.day):[])])].sort().reverse();
  const stateKey=`${initial.search}:${initial.extras}:${initial.scrollY}`;
  useEffect(()=>{restored.current=false;},[stateKey]);
  useEffect(()=>{
    if(restored.current||!showEmpty||remote?.restoring||!initial.scrollY)return;
    const restore=()=>{if(restored.current)return;if(document.documentElement.scrollHeight>=initial.scrollY+window.innerHeight-2){window.scrollTo({top:initial.scrollY,behavior:'instant'});restored.current=true;}};
    const cancel=()=>{restored.current=true;};
    const observer=new ResizeObserver(restore);observer.observe(document.body);
    const frame=requestAnimationFrame(restore);
    window.addEventListener('wheel',cancel,{passive:true});window.addEventListener('touchstart',cancel,{passive:true});window.addEventListener('keydown',cancel);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('wheel',cancel);window.removeEventListener('touchstart',cancel);window.removeEventListener('keydown',cancel);};
  },[stateKey,initial.scrollY,notes.length,showEmpty,remote?.restoring]);
  function open(entry){
    const returnTo=classHistoryReturn(window.location.pathname,{search,extras,shown:notes.length,day:entry.day||params.get('day'),scrollY:window.scrollY});
    window.history.replaceState(window.history.state,'',returnTo);
    onOpen({...entry,returnTo});
  }
  return <section className="class-study-history" aria-label="수업 돌아보기">
    <div className="class-study-history__filters">
      <label>지난 수업에서 찾기<input type="search" maxLength={200} value={search} onChange={e=>{restored.current=true;setSearch(e.target.value);}} placeholder="표현 · 뜻 · 날짜"/></label>
      <button aria-pressed={extras} onClick={()=>setExtras(v=>!v)}>교재 밖 표현만</button>
    </div>
    {showEmpty&&!dates.length&&<p role="status">{search||extras?'조건에 맞는 표현이 없어요.':'아직 수업 기록이 없어요. 교재는 먼저 읽어 볼 수 있습니다.'}</p>}
    {dates.map(day=>{
      const dayNotes=rows.filter(n=>n.day===day),read=confirmed.find(c=>c.day===day);
      return <article className="class-study-history__day" key={day}>
        <header><h2><time dateTime={day}>{dayLabel(day)}</time></h2></header>
        {read&&<div className="class-study-history__coverage"><small>선생님이 확인한 수업 범위</small>
          {read.material_ids.map(id=>{
            const chapter=chapters.find(c=>String(c.id)===String(id));
            return chapter?<button disabled={disabled(chapter)} key={id} onClick={()=>open({...chapter,day})}>{chapter.order}과 · {chapterLabel(chapter.title)} ↗</button>:<span key={id}>현재 공유되지 않는 과</span>;
          })}
        </div>}
        {dayNotes.map(note=><section key={note.id} aria-label={note.title}>
          <header><small>{dayNotes.length>1?note.title:'함께 배운 표현'}</small><div>
            <button disabled={disabled(note)} onClick={()=>open(note)}>노트 열기 →</button>
            {onCopy&&<button onClick={()=>onCopy(note)}>복사</button>}
          </div></header>
          {note.entries?.length?<ul>{note.entries.map(entry=>{
            const chapter=chapters.find(c=>String(c.id)===entry.source?.materialId);
            return <li key={entry.id}><div><strong>{entry.text}</strong>{entry.reading&&<small>{entry.reading}</small>}<p>{entry.meaning||'노트에서 문맥과 뜻 확인'}</p></div>
              {chapter?<div className="class-study-history__source"><small>{chapter.order}과에서 선택한 표현</small><button disabled={disabled(chapter)} onClick={()=>open({...chapter,day,source:entry.source,...(/^[a-zA-Z0-9_-]{1,100}:[0-9]{1,8}$/.test(entry.id)?{sourceNote:note.id,sourceEntry:entry.id}:{sourceToken:entry.source.tokenId,sourceQuote:entry.source.quote})})}>교재에서 보기 ↗</button></div>:<span>{entry.source?.kind==='manual'?'교재 밖 표현':'수업 표현'}</span>}
            </li>;
          })}</ul>:<p>이전 형식의 노트입니다. 노트를 열어 확인하세요.</p>}
        </section>)}
      </article>;
    })}
  </section>;
}
