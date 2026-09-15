'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Excalidraw,getCommonBounds,CaptureUpdateAction} from '@excalidraw/excalidraw';
import {BoardIconButton} from './BoardIcon';
import {presentationElements} from '../../lib/teachingWorkspace';
import {boardCameraForBounds} from '../../lib/teachingBoardViewport';

export default function BoardPresentation({elements,onClose,returnFocus,onRecord,recording,recordState}) {
  const dialog=useRef(null),surface=useRef(null),api=useRef(null);
  const [hun,setHun]=useState(null),[reading,setReading]=useState(null),[meaning,setMeaning]=useState(null),[laser,setLaser]=useState(true);
  const visibleReading=reading??elements.some(el=>el.customData?.manabiField==='reading'&&el.opacity!==0),visibleMeaning=meaning??elements.some(el=>el.customData?.manabiField==='meaning'&&el.opacity!==0);
  const shown=useMemo(()=>presentationElements(elements,{reading,meaning,hun}),[elements,reading,meaning,hun]);
  const fit=useCallback(()=>{
    const editor=api.current,rect=surface.current?.getBoundingClientRect();if(!editor||!rect)return;
    editor.refresh();
    const camera=boardCameraForBounds(getCommonBounds(elements),editor.getAppState(),rect,{top:68},true,2);
    if(camera)editor.updateScene({appState:camera,captureUpdate:CaptureUpdateAction.NEVER});
  },[elements]);
  useEffect(()=>{
    // Safari taps do not focus buttons. Keep the actual opener, not the
    // active element left over from a previous input or canvas interaction.
    const el=dialog.current,origin=returnFocus||document.activeElement;el.showModal();
    const observer=new ResizeObserver(fit);observer.observe(surface.current);
    return()=>{observer.disconnect();el.close();if(origin?.isConnected)origin.focus({preventScroll:true});};
  },[fit,returnFocus]);
  useEffect(()=>{api.current?.updateScene({elements:shown,captureUpdate:CaptureUpdateAction.NEVER});},[shown]);
  const connect=useCallback(editor=>{api.current=editor;requestAnimationFrame(()=>{if(api.current===editor){editor.setActiveTool({type:'laser'});fit();}});},[fit]);
  return <dialog ref={dialog} className="board-presentation" aria-label="학생에게 보여주기" onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>event.stopPropagation()}>
    <header><BoardIconButton icon="close" label="← 설명판으로" autoFocus onClick={onClose}/><span>보여주기</span><nav aria-label="보여주기 도구">
      <BoardIconButton icon="laser" label="레이저" aria-pressed={laser} onClick={()=>{setLaser(v=>!v);api.current?.setActiveTool({type:laser?'hand':'laser'});}}/>
      {elements.some(el=>el.customData?.manabiField==='reading')&&<BoardIconButton icon="reading" label={`읽기 ${visibleReading?'가리기':'보이기'}`} aria-pressed={!visibleReading} onClick={()=>setReading(!visibleReading)}/>}
      {elements.some(el=>el.customData?.manabiField==='hun')&&<BoardIconButton icon="hun" label="한자 훈음" aria-pressed={hun??elements.some(el=>el.customData?.manabiField==='hun'&&el.opacity!==0)} onClick={()=>setHun(!(hun??elements.some(el=>el.customData?.manabiField==='hun'&&el.opacity!==0)))}/>}
      {elements.some(el=>el.customData?.manabiField==='meaning')&&<BoardIconButton icon="meaning" label={`뜻 ${visibleMeaning?'가리기':'보이기'}`} aria-pressed={!visibleMeaning} onClick={()=>setMeaning(!visibleMeaning)}/>}
      {onRecord&&elements.some(el=>el.customData?.manabiExpression)&&<BoardIconButton icon="record" label={recordState||(recording?'저장 요청 중…':'수업에 남기기')} disabled={recording||!!recordState} onClick={onRecord}/>}
      <BoardIconButton icon="fit" label="화면에 맞추기" onClick={fit}/>
    </nav></header>
    <div ref={surface} className="board-presentation-paper"><Excalidraw excalidrawAPI={connect} initialData={{elements:shown,appState:{viewBackgroundColor:'transparent'}}} viewModeEnabled zenModeEnabled langCode="ko-KR" handleKeyboardGlobally={false} onLinkOpen={(_,event)=>event.preventDefault()} validateEmbeddable={false}/></div>
    <div className="teaching-board-accessible">{shown.filter(el=>el.type==='text'&&el.opacity!==0).map(el=><p key={el.id}>{el.text}</p>)}</div>
  </dialog>;
}
