'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {captureReadingAnchor,restoreReadingAnchor} from './readingViewport';

export function readerVisibleBounds(root) {
  const viewport=window.visualViewport;
  const bottom=(viewport?.height||window.innerHeight)+(viewport?.offsetTop||0);
  const toolbar=root?.closest('.viewer-layout')?.querySelector('.viewer-topbar');
  const top=Math.max(64,toolbar?toolbar.getBoundingClientRect().bottom+8:64);
  const panel=document.querySelector('.viewer-inspector');
  const r=panel?.getBoundingClientRect();
  return {top,bottom:r&&r.width>0&&getComputedStyle(panel).position==='fixed'?Math.min(bottom,r.top):bottom};
}
export function useReaderLayout(readerRef,revision) {
  const operation=useRef(null),[layoutVersion,setLayoutVersion]=useState(0);
  const cancel=useCallback(()=>{operation.current?.();operation.current=null;},[]);
  useEffect(()=>{
    const interrupt=e=>{if(e.target?.closest?.('.reader-modal'))return;cancel();};
    window.addEventListener('wheel',interrupt,{passive:true});window.addEventListener('pointerdown',interrupt);window.addEventListener('keydown',interrupt);
    return ()=>{cancel();window.removeEventListener('wheel',interrupt);window.removeEventListener('pointerdown',interrupt);window.removeEventListener('keydown',interrupt);};
  },[cancel]);
  useEffect(()=>{cancel();},[revision,cancel]);
  useEffect(()=>{
    const root=readerRef.current?.closest('.viewer-layout'),viewport=window.visualViewport;
    if(!root||!viewport)return;
    const update=()=>{
      // A mobile keyboard changes the visual viewport, not necessarily 100dvh.
      if(viewport.scale!==1)return;
      root.style.setProperty('--reader-visual-height',`${viewport.height}px`);
      const inset=Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop);
      root.style.setProperty('--reader-keyboard-inset',`${inset}px`);
      root.dataset.keyboardOpen=String(inset>100);
    };
    update();viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);
    return ()=>{viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);root.style.removeProperty('--reader-visual-height');root.style.removeProperty('--reader-keyboard-inset');delete root.dataset.keyboardOpen;};
  },[readerRef,revision]);
  const keepPosition=change=>{
    cancel();const root=readerRef.current, bounds=readerVisibleBounds(root);
    const anchor=captureReadingAnchor(root,bounds.top,bounds.bottom);
    let active=true,frame,releaseFrame,timeout;
    const restore=()=>{if(!active)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(active){
      if(root)root.dataset.layoutRestoring='true';
      restoreReadingAnchor(anchor,options=>window.scrollBy(options));
      cancelAnimationFrame(releaseFrame);releaseFrame=requestAnimationFrame(()=>{releaseFrame=requestAnimationFrame(()=>{if(root)delete root.dataset.layoutRestoring;});});
      setLayoutVersion(v=>v+1);
    }});};
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(restore):null;
    if(root)observer?.observe(root);
    operation.current=()=>{active=false;observer?.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(releaseFrame);if(root)delete root.dataset.layoutRestoring;clearTimeout(timeout);};
    if(root)root.dataset.layoutRestoring='true';
    change();restore();document.fonts?.ready.then(restore);
    timeout=setTimeout(cancel,15000);
  };
  return {keepPosition,layoutVersion};
}
