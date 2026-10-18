// 긴 작업 진행 알림의 간격(LOADING-ANNOUNCE-001 — docs/ui-conventions.md §3 ③).
// 보이는 줄은 한 편마다 바뀌어도, 화면 낭독용 상시 영역은 약 10%마다만 바뀐다 — 매번 읽으면 진행 숫자가 다른 말을 덮는다.
// 끝(done === total)은 그대로 둔다. 10개 이하면 한 칸 = 10% 이상이라 매번 바뀐다.

/** done을 total의 10% 칸 아래로 내린 값(0 ≤ 값 ≤ done). total이 0 이하이거나 숫자가 아니면 done 그대로. */
export function announcedProgress(done, total) {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return done;
  if (done >= total) return total;
  const step = Math.max(1, Math.ceil(total / 10));
  return Math.floor(Math.max(0, done) / step) * step;
}
