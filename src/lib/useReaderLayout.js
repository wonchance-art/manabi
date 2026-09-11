'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {captureReadingAnchor,restoreReadingAnchor,selectedTokenScrollDelta} from './readingViewport';

export function readerVisibleBounds(root) {
  const viewport=window.visualViewport;
  const bottom=(viewport?.height||window.innerHeight)+(viewport?.offsetTop||0);
  const toolbar=root?.closest('.viewer-layout')?.querySelector('.viewer-topbar');
  const top=Math.max(64,viewport?.offsetTop||0,toolbar?toolbar.getBoundingClientRect().bottom+8:64);
  const panels=[...(root?.closest('.viewer-layout')||document).querySelectorAll('.viewer-inspector,.class-reader-dock')];
  const edges=panels.filter(panel=>!panel.hidden&&getComputedStyle(panel).position==='fixed').map(panel=>panel.getBoundingClientRect()).filter(rect=>rect.width>0).map(rect=>rect.top);
  return {top,bottom:Math.min(bottom,...edges)};
}

// The class panel and ordinary inspector use the same visible reading bounds.
// A user scroll wins over later layout notifications; typing inside the panel does not.
export function useClassSelectionVisibility(dockRef, bodyRef, first, last, selectionKey, enabled) {
  useEffect(()=>{
    const dock=dockRef.current,root=dock?.closest('.viewer-layout');
    if(!root||!enabled)return;
    let frame,interrupted=false;
    const find=id=>id?root.querySelector(`[data-tid="${CSS.escape(id)}"]`):null;
    const reveal=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      if(dock.hidden)return;
      const field=document.activeElement,body=bodyRef.current;
      if(body?.contains(field)&&field.matches('input,textarea,select')){
        const visible=body.getBoundingClientRect(),rect=field.getBoundingClientRect();
        const delta=selectedTokenScrollDelta(rect,{top:visible.top,bottom:visible.bottom});
        if(delta)body.scrollBy({top:delta,behavior:'instant'});
        return;
      }
      if(interrupted)return;
      const a=find(first),b=find(last||first);if(!a||!b)return;
      const start=a.getBoundingClientRect(),end=b.getBoundingClientRect(),bounds=readerVisibleBounds(root);
      const rect={top:Math.min(start.top,end.top),bottom:Math.max(start.bottom,end.bottom)};
      const delta=selectedTokenScrollDelta(rect.bottom-rect.top>bounds.bottom-bounds.top-16?start:rect,bounds);
      if(delta)window.scrollBy({top:delta,behavior:'instant'});
    });};
    const interrupt=e=>{if(!dock.contains(e.target))interrupted=true;};
    const observer=new ResizeObserver(reveal);observer.observe(dock);observer.observe(root);
    window.addEventListener('resize',reveal);window.visualViewport?.addEventListener('resize',reveal);dock.addEventListener('focusin',reveal);
    for(const type of ['wheel','touchmove','pointerdown','keydown'])window.addEventListener(type,interrupt,{passive:true});
    reveal();
    return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',reveal);window.visualViewport?.removeEventListener('resize',reveal);dock.removeEventListener('focusin',reveal);for(const type of ['wheel','touchmove','pointerdown','keydown'])window.removeEventListener(type,interrupt);};
  },[dockRef,bodyRef,first,last,selectionKey,enabled]);
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
  return {keepPosition,layoutVersion,cancelPosition:cancel};
}
