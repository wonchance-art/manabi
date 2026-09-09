'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {captureReadingAnchor,restoreReadingAnchor,selectedTokenScrollDelta} from './readingViewport';

export function readerVisibleBounds(root) {
  const viewport=window.visualViewport;
  const bottom=(viewport?.height||window.innerHeight)+(viewport?.offsetTop||0);
  const toolbar=root?.closest('.viewer-layout')?.querySelector('.viewer-topbar');
  const top=Math.max(64,toolbar?toolbar.getBoundingClientRect().bottom+8:64);
  const panel=document.querySelector('.viewer-inspector');
  const r=panel?.getBoundingClientRect();
  return {top,bottom:r&&r.width>0&&getComputedStyle(panel).position==='fixed'?Math.min(bottom,r.top):bottom};
}

export function useSelectedTokenVisibility(readerRef, tokenRefs, tokenId, enabled, revision) {
  useEffect(() => {
    const root = readerRef.current, token = tokenRefs.current[tokenId];
    if (!enabled || !root || !token) return;
    const panel = root.closest('.viewer-layout')?.querySelector('.viewer-inspector');
    let frame, settleFrame, releaseFrame, interrupted = false;
    const reveal = () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(settleFrame);
      // Let modal teardown and the display-change anchor settle first.
      frame = requestAnimationFrame(() => { settleFrame = requestAnimationFrame(() => {
        if (interrupted || !token.isConnected || panel?.hidden) return;
        const delta = selectedTokenScrollDelta(token.getBoundingClientRect(), readerVisibleBounds(root));
        if (!Number.isFinite(delta) || Math.abs(delta) < 1) return;
        root.dataset.selectionRevealing = 'true';
        window.scrollBy({ top: delta, behavior: 'instant' });
        cancelAnimationFrame(releaseFrame);
        releaseFrame = requestAnimationFrame(() => { releaseFrame = requestAnimationFrame(() => { delete root.dataset.selectionRevealing; }); });
      }); });
    };
    // A user's own reading movement wins over a later font/viewport resize.
    const interrupt = e => { if (!e.target?.closest?.('.reader-modal,.viewer-inspector')) interrupted = true; };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(reveal) : null;
    observer?.observe(root); if (panel) observer?.observe(panel);
    const toolbar = root.closest('.viewer-layout')?.querySelector('.viewer-topbar');
    if (toolbar) observer?.observe(toolbar);
    window.addEventListener('resize', reveal);
    window.visualViewport?.addEventListener('resize', reveal);
    for (const event of ['wheel', 'touchmove', 'pointerdown', 'keydown']) window.addEventListener(event, interrupt, { passive: true });
    reveal();
    return () => {
      observer?.disconnect(); cancelAnimationFrame(frame); cancelAnimationFrame(settleFrame); cancelAnimationFrame(releaseFrame);
      delete root.dataset.selectionRevealing;
      window.removeEventListener('resize', reveal); window.visualViewport?.removeEventListener('resize', reveal);
      for (const event of ['wheel', 'touchmove', 'pointerdown', 'keydown']) window.removeEventListener(event, interrupt);
    };
  }, [readerRef, tokenRefs, tokenId, enabled, revision]);
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
