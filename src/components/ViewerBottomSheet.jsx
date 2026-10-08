'use client';
import {useEffect,useRef,useState} from 'react';
import {t} from '../lib/viewerMessages';
import ActionIcon from './ActionIcon';
import ViewerSheetMenu from './viewer/ViewerSheetMenu';
export function resolveSignalTransition(leftRose,rightRose,preserveWordTab=false,sentenceRequested=false) {
  return leftRose||rightRose||sentenceRequested?{tab:sentenceRequested?'left':preserveWordTab?'right':leftRose?'left':'right'}:null;
}
export default function ViewerBottomSheet({leftContent,rightContent,leftActive,rightActive,leftSignal=0,rightSignal=0,sentenceTabSignal=0,barNav=null,onSentenceTab=null,menu=null,collapsedActions=null,onClose,suppressed=false,onOpenChange,onPresentChange,preserveFocus=false,preserveWordTab=false,actions=null,className='',uiLocale='ko'}) {
  const [tab,setTab]=useState('right'),[open,setOpen]=useState(false),[expanded,setExpanded]=useState(false);
  const prev=useRef({left:false,right:false,leftSignal,rightSignal,sentenceTabSignal});
  const root=useRef(null),drag=useRef(null),suppressedRef=useRef(suppressed);suppressedRef.current=suppressed;
  useEffect(()=>{
    const old=prev.current;
    const transition=resolveSignalTransition((leftActive&&!old.left)||leftSignal>old.leftSignal,(rightActive&&!old.right)||rightSignal>old.rightSignal,preserveWordTab&&open&&tab==='right'&&!!rightActive,sentenceTabSignal>old.sentenceTabSignal);
    prev.current={left:leftActive,right:rightActive,leftSignal,rightSignal,sentenceTabSignal};
    if(transition){setTab(transition.tab);setOpen(true);}
    if(!leftActive&&!rightActive)setOpen(false);
  },[leftActive,rightActive,leftSignal,rightSignal,sentenceTabSignal,preserveWordTab,open,tab]);
  useEffect(()=>{onOpenChange?.(open);},[open,onOpenChange]);
  useEffect(()=>()=>onOpenChange?.(false),[onOpenChange]);
  // 패널이 바닥에 놓여 있는지(펼침·접힘 무관) — 접힌 머리줄과 다른 바닥 요소가 겹치지 않게 부모가 자리를 나눈다(AD-R2).
  const present=!!(leftActive||rightActive);
  useEffect(()=>{onPresentChange?.(present);},[present,onPresentChange]);
  useEffect(()=>()=>onPresentChange?.(false),[onPresentChange]);
  useEffect(()=>{
    if(!open||suppressedRef.current||preserveFocus)return;
    if(root.current?.querySelector('.viewer-inspector__tabs')?.contains(document.activeElement))return;
    const frame=requestAnimationFrame(()=>{
      // AD-R4 PR③: 탭 내용이 단어 카드가 아니면 data-sheet-focus 요소(「뜻 확인 필요」 목록 머리)가 첫 포커스를 받는다.
      const target=root.current?.querySelector(`[data-panel="${tab}"] .word-detail-card`)||root.current?.querySelector(`[data-panel="${tab}"] [data-sheet-focus]`)||root.current?.querySelector('[role=tab][aria-selected=true]');
      target?.focus({preventScroll:true});
    });
    return ()=>cancelAnimationFrame(frame);
  },[open,tab,rightSignal,preserveFocus]);
  const close=()=>{setOpen(false);onClose?.();};
  const localizedAria=label=>uiLocale==='ko'?{}:{'aria-label':t(uiLocale,label)};
  // AE-R1 Q1: 사용자가 [문장] 탭을 고르면 호출 쪽이 그 문장의 기존 번역 경로를 연다(신호로 바뀐 탭에는 부르지 않는다).
  const chooseTab=next=>{setTab(next);setOpen(true);if(next==='left')onSentenceTab?.();};
  // AE-R1 PR③: menu = 단어 탭 머리줄 ⋯(분석 고치기) {label, items}. 기본 null — PDF 뷰어·문장 탭에는 없다.
  // 보일 내용이 없으면 패널도 없다 — 문장 지정만 있을 때는 ViewerPage의 문장 이동 막대가 대신한다(VIEWER-R0 버그 4).
  if(!leftActive&&!rightActive)return null;
  const tabs=<div className="viewer-inspector__tabs" role="tablist" aria-label="읽기 보조 패널" {...localizedAria('읽기 보조 패널')} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'right':e.key==='End'?'left':tab==='right'?'left':'right';chooseTab(next);e.currentTarget.querySelector(next==='right'?'#inspector-word-tab':'#inspector-sentence-tab')?.focus();}}>
    <button role="tab" id="inspector-word-tab" aria-controls="inspector-word" aria-selected={tab==='right'} tabIndex={tab==='right'?0:-1} onClick={()=>chooseTab('right')} aria-label="단어" {...localizedAria('단어')}><span>{t(uiLocale,'단어')}</span></button>
    <button role="tab" id="inspector-sentence-tab" aria-controls="inspector-sentence" aria-selected={tab==='left'} tabIndex={tab==='left'?0:-1} onClick={()=>chooseTab('left')} aria-label="문장 번역" {...localizedAria('문장 번역')}><span>{t(uiLocale,'문장')}</span></button>
  </div>;
  return <aside ref={root} className={`viewer-inspector ${className}${expanded?' is-expanded':''}${!open?' is-collapsed':''}`} hidden={suppressed} lang={uiLocale} aria-label="읽기 보조 패널" {...localizedAria('읽기 보조 패널')} onMouseUp={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}}>
    <header className="viewer-inspector__header" onTouchStart={e=>{drag.current=e.target.closest('button')?null:e.touches[0].clientY;}} onTouchEnd={e=>{if(drag.current==null)return;const delta=e.changedTouches[0].clientY-drag.current;drag.current=null;if(delta>70)close();else if(delta < -45)setExpanded(true);}} onTouchCancel={()=>{drag.current=null;}}>
      {tabs}{barNav&&<div className="viewer-inspector__nav" aria-label="문장 이동" {...localizedAria('문장 이동')}>{barNav}</div>}{!open&&collapsedActions}{open&&tab==='right'&&menu?.items?.length>0&&<ViewerSheetMenu label={menu.label} items={menu.items}/>}{open&&<><button className="viewer-inspector__expand" onClick={()=>setExpanded(v=>!v)} aria-label={t(uiLocale,expanded?'패널 줄이기':'패널 펼치기')} title={t(uiLocale,expanded?'패널 줄이기':'패널 펼치기')} data-icon-action><ActionIcon name={expanded?'collapse':'expand'}/></button><button className="viewer-inspector__close" onClick={close} aria-label="보조 패널 닫기" {...localizedAria('보조 패널 닫기')} title={t(uiLocale,'보조 패널 닫기')} data-icon-action><ActionIcon name="close"/></button></>}
    </header>
    <div hidden={!open} className="viewer-inspector__contents">
      <div role="tabpanel" id="inspector-word" data-panel="right" aria-labelledby="inspector-word-tab" hidden={tab!=='right'}>{rightContent}</div>
      <div role="tabpanel" id="inspector-sentence" data-panel="left" aria-labelledby="inspector-sentence-tab" hidden={tab!=='left'}>{leftContent}</div>
    </div>
    {open&&actions&&<footer className="viewer-inspector__actions">{actions}</footer>}
  </aside>;
}
