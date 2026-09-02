// 단어 카드 표제어(R R2 — #1077 5504878570): 표면 ≠ 기본형인 토큰(이합사 조각 道·歉 → 道歉,
// 활용형 食べた → 食べる)은 표제어를 기본형으로 세우고 **탭한 구간만** 강조한다.
// 강조 범위는 억지로 맞추지 않는다 — 기본형 안에 표면형이 통째로 있으면 그 자리, 없으면
// 공통 접두(行った ↔ 行く의 行), 그것도 없으면 강조 없음(음편·불규칙 활용 오탐 방지).
// 코드포인트 단위 [start, end) — 서러게이트 쌍 한자(𠮷)에서 code unit 인덱스가 어긋나지 않게.

export function pickedRangeOf(head, text) {
  if (!head || !text) return null;
  const h = [...head];
  const t = [...text];
  const idx = head.indexOf(text);
  if (idx >= 0) {
    const start = [...head.slice(0, idx)].length;
    return [start, start + t.length];
  }
  let p = 0;
  while (p < h.length && p < t.length && h[p] === t[p]) p += 1;
  return p > 0 ? [0, p] : null;
}
