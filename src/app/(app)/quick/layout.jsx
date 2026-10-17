import { preloadNotoSansLatin } from '@/components/fonts/fontHints';

// 빠른 분석 — 뷰어 정본 토큰(병음 · 라틴 본문)을 그린다. Noto Sans 라틴 조각을 미리 받는다(src/components/fonts/fontHints.js).
export default function Layout({ children }) {
  preloadNotoSansLatin();
  return children;
}
