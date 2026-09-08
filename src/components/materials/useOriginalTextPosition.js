'use client';
import {useEffect,useRef} from 'react';
import {restoreOriginalTextOffset,visibleOriginalTextOffset} from '@/lib/originalTextPosition';

export default function useOriginalTextPosition({element,source,base,enabled,onPosition,canRecord,restore}){
 const read=useRef(null),restoreOnce=useRef(null);
 read.current=()=>{if(!enabled||!element.current||!source||!canRecord())return;const offset=visibleOriginalTextOffset(element.current);if(offset!==null)onPosition(source,{...base,offset});};
 useEffect(()=>{
  let frame;
  const observe=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>read.current?.());};
  window.addEventListener('scroll',observe,{passive:true});
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',observe);};
 },[]);
 useEffect(()=>{
  if(!enabled||!restore||restoreOnce.current===restore.id||!element.current)return;
  restoreOnce.current=restore.id;
  const frame=requestAnimationFrame(()=>restoreOriginalTextOffset(element.current,restore.offset));
  return()=>cancelAnimationFrame(frame);
 },[enabled,restore,element]);
}
