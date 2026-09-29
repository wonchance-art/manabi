'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {getCommonBounds} from '@excalidraw/excalidraw';
import {BoardIconButton} from './BoardIcon';
import BoardFragmentSurface from './BoardFragmentSurface';
import {fragmentUnits,fragmentSelection} from '../../lib/teachingBoardFragment';
import {expressionOf} from '../../lib/teachingBoard';

export default function BoardFragmentPicker({request,blocked,onCopy,onLocate,onRefresh,onClose}) {
  const {source,pageId,index,day,returnFocus}=request, page=source.document.pages.find(p=>p.id===pageId);
  const dialog=useRef(null),alive=useRef(true),running=useRef(false);
  const [selection,setSelection]=useState([]),[history,setHistory]=useState([]),[mode,setMode]=useState('select'),[fit,setFit]=useState(0),[list,setList]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[duplicate,setDuplicate]=useState(null),[destination,setDestination]=useState(false);
  const elements=useMemo(()=>page.elements.filter(el=>!el.isDeleted),[page]);
  const units=useMemo(()=>{const map=new Map(elements.map(el=>[el.id,el]));return fragmentUnits(elements,items=>getCommonBounds(items,map));},[elements]);
  const chosen=useMemo(()=>fragmentSelection(elements,units,selection),[elements,units,selection]);
  const chosenIds=useMemo(()=>chosen.map(el=>el.id),[chosen]);
  const words=chosen.filter(expressionOf).length,ink=chosen.some(el=>el.type==='freedraw');
  useEffect(()=>{const el=dialog.current;alive.current=true;el.showModal();return()=>{alive.current=false;el.close();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});};},[returnFocus]);
  const select=next=>{setHistory(h=>[...h.slice(-29),selection]);setSelection(next);setDuplicate(null);setError('');};
  const toggle=id=>{
    const active=units.filter(unit=>unit.ids.every(value=>chosenIds.includes(value))).map(unit=>unit.id);
    if(!active.includes(id)){select([...active,id]);return;}
    const unit=units.find(value=>value.id===id);
    const removed=unit.kind==='frame'?new Set(fragmentSelection(elements,units,[id]).map(el=>el.id)):new Set(unit.ids);
    select(active.filter(key=>{
      const candidate=units.find(value=>value.id===key);
      if(candidate.ids.some(value=>removed.has(value)))return false;
      return candidate.kind!=='frame'||!fragmentSelection(elements,units,[key]).some(el=>removed.has(el.id));
    }));
  };
  const copy=async(fresh=false,force=false)=>{
    if(running.current||!chosen.length)return;running.current=true;setBusy(true);setError('');
    try{const result=await onCopy(request,chosen,{fresh,force,isActive:()=>alive.current});if(alive.current&&result?.duplicate)setDuplicate({...result,fresh});}
    catch(e){if(alive.current)setError(e.message);}finally{running.current=false;if(alive.current)setBusy(false);}
  };
  return <dialog ref={dialog} className="board-fragment-picker" aria-labelledby="board-fragment-title" onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>event.stopPropagation()}>
    <header><BoardIconButton icon="close" label="부분 선택 닫기" autoFocus onClick={onClose}/><div><h2 id="board-fragment-title">가져올 부분 고르기</h2><p>{source.row.day} · {index+1}번 판 → {day} 수업</p></div><BoardIconButton icon="record" label="목록으로 선택" aria-expanded={list} onClick={()=>setList(v=>!v)}/></header>
    <div className="board-fragment-workspace">
      <BoardFragmentSurface elements={elements} units={units} selectedIds={chosenIds} mode={mode} disabled={busy} onToggle={toggle} onArea={ids=>{if(ids.length)select([...new Set([...selection,...ids])]);}} fitVersion={fit}/>
      {list&&<aside className="board-fragment-list" aria-label="가져올 요소 목록">{units.map((unit,i)=><label key={unit.id}><input type="checkbox" disabled={busy} checked={unit.ids.every(id=>chosenIds.includes(id))} onChange={()=>toggle(unit.id)}/><span><span>{unit.kind==='expression'?'표현 · ':''}{unit.label}{['freedraw','arrow','frame','rectangle','ellipse','diamond','line'].includes(unit.kind)?` ${i+1}`:''}</span>{unit.detail&&<small>{unit.detail}</small>}</span></label>)}</aside>}
    </div>
    <footer>
      <div className="board-fragment-tools" role="group" aria-label="부분 선택 도구">
        <BoardIconButton icon="selection" label="영역 선택" aria-pressed={mode==='select'} onClick={()=>setMode('select')}/><BoardIconButton icon="hand" label="화면 이동" aria-pressed={mode==='hand'} onClick={()=>setMode('hand')}/><BoardIconButton icon="fit" label="전체 보기" onClick={()=>setFit(n=>n+1)}/>
        <BoardIconButton icon="undo" label="마지막 선택 되돌리기" disabled={busy||!history.length} onClick={()=>{setSelection(history.at(-1));setHistory(h=>h.slice(0,-1));setDuplicate(null);}}/>
        <button disabled={busy||!selection.length} onClick={()=>select([])}>선택 해제</button>
      </div>
      <p className="board-fragment-summary" role="status">{chosen.length?`${words?`표현 ${words}개`:'요소 선택'}${ink?' · 필기 포함':''}`:'표현을 누르거나 드래그해 필요한 부분을 고르세요.'}</p>
      {error&&<div className="board-fragment-message" role="alert"><p>{error}</p><button disabled={busy} onClick={async()=>{setBusy(true);try{await onRefresh(request);}catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setBusy(false);}}}>최신 판 다시 불러오기</button></div>}
      {blocked&&<p className="board-fragment-message" role="status">다른 기기의 판을 확인한 뒤 가져와 주세요.</p>}
      {duplicate&&<div className="board-fragment-message" role="status"><p>{duplicate.duplicate==='all'?'이미 가져온 내용이에요.':'일부 내용이 현재 수업에 이미 있어요.'}</p><button disabled={busy} onClick={()=>onLocate(duplicate.matches)}>가져온 내용 보기</button><button disabled={busy||blocked} onClick={()=>copy(duplicate.fresh,true)}>다시 복사</button></div>}
      <div className="board-fragment-actions"><button className="board-fragment-submit" disabled={busy||blocked||!chosen.length} onClick={()=>copy(false)}>{busy?'가져오는 중…':'현재 판에 놓기'}</button><button aria-label="놓을 위치 선택" aria-expanded={destination} disabled={busy} onClick={()=>setDestination(v=>!v)}>⌄</button>{destination&&<div className="board-fragment-destination"><button disabled={busy||blocked||!chosen.length} onClick={()=>copy(true)}>새 페이지에 놓기</button></div>}</div>
    </footer>
  </dialog>;
}
