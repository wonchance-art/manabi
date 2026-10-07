'use client';
// 단어창 머리줄 ⋯ = 분석 고치기(VIEWER-V2-ROUNDS-001 §2 · AE-R1 설계서 §2·§10.2 「버튼 + 목록, aria-haspopup=menu,
// 항목 하나여도 메뉴로 — AD-R3가 묶기·나누기를 더한다」). WAI-ARIA 메뉴 버튼 패턴:
// - 버튼 44px(data-icon-action), Enter·Space·↓ = 열고 첫 항목, ↑ = 열고 끝 항목
// - 목록 안 ↑↓·Home·End 이동, Esc = 닫고 ⋯로 포커스 복귀(시트 닫기로 번지지 않게 전파 차단), Tab·바깥 누름 = 닫기
// - 항목을 고르면 닫고 ⋯로 포커스를 돌린 뒤 그 동작을 부른다.
import {useEffect,useId,useRef,useState} from 'react';
import ActionIcon from '../ActionIcon';

export default function ViewerSheetMenu({label,items}) {
  const [open,setOpen]=useState(false);
  const buttonRef=useRef(null),listRef=useRef(null),startAt=useRef('first');
  const id=useId();
  const entries=()=>[...(listRef.current?.querySelectorAll('[role="menuitem"]')||[])];
  useEffect(()=>{
    if(!open)return undefined;
    const list=entries();
    (startAt.current==='last'?list[list.length-1]:list[0])?.focus();
    const outside=e=>{if(!listRef.current?.contains(e.target)&&!buttonRef.current?.contains(e.target))setOpen(false);};
    document.addEventListener('pointerdown',outside,true);
    return ()=>document.removeEventListener('pointerdown',outside,true);
  },[open]);
  const show=at=>{startAt.current=at;setOpen(true);};
  const onButtonKey=e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();show(e.key==='ArrowUp'?'last':'first');}
  };
  const onMenuKey=e=>{
    const list=entries(),at=list.indexOf(document.activeElement);
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);buttonRef.current?.focus();return;}
    if(e.key==='Tab'){setOpen(false);return;}
    const next=e.key==='ArrowDown'?(at+1)%list.length:e.key==='ArrowUp'?(at-1+list.length)%list.length:e.key==='Home'?0:e.key==='End'?list.length-1:null;
    if(next==null||!list.length)return;
    e.preventDefault();list[next]?.focus();
  };
  const choose=item=>{setOpen(false);buttonRef.current?.focus();item.onSelect?.();};
  return <div className="viewer-sheet-menu">
    <button ref={buttonRef} type="button" className="viewer-sheet-menu__button" aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined}
      aria-label={label} title={label} data-icon-action onClick={()=>open?setOpen(false):show('first')} onKeyDown={onButtonKey}><ActionIcon name="more"/></button>
    {open&&<div ref={listRef} id={id} role="menu" aria-label={label} className="viewer-sheet-menu__list" onKeyDown={onMenuKey}>
      {items.map(item=><button key={item.id} type="button" role="menuitem" tabIndex={-1} className="viewer-sheet-menu__item" onClick={()=>choose(item)}>{item.label}</button>)}
    </div>}
  </div>;
}
