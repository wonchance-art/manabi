'use client';

import { useEffect, useRef } from 'react';

// 마우스 위치 기반 카드 tilt — 데스크탑 한정.
// 호버 lift(translateY)는 룰북 위반이라 안 함. perspective rotation만.
export function useTilt({ max = 4, scale = 1, disabled = false } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia?.('(hover: none)').matches) return; // 터치 디바이스 skip
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    function onMove(e) {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const rx = (0.5 - y) * (max * 2);
      const ry = (x - 0.5) * (max * 2);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(700px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale})`;
      });
    }
    function onLeave() {
      cancelAnimationFrame(raf);
      el.style.transform = '';
    }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
      el.style.transform = '';
    };
  }, [max, scale, disabled]);

  return ref;
}
