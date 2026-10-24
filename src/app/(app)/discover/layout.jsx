import { preloadNotoSerifKrLatin } from '@/components/fonts/fontHints';

// 간체 중국어는 그리는 잎이 독립 스타일시트를 직접 건다(SC-LINK-001 2단계 — src/components/fonts/ScFontLink.jsx의 ZhSlot).
// 이 세그먼트 layout은 쿠키를 읽지 않는다(GUEST-STATIC-001 2단계 — 본 화면이 ISR이다). 간체 힌트 쿠키 판정은 middleware가
// 간체 판(/discover/sc)으로 넘기고, 힌트 부품은 이미 동적인 잎 화면(reading · classics)이 직접 단다.
// 타일 제목 · 큰 숫자를 세리프 KR로 그린다 — 그 라틴 조각을 미리 받는다(src/components/fonts/fontHints.js, 빌드 값이라 정적).
export default function Layout({ children }) {
  preloadNotoSerifKrLatin();
  return children;
}
