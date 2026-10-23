'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { NAV_MOTION_COOLDOWN_MS, NAV_TAB_SELECTOR, canAnimateNav, navMotionKind } from './navMotion';

// 화면 이동 손맛 실행부(NAV-MOTION-001). 판정은 navMotion.js, 움직임 값은 web-shell.css NAV-MOTION 블록.
//
// 순서(경로가 바뀐 커밋 — 그리기 전, useLayoutEffect):
// ① html[data-nav-motion-capture]로 본문(#main-content)을 잠깐 투명하게 → 전환의 「이전」 사진 = 빈 종이 + 머리말 · 아래 메뉴.
//    (이전 화면은 이미 DOM에 없다. 사진을 그대로 찍으면 새 화면이 한 장 보였다가 0에서 다시 떠오르는 깜빡임이 생긴다.)
// ② document.startViewTransition — 콜백에서 ①을 지우고 .page-container의 옛 등장(pageEnter)을 끝낸다(두 번 움직이지 않게).
// ③ 「새」 화면은 살아 있는 상태로 들어온다 — 스트리밍 · 스크롤 복원 · 포커스 이동이 그 사이에도 그대로 보인다.
// 누른 순간의 기록(메뉴 · 뒤로가기)은 원인으로만 쓴다. 누른 순간에는 아무것도 하지 않는다(INP · 대기 밑줄 불변).
const html = (doc) => doc.documentElement;

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
 * 한 번의 전환을 시작한다. 시작했으면 true.
 * 실패 · 건너뜀(같은 이름 둘 · 숨은 탭 등)이어도 콜백은 불리므로 ①은 반드시 지워진다 — 그래도 못 부르는 경우를 위해 finished에서 한 번 더.
 */
export function startNavMotion(doc, kind) {
  const root = html(doc);
  root.dataset.navMotion = kind;
  root.dataset.navMotionCapture = '';
  const reveal = () => {
    delete root.dataset.navMotionCapture;
    for (const animation of doc.getAnimations?.() || []) if (animation.animationName === 'pageEnter') animation.finish();
  };
  let transition;
  try {
    transition = doc.startViewTransition(reveal);
  } catch {
    reveal();
    delete root.dataset.navMotion;
    return false;
  }
  transition.ready?.catch(() => {});
  transition.updateCallbackDone?.catch(() => {});
  const done = () => { reveal(); if (root.dataset.navMotion === kind) delete root.dataset.navMotion; };
  (transition.finished || Promise.resolve()).then(done, done);
  return true;
}

/** Layout에서 한 번 — 경로가 바뀐 커밋마다 판정하고, 움직일 때만 전환을 시작한다. */
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
