// 글자 단위 diff (LCS 기반). practice fail 시 입력 vs 정답 비교용.
//
// 반환: [{ type: 'eq' | 'del' | 'ins', text }]
//   eq   같은 글자
//   del  학습자만 있음 (잉여)
//   ins  정답에만 있음 (누락)

const STRIP_RE = /[\s　]/g;

function strip(s) {
  return String(s || '').replace(STRIP_RE, '');
}

export function diffChars(rawA, rawB) {
  const a = strip(rawA);
  const b = strip(rawB);
  const m = a.length, n = b.length;
  if (m === 0) return [{ type: 'ins', text: b }].filter(s => s.text);
  if (n === 0) return [{ type: 'del', text: a }].filter(s => s.text);

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const out = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { out.push({ type: 'eq', text: a[i - 1] }); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) { out.push({ type: 'del', text: a[i - 1] }); i--; }
    else { out.push({ type: 'ins', text: b[j - 1] }); j--; }
  }
  while (i > 0) { out.push({ type: 'del', text: a[i - 1] }); i--; }
  while (j > 0) { out.push({ type: 'ins', text: b[j - 1] }); j--; }
  out.reverse();
  // 연속 같은 type 머지
  const merged = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && last.type === s.type) last.text += s.text;
    else merged.push({ type: s.type, text: s.text });
  }
  return merged;
}
