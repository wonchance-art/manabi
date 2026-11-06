import DeferredZhFontSheets from '@/components/fonts/DeferredZhFontSheets';
import { preloadNotoSansLatin } from '@/components/fonts/fontHints';

// 뷰어는 중국어(간체 · 번체)를 그리지만 첫 서버 그림에는 그리지 않는다 — SC · TC 글꼴 CSS를 렌더 차단으로 싣지 않고 첫 그림 뒤에 건다
// (VIEWER-FONT-SPLIT-001 2단계, src/components/fonts/DeferredZhFontSheets.jsx). 예전엔 ScFontScope · TcFontScope로 늘 실었다(gz 약 196KB).
// 병음 · 라틴 본문도 그린다 — Noto Sans 라틴 조각을 미리 받는다(src/components/fonts/fontHints.js).
export default function Layout({ children }) {
  preloadNotoSansLatin();
  return (
    <>
      {children}
      <DeferredZhFontSheets />
    </>
  );
}
