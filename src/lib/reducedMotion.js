// 사용자가 OS에서 「동작 줄이기」를 켰는지 — 화면 이동 · 자동 순환 · 등장 효과가 공통으로 묻는 한 곳.
// usePagedReader에서 꺼냈다(MOTION-R2, 2026-10-17 KST). 서버 렌더에서는 false(창이 없다).
// 스크롤은 `behavior: reducedMotion() ? 'auto' : 'smooth'`로 쓴다 — 계약 reducedMotion.test.js.
export function reducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}
