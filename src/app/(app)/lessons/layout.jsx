import ScFontScope from '@/components/fonts/ScFontScope';
import { preloadNotoSansJpLatin } from '@/components/fonts/fontHints';

// 중국어(자료 · 단어 · 표지 글자)를 그릴 수 있는 화면 — Noto Sans SC는 이런 세그먼트에서만 싣는다(src/components/fonts/ScFontScope.jsx).
// 이어 읽기 교재(일본어 표지 글자 · 과 제목)를 첫 화면에 그린다 — 일본어 라틴 조각을 미리 받는다(src/components/fonts/fontHints.js).
export default function Layout({ children }) {
  preloadNotoSansJpLatin();
  return <ScFontScope>{children}</ScFontScope>;
}
