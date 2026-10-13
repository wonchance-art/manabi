'use client';
import {useEffect,useRef} from 'react';
import {t} from '../../lib/viewerMessages';

/** Only activities/settings are modal; the reading inspector deliberately is not. */
export default function ViewerModal({title,onClose,children,className='',footer,uiLocale='ko'}) {
  const ref=useRef(null), close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const dialog=ref.current, trigger=document.activeElement;
    dialog.showModal();
    return ()=>{dialog.close();if(trigger?.isConnected && document.activeElement===document.body) trigger.focus({preventScroll:true});};
  },[]);
  // 닫기 요청을 거절한 창(원문 수정의 「버리기 확인」·저장 중)에서 Esc를 거듭 누르면 크롬은 cancel을 막을 수 없게
  // 하고 창을 직접 닫는다(close watcher 남용 방지). 그러면 화면에서는 사라졌는데 React는 열린 채로 남아 다시 열 수도
  // 없다. 아직 마운트된 창이 브라우저 손에 닫혔으면(onClose) 다시 띄워 화면과 상태를 맞춘다 — 닫을지는 onClose 주인이 정한다.
  return <dialog ref={ref} className={`reader-modal ${className}`} aria-label={title} lang={uiLocale}
    onCancel={e=>{e.preventDefault();close.current();}} onKeyDown={e=>e.stopPropagation()}
    onClose={e=>{const dialog=e.currentTarget;if(dialog.isConnected&&!dialog.open)dialog.showModal();}}
    onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close.current();}}>
    <header className="reader-modal__header"><h2>{title}</h2><button type="button" onClick={onClose} aria-label={t(uiLocale,'{title} 닫기',{title})}>{t(uiLocale,'닫기')} <span aria-hidden="true">×</span></button></header>
    <div className="reader-modal__body">{children}</div>
    {footer&&<footer className="reader-modal__footer">{footer}</footer>}
  </dialog>;
}
