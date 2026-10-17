'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { langFromReadKey, syncReadRemote } from '../lib/refProgress';
import { refDatesKey, refReadKey } from '../lib/refReadStore';

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
  const { user, loading } = useAuth();

  useEffect(() => {
    // 계정이 정해진 뒤에만 쓴다 — 확인 중에 쓰면 로그인한 사람의 읽음이 손님(옛) 키로 샌다(LOCAL-PROGRESS-ACCOUNT-001).
    if (!storageKey || !slug || loading) return;
    const readKey = refReadKey(storageKey, user?.id ?? null), datesKey = refDatesKey(storageKey, user?.id ?? null);
    const lang = langFromReadKey(storageKey);
    // 진입 즉시 기록 — [강의] 복귀 시 언어 유지·해당 챕터로 자동 스크롤용
    try {
      if (lang) {
        localStorage.setItem('lessons_lang', lang);
        localStorage.setItem('ref_last_chapter', JSON.stringify({ lang, slug, at: Date.now() }));
      }
    } catch {}
    const record = () => {
      try {
        const arr = JSON.parse(localStorage.getItem(readKey) || '[]');
        if (!arr.includes(slug)) {
          arr.push(slug);
          localStorage.setItem(readKey, JSON.stringify(arr));
        }
        // 읽은 날짜 — 홈 '오늘 활동' 집계용 (slug → ts)
        const dates = JSON.parse(localStorage.getItem(datesKey) || '{}');
        if (!dates[slug]) {
          dates[slug] = Date.now();
          localStorage.setItem(datesKey, JSON.stringify(dates));
        }
        // 홈 '이어서 학습' 카드용 — 마지막으로 학습한 언어·챕터
        if (lang) localStorage.setItem('ref_last_visit', JSON.stringify({ lang, slug, at: Date.now() }));
      } catch {}
      // 로그인 시 서버 동기화 (실패해도 localStorage가 원본)
      if (user?.id && lang) syncReadRemote(user.id, lang, slug);
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
  }, [storageKey, slug, user?.id, loading]);

  return <span ref={ref} aria-hidden="true" style={{ display: 'block', height: 1 }} />;
}
