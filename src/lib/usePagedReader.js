'use client';
// 화면 단위 쪽 넘김(READER-PAGED-001, 오너 승인 설계 §2·§3) — 라이브러리 없이 CSS 다단 + scrollLeft.
// · 본문 상자 높이 = 보이는 화면 높이 − 상자 위 − 아래 쪽 막대. 단 폭은 상자 폭(column-width:100vw가 한 단으로 접힌다).
// · 쪽 번호는 저장하지 않는다. 다시 계산할 때마다 **기준 토큰**(사용자가 넘긴 쪽의 첫 토큰, 또는 찾아간 대상)이 있는
//   쪽으로 돌아간다 — 글자 크기·화면 방향·200% 확대가 바뀌어도 같은 글자로 돌아온다(Kindle Location 선례).
// · transform이 아니라 scrollLeft로 움직인다: 브라우저 찾기·포커스 이동이 쪽을 따라온다(foliate 선례). 어중간한
//   위치로 끌려가면 가장 가까운 쪽(포커스가 있으면 그 쪽)으로 맞춘다.
// 순수 계산(아래 export 함수)과 제어기(createPagedController)는 DOM 흉내 객체로 단독 테스트한다.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { reducedMotion } from './reducedMotion';

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
/**
 * 남의 스크롤(초점 이동 없음 — 화면 읽기 도구 · 브라우저 찾기)이 닿은 쪽(FOREIGN-SCROLL-001 후속). 지금 쪽 바로 옆 쪽의 글자 칸이
 * 조금이라도 화면에 들어왔으면(단 사이 틈 gap을 넘게 밀렸으면) 그 옆 쪽이다 — 스크롤한 쪽이 보이려던 것은 지금 쪽(이미 다 보임)이
 * 아니라 새로 드러난 쪽이기 때문이다. 화면 읽기 도구가 다음 쪽 앞머리 요소를 화면 끝에 겨우 보이게 스크롤하면 가장 가까운 쪽은
 * 지금 쪽이라 되돌아갔다(390: 쪽 폭 454px, 다음 쪽 앞 약 160px). 틈 안의 작은 밀림 · 한 쪽을 넘는 이동(찾기가 먼 쪽으로)은 가장 가까운 쪽.
 * 손으로 밀다 놓은 경우(누른 뒤 맞춤)는 이 규칙이 아니라 가장 가까운 쪽 그대로다(settleDeferred).
 */
export function foreignScrollPage(scrollLeft, page, { step, gap = 0, count }) {
  const offset = (Number(scrollLeft) || 0) - clampPage(page, count) * step;
  if (offset > gap && offset < step) return clampPage(page + 1, count);
  if (offset < -gap && offset > -step) return clampPage(page - 1, count);
  return nearestPage(scrollLeft, step, count);
}
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
/** CSS font-family 값 → 비교용 이름 목록(따옴표 · 공백 · 대소문자를 뗀다). */
export function fontFamilyNames(value) {
  return String(value || '').split(',').map(name => name.trim().replace(/^["']|["']$/g, '').trim().toLowerCase()).filter(Boolean);
}
/**
 * 글꼴 받기가 끝났을 때 쪽을 다시 잴지(READER-FONT-REMEASURE-001). 받은 글꼴 중 하나라도 본문 글꼴 목록(families)에 있으면 잰다.
 * 판단할 수 없으면(받은 글꼴 목록 · 본문 글꼴 목록이 없거나 이름이 없는 글꼴) 전처럼 잰다 — 쪽이 틀린 채 남는 쪽보다 한 번 더 재는 쪽이 낫다.
 * 운영 실측(2026-10-17 KST): 뷰어 읽기 설정을 열면 창 글꼴이 받아지며 본문 쪽을 통째로 다시 쟀다(390폭 · CPU 4배 46ms).
 */
export function fontsAffectReader(faces, families) {
  const list = faces ? [...faces] : [];
  if (!list.length || !families?.length) return true;
  const names = new Set(families);
  return list.some(face => { const name = fontFamilyNames(face?.family)[0]; return !name || names.has(name); });
}
/** 다시 재기를 부르지 않아도 되는 변화 — 쪽 흐름 밖 칸(data-page-ignore: 쪽 보기에서 숨긴 진행 막대 등) 안의 바뀜만. 대상을 모르면 잰다. */
export function mutationsAffectFlow(records) {
  return [...(records || [])].some(record => {
    const node = record?.target?.nodeType === 1 ? record.target : record?.target?.parentElement;
    return !node?.closest?.('[data-page-ignore]');
  });
}
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
 *   anchorSelector, focusSelector, captureAnchor(page, api), onUserPage(anchor, page), canSwipe(), bar(), bottomGap(), initialAnchor(),
 *   reducedMotion(), window, document
 *   anchorSelector = 쪽의 첫 기준 요소(쪽 맞춤 · 위치 저장). focusSelector = 초점 귀속 대상(기본 낱말 [data-source-token]) — 둘은 따로다:
 *   원본 리더의 기준 요소는 본문 전체 article(.original-writing)이라, 초점을 그리로 귀속하면 안의 모든 초점이 첫 쪽으로 튄다.
 */
const FOCUS_ITEM = '[data-source-token]';
const FOCUS_SCROLL_MS = 500;
export function createPagedController(pages, options = () => ({})) {
  const opt = () => options() || {};
  const win = () => opt().window || (typeof window !== 'undefined' ? window : null);
  let width = 0, gap = 0, step = 1, count = 1, page = 0, ready = false, height = 0;
  let anchor = { kind: 'start' }, programmatic = null, destroyed = false, frame = 0;
  // 읽기 진도 쪽(readPage)은 자동 이동(reveal auto — 듣기 따라가기)이 올리지 않는다(LISTEN-FOLLOW · 진도 보존): 따라가기 전에는 듣기가
  // 쪽을 옮기지 않아 진도가 그대로였다. 사람의 이동(goTo · 넘김 · 키 · 초점 · 남의 스크롤)과 auto가 아닌 reveal(시트 단어 · [지금 문장으로])만
  // 진도를 옮긴다. autoHeld = 지금 기준이 자동 이동이 정한 것 — 그 사이 다시 흐름(relayout)도 진도를 옮기지 않는다.
  let readPage = 0, autoHeld = false;
  const subscribers = new Set();
  const snapshot = () => ({ page, count, ready, progress: ready ? pageProgress(page, count) : 0, readProgress: ready ? pageProgress(readPage, count) : 0, label: pageLabel(page, count) });
  let last = '';
  const emit = () => { const s = snapshot(), key = `${s.page}/${s.count}/${s.ready}/${s.readProgress}`; if (key === last) return; last = key; subscribers.forEach(fn => fn(s)); };

  const box = () => pages.getBoundingClientRect();
  const rawPageOf = (rect, origin = box()) => pageOfOffset(rect.left - origin.left - (pages.clientLeft || 0) + (pages.scrollLeft || 0), step);
  const pageOf = target => { const rect = rectOf(target); return rect ? clampPage(rawPageOf(rect), count) : null; };

  const items = () => [...(pages.querySelectorAll?.(opt().anchorSelector || '[data-source-token]') || [])];
  /**
   * 초점이 든 요소의 쪽은 그 요소가 속한 낱말로 잰다(PAGED-FOCUS-001). 줄 머리 문장 막대(.line-pick)는 낱말 왼쪽 여백에
   * 떠 있어, 다음 쪽 첫 줄의 막대는 단 사이 틈(현재 쪽 끝)에 놓인다 — 막대 자리로 재면 쪽이 넘어가지 않아 Tab 초점이 화면 밖에 남았다
   * (390 실측: 막대 x 384~408 · 그 낱말 x 414 · 쪽 1 그대로). 낱말 밖 요소(제목 · 읽기 완료 등)는 그대로 그 요소로 잰다.
   * 귀속 대상은 focusSelector(기본 낱말)이고 anchorSelector가 아니다 — 기준 요소가 여러 쪽에 걸친 상자(원본 리더 article)면 첫 쪽으로 튄다.
   */
  const focusPageTarget = el => { const item = el?.closest?.(opt().focusSelector || FOCUS_ITEM); return item && item !== pages && pages.contains?.(item) ? item : el; };
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
    page = next; readPage = next; autoHeld = false;
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
    readPage = autoHeld ? clampPage(readPage, count) : page;
    scrollToPage(page, false);
    emit();
  }
  function schedule() {
    if (destroyed || frame) return;
    const w = win();
    frame = w?.requestAnimationFrame ? w.requestAnimationFrame(relayout) : (relayout(), 0);
  }
  /** 대상(토큰·글자 Range)이 있는 쪽으로. 대상 자체가 기준이 된다 — 글자 크기를 바꿔도 대상이 보이는 쪽으로 돌아온다.
   *  auto = 자동 이동(듣기 따라가기 등) — 사람과 다른 이동에 진다: 본문을 누르는 중이거나 canAutoReveal()이 거절하면
   *  (시트 열림 · 드래그 범위 지정 · 키 차단 — 뷰어가 판정) 옮기지도 기준을 바꾸지도 않는다. 이미 지금 쪽에 있으면 true
   *  (옮길 필요가 없으니 보인다), 다른 쪽이면 false. 시트의 단어 보이기 등 auto가 아닌 이동은 지금 그대로라 둘이 겹치면
   *  늘 사람 쪽 이동이 남는다(LISTEN-FOLLOW 우선순위 계약). */
  function reveal(target, { user = false, animate = false, auto = false } = {}) {
    if (!target || destroyed) return false;
    if (auto && (pressed || opt().canAutoReveal?.() === false)) return ready && pageOf(target) === page;
    anchor = target.nodeType === 1 ? { kind: 'element', el: target } : { kind: 'range', range: target };
    autoHeld = auto;
    if (!ready) { schedule(); return true; }
    const next = anchorPage();
    if (next == null) return false;
    scrollToPage(next, animate);
    page = next;
    if (!auto) readPage = next;
    if (user) opt().onUserPage?.(anchor, next);
    emit();
    return true;
  }

  // 어중간한 스크롤(찾기·포커스·남의 scrollIntoView) → 쪽 맞춤. 우리 이동이 끝나는 동안의 이벤트는 무시한다.
  // 누르는 동안(마우스 다운~업)에는 쪽을 맞추지 않는다 — 누른 사이 글자가 밀리면 떼는 자리가 달라져 클릭이 사라진다
  // (포커스 이동·남의 스크롤로 어중간해진 쪽은 손을 뗀 뒤에 맞춘다).
  // 초점 쪽으로 끌어오는 것은 「초점이 방금 바뀐」 스크롤뿐이다(FOREIGN-SCROLL-001). 초점이 본문 낱말에 그대로 남은 채 브라우저 찾기(Ctrl+F) ·
  // 화면 읽기 도구가 다른 쪽으로 스크롤하면 그 스크롤이 닿은 쪽(가장 가까운 쪽)으로 맞춘다 — 예전엔 초점 쪽으로 되돌려 찾은 글자가 사라졌다.
  // 초점 이동이 낸 스크롤(Tab · 클릭)은 focusin과 같은 프레임 근처에 온다 — FOCUS_SCROLL_MS 안이면 초점 쪽.
  let pressed = false, deferred = false, deferredFocus = false, focusAt = -Infinity;
  const focusedPage = () => {
    const active = (opt().document || pages.ownerDocument)?.activeElement;
    return active && active !== pages && pages.contains?.(active) ? pageOf(focusPageTarget(active)) : null;
  };
  function settleDeferred() {
    if (!deferred || pressed || destroyed) return;
    deferred = false;
    const byFocus = deferredFocus; deferredFocus = false;
    const target = (byFocus ? focusedPage() : null) ?? nearestPage(pages.scrollLeft || 0, step, count);
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
    const target = (Date.now() - focusAt < FOCUS_SCROLL_MS ? focusedPage() : null) ?? foreignScrollPage(left, page, { step, gap, count });
    if (Math.abs(left - target * step) >= 1 || target !== page) goTo(target, { user: true });
  }
  function handleFocusIn(event) {
    const target = event?.target;
    if (!ready || !target || target === pages) return;
    focusAt = Date.now();
    if (pressed) { deferred = true; deferredFocus = true; return; }
    const next = pageOf(focusPageTarget(target));
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
    // 본문 글꼴 = 상자와 1em 탐침(본문 글자와 같은 글꼴)의 font-family. 상자는 화면 글꼴, 글자는 언어별 글꼴이라 둘을 함께 본다.
    const readerFamilies = () => {
      if (typeof w.getComputedStyle !== 'function') return [];
      const nodes = [pages, ...(pages.querySelectorAll?.('[data-page-probe]') || [])];
      return [...new Set(nodes.flatMap(node => { try { return fontFamilyNames(w.getComputedStyle(node)?.fontFamily); } catch { return []; } }))];
    };
    const onFontsLoaded = event => { if (fontsAffectReader(event?.fontfaces, readerFamilies())) schedule(); };
    doc.fonts?.addEventListener?.('loadingdone', onFontsLoaded);
    doc.fonts?.ready?.then(() => schedule());
    const resize = typeof w.ResizeObserver === 'function' ? new w.ResizeObserver(schedule) : null;
    // 상자 자신·위 머리글(상단 막대가 접혀 늘면 상자 위가 내려간다)·문서(200% 글자 등 rem 변화)의 크기 변화.
    for (const el of [pages, pages.parentElement, pages.parentElement?.parentElement, doc.documentElement]) if (el) resize?.observe(el);
    // 본문 글자 크기(1em 탐침) — 200% 글자처럼 rem이 바뀌면 상자 크기는 그대로인데 흐름만 길어진다.
    const watchProbes = () => { for (const probe of pages.querySelectorAll?.('[data-page-probe]') || []) resize?.observe(probe); };
    watchProbes();
    // 분석이 끝나 원문 줄이 토큰으로 바뀌거나 글자 크기가 바뀌면 흐름이 바뀐다 — 다시 재고 기준 토큰으로.
    // 쪽 넘김마다 진행 막대(쪽 보기에서는 숨김, 쪽 상자 안)의 너비 · 숫자가 바뀌어 크기 변화 없이 쪽 전체를 다시 쟀다(PAGE-TURN-REMEASURE-001,
    // 운영 실측 2026-10-17 KST viewer/45) — 흐름 밖 칸 안의 바뀜만이면 건너뛴다.
    const mutation = typeof w.MutationObserver === 'function' ? new w.MutationObserver(records => {
      if (!mutationsAffectFlow(records)) return;
      watchProbes(); schedule();
    }) : null;
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
      doc.fonts?.removeEventListener?.('loadingdone', onFontsLoaded);
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
    set anchor(value) { anchor = value || { kind: 'start' }; autoHeld = false; },
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
/**
 * 스크롤 보기에서 멀리 뛸 때(VIEWER-CV-SCROLL-001) — 화면 밖 줄은 배치를 건너뛰어 어림 높이로 서 있으므로, 뛰는 그 순간만 본문 전부를
 * 그려(data-reader-full) 대상의 실제 자리로 간다. 두 프레임 뒤 되돌리면 그린 줄은 실제 높이를 기억한다. 겹쳐 불러도 마지막이 끝날 때 푼다.
 */
const fullHolds = new WeakMap();
export function withFullReader(target, run) {
  const area = target?.closest?.('.reader-area') || null;
  if (area) { fullHolds.set(area, (fullHolds.get(area) || 0) + 1); area.dataset.readerFull = 'true'; }
  try { return run(); } finally {
    if (area) {
      const release = () => { const n = (fullHolds.get(area) || 1) - 1; fullHolds.set(area, n); if (n <= 0) delete area.dataset.readerFull; };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(release)); else release();
    }
  }
}
/** 대상을 보이게 — 쪽 넘김이면 그 쪽으로, 스크롤 보기면 원래 scrollIntoView(그 순간 본문 전부를 그려서). */
export function revealInReader(target, scrollOptions = { block: 'center' }, revealOptions) {
  const pager = pagerFor(target);
  if (pager) return pager.reveal(target, revealOptions);
  withFullReader(target, () => target?.scrollIntoView?.(scrollOptions));
  return !!target;
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * React 연결. pages는 콜백 ref로 받은 다단 상자 요소(자료가 늦게 뜨면 그때 붙는다). enabled일 때만 제어기를 만든다 — 끄면 상자는 평범한 블록으로 돌아가고(스크롤 보기 = 지금 그대로)
 * 마지막 기준 토큰을 화면 가운데로 데려온다.
 * @returns {{page,count,ready,progress,readProgress,label,next,prev,first,last,goTo,reveal}}
 * progress = 지금 쪽의 위치(쪽 막대 표시), readProgress = 읽기 진도(자동 이동 제외 — 진행 막대 · 그룹 같이 읽기 push).
 */
export function usePagedReader({ enabled, pages, barRef, layoutKey, resetKey, onUserPage, canSwipe, canKey, canAutoReveal, captureAnchor, anchorSelector, focusSelector, initialAnchor, bottomGap, topInset }) {
  const [state, setState] = useState({ page: 0, count: 1, ready: false, progress: 0, readProgress: 0, label: pageLabel(0, 1) });
  const controller = useRef(null);
  const latest = useRef({});
  latest.current = { onUserPage, canSwipe, canKey, canAutoReveal, captureAnchor, anchorSelector, focusSelector, initialAnchor, bottomGap, topInset, bar: () => barRef?.current || null, reducedMotion };
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
      setState({ page: 0, count: 1, ready: false, progress: 0, readProgress: 0, label: pageLabel(0, 1) });
      // 스크롤 보기로 바꾸면 읽던 글자를 화면으로 데려온다(쪽 → 스크롤도 같은 글자).
      if (target && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!connected(target) || pagerFor(pages)) return;
        const el = target.nodeType === 1 ? target : target.startContainer?.parentElement;
        withFullReader(el, () => el?.scrollIntoView?.({ block: 'center', behavior: 'instant' }));
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
