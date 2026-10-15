/** 결정적 셔플 정본 — 서버 렌더와 첫 클라이언트 렌더가 같은 순서를 내야 하는 곳(하이드레이션)에서 쓴다. */
// 결정적 PRNG(문항 id 시드) — 셔플이 매 렌더·기기에서 같아 하이드레이션 불일치·재셔플 튐이 없다.
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 시드 결정적 Fisher-Yates(원본 불변) */
export function seededShuffle(arr, seedStr) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  const rand = mulberry32(hashSeed(seedStr));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
