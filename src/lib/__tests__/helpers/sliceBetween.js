/**
 * 계약 테스트 전용 앵커 슬라이스 (v2-L 계약 위생, #1077 — 오너 확정 2026-08-30).
 * raw `x.slice(x.indexOf(앵커), …)` 조합은 앵커가 소실되면(-1) 빈 문자열을 검사하게
 * 되어 부정 단언이 전량 자동 통과한다(공허 통과 — M2 돌연변이 실측). 이 헬퍼는
 * 앵커 부재 시 즉시 throw하여 그 구멍을 구조적으로 막는다.
 * __tests__/ 아래라 번들에 실리지 않고(world fixtures 선례), *.test.js가 아니라
 * vitest가 테스트로 오인하지도 않는다. raw 조합 금지는 contractHygiene.test.js가 강제.
 */
export function sliceBetween(src, startAnchor, endAnchor) {
  const s = src.indexOf(startAnchor);
  if (s < 0) throw new Error(`앵커 없음(시작): ${startAnchor}`);
  const e = endAnchor ? src.indexOf(endAnchor, s) : src.length;
  if (endAnchor && e < 0) throw new Error(`앵커 없음(끝): ${endAnchor}`);
  return src.slice(s, e);
}
