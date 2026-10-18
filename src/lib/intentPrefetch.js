// 의도 prefetch(APP-FEEL-004, 2026-10-17 KST) — 배움 · 서재는 Link prefetch={false}(performanceRepairs P5)라 첫 클릭에
// 대기 화면(loading.jsx)조차 서버 응답 전까지 뜨지 않았다(Preview 실측: RSC +800ms에 배움 대기 화면 1190ms · 산책 150ms).
// 화면에 들어올 때(뷰포트) 받는 것은 그대로 끄고, 마우스가 머물거나 키보드 포커스가 올 때만 「대기 화면까지」 받는다.
// 배움 · 산책이 쓴다(산책은 BFCACHE-A-001 — 화면 진입 prefetch의 no-store 응답이 bfcache를 막아 이 방식으로 옮겼다).
// 서재는 자체 loading이 없어(첫 화면을 서버가 미리 받는다 — LIBRARY-PREFETCH-001) AUTO가 라우터 상태만 받는다
// (server/app-render/walk-tree-with-flight-router-state.js:60-65) — 골격 이득 없이 붙잡힘 위험만 남는다.
//
// kind는 반드시 'auto'다. 옛 라우터(Next 15.5, 세그먼트 캐시 꺼짐)에서 router.prefetch()의 기본값은 FULL이라 개인화 화면을
// 통째로 받는다(node_modules/next/dist/client/components/app-router-instance.js:292). 'auto'는 Next-Router-Prefetch 헤더를
// 붙이고(router-reducer/fetch-server-response.js:76-77) 서버는 loading 경계 아래를 그리지 않는다
// (server/app-render/create-component-tree.js:318) — 개인화 데이터 없이 골격만 온다.
// 받아 둔 골격은 static staleTime(5분, config-shared.js:201-203) 동안만 다시 쓰이므로(prefetch-cache-utils.js:288-291),
// 「세션당 한 번」이 아니라 4분에 한 번으로 둔다 — 5분이 지나면 다시 받아야 골격이 뜬다.
export const INTENT_PREFETCH_TTL_MS = 4 * 60 * 1000;
const lastPrefetch = new Map(); // href → 받은 시각(이 탭의 세션 동안)

/** @returns {boolean} 이번에 prefetch를 걸었으면 true */
export function prefetchOnIntent(router, href, { current = false, now = Date.now(), nav = globalThis.navigator, seen = lastPrefetch } = {}) {
  if (!router || typeof router.prefetch !== 'function' || !href || current) return false;
  if (nav?.connection?.saveData) return false; // 데이터 절약 모드는 미리 받지 않는다
  const last = seen.get(href);
  if (last != null && now - last < INTENT_PREFETCH_TTL_MS) return false;
  seen.set(href, now);
  router.prefetch(href, { kind: 'auto' });
  return true;
}

// 마우스(펜)는 INTENT_DWELL_MS 머물러야 받는다 — 지나가기만 한 포인터는 요청을 만들지 않는다(pointerleave · pointerdown에 취소).
// 터치는 받지 않는다: touchstart → click 사이가 짧아 이동이 진행 중인 prefetch를 기다렸다가(navigate-reducer.js:191)
// 본문을 한 번 더 받는 「붙잡힘」이 가장 잘 생기는 경로다. 키보드 포커스(:focus-visible)는 바로 받는다 —
// 마우스로 누를 때 생기는 포커스(mousedown)는 focus-visible이 아니라 건너뛴다(누르는 순간의 prefetch = 붙잡힘).
export const INTENT_DWELL_MS = 80;
const dwellTimers = new Map(); // href → 대기 중인 타이머

const keyboardFocus = (e) => { try { return !!e?.currentTarget?.matches?.(':focus-visible'); } catch { return false; } };

/** MAIN_NAV 항목에 붙일 이벤트 — intentPrefetch가 아닌 항목은 아무것도 붙이지 않는다. */
export function intentPrefetchProps(router, item, current, { timers = dwellTimers, dwellMs = INTENT_DWELL_MS, schedule = setTimeout, cancel = clearTimeout, prefetch = prefetchOnIntent } = {}) {
  if (!item?.intentPrefetch) return null;
  const { href } = item;
  const stop = () => { const t = timers.get(href); if (t != null) { cancel(t); timers.delete(href); } };
  return {
    onPointerEnter: (e) => {
      if (e?.pointerType === 'touch') return;
      stop();
      timers.set(href, schedule(() => { timers.delete(href); prefetch(router, href, { current }); }, dwellMs));
    },
    onPointerLeave: stop,
    onPointerDown: stop,
    onFocus: (e) => { if (keyboardFocus(e)) prefetch(router, href, { current }); },
  };
}
