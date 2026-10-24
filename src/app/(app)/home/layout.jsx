import ScFontCookieHint from '@/components/fonts/ScFontCookieHint';
import { preloadNotoSansJpLatin, preloadNotoSerifKrLatin } from '@/components/fonts/fontHints';

// 간체 중국어는 그리는 잎이 독립 스타일시트를 직접 건다(SC-LINK-001 2단계 — src/components/fonts/ScFontLink.jsx의 ZhSlot).
// 이 세그먼트는 next/font SC(ScFontScope)를 싣지 않는다. 중국어 학습자 힌트 쿠키가 있으면 첫 그림 전에 미리 건다.
// 일본어 칸(오늘 문단 · 복습 단어)과 세리프 KR(이어 읽기 · 숫자)을 첫 화면에 그린다 — 두 라틴 조각을 미리 받는다(src/components/fonts/fontHints.js).
export default function Layout({ children }) {
  preloadNotoSansJpLatin();
  preloadNotoSerifKrLatin();
  return <><ScFontCookieHint />{children}</>;
}
