'use client';

import { useEffect } from 'react';

/**
 * 레퍼런스 문법 챕터 열람 기록 (localStorage)
 * 강의 페이지(레퍼런스 뷰)의 읽음 표시(● / N/M)에 사용.
 * storageKey: 언어별 키 — fr_read_chapters / ja_read_chapters / en_read_chapters
 */
export default function RefReadMark({ storageKey, slug }) {
  useEffect(() => {
    if (!storageKey || !slug) return;
    try {
      const arr = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!arr.includes(slug)) {
        arr.push(slug);
        localStorage.setItem(storageKey, JSON.stringify(arr));
      }
    } catch {}
  }, [storageKey, slug]);
  return null;
}
