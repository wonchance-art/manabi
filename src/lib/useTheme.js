'use client';

import { useState, useEffect } from 'react';

// 첫 값은 머리 스크립트(app/layout.jsx)가 이미 붙인 값이다 — 같은 규칙이라 아래 effect가 값을 바꾸지 않는다(THEME-INIT-001).
// 예전 첫 값 'dark'는 OS 라이트 · 저장값 light 사용자에게 붙을 때 dark → light 두 번 바꾸기(페이지 전체 스타일 재계산)를 만들었다.
// 값은 그리지 않고 붙이기에만 쓰므로 서버('dark')와 달라도 붙기 불일치가 없다.
function attachedTheme() {
  if (typeof document === 'undefined') return 'dark';
  const attached = document.documentElement.getAttribute('data-theme');
  return attached === 'dark' || attached === 'light' ? attached : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState(attachedTheme);

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
  // 이미 같은 값이면 건드리지 않는다 — 같은 값 다시 쓰기도 속성 변경(스타일 무효화)으로 잡힌다.
  useEffect(() => {
    if (document.documentElement.getAttribute('data-theme') !== theme) document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 저장은 사용자가 실제로 고를 때만.
  const toggleTheme = () => setTheme((t) => {
    const next = t === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch { /* 무해성 */ }
    return next;
  });

  return { theme, toggleTheme };
}
