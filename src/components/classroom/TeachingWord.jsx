'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {teachingWordLayout,annotatedLanguage,normalizeWordAppearance,readWordAppearance,writeWordAppearance} from '../../lib/teachingWordLayout';
import './teaching-word.css';

export function WordDisplayControls({language,value,onChange,appearance=false}) {
  return <div className="teaching-word-controls" role="group" aria-label="표현 표시 설정">
    {annotatedLanguage(language)&&<><button type="button" aria-pressed={value.showReading!==false} onClick={()=>onChange({...value,showReading:value.showReading===false})}>{language==='Chinese'?'병음':'후리가나'}</button><button type="button" aria-pressed={value.showHun!==false} onClick={()=>onChange({...value,showHun:value.showHun===false})}>한자 훈음</button></>}
    <button type="button" aria-pressed={value.showMeaning!==false} onClick={()=>onChange({...value,showMeaning:value.showMeaning===false})}>뜻</button>
    {appearance&&<button type="button" aria-pressed={value.appearance==='card'} onClick={()=>onChange({...value,appearance:value.appearance==='card'?'plain':'card'})}>{value.appearance==='card'?'카드':'글자만'}</button>}
  </div>;
}

export function useWordAppearance(owner,language) {
  const [value,setValue]=useState(()=>readWordAppearance(owner,language));
  useEffect(()=>setValue(readWordAppearance(owner,language)),[owner,language]);
  const change=next=>{const value=normalizeWordAppearance(next);setValue(value);writeWordAppearance(owner,language,value);};
  return [value,change];
}

export default function TeachingWord({entry,language,display={},presentation=false,onChar}) {
  const root=useRef(null),[width,setWidth]=useState(320);
  useEffect(()=>{const node=root.current;if(!node)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(200,entry.contentRect.width)));observer.observe(node);return()=>observer.disconnect();},[]);
  const layout=useMemo(()=>teachingWordLayout({...entry,language,...display},{fontSize:presentation?Math.max(42,Math.min(120,width/10)):Math.max(30,Math.min(42,width/8)),maxWidth:width}),[entry,language,display,width,presentation]);
  const lang=language==='Japanese'?'ja':language==='Chinese'?'zh':language==='French'?'fr':'en';
  return <div ref={root} className={`teaching-word${presentation?' teaching-word--presentation':''}`}>
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height} style={{maxWidth:'100%',height:'auto'}} className="teaching-word-graphic" lang={lang} role="group" aria-label={`${entry.text}${layout.showReading&&entry.reading?`, ${entry.reading}`:''}${layout.showMeaning&&entry.meaning?`, ${entry.meaning}`:''}`}>
      {layout.parts.map((part,i)=><text key={i} x={part.x+(part.align==='center'?part.width/2:0)} y={part.y+part.fontSize} textAnchor={part.align==='center'?'middle':'start'} fontSize={part.fontSize} className={`teaching-word-part teaching-word-part--${part.role}`} visibility={part.visible===false?'hidden':undefined} aria-hidden={part.visible===false||undefined} lang={['hun','meaning'].includes(part.role)?'ko':lang} {...(onChar&&part.role==='text'&&/\p{Script=Han}/u.test(part.text)?{role:'button',tabIndex:0,'aria-label':`${part.text} 글자 정보`,onClick:()=>onChar(part.text,part.index),onKeyDown:e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();onChar(part.text,part.index);}}}:{})}>{part.text}</text>)}
    </svg>
  </div>;
}
