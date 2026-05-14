'use client';

import { useEffect, useRef, useState } from 'react';

// requestAnimationFrame 기반 숫자 카운트업.
// IntersectionObserver로 viewport 진입 시 시작 (off-screen에선 작동 X).
export function useCountUp(target, { duration = 700, startOnVisible = true } = {}) {
  const [value, setValue] = useState(startOnVisible ? 0 : target);
  const elRef = useRef(null);
  const startedRef = useRef(false);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (typeof window === 'undefined') { setValue(target); return; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    if (!startOnVisible) {
      runAnim(0, target);
      return;
    }
    if (!elRef.current) return;
    if (startedRef.current) {
      runAnim(value, target);
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          runAnim(0, target);
        }
      }
    }, { threshold: 0.3 });
    obs.observe(elRef.current);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, startOnVisible]);

  function runAnim(from, to) {
    const t0 = performance.now();
    let raf;
    function step(now) {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const next = from + (to - from) * eased;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }

  return { value: Math.round(value), ref: elRef };
}
