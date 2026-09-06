'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { emptyReadingProgress, readingProgressKey, validReadingProgress } from '@/lib/bookNavigation';

export default function useReadingProgress(edition) {
  const { user } = useAuth();
  const key = readingProgressKey(edition, user?.id);
  const [progress, setProgress] = useState(emptyReadingProgress);
  const current = useRef(emptyReadingProgress());
  const ready = useRef(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    function restore() {
      let next = emptyReadingProgress();
      try { next = validReadingProgress(JSON.parse(localStorage.getItem(key) || 'null')); } catch { setStorageAvailable(false); }
      current.current = next; setProgress(next); ready.current = key;
    }
    restore();
    const sync = event => { if (!event.key || event.key === key) restore(); };
    window.addEventListener('storage', sync);
    return () => { ready.current = null; window.removeEventListener('storage', sync); };
  }, [key]);
  const update = useCallback(patch => {
    if (ready.current !== key) return;
    const next = validReadingProgress({ ...current.current, ...patch });
    current.current = next; setProgress(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { setStorageAvailable(false); }
  }, [key]);
  return { progress, update, storageAvailable };
}
