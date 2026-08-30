'use client';

import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState('dark');

  // SSR 이후 클라이언트에서만 적용 → hydration 불일치 방지.
  // 저장값이 있으면 그것이 정본이고, **없을 때만** OS 설정을 따른다(v2-K R1).
  // 예전에는 저장값이 없어도 무조건 dark였다 — OS를 라이트로 쓰는 사람에게
  // 첫 방문이 늘 어두웠다.
  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem('theme'); } catch { /* 사생활 모드 */ }
    if (saved === 'dark' || saved === 'light') { setTheme(saved); return; }
    const prefersLight = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-color-scheme: light)').matches;
    setTheme(prefersLight ? 'light' : 'dark');
  }, []);

  // 부착만 한다 — 여기서 저장까지 하면 사용자가 고른 적 없는 값이 저장되어
  // '저장값 없음'(= OS를 따르는 상태)이 첫 렌더에 사라진다.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 저장은 사용자가 실제로 고를 때만.
  const toggleTheme = () => setTheme((t) => {
    const next = t === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch { /* 무해성 */ }
    return next;
  });

  return { theme, toggleTheme };
}
