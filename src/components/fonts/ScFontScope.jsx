import { Noto_Sans_SC } from 'next/font/google';
import ScFontBodyVariable from './ScFontBodyVariable';
import { ScFontScopeMarker } from './ScFontLink';

// 간체 중국어(Noto Sans SC)는 중국어를 그릴 수 있는 화면에만 건다(FONT-SC-SCOPE-001, 2026-10-17 KST).
// 루트에 두면 모든 페이지 head CSS에 SC @font-face 303개(gz 약 91KB, 렌더 차단)가 실렸다. 중국어(lang zh* · :lang(zh) ·
// 중국어 뷰어 글꼴)는 자료 · 단어 · 표지 글자가 학습 언어를 따라가는 화면에서 나온다 — 지도는 src/app/__tests__/fontScope.test.js.
// 선언은 여기 한 벌이다(FONT-HINT-001 「이중 선언 금지」를 SC에도 — 다른 곳에서 Noto_Sans_SC(를 부르면 @font-face가 두 벌).
// TcFontScope와 같은 display: contents 감싸개(상자 · 레이아웃 무변경). 감싸개 밖으로 나가는 포털(한자판 · 수업 판서)은
// body에도 같은 변수 클래스를 건다(ScFontBodyVariable — 포털은 마운트 뒤에만 그리므로 그 전에 걸린다).
// 이 범위 밖의 --font-noto-sc 사용은 CSS 폴백(var(--font-noto-sc, 'Noto Sans SC'))으로 선언이 통째로 무효가 되지 않는다.
const notoSc = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sc',
  display: 'swap',
});

export default function ScFontScope({ children }) {
  return (
    <div className={notoSc.variable} style={{ display: 'contents' }}>
      <ScFontBodyVariable className={notoSc.variable} />
      {/* 범위 안 잎(ZhSlot)은 독립 스타일시트를 걸지 않는다 — @font-face 두 벌 · 이중 다운로드 방지(SC-LINK-001). */}
      <ScFontScopeMarker>{children}</ScFontScopeMarker>
    </div>
  );
}
