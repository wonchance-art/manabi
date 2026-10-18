import ScFontScope from '@/components/fonts/ScFontScope';

// 중국어(자료 · 단어 · 표지 글자)를 그릴 수 있는 화면 — Noto Sans SC는 이런 세그먼트에서만 싣는다(src/components/fonts/ScFontScope.jsx).
export default function Layout({ children }) {
  return <ScFontScope>{children}</ScFontScope>;
}
