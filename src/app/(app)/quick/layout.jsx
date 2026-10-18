import ScFontScope from '@/components/fonts/ScFontScope';
import { preloadNotoSansLatin } from '@/components/fonts/fontHints';

// 빠른 분석 — 뷰어 정본 토큰(병음 · 라틴 본문)을 그린다. Noto Sans 라틴 조각을 미리 받는다(src/components/fonts/fontHints.js).
// 중국어 분석 결과(간체)도 그린다 — Noto Sans SC를 싣는다(src/components/fonts/ScFontScope.jsx).
export default function Layout({ children }) {
  preloadNotoSansLatin();
  return <ScFontScope>{children}</ScFontScope>;
}
