// 변수 · 크기 보정 대체 글꼴(--font-noto-sc · --font-noto-tc) — 시트를 거는 부품(DeferredZhFontSheets)은 쪽이 싣는다.
import '@/components/fonts/zhFontVars.css';
import { preloadNotoSansLatin } from '@/components/fonts/fontHints';
// 뷰어 UI 한글을 한 파일(약 51KB)로 — Noto Sans KR 조각 10여 개(약 157KB)를 대신한다(KR-VIEWER-SUBSET-001, 목록 밖 글자는 원래 조각으로).
import { preloadKrUiSubset } from '@/components/fonts/kr-viewer/KrUiSubset';

// 뷰어는 중국어(간체 · 번체)를 그리지만 첫 서버 그림에는 그리지 않는다 — SC · TC 글꼴 CSS를 렌더 차단으로 싣지 않고 첫 그림 뒤에 건다
// (VIEWER-FONT-SPLIT-001 2단계, src/components/fonts/DeferredZhFontSheets.jsx). 예전엔 ScFontScope · TcFontScope로 늘 실었다(gz 약 196KB).
// 미리 받기 · 붙이는 때는 본문 언어를 아는 쪽([id]/page.jsx)이 정한다(VIEWER-MOBILE-PERF-001) — 셸이 걸면 일본어 · 영어 뷰어도 받았다.
// 병음 · 라틴 본문도 그린다 — Noto Sans 라틴 조각을 미리 받는다(src/components/fonts/fontHints.js).
export default function Layout({ children }) {
  preloadNotoSansLatin();
  // 하위 집합은 첫 그림 전에 오게 미리 받는다(늦으면 상단 막대가 4px 밀렸다 — #1723). next/font가 자기 글꼴을 미리 받는 것과 같은 방식.
  preloadKrUiSubset();
  return children;
}
