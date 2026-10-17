'use client';
import { Children, cloneElement, createContext, isValidElement, Suspense, useContext } from 'react';

// 간체 중국어 글꼴을 「그리는 잎」이 직접 거는 방식(SC-LINK-001 2단계 · 설계 메모 A안, 2026-10-17 KST).
// next/font SC(@font-face 303개, gz 약 95KB)는 그것을 import한 라우트 CSS에 통째로 실려 중국어를 안 그리는 사람에게도
// 렌더 차단이었다. 이제 lang zh*를 그리는 잎이 독립 스타일시트(scripts/fonts/sc-stylesheet.cjs → env MANABI_SC_STYLESHEET)를
// React 19 <link rel="stylesheet" precedence>로 건다:
//   - 서버 렌더에서 만나면 React가 head로 올려 첫 그림 전에 받는다(지금처럼 렌더 차단, 대체 글꼴 깜빡임 없음).
//   - 데이터가 온 뒤 클라이언트에서 처음 만나면 그 잎만 스타일시트가 올 때까지 멈추고(Suspense), 그동안 같은 요소를
//     visibility: hidden으로 자리만 지킨다(자리 이동 0 · 대체 글꼴로 먼저 그리지 않음).
//   - 같은 href는 React가 하나로 합친다. ScFontScope(next/font SC) 안이면 걸지 않는다(두 벌 @font-face → 이중 다운로드 방지).
export const ScFontInScope = createContext(false);

/** ScFontScope가 감싸개 안쪽에 둔다 — 이 안의 잎은 next/font SC가 이미 있으므로 링크를 걸지 않는다. */
export function ScFontScopeMarker({ children }) {
  return <ScFontInScope.Provider value>{children}</ScFontInScope.Provider>;
}

export const SC_STYLESHEET_HREF = process.env.MANABI_SC_STYLESHEET || '';
export const isZhLang = (lang) => typeof lang === 'string' && /^zh(?:-|$)/i.test(lang);

/** 독립 스타일시트 링크 하나. 범위(ScFontScope) 안 · 주소 없음(글꼴 입력 없는 next dev)이면 아무것도 그리지 않는다. */
export function ScFontLink() {
  const inScope = useContext(ScFontInScope);
  if (inScope || !SC_STYLESHEET_HREF) return null;
  return <link rel="stylesheet" href={SC_STYLESHEET_HREF} precedence="font-sc" />;
}

/**
 * lang이 zh*면 자식(요소 하나)을 스타일시트가 온 뒤에 보인다 — 잎 가까이의 Suspense 경계.
 * 기다리는 동안은 같은 요소를 visibility: hidden으로 그려 자리를 지킨다. zh가 아니면 자식 그대로.
 */
export function ZhSlot({ lang, children }) {
  const inScope = useContext(ScFontInScope);
  if (!isZhLang(lang) || inScope || !SC_STYLESHEET_HREF) return children;
  const only = Children.only(children);
  const hidden = isValidElement(only) ? cloneElement(only, { style: { ...(only.props.style || {}), visibility: 'hidden' }, 'aria-hidden': true }) : null;
  return (
    <Suspense fallback={hidden}>
      <ScFontLink />
      {only}
    </Suspense>
  );
}
