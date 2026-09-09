'use client';
import {useEffect,useRef,useState} from 'react';
export function resolveSignalTransition(leftRose,rightRose) {
  return leftRose||rightRose?{tab:leftRose?'left':'right'}:null;
}
export default function ViewerBottomSheet({leftContent,rightContent,leftActive,rightActive,leftBadge,rightBadge,leftSignal=0,rightSignal=0,barNav=null,onClose,suppressed=false,onOpenChange}) {
  const [tab,setTab]=useState('right'),[open,setOpen]=useState(false),[expanded,setExpanded]=useState(false);
  const prev=useRef({left:false,right:false,leftSignal:0,rightSignal:0});
  const root=useRef(null),drag=useRef(null),suppressedRef=useRef(suppressed);suppressedRef.current=suppressed;
  useEffect(()=>{
    const old=prev.current;
    const transition=resolveSignalTransition((leftActive&&!old.left)||leftSignal>old.leftSignal,(rightActive&&!old.right)||rightSignal>old.rightSignal);
    prev.current={left:leftActive,right:rightActive,leftSignal,rightSignal};
    if(transition){setTab(transition.tab);setOpen(true);}
    if(!leftActive&&!rightActive)setOpen(false);
  },[leftActive,rightActive,leftSignal,rightSignal]);
  useEffect(()=>{onOpenChange?.(open);},[open,onOpenChange]);
  useEffect(()=>{
    if(!open||suppressedRef.current)return;
    const frame=requestAnimationFrame(()=>{
      const target=root.current?.querySelector(`[data-panel="${tab}"] .word-detail-card`)||root.current?.querySelector('.viewer-inspector__title');
      target?.focus({preventScroll:true});
    });
    return ()=>cancelAnimationFrame(frame);
  },[open,tab,rightSignal]);
  const close=()=>{setOpen(false);onClose?.();};
  if(!leftActive&&!rightActive&&!barNav)return null;
  const tabs=<div className="viewer-inspector__tabs" role="tablist" aria-label="읽기 보조 패널" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'right':e.key==='End'?'left':tab==='right'?'left':'right';setTab(next);setOpen(true);e.currentTarget.querySelector(next==='right'?'#inspector-word-tab':'#inspector-sentence-tab')?.focus();}}>
    <button role="tab" id="inspector-word-tab" aria-controls="inspector-word" aria-selected={tab==='right'} tabIndex={tab==='right'?0:-1} onClick={()=>{setTab('right');setOpen(true);}}>단어 {rightBadge&&<small>{rightBadge}</small>}</button>
    <button role="tab" id="inspector-sentence-tab" aria-controls="inspector-sentence" aria-selected={tab==='left'} tabIndex={tab==='left'?0:-1} onClick={()=>{setTab('left');setOpen(true);}}>문장 번역 {leftBadge&&<small>{leftBadge}</small>}</button>
  </div>;
  return <aside ref={root} className={`viewer-inspector${expanded?' is-expanded':''}${!open?' is-collapsed':''}`} hidden={suppressed} aria-label="읽기 보조 패널" onMouseUp={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}}>
    {open&&<header className="viewer-inspector__header" onTouchStart={e=>{drag.current=e.touches[0].clientY;}} onTouchEnd={e=>{if(drag.current==null)return;const delta=e.changedTouches[0].clientY-drag.current;drag.current=null;if(delta>70)close();else if(delta < -45)setExpanded(true);}} onTouchCancel={()=>{drag.current=null;}}>
      <b tabIndex={-1} className="viewer-inspector__title">{tab==='right'?'단어':'문장 번역'}</b><button className="viewer-inspector__expand" onClick={()=>setExpanded(v=>!v)} aria-label={expanded?'패널 줄이기':'패널 펼치기'}>{expanded?'줄이기':'펼치기'}</button><button onClick={close} aria-label="보조 패널 닫기">닫기 ×</button>
    </header>}
    <div hidden={!open} className="viewer-inspector__contents">
      <div role="tabpanel" id="inspector-word" data-panel="right" aria-labelledby="inspector-word-tab" hidden={tab!=='right'}>{rightContent}</div>
      <div role="tabpanel" id="inspector-sentence" data-panel="left" aria-labelledby="inspector-sentence-tab" hidden={tab!=='left'}>{leftContent}</div>
    </div>
    <footer>{tabs}{barNav&&<div className="viewer-inspector__nav" aria-label="문장 이동">{barNav}</div>}</footer>
  </aside>;
}
