'use client';

// Explicit start/stop is owned by the viewer; this timer retains dwell during holds.
import { useEffect, useRef } from 'react';

export function useReadingPacer({
  enabled = false,
  dwell = null,
  paused = false,
  cursor = null,
  onAdvance,
  resumeGrace = 2000,
} = {}) {
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;
  /** 이 문장에 남은 체류(ms). 일시정지 때 깎아 두었다가 재개 시 이어 쓴다. */
  const remainingRef = useRef(null);
  const heldRef = useRef(false);

  // 문장이 바뀌거나 목표 속도가 바뀌면 체류를 처음부터 — 남은 시간을 물려받지 않는다.
  useEffect(() => {
    remainingRef.current = Number.isFinite(dwell) ? dwell : null;
  }, [cursor, dwell, enabled]);

  useEffect(() => {
    if (!enabled) { heldRef.current=false; return undefined; }
    if (paused) { heldRef.current=true; return undefined; }
    if (!Number.isFinite(dwell)) return undefined;
    if (heldRef.current) { remainingRef.current=Math.max(resumeGrace,remainingRef.current ?? dwell); heldRef.current=false; }
    if (remainingRef.current == null) remainingRef.current = dwell;
    const startedAt = Date.now();
    const id = setTimeout(() => {
      remainingRef.current = null;   // 소진 — 다음 문장에서 새로 잰다
      onAdvanceRef.current?.();
    }, Math.max(0, remainingRef.current));
    return () => {
      clearTimeout(id);
      // 재개는 '이어서'다. 카드 한 번 열었다고 체류가 처음으로 돌아가면 사전을 찾을수록
      // 페이서가 제자리걸음을 한다(설계 §5 일시정지 = 멈춤·재개).
      if (remainingRef.current != null) {
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
      }
    };
  }, [enabled, paused, dwell, cursor, resumeGrace]);
}
