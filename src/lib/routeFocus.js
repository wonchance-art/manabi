// 화면 이동 뒤 포커스 되찾기(APP-FEEL-003, 2026-10-17 KST). 누른 카드 · 탭이 새 화면에서 사라지면 포커스가 body로 떨어져
// 키보드 · 화면 읽기가 처음부터 다시 찾았다. 그때만 새 화면의 첫 제목(h1)으로 옮긴다 — 살아 있는 포커스는 빼앗지 않는다.
// 제목으로 보내는 이유: 본문 전체(#main-content)에 초점을 두면 화면 읽기(JAWS 등)가 큰 영역을 길게 읽는다. 제목이면 「어디에 왔는지」 한 줄.
// 제목이 없거나(또는 화면 읽기에 숨긴 대기 화면 제목뿐이거나) 초점을 받지 못하면 본문(#main-content, tabIndex -1)으로.

/**
 * 실제로 그려진 요소인가 — display:none(그린 상자 0개) · visibility:hidden(상속)이면 아니다.
 * 교재 hash 진입(BOOK-HASH-ENTRY-001)은 첫 쪽이 정해질 때까지 head에 넣은 style로 표지를 visibility:hidden으로 감춘다 —
 * 그 표지의 h1은 DOM에 있지만 보이지 않고, 곧 본문 h1로 바뀐다. 측정 수단이 없으면(대역 등) 그려졌다고 본다.
 */
function rendered(doc, el) {
  if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
  const style = doc.defaultView?.getComputedStyle?.(el);
  return !style || style.visibility !== 'hidden';
}

/** 화면 읽기에 숨기지 않았고 실제로 보이는 첫 h1 — 대기 화면(loading.jsx)의 h1은 aria-hidden(또는 받는 중 aria-busy 영역 안)이라 건너뛴다. */
function pageHeading(main, doc) {
  const headings = main?.querySelectorAll ? [...main.querySelectorAll('h1')] : [];
  return headings.find((h) => !h.closest?.('[aria-hidden="true"], [aria-busy="true"]') && rendered(doc, h)) || null;
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
  const heading = pageHeading(main, doc);
  if (heading && focusHeading(doc, heading)) return 'heading';
  main.focus({ preventScroll: true });
  return 'main';
}

/** 이동 뒤 제목을 지켜보는 최대 시간 — 대기 화면(loading.jsx) 뒤 첫 내용이 오는 데 보통 1초 안. */
export const HEADING_WATCH_MS = 2000;

/**
 * focusPageIfLost가 옮긴 자리를 HEADING_WATCH_MS 동안 지킨다(병합 전 교차 리뷰 S2 · Preview 실측 2026-10-17 KST).
 * ① 본문(#main-content)으로 보냈다면 — 대기 화면이라 제목이 없었다 — 실제 화면의 첫 제목(h1)이 보이면 그리로 옮긴다.
 * ② 제목으로 옮긴 뒤 그 제목이 문서에서 빠지거나(교재: 표지 h1 → 본문 h1로 바뀜) 보이지 않게 되어 포커스가 body로 떨어졌으면
 *    다음에 보이는 첫 제목으로(없으면 본문으로) 다시 옮긴다 — 실측: 교재 카드 뒤 h1에 닿고 ~10ms 뒤 그 h1이 빠져 body.
 * 옮기는 건 포커스가 아직 우리가 둔 자리(또는 그 자리가 사라져 body)일 때뿐이다 — 다른 데로 갔으면 멈춘다.
 * 사용자가 누르거나 키를 쓰면(pointerdown · keydown), 시간이 다 되면, 다음 이동(돌려준 정리 함수)에서도 멈춘다.
 * @returns {() => void} 정리 함수(지켜보기 끝)
 */
export function watchPageHeading(doc = globalThis.document, {
  timeoutMs = HEADING_WATCH_MS, Observer = globalThis.MutationObserver, schedule = setTimeout, cancel = clearTimeout,
} = {}) {
  const main = doc?.getElementById?.('main-content');
  if (!main || typeof Observer !== 'function') return () => {};
  // 지키는 자리: 본문이거나, 이미 옮겨 둔 제목.
  let target = doc.activeElement === main ? main : (doc.activeElement && doc.activeElement === pageHeading(main, doc) ? doc.activeElement : null);
  if (!target) return () => {};
  let done = false, timer = null;
  const observers = [];
  const stop = () => {
    if (done) return;
    done = true;
    observers.forEach((o) => o.disconnect());
    cancel(timer);
    doc.removeEventListener?.('pointerdown', stop, true);
    doc.removeEventListener?.('keydown', stop, true);
  };
  const toHeading = () => {
    const heading = pageHeading(main, doc);
    if (heading && focusHeading(doc, heading)) { target = heading; return true; }
    return false;
  };
  const check = () => {
    if (done) return;
    const active = doc.activeElement;
    if (target === main) {
      if (active !== main) { stop(); return; } // 포커스가 이미 다른 데로 갔다 — 빼앗지 않는다
      toHeading(); // 제목이 보이면 옮기고, 그 제목을 계속 지킨다
      return;
    }
    const lost = target.isConnected === false || !rendered(doc, target);
    if (!lost) { if (active !== target) stop(); return; }
    const dropped = !active || active === doc.body || active === target || active.isConnected === false;
    if (!dropped) { stop(); return; }
    if (toHeading()) return;
    main.focus({ preventScroll: true });
    target = main;
  };
  const onMain = new Observer(check);
  onMain.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden', 'aria-busy', 'hidden', 'style', 'class'] });
  observers.push(onMain);
  if (doc.head) { // 감춤 style(BOOK-HASH-ENTRY-001)을 넣고 빼는 자리
    const onHead = new Observer(check);
    onHead.observe(doc.head, { childList: true });
    observers.push(onHead);
  }
  timer = schedule(stop, timeoutMs);
  doc.addEventListener?.('pointerdown', stop, true);
  doc.addEventListener?.('keydown', stop, true);
  return stop;
}
