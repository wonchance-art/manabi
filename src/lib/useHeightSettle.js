'use client';
import { useLayoutEffect, useRef } from 'react';
import { reducedMotion } from './reducedMotion';

/**
 * 골격 → 실제 내용으로 바뀔 때 칸 높이를 **짧게 옮긴다**(LOADING-SKELETON-001 후속 — 서재 대화 묶음).
 * 받기 전엔 줄 수를 알 수 없어 골격 높이와 실제 높이가 다를 수 있다. 그 차이를 한 프레임에 뛰지 않고
 * 0.2초에 옮긴다(이전 높이 → 새 높이, transition은 CSS `.is-height-settling`이 진다 — 곡선 토큰 · 모션 축소 블록).
 * `phase`가 바뀔 때만 잰다(예: 'pending' → 'ready') — 사용자가 누른 펼치기 · 접기는 그대로 즉시.
 * 동작 줄이기면 옮기지 않는다(바로 새 높이). 레이아웃 효과라 첫 그림 전에 이전 높이로 고정된다.
 */
export function useHeightSettle(phase) {
  const ref = useRef(null);
  const last = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) { last.current = null; return undefined; }
    const next = el.getBoundingClientRect().height;
    const prev = last.current;
    last.current = next;
    return settleHeight(el, prev, next, reducedMotion());
  }, [phase]);
  return ref;
}

/**
 * 한 번 옮기기 — 이전 높이(prev)에 고정한 뒤 새 높이(next)로 전이시키고, 끝나면(transitionend 또는 400ms) 원래대로.
 * 옮길 게 없으면(첫 측정 · 1px 미만 차이 · 동작 줄이기) 아무것도 하지 않는다. 돌려주는 함수 = 정리(효과 cleanup).
 */
export function settleHeight(el, prev, next, reduce) {
  if (prev == null || Math.abs(prev - next) < 1 || reduce) return undefined;
  el.style.height = `${prev}px`;
  el.classList.add('is-height-settling');
  el.getBoundingClientRect(); // 이전 높이를 한 번 확정해야 전이가 그 높이에서 시작한다
  el.style.height = `${next}px`;
  const done = () => { el.style.height = ''; el.classList.remove('is-height-settling'); };
  el.addEventListener('transitionend', done, { once: true });
  const timer = setTimeout(done, 400); // transitionend가 안 오는 경우(숨김 · 탭 전환)도 원래대로
  return () => { clearTimeout(timer); el.removeEventListener('transitionend', done); done(); };
}
