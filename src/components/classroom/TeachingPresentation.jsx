'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
export default function TeachingPresentation({entry,lang,onClose,onRecord,recordState,originRef,fallbackRef}) {
 const dialog=useRef(null),[hideMeaning,setHideMeaning]=useState(false);
 useEffect(()=>{
  const back=originRef?.current||document.activeElement,old=document.body.style.overflow,position={top:window.scrollY,left:window.scrollX,behavior:'instant'};document.body.style.overflow='hidden';
  const fallback=fallbackRef?.current;
  const reader=back?.closest?.('.viewer-layout');
  if(reader){const styles=getComputedStyle(reader);for(const [dest,source] of Object.entries({'--bg-primary':'--reader-paper','--bg-secondary':'--reader-surface','--text-primary':'--reader-ink','--text-secondary':'--reader-muted','--text-muted':'--reader-muted','--border':'--reader-line','--accent':'--reader-accent'})){dialog.current.parentElement.style.setProperty(dest,styles.getPropertyValue(source));}}
  const siblings=[...document.body.children].filter(el=>el!==dialog.current?.parentElement);
  const values=siblings.map(el=>[el,el.inert]);siblings.forEach(el=>{el.inert=true;});dialog.current?.focus({preventScroll:true});
  const hold=e=>{if(e.key==='Escape'){e.stopImmediatePropagation();onClose();}else if(e.key!=='Tab')e.stopPropagation();};
  // Capture at the window prevents the reader's document-level grading shortcuts.
  window.addEventListener('keydown',hold,true);
  return()=>{
   document.body.style.overflow=old;values.forEach(([el,value])=>{el.inert=value;});window.removeEventListener('keydown',hold,true);
   // Recording disables its trigger. Keep focus in the same expression's
   // controls instead of dropping keyboard users back to the document body.
   for(const target of [back,fallback]){
    if(!target?.isConnected||target.matches(':disabled')||target.closest('[hidden], [inert]'))continue;
    target.focus({preventScroll:true});if(document.activeElement===target)break;
   }
   window.scrollTo(position);requestAnimationFrame(()=>window.scrollTo(position));
  };
 },[onClose,originRef,fallbackRef]);
 return createPortal(<div className="teaching-presentation-host"><section className="teaching-presentation" ref={dialog} role="dialog" aria-modal="true" aria-label="학생에게 보여주는 설명" tabIndex={-1} onKeyDown={e=>{
  if(e.key==='Tab'){const buttons=[...e.currentTarget.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===e.currentTarget)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}><header><span>manabi · 함께 읽기</span><button onClick={onClose}>교재로 돌아가기 ×</button></header>
 <main lang={lang==='Chinese'?'zh':lang==='Japanese'?'ja':undefined}>{entry.reading&&<p className="teaching-presentation__reading">{entry.reading}</p>}<h2>{entry.text}</h2><p className="teaching-presentation__meaning" lang="ko">{hideMeaning?'뜻을 떠올려 보세요.':entry.meaning||'뜻을 입력하면 여기에 함께 표시됩니다.'}</p></main>
 <footer><button aria-pressed={hideMeaning} onClick={()=>setHideMeaning(v=>!v)}>{hideMeaning?'뜻 보이기':'뜻 가리기'}</button>{onRecord&&<button onClick={onRecord} disabled={!!recordState}>{recordState||'오늘 표현에 추가'}</button>}<span>설명을 닫으면 읽던 위치로 돌아갑니다.</span></footer></section></div>,document.body);
}
