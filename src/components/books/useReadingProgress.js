'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { emptyReadingProgress, readingProgressKey, validReadingProgress } from '@/lib/bookNavigation';

export default function useReadingProgress(edition) {
  const { user, loading } = useAuth();
  const key = readingProgressKey(edition, user?.id);
  const [snapshot, setSnapshot] = useState(null);
  const current = useRef(null);
  useEffect(() => {
    if (loading || !edition) return;
    function restore() {
      let raw = null, storageAvailable = true;
      try { raw = JSON.parse(localStorage.getItem(key) || 'null'); } catch { storageAvailable = false; }
      const progress = validReadingProgress(raw);
      const next = { key, progress, hasProgress: !!raw && raw.page === progress.page, updatedAt: raw?.updatedAt || null, storageAvailable };
      current.current = next; setSnapshot(next);
    }
    restore();
    const sync = event => { if (!event.key || event.key === key) restore(); };
    window.addEventListener('storage', sync);
    return () => { current.current = null; window.removeEventListener('storage', sync); };
  }, [key, edition, loading]);
  const update = useCallback(patch => {
    if (current.current?.key !== key) return;
    const progress = validReadingProgress({ ...current.current.progress, ...patch });
    const updatedAt = new Date().toISOString();
    const next = { key, progress, updatedAt, hasProgress: true, storageAvailable: true };
    try { localStorage.setItem(key, JSON.stringify({ ...progress, updatedAt })); } catch { next.storageAvailable = false; }
    current.current = next; setSnapshot(next);
  }, [key]);
  const ready = !loading && snapshot?.key === key;
  return { progress: ready ? snapshot.progress : emptyReadingProgress(), update, ready,
    hasProgress: ready && snapshot.hasProgress, updatedAt: ready ? snapshot.updatedAt : null,
    storageAvailable: ready ? snapshot.storageAvailable : true };
}
