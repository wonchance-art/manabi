// 휴대폰 표시줄 · 주소창 색(theme-color) 맞추기 — PWA-SHELL-001 ⑩.
// 기본값은 layout.jsx의 meta = 셸 종이(#F6F4EE, brandAssets 계약). 어두운 읽기 테마는 머리(GNB)까지 어둡게 칠하는데
// (reader-controls.css VIEWER-R0 bug 8) 표시줄만 밝은 종이로 남았다 — 머리와 같은 --reader-paper로 바꾸고 화면을 떠나면 되돌린다.
// 값은 CSS 변수에서 읽지 않고 같은 값을 적는다(로딩 화면에는 .viewer-layout이 아직 없다) — 계약이 CSS 값과 맞춰 본다.

export const READER_DARK_PAPER = '#202625';

/** meta[name=theme-color]를 color로 바꾸고, 되돌리는 함수를 준다(meta가 없거나 색이 없으면 아무것도 안 한다). */
export function applyThemeColor(doc, color) {
  const meta = doc?.querySelector?.('meta[name="theme-color"]');
  if (!meta || !color) return () => {};
  const previous = meta.getAttribute('content');
  meta.setAttribute('content', color);
  return () => { if (meta.getAttribute('content') === color) meta.setAttribute('content', previous); };
}

/** 읽기 테마 → 표시줄 색(어둡게만 바꾼다 — 종이 · 밝게는 머리가 셸 종이 그대로라 기본값이 맞다). */
export function readerThemeColor(theme) {
  return theme === 'dark' ? READER_DARK_PAPER : null;
}
