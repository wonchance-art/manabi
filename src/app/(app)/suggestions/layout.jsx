import TcFontScope from '@/components/fonts/TcFontScope';

// 대만 번체를 그리는 화면 — Noto Sans TC는 이 세그먼트에서만 싣는다(src/components/fonts/TcFontScope.jsx).
export default function Layout({ children }) {
  return <TcFontScope>{children}</TcFontScope>;
}
