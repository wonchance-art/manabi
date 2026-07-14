'use client';

import { useEffect, useRef, useState } from 'react';
import { worldTimeAt } from './worldClock';

export function useWorldClock() {
  const offsetRef = useRef(0);
  const clockRef = useRef(worldTimeAt());
  const [snapshot, setSnapshot] = useState(clockRef.current);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const sync = async () => {
      const sentAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch('/api/world/time', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const body = await response.json();
        const receivedAt = Date.now();
        const midpoint = sentAt + (receivedAt - sentAt) / 2;
        if (!cancelled && Number.isFinite(body.serverNowMs)) offsetRef.current = body.serverNowMs - midpoint;
      } catch { /* 오프라인은 고정 epoch 공식을 그대로 사용한다. */ }
      finally { clearTimeout(timeout); }
    };

    const update = () => {
      const next = worldTimeAt(Date.now() + offsetRef.current);
      clockRef.current = next;
      if (!cancelled) setSnapshot(next);
    };

    const resync = () => { sync().finally(update); };
    resync();
    timer = setInterval(update, 1000);
    const syncTimer = setInterval(sync, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') resync(); };
    window.addEventListener('online', resync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearInterval(syncTimer);
      window.removeEventListener('online', resync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { snapshot, clockRef };
}
