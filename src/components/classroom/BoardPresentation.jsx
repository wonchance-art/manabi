'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Excalidraw,getCommonBounds,CaptureUpdateAction} from '@excalidraw/excalidraw';
import {presentationElements} from '../../lib/teachingWorkspace';
import {boardCameraForBounds} from '../../lib/teachingBoardViewport';

export default function BoardPresentation({elements,onClose}) {
  const dialog=useRef(null),surface=useRef(null),api=useRef(null);
  const [reading,setReading]=useState(null),[meaning,setMeaning]=useState(null),[laser,setLaser]=useState(true);
  const visibleReading=reading??elements.some(el=>el.customData?.manabiField==='reading'&&el.opacity!==0),visibleMeaning=meaning??elements.some(el=>el.customData?.manabiField==='meaning'&&el.opacity!==0);
  const shown=useMemo(()=>presentationElements(elements,{reading,meaning}),[elements,reading,meaning]);
  const fit=useCallback(()=>{
    const editor=api.current,rect=surface.current?.getBoundingClientRect();if(!editor||!rect)return;
    editor.refresh();
    const camera=boardCameraForBounds(getCommonBounds(elements),editor.getAppState(),rect,{},true,2);
    if(camera)editor.updateScene({appState:camera,captureUpdate:CaptureUpdateAction.NEVER});
  },[elements]);
  useEffect(()=>{
    const el=dialog.current,origin=document.activeElement;el.showModal();
    const observer=new ResizeObserver(fit);observer.observe(surface.current);
    return()=>{observer.disconnect();el.close();if(origin?.isConnected)origin.focus({preventScroll:true});};
  },[fit]);
  useEffect(()=>{api.current?.updateScene({elements:shown,captureUpdate:CaptureUpdateAction.NEVER});},[shown]);
  const connect=useCallback(editor=>{api.current=editor;requestAnimationFrame(()=>{if(api.current===editor){editor.setActiveTool({type:'laser'});fit();}});},[fit]);
  return <dialog ref={dialog} className="board-presentation" aria-label="학생에게 보여주기" onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>event.stopPropagation()}>
    <header><button autoFocus onClick={onClose}>← 설명판으로</button><span>보여주기</span><nav aria-label="보여주기 도구">
      <button aria-pressed={laser} onClick={()=>{setLaser(v=>!v);api.current?.setActiveTool({type:laser?'hand':'laser'});}}>레이저</button>
      {elements.some(el=>el.customData?.manabiField==='reading')&&<button aria-pressed={!visibleReading} onClick={()=>setReading(!visibleReading)}>읽기 {visibleReading?'가리기':'보이기'}</button>}
      {elements.some(el=>el.customData?.manabiField==='meaning')&&<button aria-pressed={!visibleMeaning} onClick={()=>setMeaning(!visibleMeaning)}>뜻 {visibleMeaning?'가리기':'보이기'}</button>}
      <button onClick={fit}>화면에 맞추기</button>
    </nav></header>
    <div ref={surface} className="board-presentation-paper"><Excalidraw excalidrawAPI={connect} initialData={{elements:shown,appState:{viewBackgroundColor:'transparent'}}} viewModeEnabled zenModeEnabled langCode="ko-KR" handleKeyboardGlobally={false} onLinkOpen={(_,event)=>event.preventDefault()} validateEmbeddable={false}/></div>
    <div className="teaching-board-accessible">{shown.filter(el=>el.type==='text'&&el.opacity!==0).map(el=><p key={el.id}>{el.text}</p>)}</div>
  </dialog>;
}
