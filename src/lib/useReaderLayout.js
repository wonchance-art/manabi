'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {captureReadingAnchor,restoreReadingAnchor,selectedTokenScrollDelta,compactSheetHeight,pagedSheetDock} from './readingViewport';
import {pagerFor} from './usePagedReader';

// A split classroom scrolls its textbook column; ordinary reading scrolls the page.
export function readerScrollTarget(root) {
  const center=root?.closest('.viewer-center')||root?.querySelector('.viewer-center');
  return center&&/auto|scroll/.test(getComputedStyle(center).overflowY)?center:window;
}

export function readerVisibleBounds(root) {
  const viewport=window.visualViewport;
  const scroller=readerScrollTarget(root),pane=scroller===window?null:scroller.getBoundingClientRect();
  const bottom=Math.min((viewport?.height||window.innerHeight)+(viewport?.offsetTop||0),pane?.bottom??Infinity);
  const toolbars=[...(root?.closest('.viewer-layout')?.querySelectorAll('.viewer-topbar,.class-workspace-topbar')||[])].filter(el=>!el.hidden);
  const top=Math.max(64,viewport?.offsetTop||0,pane?.top||0,...toolbars.map(el=>el.getBoundingClientRect().bottom+8));
  const panels=[...(root?.closest('.viewer-layout')||document).querySelectorAll('.viewer-inspector,.class-reader-dock,.sentence-move-bar,.viewer-pace-float')];
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
      if(delta)readerScrollTarget(root).scrollBy({top:delta,behavior:'instant'});
    });};
    const interrupt=e=>{if(!dock.contains(e.target))interrupted=true;};
    const observer=new ResizeObserver(reveal);observer.observe(dock);observer.observe(root);
    window.addEventListener('resize',reveal);window.visualViewport?.addEventListener('resize',reveal);dock.addEventListener('focusin',reveal);
    for(const type of ['wheel','touchmove','pointerdown','keydown'])window.addEventListener(type,interrupt,{passive:true});
    reveal();
    return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',reveal);window.visualViewport?.removeEventListener('resize',reveal);dock.removeEventListener('focusin',reveal);for(const type of ['wheel','touchmove','pointerdown','keydown'])window.removeEventListener(type,interrupt);};
  },[dockRef,bodyRef,first,last,selectionKey,enabled]);
}

// 쪽 넘김 시트 자리(A안 data-dock · 목업 C data-compact)는 시트를 닫을 때만 지운다. 다른 단어로 바꿔 누르는 동안 지우면 새 판정
// 전에 바닥 자리가 그려져 시트가 위→바닥→위로 튄다(리뷰 실측 390 top 134→396→134, 약 270ms). 효과 정리는 지우기를 한 프레임
// 미뤄 두고, 같은 시트를 이어받는 다음 효과가 그 예약을 거둔다 — 이어받는 효과가 없으면(닫힘) 다음 프레임에 지워진다.
const pendingSheetReset = new WeakMap();
// 처음 열 때는 자리 판정이 끝날 때까지 시트를 투명하게 · 누르기 막음으로 둔다(data-placing — paged-reader.css). 안 그러면
// 바닥 자리가 2~3프레임 그려진 뒤 위로 옮겨 간다(9d971872 실측 390 396→134). opacity라 초점은 그대로 들어간다(visibility는
// 초점을 막는다 — 카드 첫 초점 focusInCard). 판정이 안 오면 2프레임 뒤 그냥 보인다. 한 번 자리 잡고 보인 시트는 다시 숨기지 않는다.
const placedSheets = new WeakSet();
const sheetDisplayed = panel => !panel.hidden && panel.getClientRects().length > 0;
function resetPagedSheet(panel) {
  panel.style.removeProperty('--reader-sheet-compact'); panel.style.removeProperty('--reader-sheet-top');
  delete panel.dataset.compact; delete panel.dataset.dock; delete panel.dataset.placing;
  if (!sheetDisplayed(panel) || panel.classList.contains('is-collapsed')) placedSheets.delete(panel); // 닫힘 = 숨김 또는 접힌 막대
}

// 시트 자리 판정의 좌표 — visualViewport와 같은 계(배치 뷰포트 기준 offsetTop). 키보드가 열려 보이는 영역이 바뀌면 열쇠가 바뀐다.
function sheetViewport() {
  const view = window.visualViewport, viewTop = view?.offsetTop || 0, viewHeight = view?.height || window.innerHeight;
  return { viewTop, viewHeight, sizeKey: `${window.innerWidth}x${viewHeight}@${Math.round(viewTop)}` };
}
// 위에 세운 시트의 위 끝 = 머리줄 바닥(또는 보이는 영역 위 끝) + 8. 판정(judgePagedSheet)과 머리줄 크기 변화(retopPagedSheet)가 같은 식을 쓴다.
function sheetTopLimit(layout, viewTop) {
  const toolbarBottom = layout?.querySelector('.viewer-topbar')?.getBoundingClientRect().bottom;
  return Math.max(Number.isFinite(toolbarBottom) ? toolbarBottom : 0, viewTop) + 8;
}
// 머리줄이 자라거나 줄면(따라갈 수 없는 쪽 넘김 자료의 듣기 「지금 문장」 줄이 문장마다 바뀐다 — B1 비차단 2) 위에 세운 시트의
// 위 끝(--reader-sheet-top)만 머리줄 바닥에 다시 맞춘다. 시트 높이(--reader-sheet-compact) · 위/바닥 판정은 다시 하지 않는다 —
// 단어마다 한 번 정한 자리를 출렁이지 않게(잠금 열쇠 sizeKey 그대로). 첫 열림 판정과 겹치지 않는다 — data-dock="top"을 거는 것은
// 판정(judgePagedSheet)뿐이고, 판정 전(data-placing)의 시트에는 아직 자리가 없다(판정이 자리를 걸고 같은 태스크에서 숨김을 푼다).
// 높이 상한은 CSS max-height가 같은 변수(--reader-sheet-top)로 따라 줄어든다. 펼친 동안에도 맞춰 둔다 — CSS가 펼침 중에는 변수를
// 쓰지 않고, 펼침을 풀면 그때의 머리줄 바닥에 선다(옆 패널 · 스크롤 보기에는 판정이 data-dock을 걸지 않는다).
function retopPagedSheet(panel, layout) {
  if (!panel || panel.dataset.dock !== 'top') return;
  const top = `${Math.ceil(sheetTopLimit(layout, sheetViewport().viewTop))}px`;
  if (panel.style.getPropertyValue('--reader-sheet-top') !== top) panel.style.setProperty('--reader-sheet-top', top);
}
const sheetPlaceable = panel => getComputedStyle(panel).position === 'fixed' && !panel.classList.contains('is-expanded') && !panel.classList.contains('is-collapsed');
// 쪽 넘김 바닥 시트의 자리(A안 위에 세우기 · 목업 C 낮추기)를 정한다. 카드 핵심을 쟀으면 잠금 열쇠(sizeKey)를, 아직이면 ''를 돌려준다.
function judgePagedSheet(panel, token, layout) {
  const { viewTop, viewHeight, sizeKey } = sheetViewport();
  // 바닥 자리를 재고 같은 태스크 안에서 새 자리를 건다 — 그 사이에 그려지지 않는다.
  delete panel.dataset.compact; delete panel.dataset.dock; panel.style.removeProperty('--reader-sheet-top');
  const natural = panel.getBoundingClientRect();
  // 낮춰도 카드의 첫 화면(표제어·뜻 + 바닥 등급 줄 — AE-R2 계약)은 스크롤 없이 남아야 한다: 그 높이를 실제 배치에서 잰다.
  const word = panel.querySelector('#inspector-word:not([hidden])'), meaning = word?.querySelector('.word-detail-card__meaning'), actions = word?.querySelector('.reader-card-actions');
  const scrolled = word?.querySelector('.reader-card-body')?.scrollTop || 0;
  const core = meaning && actions ? Math.ceil(meaning.getBoundingClientRect().bottom + scrolled - natural.top + (natural.bottom - actions.getBoundingClientRect().top) + 12) : undefined;
  const tokenRect = token.getBoundingClientRect();
  // A안: 아래 절반의 단어는 시트를 머리줄 아래에 세운다(data-dock="top" — paged-reader.css). 위 절반은 지금처럼 바닥(목업 C 낮추기).
  const dock = pagedSheetDock({ tokenTop: tokenRect.top, tokenBottom: tokenRect.bottom, viewportTop: viewTop, viewportHeight: viewHeight,
    topLimit: sheetTopLimit(layout, viewTop), naturalHeight: natural.height, ...(core ? { min: core } : null) });
  if (dock.dock === 'top') {
    panel.dataset.dock = 'top'; panel.style.setProperty('--reader-sheet-top', `${dock.top}px`);
    if (dock.height !== null) { panel.style.setProperty('--reader-sheet-compact', `${dock.height}px`); panel.dataset.compact = 'true'; }
  } else {
    const height = compactSheetHeight({ tokenBottom: tokenRect.bottom, sheetTop: natural.top, sheetBottom: natural.bottom, ...(core ? { min: core } : null) });
    if (height !== null && height < natural.height) { panel.style.setProperty('--reader-sheet-compact', `${height}px`); panel.dataset.compact = 'true'; }
  }
  // 카드 핵심이 아직 안 그려졌으면(처음 열 때 머리줄만 있는 시트 — 390 실측 57px) 잠그지 않는다: 다 차서 커질 때 다시 정한다.
  return core ? sizeKey : '';
}

export function useSelectedTokenVisibility(readerRef, tokenRefs, tokenId, enabled, revision) {
  useEffect(() => {
    const root = readerRef.current, token = tokenRefs.current[tokenId];
    if (!enabled || !root || !token) return;
    const layout = root.closest('.viewer-layout');
    let panel = null, frame, settleFrame, releaseFrame, holdFrame = 0, holdSettle = 0, interrupted = false, compactFor = '';
    const showSheet = () => {
      cancelAnimationFrame(holdFrame); cancelAnimationFrame(holdSettle); holdFrame = holdSettle = 0;
      if (!panel) return;
      delete panel.dataset.placing;
      if (sheetDisplayed(panel)) placedSheets.add(panel);
    };
    const holdSheet = () => {
      if (!panel || holdFrame || placedSheets.has(panel) || !pagerFor(root) || !sheetDisplayed(panel) || getComputedStyle(panel).position !== 'fixed') return;
      panel.dataset.placing = 'true';
      holdFrame = requestAnimationFrame(() => { holdSettle = requestAnimationFrame(showSheet); });
    };
    // 시트가 보이게 되는 프레임(그리기 전)에 ResizeObserver가 먼저 숨기고, 자리는 다음 프레임에 정한다.
    // 머리줄 크기 변화는 같은 콜백(그리기 전)에서 위 끝만 다시 맞춘다 — 읽는 이가 손을 대 끌어오기가 멈춘 뒤(interrupted)에도.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { holdSheet(); retopPagedSheet(panel, layout); reveal(); }) : null;
    const adopt = found => {
      panel = found;
      if (pendingSheetReset.has(found)) {
        // 앞 효과에서 이어받은 시트(바꿔 누르기 · 보기 전환 등) — 열린 채 그려지고 있었으니 숨기지 않는다.
        cancelAnimationFrame(pendingSheetReset.get(found)); pendingSheetReset.delete(found);
        if (sheetDisplayed(found) && !found.dataset.placing) placedSheets.add(found);
      }
      observer?.observe(found);
      holdSheet();
    };
    // 쪽 넘김 보기(READER-PAGED-001): 세로로 끌어오지 않는다 — 고른 단어의 쪽으로 넘기고, 바닥 시트가 단어를 덮으면 시트를
    // 낮게 열거나(목업 C) 아래 절반의 단어면 머리줄 아래에 세운다(A안). 본문은 다시 흐르지 않는다.
    const placePaged = pager => {
      pager.reveal(token);
      placeSheet();
      if (panel?.dataset.placing) showSheet(); // 자리를 정했다(또는 정할 것이 없다) — 이 프레임부터 보인다
    };
    const placeSheet = () => {
      // 시트 자리는 단어(와 화면 크기)마다 한 번 정한다 — 카드 내용이 늦게 차도 시트가 출렁이지 않게(한자 창 등이 자리를 잡는다).
      const { sizeKey } = sheetViewport();
      if (!panel || compactFor === sizeKey || !sheetPlaceable(panel)) return;
      compactFor = judgePagedSheet(panel, token, layout);
    };
    const reveal = () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(settleFrame);
      frame = requestAnimationFrame(() => {
        if (interrupted || !token.isConnected || panel?.hidden) return;
        // 쪽 넘김의 시트 자리는 첫 프레임 안에 정한다 — 이전 단어의 자리가 그 프레임까지 남아 있다.
        const pager = pagerFor(root);
        if (pager) { placePaged(pager); return; }
        if (panel && (panel.dataset.dock || panel.dataset.compact)) resetPagedSheet(panel);
        // Let modal teardown and the display-change anchor settle first.
        settleFrame = requestAnimationFrame(() => {
          if (interrupted || !token.isConnected || panel?.hidden) return;
          if (panel?.classList.contains('viewer-inspector--board')) {
            const bounds = readerVisibleBounds(root), rect = token.getBoundingClientRect();
            const bottom = Math.ceil(bounds.top + rect.height + 24 - (window.visualViewport?.offsetTop || 0));
            panel.style.setProperty('--reader-selected-bottom', `${bottom}px`);
          }
          const delta = selectedTokenScrollDelta(token.getBoundingClientRect(), readerVisibleBounds(root));
          if (!Number.isFinite(delta) || Math.abs(delta) < 1) return;
          root.dataset.selectionRevealing = 'true';
          readerScrollTarget(root).scrollBy({ top: delta, behavior: 'instant' });
          cancelAnimationFrame(releaseFrame);
          releaseFrame = requestAnimationFrame(() => { releaseFrame = requestAnimationFrame(() => { delete root.dataset.selectionRevealing; }); });
        });
      });
    };
    // A user's own reading movement wins over a later font/viewport resize.
    const interrupt = e => {
      if (e.type === 'keydown' && token.contains(e.target) && ['Enter', ' '].includes(e.key)) return;
      if (!e.target?.closest?.('.reader-modal,.viewer-inspector')) interrupted = true;
    };
    const found = layout?.querySelector('.viewer-inspector');
    if (found) adopt(found);
    // 처음 열 때 시트가 같은 커밋에 없으면(뒤 커밋에 붙는다) 붙는 순간 이어받아 다시 정한다 — 목업 C 낮추기도 같은 길이다.
    const arrival = !found && layout && typeof MutationObserver === 'function' ? new MutationObserver(() => {
      const next = layout.querySelector('.viewer-inspector');
      if (!next) return;
      arrival.disconnect(); adopt(next); reveal();
    }) : null;
    arrival?.observe(layout, { childList: true, subtree: true });
    observer?.observe(root);
    const toolbar = layout?.querySelector('.viewer-topbar');
    if (toolbar) observer?.observe(toolbar);
    window.addEventListener('resize', reveal);
    window.visualViewport?.addEventListener('resize', reveal);
    for (const event of ['wheel', 'touchmove', 'pointerdown', 'keydown']) window.addEventListener(event, interrupt, { passive: true });
    reveal();
    return () => {
      observer?.disconnect(); arrival?.disconnect(); cancelAnimationFrame(frame); cancelAnimationFrame(settleFrame); cancelAnimationFrame(releaseFrame);
      cancelAnimationFrame(holdFrame); cancelAnimationFrame(holdSettle); // 숨김은 이어받는 효과(또는 닫힘 정리)가 맡는다
      delete root.dataset.selectionRevealing;
      panel?.style.removeProperty('--reader-selected-bottom');
      if (panel) {
        const closing = panel;
        pendingSheetReset.set(closing, requestAnimationFrame(() => { pendingSheetReset.delete(closing); resetPagedSheet(closing); }));
      }
      window.removeEventListener('resize', reveal); window.visualViewport?.removeEventListener('resize', reveal);
      for (const event of ['wheel', 'touchmove', 'pointerdown', 'keydown']) window.removeEventListener(event, interrupt);
    };
  }, [readerRef, tokenRefs, tokenId, enabled, revision]);
  // 처음 열 때 첫 그리기 전에 자리를 정한다. 위 효과는 시트가 보이고 몇 프레임 뒤에 온다(포인터 선택이 끝나야 켜진다 —
  // 390 실측 시트가 보인 뒤 약 120ms). 시트를 보이게 한 DOM 변경의 MutationObserver(마이크로태스크, 그리기 전)에서
  // 고른 단어([data-selected])로 같은 판정을 한다. 고른 단어를 못 찾으면 위 효과의 숨김(data-placing)과 안전 시간이 맡는다.
  useEffect(() => {
    const root = readerRef.current, layout = root?.closest('.viewer-layout');
    if (!layout || typeof MutationObserver !== 'function') return;
    const placeOnShow = () => {
      const panel = layout.querySelector('.viewer-inspector');
      if (!panel || panel.hidden || placedSheets.has(panel) || panel.classList.contains('is-collapsed') || panel.classList.contains('is-expanded') || !pagerFor(root) || !sheetPlaceable(panel) || !sheetDisplayed(panel)) return;
      const token = root.querySelector('[data-selected]');
      if (!token) return;
      judgePagedSheet(panel, token, layout);
      delete panel.dataset.placing;
      placedSheets.add(panel);
    };
    const observer = new MutationObserver(placeOnShow);
    observer.observe(layout, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-selected'] });
    return () => observer.disconnect();
  }, [readerRef, revision]); // 본문(readerRef)은 자료가 온 뒤에 붙는다 — 자료가 바뀌면 다시 건다
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
      restoreReadingAnchor(anchor,options=>readerScrollTarget(root).scrollBy(options));
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
