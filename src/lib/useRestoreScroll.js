'use client';
import { useEffect } from 'react';

/**
 * 목록 위치 복원(restoreY) — 서재(LibraryPage)와 함께 읽는 글(LazyMaterialsPage public)이 같이 쓴다(READER-RETURN-001).
 * 목록이 그 높이까지 그려질 때를 rAF로 기다렸다(최대 10초) 한 번에 옮기고, 주소에서 restoreY만 지운다(다시 고침 · 뒤로 가기에
 * 같은 이동이 되풀이되지 않게). 사용자가 먼저 굴리거나(wheel · touchstart) 키를 누르면 복원하지 않는다.
 */
export function useRestoreScroll(restoreY) {
  useEffect(() => {
    const y = Number(restoreY);
    if (restoreY === null || restoreY === undefined || !Number.isFinite(y) || y < 0 || y > 1000000) return;
    let frame, done = false;
    const started = performance.now();
    const stop = () => { done = true; cancelAnimationFrame(frame); };
    const restore = () => {
      if (done) return;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      if (height >= y || performance.now() - started > 10000) {
        window.scrollTo({ top: Math.min(y, height), behavior: 'instant' });
        const url = new URL(window.location.href); url.searchParams.delete('restoreY');
        window.history.replaceState({ ...window.history.state }, '', url.pathname + url.search);
        stop();
      } else frame = requestAnimationFrame(restore);
    };
    frame = requestAnimationFrame(restore);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);
    return () => { stop(); window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); window.removeEventListener('keydown', stop); };
  }, [restoreY]);
}
