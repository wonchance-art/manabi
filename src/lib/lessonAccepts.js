// 한→일 미션의 정답 비교 헬퍼.
// 1) normalize — 공백·구두점·전각공백 흡수
// 2) expand   — 의미는 같지만 표기 양식이 다른 흔한 변형 자동 추가
//
// 콘텐츠에선 회화체(~じゃないです)만 적어두면 격식체(~じゃありません)도 자동 인정.

function normalize(s) {
  return String(s || '')
    .replace(/[\s　。、・！？!?,.]/g, '')
    .trim();
}

// [회화체, 격식체] — 양방향 매핑
const VARIANTS = [
  ['じゃないです', 'じゃありません'],
  ['じゃありません', 'じゃないです'],
  ['ではないです', 'ではありません'],
  ['ではありません', 'ではないです'],
];

function expand(seed) {
  const out = [seed];
  for (const [from, to] of VARIANTS) {
    if (seed.includes(from)) {
      out.push(seed.split(from).join(to));
    }
  }
  return out;
}

export function isAnswerCorrect(input, item) {
  const n = normalize(input);
  if (!n) return false;
  const seeds = [item.ja, ...(Array.isArray(item.accepts) ? item.accepts : [])];
  const all = new Set();
  for (const seed of seeds) {
    for (const variant of expand(seed)) {
      all.add(normalize(variant));
    }
  }
  return all.has(n);
}
