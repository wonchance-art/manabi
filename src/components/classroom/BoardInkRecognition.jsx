'use client';
import {useEffect,useRef,useState} from 'react';
import {requestNote} from '../../lib/useStudyNote';
import {inkRows,editInkRow,inkValues} from '../../lib/teachingInk';
import {BoardIconButton} from './BoardIcon';
import {WordDisplayControls} from './TeachingWord';
import {annotatedLanguage} from '../../lib/teachingWordLayout';

export default function BoardInkRecognition({rootId,team,capture,isCurrent,onPlace,onClose,appearance,onAppearance}) {
  const root=useRef(null),request=useRef(null),alive=useRef(false),placing=useRef(false);
  const [collapsed,setCollapsed]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[rows,setRows]=useState(null);
  const [needsPage,setNeedsPage]=useState(false),[applying,setApplying]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    alive.current=true;const active=document.activeElement;
    root.current?.querySelector('button')?.focus({preventScroll:true});
    return()=>{alive.current=false;request.current?.abort();if(active?.isConnected)active.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{if(collapsed)root.current?.querySelector('button')?.focus({preventScroll:true});},[collapsed]);
  async function recognize(){
    if(request.current)return;
    const controller=new AbortController();request.current=controller;setBusy(true);setError('');
    const timeout=setTimeout(()=>controller.abort(),55000);
    try{
      if(!await isCurrent(capture))throw new Error('선택한 필기가 바뀌었어요. 닫은 뒤 다시 선택해 주세요.');
      if(controller.signal.aborted||!alive.current)return;
      const result=await requestNote('/api/classroom/recognize',{method:'POST',signal:controller.signal,body:JSON.stringify({
        rootId,teamKey:team.key,image:capture.image,fingerprint:capture.fingerprint,consent:'selected-ink-to-gemini',
      })});
      if(controller.signal.aborted||!alive.current)return;
      if(result.fingerprint!==capture.fingerprint||!await isCurrent(capture))throw new Error('선택한 필기가 바뀌었어요. 닫은 뒤 다시 선택해 주세요.');
      if(!result.expressions?.length){setError('읽을 수 있는 표현이 없어요. 영역을 줄이거나 ＋에서 직접 입력해 주세요.');return;}
      setRows(inkRows(result.expressions));
    }catch(cause){if(alive.current)setError(cause.name==='AbortError'?'인식 시간이 길어졌어요. 다시 시도해 주세요.':cause.message);}
    finally{clearTimeout(timeout);request.current=null;if(alive.current)setBusy(false);}
  }
  const edit=(index,patch)=>{setRows(previous=>previous.map(row=>row.index===index?editInkRow(row,patch):row));setNeedsPage(false);setError('');setMessage('');};
  const values=rows?inkValues(rows,team.lang):[];
  async function place(fresh=false){
    if(placing.current||!values.length)return;
    placing.current=true;setApplying(true);setError('');
    try{
      const result=await onPlace(values,capture,{fresh,panelWidth:root.current?.getBoundingClientRect().width||0});
      if(!alive.current)return;
      if(result.needsPage){setNeedsPage(true);setMessage('현재 화면에 공간이 부족해요. 원래 필기를 보존하고 새 판에 놓을 수 있어요.');return;}
      setRows(previous=>previous.map(row=>result.indices.includes(row.index)?{...row,placed:true,selected:false}:row));
      setCollapsed(true);setNeedsPage(false);setMessage(result.existing?'이미 놓은 표현을 선택했어요.':'판에 놓았어요. 학생용 기록은 요소 메뉴에서 수업에 남기기를 눌러 주세요.');
    }catch(cause){if(alive.current)setError(cause.message);}
    finally{placing.current=false;if(alive.current)setApplying(false);}
  }
  return <section className="board-ink-panel" data-collapsed={collapsed} ref={root} role="dialog" aria-label="필기에서 표현 가져오기" onKeyDown={event=>{
    event.stopPropagation();if(event.key==='Escape'){event.preventDefault();onClose();}
  }}>
    {collapsed?<div className="board-ink-collapsed"><button aria-label="인식 결과 다시 열기" onClick={()=>setCollapsed(false)}>판에 놓음 · 결과 열기</button><BoardIconButton icon="close" label="필기 인식 닫기" onClick={onClose}/></div>:<>
    <header><div><small>INK → WORDS</small><h2>필기에서 표현<span>.</span></h2></div><BoardIconButton icon="close" label={busy?'필기 인식 취소':'필기 인식 닫기'} onClick={onClose}/></header>
    <div className="board-ink-body">
      <details open={!rows} className="board-ink-preview"><summary>선택한 필기</summary>
        {/* Explicit local selection, raster only. No embedded scene or source. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={capture.image} alt="인식할 선택 영역의 필기"/>
      </details>
      {!rows?<p>선택한 부분만 <strong>Google Gemini</strong>로 인식합니다. 원래 필기는 그대로 남아요.</p>:<>
        <p className="board-ink-guide">표기와 뜻을 확인해 판에 놓으세요.</p>
        <div className="board-ink-results">{rows.map(row=><article key={row.index} data-placed={row.placed}>
          <div className="board-ink-row-heading"><label><input type="checkbox" checked={row.selected} disabled={row.placed||applying||!row.text.trim()||!row.meaning.trim()} onChange={event=>edit(row.index,{selected:event.target.checked})} aria-label={`${row.original} 놓기 선택`}/><span>{row.placed?'판에 놓음':row.uncertain?'표기·뜻 확인':'인식한 표현'}</span></label><small>원문 {row.original}</small></div>
          <fieldset disabled={row.placed||applying}>
            <div className="board-ink-fields"><label>표기<input value={row.text} maxLength={300} onChange={event=>edit(row.index,{text:event.target.value})}/></label><label>뜻<input value={row.meaning} maxLength={500} placeholder="설명할 뜻" onChange={event=>edit(row.index,{meaning:event.target.value})}/></label></div>
            {annotatedLanguage(team.lang)&&<label className="board-ink-reading">{team.lang==='Japanese'?'후리가나':'병음'}<input value={row.reading} maxLength={500} onChange={event=>edit(row.index,{reading:event.target.value})}/></label>}
            <div className="board-ink-choices" role="group" aria-label={`${row.original} 인식 후보`}>{row.choices.map((choice,i)=><button key={i} type="button" aria-pressed={row.text===choice.text&&row.meaning===choice.meaning} onClick={()=>edit(row.index,{text:choice.text,reading:choice.reading||row.reading,meaning:choice.meaning,selected:true})}><b>{choice.text}</b><span>{choice.meaning||'뜻 직접 입력'}</span></button>)}
              {team.lang==='Japanese'&&row.text!==row.original&&<button type="button" onClick={()=>edit(row.index,{text:row.original,reading:row.reading,selected:false})}>가나·원문 그대로</button>}
            </div>
          </fieldset>
        </article>)}</div>
        <details className="board-ink-display"><summary>판에 놓을 때 표시</summary><WordDisplayControls language={team.lang} value={appearance} onChange={onAppearance} appearance/></details>
      </>}
    </div>
    <footer>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
      {!rows?<button className="board-ink-primary" disabled={busy} onClick={recognize}>{busy?'선택한 필기를 읽는 중…':error?'다시 인식':'이 부분 인식하기'}</button>:<button className="board-ink-primary" disabled={!values.length||applying} onClick={()=>place(needsPage)}>{applying?'놓는 중…':needsPage?`새 판에 ${values.length}개 놓기`:`선택한 ${values.length}개 판에 놓기`}</button>}
      <small>{busy?'다른 부분에 필기를 계속해도 됩니다. 닫으면 결과 적용을 취소합니다.':rows?'수업 기록·개인 단어장에 자동 저장하지 않습니다.':'전체 판·교재는 전송하지 않습니다.'}</small>
    </footer></>}
  </section>;
}
