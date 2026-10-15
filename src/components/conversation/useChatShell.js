'use client';
// 채팅 화면 껍데기 공용 부품(CONV-CHAT-001) — 튜터 대화방과 모두의 대화방이 같은 규칙을 쓴다.
//  · useChatScroll: 맨 아래 근처일 때만 새 말을 따라가고, 내가 보냈으면 항상 맨 아래로, 위를 보면 「새 메시지 ↓」
//  · useChatViewport: 키보드 — Android는 interactive-widget=resizes-content로 화면이 줄고, iOS는 visualViewport 높이에 맞춘다.
//    viewport 메타는 이 화면에서만 바꾸고 나가면 되돌린다(다른 화면 영향 0).
//  · useAutoGrow: 입력창은 한 줄에서 시작해 다섯 줄까지 자라고, 그 위로는 입력창 안에서 스크롤한다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const CHAT_COMPOSER_MAX_LINES = 5;
export const CHAT_NEAR_BOTTOM_PX = 100;

export function useChatScroll(logRef, { resetKey, changeKey }) {
  const nearBottomRef = useRef(true);
  const sentRef = useRef(false);
  const [jump, setJump] = useState(false);
  const toBottom = useCallback((smooth) => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTo?.({ top: log.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    nearBottomRef.current = true;
    setJump(false);
  }, [logRef]);
  const onScroll = useCallback(() => {
    const log = logRef.current;
    if (!log) return;
    nearBottomRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < CHAT_NEAR_BOTTOM_PX;
    if (nearBottomRef.current) setJump(false);
  }, [logRef]);
  // 처음 열면 마지막 말에서 시작한다(채팅앱).
  useLayoutEffect(() => { toBottom(false); }, [resetKey, toBottom]);
  useEffect(() => {
    if (sentRef.current || nearBottomRef.current) toBottom(true);
    else setJump(true);
    sentRef.current = false;
  }, [changeKey, toBottom]);
  const markSent = useCallback(() => { sentRef.current = true; }, []);
  return { jump, onScroll, toBottom, nearBottomRef, markSent };
}

export function useChatViewport(shellRef, { nearBottomRef, toBottom }) {
  const latest = useRef({ nearBottomRef, toBottom });
  latest.current = { nearBottomRef, toBottom };
  useEffect(() => {
    const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="viewport"]') : null;
    const before = meta?.getAttribute('content');
    if (meta && before != null && !/interactive-widget/.test(before)) {
      meta.setAttribute('content', `${before}, interactive-widget=resizes-content, viewport-fit=cover`);
    }
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const shell = shellRef.current;
    if (!vv || !shell) return () => { if (meta && before != null) meta.setAttribute('content', before); };
    const fit = () => {
      const stick = latest.current.nearBottomRef?.current;
      shell.style.setProperty('--conv-vh', `${Math.round(vv.height)}px`);
      // iOS는 키보드가 열려도 레이아웃을 줄이지 않고 화면을 밀어 올린다 — 밀린 만큼 껍데기를 따라 내린다.
      shell.style.setProperty('--conv-top', `${Math.max(0, Math.round(vv.offsetTop))}px`);
      if (stick) requestAnimationFrame(() => latest.current.toBottom?.(false));
    };
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
      if (meta && before != null) meta.setAttribute('content', before);
    };
  }, [shellRef]);
}

export function useAutoGrow(inputRef, value) {
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cs = getComputedStyle(el);
    const px = (k) => parseFloat(cs[k]) || 0;
    const border = px('borderTopWidth') + px('borderBottomWidth');
    const max = (px('lineHeight') || 24) * CHAT_COMPOSER_MAX_LINES + px('paddingTop') + px('paddingBottom') + border;
    el.style.height = `${Math.min(el.scrollHeight + border, max)}px`;
  }, [inputRef, value]);
}
