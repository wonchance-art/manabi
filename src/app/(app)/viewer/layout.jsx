import TcFontScope from '@/components/fonts/TcFontScope';
import { preloadNotoSansLatin } from '@/components/fonts/fontHints';

// 대만 번체를 그리는 화면 — Noto Sans TC는 이 세그먼트에서만 싣는다(src/components/fonts/TcFontScope.jsx).
// 병음 · 라틴 본문도 그린다 — Noto Sans 라틴 조각을 미리 받는다(src/components/fonts/fontHints.js).
export default function Layout({ children }) {
  preloadNotoSansLatin();
  return <TcFontScope>{children}</TcFontScope>;
}
