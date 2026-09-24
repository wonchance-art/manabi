'use client';
import {useEffect,useRef,useState} from 'react';
import {exportToBlob} from '@excalidraw/excalidraw';
import {BOARD_PAGE_LIMIT} from '../../lib/teachingBoard';
import {boardPageSummary} from '../../lib/teachingBoardCard';
import {readCloudBoard} from '../../lib/teachingBoardCloudClient';
import {boardReuseKey,pageReuseSource} from '../../lib/teachingBoardReuse';

function PagePreview({page}) {
  const [url,setUrl]=useState(''),host=useRef(null);
  useEffect(()=>{
    let alive=true,objectUrl='',started=false;
    const observer=new IntersectionObserver(entries=>{if(started||!entries.some(e=>e.isIntersecting))return;started=true;observer.disconnect();
      const paper=getComputedStyle(host.current).getPropertyValue('--reader-paper').trim();
      exportToBlob({elements:page.elements.filter(el=>!el.isDeleted),files:null,appState:{exportBackground:true,viewBackgroundColor:paper},maxWidthOrHeight:420})
        .then(blob=>{if(alive){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}).catch(()=>{});
    });
    observer.observe(host.current);return()=>{alive=false;observer.disconnect();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[page]);
  // These thumbnails exist only as local Blob URLs; there is no remote image to optimize.
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="board-reuse-preview" ref={host}>{url?<img src={url} alt=""/>:<span aria-hidden="true">페이지 미리보기</span>}</span>;
}

export default function BoardReusePanel({rootId,sourceDay,day,pages,blocked,onCopy,onPick,onBack,onOpen,opening,actionError,onDenied}) {
  const [source,setSource]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState([]),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
  const alive=useRef(true),running=useRef(false),heading=useRef(null),denied=useRef(onDenied);denied.current=onDenied;
  useEffect(()=>{alive.current=true;heading.current?.focus();return()=>{alive.current=false;};},[]);
  useEffect(()=>{let current=true;const controller=new AbortController();setSource(null);setError('');setSelected([]);
    readCloudBoard(rootId,sourceDay,{signal:controller.signal}).then(value=>{if(!current)return;if(!value.document)throw new Error('저장된 페이지를 찾지 못했어요.');setSource(value);}).catch(e=>{if(current){if([401,403].includes(e.status))denied.current?.();else setError(e.message);}});return()=>{current=false;controller.abort();};
  },[rootId,sourceDay,attempt]);
  const copied=new Set(pages.map(p=>boardReuseKey(p.reusedFrom)).filter(Boolean));
  const available=source?.document.pages.filter(p=>!copied.has(boardReuseKey(pageReuseSource(source.row,p.id))))||[];
  const chosen=selected.filter(id=>available.some(p=>p.id===id)),room=BOARD_PAGE_LIMIT-pages.length;
  const copy=async()=>{if(running.current||!chosen.length)return;running.current=true;setBusy(true);setError('');try{await onCopy(source,chosen);}catch(e){if(alive.current)setError(e.message);}finally{running.current=false;if(alive.current)setBusy(false);}};
  return <div className="board-reuse-panel" aria-busy={busy}>
    <button className="board-reuse-back" disabled={busy} onClick={onBack}>← 날짜 목록</button>
    <h3 ref={heading} tabIndex={-1}>{sourceDay} 설명판</h3>
    <p className="board-menu-caption">선택한 페이지를 {day} 수업의 새 페이지로 가져옵니다.</p>
    {actionError&&<p role="alert">{actionError}</p>}
    {error&&<p role="alert">{error}{!source&&<button onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button>}</p>}
    {!source&&!error&&<p role="status">저장된 페이지를 불러오고 있어요…</p>}
    {source&&<>
      <div className="board-reuse-summary"><span>{chosen.length}개 선택 · {room}개 더 담기 가능</span><button disabled={busy||!available.length} onClick={()=>setSelected(chosen.length===available.length?[]:available.map(p=>p.id))}>{chosen.length===available.length?'선택 해제':'모두 선택'}</button></div>
      <div className="board-reuse-pages">{source.document.pages.map((page,index)=>{const summary=boardPageSummary(page),done=!available.some(p=>p.id===page.id);return <div key={page.id} className="board-reuse-page" data-selected={chosen.includes(page.id)} data-copied={done}>
        <label className="board-reuse-whole"><input type="checkbox" aria-label={`${index+1}번 페이지 가져오기`} disabled={busy||done} checked={chosen.includes(page.id)} onChange={event=>setSelected(ids=>event.target.checked?[...ids,page.id]:ids.filter(id=>id!==page.id))}/>
        <PagePreview page={page}/><span className="board-reuse-page-title"><b>{index+1}번 페이지</b><small>{done?'가져옴':summary.count?`${summary.words}개 표현 · ${summary.ink}개 필기`:'빈 페이지'}</small></span>
        {summary.text&&<span className="board-reuse-excerpt">{summary.text}</span>}</label>
        {onPick&&<button className="board-reuse-fragment" disabled={busy||!summary.count} onClick={event=>onPick({source,pageId:page.id,index,returnFocus:event.currentTarget})} aria-label={`${index+1}번 페이지 부분 고르기`}>부분 고르기</button>}
      </div>;})}</div>
      <div className="board-reuse-footer">{blocked&&<p role="status">저장 상태에서 다른 기기의 판을 확인한 뒤 가져와 주세요.</p>}{room===0?<p role="status">현재 수업의 20개 페이지가 모두 찼어요. 다른 수업 날짜에서 가져와 주세요.</p>:chosen.length>room&&<p role="status">선택을 {room}개 이하로 줄여 주세요.</p>}<button className="board-reuse-submit" disabled={busy||blocked||!chosen.length||chosen.length>room} onClick={copy}>{busy?'가져오는 중…':`현재 수업에 ${chosen.length||''}${chosen.length?'개 ':''}복사`}</button><small>학생에게 공유하려면 ‘수업에 남기기’를 눌러 주세요.</small></div>
    </>}
    {onOpen&&<button className="board-reuse-original" disabled={busy||opening} onClick={onOpen}>그날 수업 열기 ↗</button>}
  </div>;
}
