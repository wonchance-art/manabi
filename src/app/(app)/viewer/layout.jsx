import { preload } from 'react-dom';
import DeferredZhFontSheets from '@/components/fonts/DeferredZhFontSheets';
import { preloadNotoSansLatin } from '@/components/fonts/fontHints';
// 뷰어 UI 한글을 한 파일(약 50KB)로 — Noto Sans KR 조각 10여 개(약 157KB)를 대신한다(KR-VIEWER-SUBSET-001, 목록 밖 글자는 원래 조각으로).
import '@/components/fonts/kr-viewer/krViewerSubset.css';
import krViewerSubset from '@/components/fonts/kr-viewer/subset.json';

// 뷰어는 중국어(간체 · 번체)를 그리지만 첫 서버 그림에는 그리지 않는다 — SC · TC 글꼴 CSS를 렌더 차단으로 싣지 않고 첫 그림 뒤에 건다
// (VIEWER-FONT-SPLIT-001 2단계, src/components/fonts/DeferredZhFontSheets.jsx). 예전엔 ScFontScope · TcFontScope로 늘 실었다(gz 약 196KB).
// 병음 · 라틴 본문도 그린다 — Noto Sans 라틴 조각을 미리 받는다(src/components/fonts/fontHints.js).
export default function Layout({ children }) {
  preloadNotoSansLatin();
  // 하위 집합은 첫 그림 전에 오게 미리 받는다 — 늦게 오면 상단 막대의 한글이 대체 → 실제 글꼴로 바뀌며 도구 묶음이 4px 밀렸다
  // (운영 실측 CLS 0.0002, #1721 뒤 · 미리 받기를 넣은 시험에서 5/5 CLS 0). next/font가 자기 글꼴을 미리 받는 것과 같은 방식.
  preload(krViewerSubset.woff2.href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  return (
    <>
      {children}
      <DeferredZhFontSheets />
    </>
  );
}
