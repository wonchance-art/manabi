'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * 본문 스크롤 기반 읽기 진행률.
 * @returns {{ readerRef, readProgress }} readerRef는 본문 컨테이너에 부착
 */
export function useReadProgress(material) {
  const readerRef = useRef(null);
  const [readProgress, setReadProgress] = useState(0);

  useEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const rect = el.getBoundingClientRect();
      const total = el.scrollHeight - window.innerHeight;
      if (total <= 0) { setReadProgress(100); return; }
      const scrolled = -rect.top + 80;
      setReadProgress(Math.min(100, Math.max(0, Math.round((scrolled / total) * 100))));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [material]);

  return { readerRef, readProgress };
}
