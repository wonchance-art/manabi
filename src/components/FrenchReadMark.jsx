'use client';

import { useEffect } from 'react';

/**
 * 프랑스어 문법 챕터 열람 기록 (localStorage)
 * 강의 페이지(🇫🇷 탭)의 읽음 표시(● / N/M)에 사용.
 */
export default function FrenchReadMark({ slug }) {
  useEffect(() => {
    if (!slug) return;
    try {
      const key = 'fr_read_chapters';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (!arr.includes(slug)) {
        arr.push(slug);
        localStorage.setItem(key, JSON.stringify(arr));
      }
    } catch {}
  }, [slug]);
  return null;
}
