import { reducedMotion } from './reducedMotion';

// 화면 이동 손맛(NAV-MOTION-001 — 오너 「앱처럼」 2026-10-16 · 목업 nav-transition.md 권장안 B′ = 도착 시작).
// 새 화면이 **도착한 순간**(경로가 바뀐 커밋) 그 화면만 들어온다 — 메뉴 = 제자리 옅게(0.16s), 목록 → 상세 = 오른쪽에서(0.22s),
// 뒤로 = 왼쪽에서(0.22s). 머리말 · 아래 메뉴는 움직이지 않는다.
//
// 누른 순간에 시작하지 않는 이유(측정 근거는 목업 문서): document.startViewTransition은 콜백이 끝날 때까지 화면 그리기를 멈춘다.
// 누를 때 시작하면 서버 응답(prefetch:false 탭 0.3~1.5초) 동안 화면이 얼고, 대기 밑줄(NavPendingMark)도 안 보이며, INP에 그 시간이 더해진다.
// 그래서 이전 화면과 섞는 진짜 crossfade · 공유 요소는 하지 않는다(React 19.3 <ViewTransition> + Next 16 전환 뒤 재검토).
//
// 이 모듈은 판정만 한다(창 · 문서는 인자로 받는다). 실행은 useNavMotion.js, 움직임 값은 web-shell.css(NAV-MOTION 블록)가 정본.

/** 기능 스위치 — false면 전환을 아예 시작하지 않는다(코드 한 줄로 끄는 자리). 창에서 끄기: window.__MANABI_NAV_MOTION__ = 'off'. */
export const NAV_MOTION_ENABLED = true;

/** 누른 곳 · 뒤로가기 기록을 이 시간 안에 온 경로 변경에만 쓴다 — 늦게 온 이동(느린 응답)도 그 원인으로 읽되, 남은 기록이 엉뚱한 이동에 붙지 않게. */
export const NAV_CAUSE_TTL_MS = 4000;

/** 직전 전환이 시작된 지 이 시간 안이면 새 전환을 겹치지 않는다(곧바로 이어지는 replace · 재이동 — 새 화면은 이미 살아 있는 상태로 들어오는 중). */
export const NAV_MOTION_COOLDOWN_MS = 300;

/** 머리말 · 아래 메뉴 · 읽기 화면 메뉴 — 여기서 누른 이동은 「메뉴 바꾸기」(옅게)다. */
export const NAV_TAB_SELECTOR = '.gnb, .mobile-nav, .reader-site-menu';

const depth = (pathname) => String(pathname || '').split('/').filter(Boolean).length;

/**
 * 이번 경로 변경을 어떻게 보여 줄까.
 * @param {{ from: string|null, to: string, cause?: { type: 'tab'|'pop', at: number, uaVisual?: boolean, uaVisualKnown?: boolean, coarse?: boolean } | null,
 *           now: number, fromIndex?: number|null, toIndex?: number|null }} input
 * @returns {'tab'|'push'|'pop'|null} null = 움직이지 않는다
 */
export function navMotionKind({ from, to, cause = null, now, fromIndex = null, toIndex = null }) {
  if (!from || !to || from === to) return null; // 첫 화면 · 같은 경로(검색 조건 · 해시만 바뀜)
  const live = cause && now - cause.at <= NAV_CAUSE_TTL_MS ? cause : null;
  const indexed = Number.isInteger(fromIndex) && Number.isInteger(toIndex) && fromIndex !== toIndex;
  if (live?.type === 'pop') {
    // 브라우저가 이미 넘김을 보여 줬다(iOS 가장자리 밀기 · 안드로이드 뒤로 제스처) — 두 번 움직이지 않는다.
    if (live.uaVisual) return null;
    // 그 여부를 알 수 없는 브라우저(iOS Safari 26.2 미만 등)의 터치 기기는 제스처일 수 있어 움직이지 않는다.
    if (!live.uaVisualKnown && live.coarse) return null;
    if (indexed) return toIndex > fromIndex ? 'push' : 'pop';
    return 'pop';
  }
  if (live?.type === 'tab') return 'tab';
  return depth(to) < depth(from) ? 'pop' : 'push';
}

/**
 * 지금 전환을 시작해도 되나 — 지원 · 기능 스위치 · 동작 줄이기 · 보이는 문서.
 * @param {Document} doc
 * @param {Window} win
 */
export function canAnimateNav(doc, win) {
  if (!NAV_MOTION_ENABLED || !doc || !win) return false;
  if (win.__MANABI_NAV_MOTION__ === 'off') return false;
  if (typeof doc.startViewTransition !== 'function') return false;
  if (doc.visibilityState && doc.visibilityState !== 'visible') return false;
  return !reducedMotion(); // 동작 줄이기 판정 정본(MOTION-R2) — 두 번째 matchMedia를 두지 않는다
}
