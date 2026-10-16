// 화면 이동 뒤 포커스 되찾기(APP-FEEL-003, 2026-10-17 KST). 누른 카드 · 탭이 새 화면에서 사라지면 포커스가 body로 떨어져
// 키보드 · 화면 읽기가 처음부터 다시 찾았다. 그때만 새 화면의 첫 제목(h1)으로 옮긴다 — 살아 있는 포커스는 빼앗지 않는다.
// 제목으로 보내는 이유: 본문 전체(#main-content)에 초점을 두면 화면 읽기(JAWS 등)가 큰 영역을 길게 읽는다. 제목이면 「어디에 왔는지」 한 줄.
// 제목이 없거나(또는 화면 읽기에 숨긴 대기 화면 제목뿐이거나) 초점을 받지 못하면 본문(#main-content, tabIndex -1)으로.

/** 화면 읽기에 숨기지 않은 첫 h1 — 대기 화면(loading.jsx)의 h1은 aria-hidden이라 건너뛴다. */
function pageHeading(main) {
  const headings = main?.querySelectorAll ? [...main.querySelectorAll('h1')] : [];
  return headings.find((h) => !h.closest?.('[aria-hidden="true"]')) || null;
}

/** @returns {'heading' | 'main' | null} 옮긴 곳(옮기지 않았으면 null) */
export function focusPageIfLost(doc = globalThis.document) {
  if (!doc) return null;
  const active = doc.activeElement;
  if (active && active !== doc.body && active.isConnected) return null;
  const main = doc.getElementById?.('main-content');
  if (!main) return null;
  const heading = pageHeading(main);
  if (heading) {
    // 제목은 원래 초점을 받지 않는다 — 이미 tabindex가 있으면 그대로 두고, 없을 때만 -1(Tab 순서에는 넣지 않는다).
    if (!heading.hasAttribute?.('tabindex')) heading.setAttribute?.('tabindex', '-1');
    heading.focus({ preventScroll: true });
    if (doc.activeElement === heading) return 'heading';
  }
  main.focus({ preventScroll: true });
  return 'main';
}
