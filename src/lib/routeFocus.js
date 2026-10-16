// 화면 이동 뒤 포커스 되찾기(APP-FEEL-003, 2026-10-17 KST). 누른 카드 · 탭이 새 화면에서 사라지면 포커스가 body로 떨어져
// 키보드 · 화면 읽기가 처음부터 다시 찾았다. 그때만 본문(#main-content, tabIndex -1)으로 옮긴다 — 살아 있는 포커스는 빼앗지 않는다.
/** @returns {boolean} 옮겼으면 true */
export function focusMainIfLost(doc = globalThis.document) {
  if (!doc) return false;
  const active = doc.activeElement;
  if (active && active !== doc.body && active.isConnected) return false;
  const main = doc.getElementById?.('main-content');
  if (!main) return false;
  main.focus({ preventScroll: true });
  return true;
}
