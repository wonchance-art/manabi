// 화면 이동 뒤 포커스 되찾기(APP-FEEL-003, 2026-10-17 KST). 누른 카드 · 탭이 새 화면에서 사라지면 포커스가 body로 떨어져
// 키보드 · 화면 읽기가 처음부터 다시 찾았다. 그때만 새 화면의 첫 제목(h1)으로 옮긴다 — 살아 있는 포커스는 빼앗지 않는다.
// 제목으로 보내는 이유: 본문 전체(#main-content)에 초점을 두면 화면 읽기(JAWS 등)가 큰 영역을 길게 읽는다. 제목이면 「어디에 왔는지」 한 줄.
// 제목이 없거나(또는 화면 읽기에 숨긴 대기 화면 제목뿐이거나) 초점을 받지 못하면 본문(#main-content, tabIndex -1)으로.

/** 화면 읽기에 숨기지 않은 첫 h1 — 대기 화면(loading.jsx)의 h1은 aria-hidden(또는 받는 중 aria-busy 영역 안)이라 건너뛴다. */
function pageHeading(main) {
  const headings = main?.querySelectorAll ? [...main.querySelectorAll('h1')] : [];
  return headings.find((h) => !h.closest?.('[aria-hidden="true"], [aria-busy="true"]')) || null;
}

/** 제목에 초점 — 원래 초점을 받지 않으므로 tabindex가 없을 때만 -1(Tab 순서에는 넣지 않는다). 받았으면 true. */
function focusHeading(doc, heading) {
  if (!heading.hasAttribute?.('tabindex')) heading.setAttribute?.('tabindex', '-1');
  heading.focus({ preventScroll: true });
  return doc.activeElement === heading;
}

/** @returns {'heading' | 'main' | null} 옮긴 곳(옮기지 않았으면 null) */
export function focusPageIfLost(doc = globalThis.document) {
  if (!doc) return null;
  const active = doc.activeElement;
  if (active && active !== doc.body && active.isConnected) return null;
  const main = doc.getElementById?.('main-content');
  if (!main) return null;
  const heading = pageHeading(main);
  if (heading && focusHeading(doc, heading)) return 'heading';
  main.focus({ preventScroll: true });
  return 'main';
}

/** 본문으로 보낸 뒤 실제 제목을 기다리는 최대 시간 — 대기 화면(loading.jsx) 뒤 첫 내용이 오는 데 보통 1초 안. */
export const HEADING_WATCH_MS = 2000;

/**
 * 대기 화면이 떠 있어 본문(#main-content)으로 보냈다면 — 실제 화면의 첫 제목(h1)이 나타날 때 **한 번** 그리로 옮긴다
 * (병합 전 교차 리뷰 S2: 다음 프레임에는 대부분 대기 화면이라 제목이 없어, 「어디에 왔는지」 한 줄 대신 본문이 남았다).
 * 옮기는 건 포커스가 아직 본문에 있을 때뿐이다 — 그사이 사용자가 누르거나 키를 쓰면(pointerdown · keydown) 지켜보기를 멈추고,
 * HEADING_WATCH_MS가 지나거나 다음 이동(돌려준 정리 함수)에서도 멈춘다.
 * @returns {() => void} 정리 함수(지켜보기 끝)
 */
export function watchPageHeading(doc = globalThis.document, {
  timeoutMs = HEADING_WATCH_MS, Observer = globalThis.MutationObserver, schedule = setTimeout, cancel = clearTimeout,
} = {}) {
  const main = doc?.getElementById?.('main-content');
  if (!main || typeof Observer !== 'function') return () => {};
  let done = false, observer = null, timer = null;
  const stop = () => {
    if (done) return;
    done = true;
    observer?.disconnect();
    cancel(timer);
    doc.removeEventListener?.('pointerdown', stop, true);
    doc.removeEventListener?.('keydown', stop, true);
  };
  const check = () => {
    if (done) return;
    if (doc.activeElement !== main) { stop(); return; } // 포커스가 이미 다른 데로 갔다 — 빼앗지 않는다
    const heading = pageHeading(main);
    if (!heading) return;
    focusHeading(doc, heading);
    stop();
  };
  observer = new Observer(check);
  observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden', 'aria-busy'] });
  timer = schedule(stop, timeoutMs);
  doc.addEventListener?.('pointerdown', stop, true);
  doc.addEventListener?.('keydown', stop, true);
  return stop;
}
