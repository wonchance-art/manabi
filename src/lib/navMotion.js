import { reducedMotion } from './reducedMotion';

// 화면 이동 손맛(NAV-MOTION-001 — 오너 「앱처럼」 2026-10-16 · 목업 nav-transition.md 권장안 B′ = 도착 시작).
// 새 화면이 **도착한 순간**(경로가 바뀐 커밋) 그 화면만 들어온다 — 메뉴 = 제자리 옅게(0.16s), 목록 → 상세 = 오른쪽에서(0.22s),
// 뒤로 = 왼쪽에서(0.22s). 머리말 · 아래 메뉴는 움직이지 않는다.
//
// 방식: 경로가 바뀐 커밋에서 html[data-nav-motion]만 달고 본문(#main-content)에 CSS 등장 애니메이션(useNavMotion.js).
// View Transitions는 쓰지 않는다 — 전환 중 모든 포인터가 <html>로 가 연속 탭이 사라지고(실측 4/4), 사진 두 장 · 그리기 정지 비용이 붙는다.
// 누른 순간에는 아무것도 하지 않는다(INP · 대기 밑줄 불변). 공유 요소 · 이전 화면과의 crossfade는 Next 16 + React 19.3 <ViewTransition> 뒤 재검토.
//
// 이 모듈은 판정만 한다(창 · 문서는 인자로 받는다). 실행은 useNavMotion.js, 움직임 값은 web-shell.css(NAV-MOTION 블록)가 정본.

/** 기능 스위치 — false면 전환을 아예 시작하지 않는다(코드 한 줄로 끄는 자리). 창에서 끄기: window.__MANABI_NAV_MOTION__ = 'off'. */
export const NAV_MOTION_ENABLED = true;

/** 종류별 길이(ms) — web-shell.css 키프레임 길이와 같다(계약). 표식을 떼는 여유 시간 계산에 쓴다. */
export const NAV_MOTION_MS = Object.freeze({ tab: 160, push: 220, pop: 220 });

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
 * 지금 등장 효과를 걸어도 되나 — 기능 스위치 · 동작 줄이기 · 보이는 문서(숨은 탭에서는 animationend가 오지 않는다).
 * @param {Document} doc
 * @param {Window} win
 */
export function canAnimateNav(doc, win) {
  if (!NAV_MOTION_ENABLED || !doc || !win) return false;
  if (win.__MANABI_NAV_MOTION__ === 'off') return false;
  if (doc.visibilityState && doc.visibilityState !== 'visible') return false;
  return !reducedMotion(); // 동작 줄이기 판정 정본(MOTION-R2) — 두 번째 matchMedia를 두지 않는다
}
