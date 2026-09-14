'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import TeachingWord,{WordDisplayControls,useWordAppearance} from './TeachingWord';
export default function TeachingPresentation({entry,lang,onClose,onRecord,recordState,originRef,fallbackRef,owner}) {
 const dialog=useRef(null),[display,setDisplay]=useState(null);
 const [base]=useWordAppearance(owner,lang);
 const shown=display||base;
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
   const restoreFocus=()=>{
    for(const target of [back,fallback]){
     if(!target?.isConnected||target.matches(':disabled')||target.closest('[hidden], [inert]'))continue;
     target.focus({preventScroll:true});if(document.activeElement===target)return true;
    }
    return false;
   };
   const restored=restoreFocus();
   window.scrollTo(position);requestAnimationFrame(()=>{
    // The reader removes the inspector's hidden state in its next effect.
    // Retry after that commit without stealing focus from a new user action.
    if(!restored&&document.activeElement===document.body)restoreFocus();
    window.scrollTo(position);
   });
  };
 },[onClose,originRef,fallbackRef]);
 return createPortal(<div className="teaching-presentation-host"><section className="teaching-presentation" ref={dialog} role="dialog" aria-modal="true" aria-label="학생에게 보여주는 설명" tabIndex={-1} onKeyDown={e=>{
  if(e.key==='Tab'){const buttons=[...e.currentTarget.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===e.currentTarget)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}><header><span>manabi · 함께 읽기</span><button onClick={onClose}>교재로 돌아가기 ×</button></header>
 <main><TeachingWord entry={entry} language={lang} display={shown} presentation/></main>
 <footer><WordDisplayControls language={lang} value={shown} onChange={setDisplay}/>{onRecord&&<button onClick={onRecord} disabled={!!recordState}>{recordState||'수업에 남기기'}</button>}<span>설명을 닫으면 읽던 위치로 돌아갑니다.</span></footer></section></div>,document.body);
}
