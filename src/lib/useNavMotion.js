'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { NAV_MOTION_COOLDOWN_MS, NAV_MOTION_MS, NAV_TAB_SELECTOR, canAnimateNav, navMotionKind } from './navMotion';

// 화면 이동 손맛 실행부(NAV-MOTION-001). 판정은 navMotion.js, 움직임 값은 web-shell.css NAV-MOTION 블록.
//
// 경로가 바뀐 커밋(useLayoutEffect — 그리기 전)에서 html[data-nav-motion=tab|push|pop]만 붙인다. 본문(#main-content)의 CSS 등장
// 애니메이션이 첫 그림부터 시작 상태(투명 · 16px 밀림)로 그려진다. View Transitions는 쓰지 않는다 — 전환 중 모든 포인터를
// <html>로 보내 연속 탭이 사라지고(실측 4/4), 「이전」 사진 두 장 · 그리기 정지가 붙는다(비교 실측은 목업 문서 §6).
// 누른 순간의 기록(메뉴 · 뒤로가기)은 원인으로만 쓴다. 누른 순간에는 아무것도 하지 않는다(INP · 대기 밑줄 불변).

/** 누른 곳(메뉴?) · 뒤로가기(브라우저 넘김 효과?)를 적어 두는 리스너. 정리 함수를 돌려준다. */
export function watchNavCause(win, causeRef) {
  const doc = win.document;
  const onClick = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target?.closest?.('a[href]');
    if (!link) return;
    causeRef.current = link.closest(NAV_TAB_SELECTOR) ? { type: 'tab', at: win.performance.now() } : null;
  };
  const onPop = (event) => {
    causeRef.current = {
      type: 'pop', at: win.performance.now(),
      uaVisual: event.hasUAVisualTransition === true,
      uaVisualKnown: typeof event.hasUAVisualTransition === 'boolean',
      coarse: !!win.matchMedia?.('(pointer: coarse)')?.matches,
    };
  };
  doc.addEventListener('click', onClick, true);
  win.addEventListener('popstate', onPop, true);
  return () => { doc.removeEventListener('click', onClick, true); win.removeEventListener('popstate', onPop, true); };
}

/** 지금 기록 위치(Navigation API — 없으면 null). 앞 · 뒤 판정에만 쓴다. */
const historyIndex = (win) => (Number.isInteger(win.navigation?.currentEntry?.index) ? win.navigation.currentEntry.index : null);

/**
 * 한 번의 등장. 표식을 달고, .page-container의 옛 등장(pageEnter)은 끝 상태로 보낸다(두 번 움직이지 않게 — 표식을 CSS로 막으면
 * 표식을 뗄 때 pageEnter가 다시 붙어 처음부터 돈다). 끝나면(animationend · 못 받으면 길이 + 여유 뒤) 표식을 뗀다 — 다음 이동이 같은
 * 종류여도 다시 돌게. 끝 판정은 늘 있는 옅어짐(navFadeIn)으로만 — 밀림(navFrom*)은 본문에 고정 요소가 생기면 CSS가 중간에 떼고
 * (animationcancel), 그때 표식을 떼면 옅어짐까지 끊긴다. 정리 함수를 돌려준다.
 */
export function startNavMotion(doc, kind, { schedule = setTimeout, cancel = clearTimeout } = {}) {
  const root = doc.documentElement;
  const main = doc.getElementById?.('main-content');
  if (!main) return null;
  root.dataset.navMotion = kind;
  for (const animation of doc.getAnimations?.() || []) if (animation.animationName === 'pageEnter') animation.finish();
  let timer = null;
  const end = (event) => {
    if (event && (event.target !== main || event.animationName !== 'navFadeIn')) return;
    main.removeEventListener('animationend', end);
    main.removeEventListener('animationcancel', end);
    cancel(timer);
    if (root.dataset.navMotion === kind) delete root.dataset.navMotion;
  };
  main.addEventListener('animationend', end);
  main.addEventListener('animationcancel', end);
  timer = schedule(() => end(), NAV_MOTION_MS[kind] + 200);
  return () => end();
}

/** Layout에서 한 번 — 경로가 바뀐 커밋마다 판정하고, 움직일 때만 표식을 단다. */
export function useNavMotion(pathname) {
  const causeRef = useRef(null);
  const last = useRef({ pathname: null, index: null, startedAt: -Infinity });
  useEffect(() => watchNavCause(window, causeRef), []);
  useLayoutEffect(() => {
    const prev = last.current;
    const index = historyIndex(window);
    const now = window.performance.now();
    const kind = navMotionKind({ from: prev.pathname, to: pathname, cause: causeRef.current, now, fromIndex: prev.index, toIndex: index });
    last.current = { pathname, index, startedAt: prev.startedAt };
    if (prev.pathname !== pathname) causeRef.current = null;
    if (!kind || now - prev.startedAt < NAV_MOTION_COOLDOWN_MS || !canAnimateNav(document, window)) return;
    if (startNavMotion(document, kind)) last.current.startedAt = now;
  }, [pathname]);
}
