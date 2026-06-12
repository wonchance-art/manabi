'use client';

import { useEffect, useRef } from 'react';

/**
 * 레퍼런스 문법 챕터 읽음 기록 (localStorage)
 * 강의 페이지(레퍼런스 뷰)의 읽음 표시(● / N/M)에 사용.
 * storageKey: 언어별 키 — fr_read_chapters / ja_read_chapters / en_read_chapters
 *
 * 챕터 끝에 센티널로 렌더 — 끝까지 스크롤해야 '읽음'으로 기록한다.
 * (IntersectionObserver 미지원 환경은 종전처럼 열람 즉시 기록)
 */
export default function RefReadMark({ storageKey, slug }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!storageKey || !slug) return;
    const record = () => {
      try {
        const arr = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!arr.includes(slug)) {
          arr.push(slug);
          localStorage.setItem(storageKey, JSON.stringify(arr));
        }
        // 홈 '이어서 학습' 카드용 — 마지막으로 학습한 언어·챕터
        const lang = { ja: 'Japanese', en: 'English', fr: 'French' }[storageKey.slice(0, 2)];
        if (lang) localStorage.setItem('ref_last_visit', JSON.stringify({ lang, slug, at: Date.now() }));
      } catch {}
    };
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      record();
      return;
    }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        record();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [storageKey, slug]);

  return <span ref={ref} aria-hidden="true" style={{ display: 'block', height: 1 }} />;
}
