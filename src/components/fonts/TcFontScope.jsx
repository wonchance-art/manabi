import { Noto_Sans_TC } from 'next/font/google';
import SegmentSlot from '../SegmentSlot';

// 대만 번체(zh-TW · zh-Hant-TW)를 그리는 화면에만 Noto Sans TC를 건다(FONT-TC-SCOPE-001, 2026-10-17 KST).
// 루트에 두면 모든 페이지 head CSS에 TC @font-face 325개(gz 36KB, 렌더 차단)가 실렸다. 번체를 그리는 곳은
// 뷰어(UI · 해설 언어 zh-TW, 자형 열 正)와 중국어 레벨 목록(正 표기)뿐이다 — 지도는 fontScope.test.js.
// (app) 레이아웃의 serif · manrope와 같은 방식: display: contents 감싸개에 변수 클래스(상자 · 레이아웃 무변경).
// 이 범위 밖의 --font-noto-tc 사용은 CSS 폴백(var(--font-noto-tc, 'Noto Sans TC'))으로 시스템 글꼴에 떨어진다.
const notoTc = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-tc',
  display: 'swap',
});

export default function TcFontScope({ children }) {
  // 세그먼트 자리를 div 바로 안에 두지 않는다 — 하이드레이션 #418 간헐(HYDRATION-SLOT-001, src/components/SegmentSlot.jsx).
  return <div className={notoTc.variable} style={{ display: 'contents' }}><SegmentSlot>{children}</SegmentSlot></div>;
}
