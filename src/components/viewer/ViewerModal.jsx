'use client';
import {useEffect,useRef} from 'react';

/** Only activities/settings are modal; the reading inspector deliberately is not. */
export default function ViewerModal({title,onClose,children,className='',footer}) {
  const ref=useRef(null), close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const dialog=ref.current, trigger=document.activeElement;
    dialog.showModal();
    return ()=>{dialog.close();if(trigger?.isConnected && document.activeElement===document.body) trigger.focus({preventScroll:true});};
  },[]);
  return <dialog ref={ref} className={`reader-modal ${className}`} aria-label={title}
    onCancel={e=>{e.preventDefault();close.current();}} onKeyDown={e=>e.stopPropagation()}
    onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close.current();}}>
    <header className="reader-modal__header"><h2>{title}</h2><button type="button" onClick={onClose} aria-label={`${title} 닫기`}>닫기 <span aria-hidden="true">×</span></button></header>
    <div className="reader-modal__body">{children}</div>
    {footer&&<footer className="reader-modal__footer">{footer}</footer>}
  </dialog>;
}
