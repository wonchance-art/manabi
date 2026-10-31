// 모바일 머리 숨김(GNB-AUTOHIDE-001, 오너 2026-10-31 KST 「권장대로 A+B」) — 긴 글 화면(교재 · 지역학)에서만, 휴대폰 폭에서만.
// 내려 읽으면 머리를 위로 숨기고(상태 표시줄 칸은 종이 색으로 남김), 조금이라도 올리거나 맨 위 근처면 다시 보인다.
// 학습 · 복습 · 단어 페이지는 단추 자리가 고정돼야 해서 넣지 않는다 — 뷰어 · 추천 글(focused reading)은 자체 막대가 머리 높이에 붙어 있어 제외.

/** 숨김을 쓰는 화면 — 교재(/books/…) · 지역학(/studies/…). */
export function isGnbAutoHideRoute(pathname) {
  return /^\/(?:books|studies)\/[^/]/.test(pathname || '');
}

export const GNB_AUTOHIDE = Object.freeze({ maxWidth: 680, topZone: 80, downDelta: 8, upDelta: 6 });

/**
 * 다음 상태 — hidden(지금), y(지금 스크롤), lastY(지난번), anchor(방향이 바뀐 자리).
 * 맨 위 근처는 늘 보임 · 아래로 downDelta 넘게 내려가면 숨김 · 위로 upDelta 넘게 올라오면 보임(작은 떨림은 무시).
 * @returns {{ hidden: boolean, anchor: number }}
 */
export function nextGnbHidden({ hidden, y, lastY, anchor }) {
  if (y <= GNB_AUTOHIDE.topZone) return { hidden: false, anchor: y };
  const turned = (y > lastY) !== (lastY > anchor);
  const start = turned ? lastY : anchor;
  if (y > lastY && y - start > GNB_AUTOHIDE.downDelta) return { hidden: true, anchor: start };
  if (y < lastY && start - y > GNB_AUTOHIDE.upDelta) return { hidden: false, anchor: start };
  return { hidden, anchor: start };
}
