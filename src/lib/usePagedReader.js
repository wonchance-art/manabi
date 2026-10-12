'use client';
// 화면 단위 쪽 넘김(READER-PAGED-001, 오너 승인 설계 §2·§3) — 라이브러리 없이 CSS 다단 + scrollLeft.
// · 본문 상자 높이 = 보이는 화면 높이 − 상자 위 − 아래 쪽 막대. 단 폭은 상자 폭(column-width:100vw가 한 단으로 접힌다).
// · 쪽 번호는 저장하지 않는다. 다시 계산할 때마다 **기준 토큰**(사용자가 넘긴 쪽의 첫 토큰, 또는 찾아간 대상)이 있는
//   쪽으로 돌아간다 — 글자 크기·화면 방향·200% 확대가 바뀌어도 같은 글자로 돌아온다(Kindle Location 선례).
// · transform이 아니라 scrollLeft로 움직인다: 브라우저 찾기·포커스 이동이 쪽을 따라온다(foliate 선례). 어중간한
//   위치로 끌려가면 가장 가까운 쪽(포커스가 있으면 그 쪽)으로 맞춘다.
// 순수 계산(아래 export 함수)과 제어기(createPagedController)는 DOM 흉내 객체로 단독 테스트한다.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export const PAGED_ATTR = 'data-reader-pages';
const registry = new WeakMap();

// ── 순수 계산 ─────────────────────────────────────────────
export function pageStep(width, gap) { return Math.max(1, (Number(width) || 0) + (Number(gap) || 0)); }
export function clampPage(page, count) { return Math.min(Math.max(0, Math.floor(Number(page) || 0)), Math.max(0, count - 1)); }
/** 다단 상자의 scrollWidth = n·폭 + (n−1)·간격. */
export function pageCountFor({ scrollWidth, width, gap = 0 }) {
  if (!(width > 0)) return 1;
  return Math.max(1, Math.round(((Number(scrollWidth) || 0) + gap) / (width + gap)));
}
/** 상자 안 가로 위치(스크롤 0 기준) → 쪽. 경계의 반올림 오차 1px을 흡수한다. */
export function pageOfOffset(offset, step) { return Math.floor(((Number(offset) || 0) + 1) / step); }
export function nearestPage(scrollLeft, step, count) { return clampPage(Math.round((Number(scrollLeft) || 0) / step), count); }
/** 쪽 기준 진행률(설계 §4) — 「12 / 48쪽 · 25%」. 한 쪽뿐이면 다 보인 것이다. */
export function pageProgress(page, count) {
  if (!(count > 1)) return 100;
  return Math.min(100, Math.max(0, Math.round(((clampPage(page, count) + 1) / count) * 100)));
}
export function pageLabel(page, count) { return `${clampPage(page, count) + 1} / ${Math.max(1, count)}쪽 · ${pageProgress(page, count)}%`; }
/**
 * 상자 높이. 상자 위가 첫 화면 안에 있으면 남은 높이를 채운다(분석 뷰어: 상단 막대 아래 전부).
 * 위에 머리글이 길어 남는 높이가 화면의 minRatio보다 작으면 화면 하나 높이의 상자를 둔다(원본 리더: 상자로 스크롤해 읽는다).
 */
export function pageHeightFor({ visibleHeight, top, reserve = 0, inset = 0, minRatio = 0.55, min = 160 }) {
  const fill = Math.floor(visibleHeight - top - reserve);
  if (fill >= visibleHeight * minRatio) return Math.max(min, fill);
  // 화면 하나 높이의 상자 — 위에 고정된 머리(inset)와 아래 쪽 막대(reserve)를 뺀 자리.
  return Math.max(min, Math.floor(visibleHeight - reserve - inset - 16));
}
// 쪽 넘김 키가 끼어들지 않는 자리 — 입력·대화상자·보조 패널·탭/슬라이더처럼 화살표를 스스로 쓰는 위젯.
const KEY_OWNERS = 'input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"],[role="slider"],[role="tablist"],[role="radiogroup"],[role="listbox"],[role="menu"],[role="spinbutton"],dialog,.reader-modal,.viewer-inspector';
/** 키 → 쪽 동작. Alt/Ctrl/⌘ 조합(Alt+↑↓ 문장 이동 등)·Shift+화살표(선택 확장)·조합 중 입력은 건드리지 않는다. */
export function pageKeyAction(event) {
  if (!event || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return null;
  const target = event.target;
  if (target?.closest?.(KEY_OWNERS)) return null;
  if (event.key === ' ' || event.key === 'Spacebar') {
    // Space는 버튼·링크·단어(role=button)를 누르는 키다 — 거기서는 원래 일을 한다.
    if (target?.closest?.('button,a[href],summary,label,[role="button"],[role="link"],[role="checkbox"],[role="switch"]')) return null;
    return event.shiftKey ? 'prev' : 'next';
  }
  if (event.shiftKey) return null;
  switch (event.key) {
    case 'ArrowRight': case 'PageDown': return 'next';
    case 'ArrowLeft': case 'PageUp': return 'prev';
    case 'Home': return 'first';
    case 'End': return 'last';
    default: return null;
  }
}
/** 가로 밀기 판정 — 왼쪽으로 밀면 다음 쪽(1), 오른쪽이면 이전 쪽(−1). 세로 성분이 크거나 느린 끌기는 무시. */
export function swipeDirection({ dx, dy, dt }, { min = 48, ratio = 1.5, maxTime = 800 } = {}) {
  if (!(dt <= maxTime) || Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * ratio) return 0;
  return dx < 0 ? 1 : -1;
}
/** 문서 순서 목록에서 쪽 번호가 page 이상인 첫 항목(다단은 문서 순서대로 채우므로 쪽 번호가 단조 증가). */
export function firstIndexAtOrAfter(length, page, pageAt) {
  let low = 0, high = length;
  while (low < high) { const mid = (low + high) >> 1; if (pageAt(mid) < page) low = mid + 1; else high = mid; }
  return low;
}

// ── 제어기 ───────────────────────────────────────────────
const rectOf = target => {
  if (!target) return null;
  if (typeof target.getClientRects === 'function' && target.nodeType === 1) {
    const first = target.getClientRects()[0];
    if (first) return first;
  }
  return typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : null;
};
const connected = target => target && (target.isConnected ?? target.startContainer?.isConnected ?? true);

/**
 * @param {HTMLElement} pages 다단 상자(overflow:hidden). 쪽 이동은 이 상자의 scrollLeft.
 * @param {() => object} options 최신 옵션을 돌려주는 함수(React 렌더마다 바뀌는 콜백을 다시 붙이지 않는다).
 *   anchorSelector, captureAnchor(page, api), onUserPage(anchor, page), canSwipe(), bar(), bottomGap(), initialAnchor(),
 *   reducedMotion(), window, document
 */
export function createPagedController(pages, options = () => ({})) {
  const opt = () => options() || {};
  const win = () => opt().window || (typeof window !== 'undefined' ? window : null);
  let width = 0, gap = 0, step = 1, count = 1, page = 0, ready = false, height = 0;
  let anchor = { kind: 'start' }, programmatic = null, destroyed = false, frame = 0;
  const subscribers = new Set();
  const snapshot = () => ({ page, count, ready, progress: ready ? pageProgress(page, count) : 0, label: pageLabel(page, count) });
  let last = '';
  const emit = () => { const s = snapshot(), key = `${s.page}/${s.count}/${s.ready}`; if (key === last) return; last = key; subscribers.forEach(fn => fn(s)); };

  const box = () => pages.getBoundingClientRect();
  const rawPageOf = (rect, origin = box()) => pageOfOffset(rect.left - origin.left - (pages.clientLeft || 0) + (pages.scrollLeft || 0), step);
  const pageOf = target => { const rect = rectOf(target); return rect ? clampPage(rawPageOf(rect), count) : null; };

  const items = () => [...(pages.querySelectorAll?.(opt().anchorSelector || '[data-source-token]') || [])];
  /** 쪽의 첫 토큰. 토큰이 없는 쪽: 본문 뒤(읽기 완료·다음 편)면 끝에서 몇 번째 쪽인지, 앞(제목)이면 시작. */
  function captureAnchor(target) {
    const custom = opt().captureAnchor?.(target, api);
    if (custom !== undefined) return custom;
    const list = items(), origin = box();
    if (!list.length) return target === 0 ? { kind: 'start' } : { kind: 'tail', fromEnd: count - 1 - target };
    const pageAt = i => { const rect = rectOf(list[i]); return rect ? rawPageOf(rect, origin) : Infinity; };
    const index = firstIndexAtOrAfter(list.length, target, pageAt);
    if (index < list.length && pageAt(index) === target) return { kind: 'element', el: list[index] };
    if (index >= list.length) return { kind: 'tail', fromEnd: Math.max(0, count - 1 - target), el: list[list.length - 1] };
    return target === 0 ? { kind: 'start' } : { kind: 'element', el: list[index] };
  }
  function anchorPage(value = anchor) {
    if (!value || value.kind === 'start') return 0;
    if (value.kind === 'tail') return clampPage(count - 1 - value.fromEnd, count);
    if (typeof value.page === 'function') return clampPage(value.page(api), count);
    let target = value.range || value.el;
    if (!connected(target)) {
      // 분석이 끝나 줄이 토큰으로 다시 그려지면 같은 토큰 번호의 새 요소를 쓴다.
      const id = value.el?.dataset?.sourceToken;
      const found = id && pages.querySelector?.(`[data-source-token="${String(id).replace(/["\\]/g, '\\$&')}"]`);
      if (!found) return null;
      value.el = found; target = found;
    }
    return pageOf(target);
  }

  function fitHeight() {
    const w = win();
    if (!w) return;
    const viewport = w.visualViewport;
    if (viewport && viewport.scale && Math.abs(viewport.scale - 1) > 0.01) return; // 손가락 확대 중에는 다시 흘리지 않는다
    const visibleHeight = viewport?.height || w.innerHeight || 0;
    if (!visibleHeight) return;
    const bar = opt().bar?.();
    const barHeight = bar && !bar.hidden ? (bar.getBoundingClientRect().height || 0) : 0;
    const top = box().top + (w.scrollY || 0);
    const next = pageHeightFor({ visibleHeight, top, reserve: barHeight + (opt().bottomGap?.() ?? 12), inset: opt().topInset?.() ?? 0 });
    if (Math.abs(next - height) >= 1) { height = next; pages.style?.setProperty('--reader-page-height', `${next}px`); }
  }
  function measure() {
    const style = win()?.getComputedStyle?.(pages);
    // 단 폭 = 내용 상자 폭(안쪽 여백 제외 — 호버 기기는 줄 왼쪽 문장 막대 자리로 안쪽 여백을 둔다).
    width = Math.max(0, (pages.clientWidth || 0) - (parseFloat(style?.paddingLeft) || 0) - (parseFloat(style?.paddingRight) || 0));
    gap = parseFloat(style?.columnGap) || 0;
    step = pageStep(width, gap);
    const end = pages.querySelector?.('[data-page-end]');
    const endRect = rectOf(end);
    count = endRect ? Math.max(1, rawPageOf(endRect) + 1) : pageCountFor({ scrollWidth: pages.scrollWidth, width, gap });
  }
  function scrollToPage(target, animate) {
    const left = target * step;
    if (Math.abs((pages.scrollLeft || 0) - left) < 0.5) { programmatic = null; return; }
    const smooth = animate && !opt().reducedMotion?.() && typeof pages.scrollTo === 'function';
    programmatic = { left, until: Date.now() + (smooth ? 700 : 120) };
    if (smooth) pages.scrollTo({ left, behavior: 'smooth' });
    else pages.scrollLeft = left;
  }
  /** user=true면 기준 토큰을 그 쪽의 첫 토큰으로 바꾸고 위치 저장 콜백을 부른다. */
  function goTo(target, { user = false, animate = false } = {}) {
    if (destroyed || !ready) return page;
    const next = clampPage(target, count);
    scrollToPage(next, animate);
    page = next;
    if (user) { anchor = captureAnchor(next); opt().onUserPage?.(anchor, next); }
    emit();
    return next;
  }
  function relayout() {
    frame = 0;
    if (destroyed) return;
    fitHeight();
    measure();
    if (!ready) {
      ready = true;
      const initial = opt().initialAnchor?.();
      if (initial) anchor = initial;
    }
    const target = anchorPage();
    page = clampPage(target ?? page, count);
    scrollToPage(page, false);
    emit();
  }
  function schedule() {
    if (destroyed || frame) return;
    const w = win();
    frame = w?.requestAnimationFrame ? w.requestAnimationFrame(relayout) : (relayout(), 0);
  }
  /** 대상(토큰·글자 Range)이 있는 쪽으로. 대상 자체가 기준이 된다 — 글자 크기를 바꿔도 대상이 보이는 쪽으로 돌아온다. */
  function reveal(target, { user = false, animate = false } = {}) {
    if (!target || destroyed) return false;
    anchor = target.nodeType === 1 ? { kind: 'element', el: target } : { kind: 'range', range: target };
    if (!ready) { schedule(); return true; }
    const next = anchorPage();
    if (next == null) return false;
    scrollToPage(next, animate);
    page = next;
    if (user) opt().onUserPage?.(anchor, next);
    emit();
    return true;
  }

  // 어중간한 스크롤(찾기·포커스·남의 scrollIntoView) → 쪽 맞춤. 우리 이동이 끝나는 동안의 이벤트는 무시한다.
  // 누르는 동안(마우스 다운~업)에는 쪽을 맞추지 않는다 — 누른 사이 글자가 밀리면 떼는 자리가 달라져 클릭이 사라진다
  // (포커스 이동·남의 스크롤로 어중간해진 쪽은 손을 뗀 뒤에 맞춘다).
  let pressed = false, deferred = false;
  function settleDeferred() {
    if (!deferred || pressed || destroyed) return;
    deferred = false;
    const active = (opt().document || pages.ownerDocument)?.activeElement;
    const target = active && active !== pages && pages.contains?.(active) ? pageOf(active) : nearestPage(pages.scrollLeft || 0, step, count);
    if (target != null && (Math.abs((pages.scrollLeft || 0) - target * step) >= 1 || target !== page)) goTo(target, { user: true });
  }
  function handleRelease() {
    if (!pressed) return;
    pressed = false;
    const w = win();
    if (deferred) { if (w?.setTimeout) w.setTimeout(settleDeferred, 0); else settleDeferred(); }
  }
  function handleScroll() {
    if (destroyed || !ready) return;
    const left = pages.scrollLeft || 0;
    if (programmatic) {
      if (Math.abs(left - programmatic.left) < 1) { programmatic = null; return; }
      if (Date.now() < programmatic.until) return;
      programmatic = null;
    }
    if (pressed) { deferred = true; return; }
    // 같은 프레임 안에서 바로 맞춘다 — 늦게 맞추면 끌려간 화면을 보고 누른 손(또는 자동화의 클릭)이 엉뚱한 자리를 누른다.
    const active = (opt().document || pages.ownerDocument)?.activeElement;
    const target = active && active !== pages && pages.contains?.(active) ? pageOf(active) : nearestPage(left, step, count);
    if (Math.abs(left - target * step) >= 1 || target !== page) goTo(target, { user: true });
  }
  function handleFocusIn(event) {
    const target = event?.target;
    if (!ready || !target || target === pages) return;
    if (pressed) { deferred = true; return; }
    const next = pageOf(target);
    if (next != null && next !== page) goTo(next, { user: true });
  }
  function handleKey(event) {
    if (!ready || destroyed) return false;
    const action = pageKeyAction(event);
    if (!action) return false;
    const doc = opt().document || pages.ownerDocument;
    if (doc?.querySelector?.('dialog[open]')) return false;
    if (opt().canKey && !opt().canKey(event)) return false;
    event.preventDefault?.();
    const target = action === 'next' ? page + 1 : action === 'prev' ? page - 1 : action === 'first' ? 0 : count - 1;
    goTo(target, { user: true, animate: true });
    return true;
  }
  let swipe = null;
  const selectionActive = () => {
    const selection = win()?.getSelection?.();
    return !!selection && !selection.isCollapsed && String(selection).length > 0;
  };
  function handlePointerDown(event) {
    pressed = true;
    if (!ready || event.pointerType === 'mouse' || event.isPrimary === false) { swipe = null; return; }
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, t: Date.now(), selecting: selectionActive() };
  }
  function handlePointerUp(event) {
    handleRelease();
    const start = swipe; swipe = null;
    if (!start || start.id !== event.pointerId || !ready) return 0;
    // 글자를 끌어 고르는 중이거나 단어창이 열려 있으면 넘기지 않는다(설계 §2).
    if (start.selecting || selectionActive() || (opt().canSwipe && !opt().canSwipe())) return 0;
    const dir = swipeDirection({ dx: event.clientX - start.x, dy: event.clientY - start.y, dt: Date.now() - start.t });
    if (dir) goTo(page + dir, { user: true, animate: true });
    return dir;
  }
  function handlePointerCancel() { swipe = null; handleRelease(); }

  function attach() {
    const w = win();
    if (!w) return () => {};
    const doc = opt().document || pages.ownerDocument || w.document;
    const onKey = e => handleKey(e);
    pages.addEventListener('scroll', handleScroll, { passive: true });
    pages.addEventListener('focusin', handleFocusIn);
    pages.addEventListener('pointerdown', handlePointerDown, { passive: true });
    pages.addEventListener('pointerup', handlePointerUp, { passive: true });
    pages.addEventListener('pointercancel', handlePointerCancel, { passive: true });
    doc.addEventListener('keydown', onKey);
    // 상자 밖에서 손을 떼도 누름을 푼다.
    doc.addEventListener('pointerup', handleRelease, true);
    doc.addEventListener('pointercancel', handleRelease, true);
    w.addEventListener('resize', schedule);
    w.addEventListener('orientationchange', schedule);
    w.visualViewport?.addEventListener('resize', schedule);
    doc.fonts?.addEventListener?.('loadingdone', schedule);
    doc.fonts?.ready?.then(() => schedule());
    const resize = typeof w.ResizeObserver === 'function' ? new w.ResizeObserver(schedule) : null;
    // 상자 자신·위 머리글(상단 막대가 접혀 늘면 상자 위가 내려간다)·문서(200% 글자 등 rem 변화)의 크기 변화.
    for (const el of [pages, pages.parentElement, pages.parentElement?.parentElement, doc.documentElement]) if (el) resize?.observe(el);
    // 본문 글자 크기(1em 탐침) — 200% 글자처럼 rem이 바뀌면 상자 크기는 그대로인데 흐름만 길어진다.
    const watchProbes = () => { for (const probe of pages.querySelectorAll?.('[data-page-probe]') || []) resize?.observe(probe); };
    watchProbes();
    // 분석이 끝나 원문 줄이 토큰으로 바뀌거나 글자 크기가 바뀌면 흐름이 바뀐다 — 다시 재고 기준 토큰으로.
    const mutation = typeof w.MutationObserver === 'function' ? new w.MutationObserver(() => { watchProbes(); schedule(); }) : null;
    mutation?.observe(pages, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'hidden'] });
    return () => {
      pages.removeEventListener('scroll', handleScroll);
      pages.removeEventListener('focusin', handleFocusIn);
      pages.removeEventListener('pointerdown', handlePointerDown);
      pages.removeEventListener('pointerup', handlePointerUp);
      pages.removeEventListener('pointercancel', handlePointerCancel);
      doc.removeEventListener('keydown', onKey);
      doc.removeEventListener('pointerup', handleRelease, true);
      doc.removeEventListener('pointercancel', handleRelease, true);
      w.removeEventListener('resize', schedule);
      w.removeEventListener('orientationchange', schedule);
      w.visualViewport?.removeEventListener('resize', schedule);
      doc.fonts?.removeEventListener?.('loadingdone', schedule);
      resize?.disconnect(); mutation?.disconnect();
    };
  }
  function destroy() {
    destroyed = true;
    const w = win();
    if (frame) w?.cancelAnimationFrame?.(frame);
    pages.style?.removeProperty('--reader-page-height');
    pages.scrollLeft = 0;
    subscribers.clear();
  }

  const api = {
    relayout, schedule, goTo, reveal, pageOf, captureAnchor, anchorPage, attach, destroy,
    handleScroll, handleFocusIn, handleKey, handlePointerDown, handlePointerUp, handlePointerCancel, handleRelease,
    next: (o = { user: true, animate: true }) => goTo(page + 1, o),
    prev: (o = { user: true, animate: true }) => goTo(page - 1, o),
    first: (o = { user: true, animate: true }) => goTo(0, o),
    last: (o = { user: true, animate: true }) => goTo(count - 1, o),
    get anchor() { return anchor; },
    set anchor(value) { anchor = value || { kind: 'start' }; },
    get state() { return snapshot(); },
    get metrics() { return { width, gap, step, count, height }; },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
  };
  return api;
}

/** 다단 상자의 제어기 — 상자 안 아무 노드에서나(본문 영역 ref 등) 찾는다. 스크롤 보기면 null. */
export function pagerFor(node) {
  if (!node) return null;
  const pages = node.closest?.(`[${PAGED_ATTR}="paged"]`) || node.querySelector?.(`[${PAGED_ATTR}="paged"]`);
  return pages ? registry.get(pages) || null : null;
}
/** 절대 배치 덧그림(지정 그립·이합사 아치)의 좌표 원점. 쪽 넘김에서는 다단 상자가 기준(본문 영역은 단마다 쪼개진다). */
export function overlayOrigin(reader) {
  const pages = reader?.closest?.(`[${PAGED_ATTR}="paged"]`);
  if (!pages) return reader.getBoundingClientRect();
  const rect = pages.getBoundingClientRect();
  return { left: rect.left + (pages.clientLeft || 0) - (pages.scrollLeft || 0), top: rect.top + (pages.clientTop || 0) - (pages.scrollTop || 0) };
}
/** 대상을 보이게 — 쪽 넘김이면 그 쪽으로, 스크롤 보기면 원래 scrollIntoView. */
export function revealInReader(target, scrollOptions = { block: 'center' }, revealOptions) {
  const pager = pagerFor(target);
  if (pager) return pager.reveal(target, revealOptions);
  target?.scrollIntoView?.(scrollOptions);
  return !!target;
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * React 연결. pages는 콜백 ref로 받은 다단 상자 요소(자료가 늦게 뜨면 그때 붙는다). enabled일 때만 제어기를 만든다 — 끄면 상자는 평범한 블록으로 돌아가고(스크롤 보기 = 지금 그대로)
 * 마지막 기준 토큰을 화면 가운데로 데려온다.
 * @returns {{page,count,ready,progress,label,next,prev,first,last,goTo,reveal}}
 */
export function usePagedReader({ enabled, pages, barRef, layoutKey, resetKey, onUserPage, canSwipe, canKey, captureAnchor, anchorSelector, initialAnchor, bottomGap, topInset }) {
  const [state, setState] = useState({ page: 0, count: 1, ready: false, progress: 0, label: pageLabel(0, 1) });
  const controller = useRef(null);
  const latest = useRef({});
  latest.current = { onUserPage, canSwipe, canKey, captureAnchor, anchorSelector, initialAnchor, bottomGap, topInset, bar: () => barRef?.current || null, reducedMotion };
  useIsoLayoutEffect(() => {
    if (!enabled || !pages) return undefined;
    const pager = createPagedController(pages, () => latest.current);
    controller.current = pager;
    registry.set(pages, pager);
    const unsubscribe = pager.subscribe(setState);
    const detach = pager.attach();
    pager.relayout();
    return () => {
      const anchor = pager.anchor, target = anchor?.range || anchor?.el;
      unsubscribe(); detach(); registry.delete(pages); pager.destroy();
      if (controller.current === pager) controller.current = null;
      setState({ page: 0, count: 1, ready: false, progress: 0, label: pageLabel(0, 1) });
      // 스크롤 보기로 바꾸면 읽던 글자를 화면으로 데려온다(쪽 → 스크롤도 같은 글자).
      if (target && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!connected(target) || pagerFor(pages)) return;
        const el = target.nodeType === 1 ? target : target.startContainer?.parentElement;
        el?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
      }));
    };
  }, [enabled, pages]);
  useIsoLayoutEffect(() => { controller.current?.schedule(); }, [layoutKey]);
  // 다른 글(다음 편 등)로 바뀌면 처음 쪽부터 — 같은 토큰 번호 형식(id_0_0)이 새 글에도 있어 옛 기준이 엉뚱한 쪽을 연다.
  const lastReset = useRef(resetKey);
  useIsoLayoutEffect(() => {
    if (lastReset.current === resetKey) return;
    lastReset.current = resetKey;
    const pager = controller.current;
    if (pager) { pager.anchor = { kind: 'start' }; pager.schedule(); }
  }, [resetKey]);
  const api = useMemo(() => ({
    next: () => controller.current?.next(),
    prev: () => controller.current?.prev(),
    first: () => controller.current?.first(),
    last: () => controller.current?.last(),
    goTo: (page, o) => controller.current?.goTo(page, o),
    reveal: (target, o) => controller.current?.reveal(target, o) ?? false,
    controller: () => controller.current,
  }), []);
  return { ...state, active: !!enabled && state.ready, ...api };
}
