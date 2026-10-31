'use client';
import { useEffect, useState } from 'react';
import { GNB_AUTOHIDE, isGnbAutoHideRoute, nextGnbHidden } from './gnbAutoHide';

/** 긴 글 화면 · 휴대폰 폭에서만 스크롤 방향으로 머리를 숨긴다(GNB-AUTOHIDE-001). 화면 읽기 · 키보드 포커스가 머리에 들어오면 보인다. */
export function useGnbAutoHide(pathname) {
  const [hidden, setHidden] = useState(false);
  const enabled = isGnbAutoHideRoute(pathname);
  useEffect(() => {
    setHidden(false);
    if (!enabled || typeof window === 'undefined') return undefined;
    const narrow = window.matchMedia(`(max-width: ${GNB_AUTOHIDE.maxWidth}px)`);
    let state = { hidden: false, anchor: window.scrollY }, lastY = window.scrollY, frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = Math.max(0, window.scrollY);
        state = narrow.matches ? nextGnbHidden({ ...state, y, lastY }) : { hidden: false, anchor: y };
        lastY = y;
        setHidden(state.hidden);
      });
    };
    const onFocus = (event) => { if (event.target instanceof Element && event.target.closest('.gnb')) { state = { hidden: false, anchor: window.scrollY }; setHidden(false); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusin', onFocus);
    return () => { window.removeEventListener('scroll', onScroll); document.removeEventListener('focusin', onFocus); if (frame) cancelAnimationFrame(frame); };
  }, [enabled, pathname]);
  return enabled && hidden;
}
