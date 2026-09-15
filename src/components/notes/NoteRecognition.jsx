'use client';
import {useEffect,useRef,useState} from 'react';
import {requestNote} from '@/lib/useStudyNote';
import {recognitionFingerprint} from '@/lib/noteRecognition';
import BoardIcon from '@/components/classroom/BoardIcon';

export default function NoteRecognition({noteId,capture,sync,current,onApply,onClose}) {
  const dialog=useRef(null),request=useRef(null),alive=useRef(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    alive.current=true;const active=document.activeElement,node=dialog.current;
    node.showModal();node.querySelector('button')?.focus({preventScroll:true});
    return()=>{alive.current=false;request.current?.abort();node.close();if(active?.isConnected)active.focus({preventScroll:true});};
  },[]);
  async function recognize(){
    if(request.current)return;
    const controller=new AbortController();request.current=controller;setBusy(true);setError('');
    const timeout=setTimeout(()=>controller.abort(),55000);
    try{
      const saved=await sync();
      if(controller.signal.aborted||!alive.current)return;
      const page=saved.document.board.pages.find(page=>page.id===capture.pageId);
      if(await recognitionFingerprint(page,capture.elementIds)!==capture.fingerprint)throw new Error('필기가 바뀌었어요. 닫은 뒤 다시 선택해 주세요.');
      const result=await requestNote(`/api/notes/${noteId}/recognize`,{method:'POST',signal:controller.signal,body:JSON.stringify({...capture,revision:saved.revision,consent:'selected-ink-to-gemini'})});
      if(!alive.current||controller.signal.aborted)return;
      const latest=current();
      if(latest.revision!==saved.revision||result.revision!==saved.revision||result.fingerprint!==capture.fingerprint||await recognitionFingerprint(latest.document.board.pages.find(page=>page.id===capture.pageId),capture.elementIds)!==capture.fingerprint)throw new Error('노트가 바뀌었어요. 닫은 뒤 최신 필기를 다시 선택해 주세요.');
      if(!result.expressions?.length){setError('읽을 수 있는 표현을 찾지 못했어요. 글자 몇 개씩 선택하거나 직접 입력해 주세요.');return;}
      onApply(result.expressions,capture);onClose();
    }catch(cause){if(alive.current)setError(cause.name==='AbortError'?'인식 시간이 길어졌어요. 영역을 줄여 다시 시도해 주세요.':cause.message);}
    finally{clearTimeout(timeout);request.current=null;if(alive.current)setBusy(false);}
  }
  return <dialog className="note-recognition" ref={dialog} aria-labelledby="note-recognition-title" onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{
    if(event.key!=='Tab')return;
    const items=[...event.currentTarget.querySelectorAll('button:not(:disabled)')].filter(el=>el.getClientRects().length);
    if(!items.length)return;
    event.preventDefault();const index=items.indexOf(document.activeElement);items[(index+(event.shiftKey?-1:1)+items.length)%items.length].focus();
  }}>
    <header><div><small>HANDWRITING → WORDS</small><h2 id="note-recognition-title">선택한 필기 읽기<span>.</span></h2></div><button className="note-icon" aria-label={busy?'필기 인식 취소':'필기 인식 닫기'} onClick={onClose}><BoardIcon name="close"/></button></header>
    <div className="note-recognition-body"><p>아래에 보이는 부분만 <strong>Google Gemini</strong>로 보냅니다.</p>
      {/* Local PNG generated from the explicitly selected elements. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={capture.image} alt="인식할 선택 영역의 필기"/>
      <p>손글씨는 그대로 남기고, 읽은 표현을 정리 목록에 추가합니다. 히라가나의 한자·뜻은 후보를 보고 직접 골라 주세요.</p>
      {error&&<p role="alert" className="note-row-error">{error}</p>}
    </div><footer><button className="manabi-button" disabled={busy} onClick={recognize}>{busy?'선택한 필기를 읽는 중…':error?'다시 인식':'이 부분 인식하기'}</button><small role="status">{busy?'닫으면 결과 적용을 취소합니다.':'전체 노트·다른 페이지·연결한 교재는 보내지 않습니다.'}</small></footer>
  </dialog>;
}
