// 『となり』 一つの町 01 富士吉田 표지 ④안 「機の町」 — 결정적 생성기 (2026-10-15 KST)
// 사용: node build.mjs <overpass fy.json> [out=cover.html]
// 입력: Overpass JSON(out geom), osm_base 2026-07-28 11:16 KST. © OpenStreetMap contributors, ODbL 1.0.
// 하는 일
//  1 下吉田(本町二丁目 교차점 원점) 주변 도로 웨이를 국소 정거로 투영. 위 = 本町二丁目에서 본 富士山頂(剣ヶ峯) 방위.
//  2 교차점에서 가장 곧게 이어지는 웨이끼리 이어 '실'(stroke)을 만든다(굴절 40° 이하).
//  3 실의 길이가중 방향이 위아래에 가까우면 경사(経糸), 아니면 위사(緯糸)로 나눈다 — 2색.
//  4 실끼리의 교차·T자 끝을 찾아 위아래(over-under)를 정한다: T자는 지나가는 실이 위(끝난 실은 밑으로 숨는다),
//    지나가는 교차는 각 실을 따라 위·아래가 번갈아 오도록 전파(평직 模式). 실측이 아닌 표현이므로 크레딧에 「模式」.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const [file, outFile = new URL('./cover.html', import.meta.url).pathname] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const P = JSON.parse(fs.readFileSync(new URL('./params.json', import.meta.url), 'utf8'));

// ── 투영 ──
const ORIGIN = { lat: 35.4930014, lon: 138.8040588 };  // 本町二丁目 교차점(OSM 신호 노드, 04-factcheck §1)
const SUMMIT = { lat: 35.360738, lon: 138.727373 };    // 剣ヶ峯 — 국토지리원 1003山 CSV 2026-03-31판
const R = 6371008, rad = Math.PI / 180;
const local = (lat, lon) => ({ e: (lon - ORIGIN.lon) * rad * R * Math.cos(ORIGIN.lat * rad), n: (lat - ORIGIN.lat) * rad * R });
const s0 = local(SUMMIT.lat, SUMMIT.lon);
const beta = Math.atan2(s0.e, s0.n);
const up = { e: Math.sin(beta), n: Math.cos(beta) }, right = { e: Math.cos(beta), n: -Math.sin(beta) };
const proj = (lat, lon) => { const p = local(lat, lon); return [P.ox + (p.e * right.e + p.n * right.n) / P.mpm, P.oy - (p.e * up.e + p.n * up.n) / P.mpm]; };

const KEEP = new Set(P.highways);
const PAD = 25;
const inPage = ([x, y]) => x > -PAD && x < 210 + PAD && y > -PAD && y < 297 + PAD;

// ── 웨이 → 간선(교차점 사이) ──
const ways = [];
for (const el of data.elements) {
  if (el.type !== 'way' || !el.geometry || !el.nodes) continue;
  const t = el.tags || {};
  if (!KEEP.has(t.highway)) continue;
  if (t.area === 'yes') continue;
  const pts = el.geometry.map((g) => proj(g.lat, g.lon));
  if (!pts.some(inPage)) continue;
  ways.push({ id: el.id, nodes: el.nodes, pts });
}
ways.sort((a, b) => a.id - b.id);
const use = new Map();
for (const w of ways) w.nodes.forEach((n, i) => use.set(n, (use.get(n) || 0) + (i === 0 || i === w.nodes.length - 1 ? 1 : 2)));
const nodePt = new Map();
for (const w of ways) w.nodes.forEach((n, i) => nodePt.set(n, w.pts[i]));
const isJ = (n) => use.get(n) !== 2;
const edges = [];
for (const w of ways) {
  let cur = [w.nodes[0]];
  for (let i = 1; i < w.nodes.length; i++) {
    cur.push(w.nodes[i]);
    if (isJ(w.nodes[i]) || i === w.nodes.length - 1) { if (cur.length > 1) edges.push(cur); cur = [w.nodes[i]]; }
  }
}
// ── 교차점에서 곧게 잇기 ──
const ends = new Map(); // node -> [{e, at:0|1}]
edges.forEach((e, k) => {
  for (const at of [0, 1]) { const n = at ? e[e.length - 1] : e[0]; if (!ends.has(n)) ends.set(n, []); ends.get(n).push({ k, at }); }
});
const dirOut = (k, at) => { // 교차점에서 간선 안쪽으로 약 2mm 지점 방향
  const ns = at ? [...edges[k]].reverse() : edges[k];
  const a = nodePt.get(ns[0]); let b = nodePt.get(ns[1]);
  for (let i = 1; i < ns.length; i++) { b = nodePt.get(ns[i]); if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 2) break; }
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
};
const link = new Map(); // `${k}:${at}` -> {k, at}
for (const [n, list] of [...ends.entries()].sort((a, b) => a[0] - b[0])) {
  if (list.length < 2) continue;
  const cand = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (list[i].k === list[j].k) continue;
    const a = dirOut(list[i].k, list[i].at), b = dirOut(list[j].k, list[j].at);
    const dot = a[0] * b[0] + a[1] * b[1]; // -1 = 곧음
    if (dot < -Math.cos(P.maxBend * rad)) cand.push({ i, j, dot });
  }
  cand.sort((p, q) => p.dot - q.dot || p.i - q.i || p.j - q.j);
  const used = new Set();
  for (const c of cand) {
    if (used.has(c.i) || used.has(c.j)) continue;
    used.add(c.i); used.add(c.j);
    const A = list[c.i], B = list[c.j];
    link.set(`${A.k}:${A.at}`, B); link.set(`${B.k}:${B.at}`, A);
  }
}
const seen = new Set();
const strokes = [];
const walk = (k0) => {
  // 한쪽 끝까지 거슬러 간 뒤 순방향으로 모은다
  let k = k0, at = 0, guard = 0;
  while (guard++ < 5000) { const nx = link.get(`${k}:${at}`); if (!nx || nx.k === k0) break; k = nx.k; at = 1 - nx.at; }
  const seq = []; guard = 0;
  let cur = { k, at }; // at = 들어오는 끝
  while (cur && !seen.has(cur.k) && guard++ < 5000) {
    seen.add(cur.k);
    const ns = cur.at ? [...edges[cur.k]].reverse() : edges[cur.k];
    for (const n of ns) { if (!seq.length || seq[seq.length - 1] !== n) seq.push(n); }
    const nx = link.get(`${cur.k}:${1 - cur.at}`);
    cur = nx ? { k: nx.k, at: nx.at } : null;
  }
  return seq;
};
for (let k = 0; k < edges.length; k++) if (!seen.has(k)) { const seq = walk(k); if (seq.length > 1) strokes.push(seq.map((n) => nodePt.get(n))); }

// 실 길이·방향
const S = strokes.map((pts, id) => {
  const cum = [0]; let c2 = 0, s2 = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], L = Math.hypot(dx, dy);
    cum.push(cum[i - 1] + L);
    const a = Math.atan2(dx, -dy) * 2; c2 += L * Math.cos(a); s2 += L * Math.sin(a);
  }
  const ang = Math.abs(Math.atan2(s2, c2) / 2 / rad); // 0 = 위아래
  return { id, pts, cum, len: cum[cum.length - 1], warp: ang <= 45, ang };
}).filter((s) => s.len > P.minLen);
S.forEach((s, i) => (s.id = i));
// 겹친 실 걸러내기: 상하행 분리 도로처럼 다른(더 긴) 실과 거의 같은 자리를 지나는 실은 한 가닥으로 본다.
{
  const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  const bb = (s) => { let a = [1e9, 1e9, -1e9, -1e9]; for (const [x, y] of s.pts) a = [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)]; return a; };
  S.forEach((s) => (s.bb0 = bb(s)));
  const order = [...S].sort((p, q) => q.len - p.len || p.id - q.id);
  const kept = [];
  for (const s of order) {
    const samples = []; for (let d = 0; d <= s.len; d += 1) { let i = 1; while (i < s.cum.length - 1 && s.cum[i] < d) i++; const t = (d - s.cum[i - 1]) / ((s.cum[i] - s.cum[i - 1]) || 1); samples.push([s.pts[i - 1][0] + t * (s.pts[i][0] - s.pts[i - 1][0]), s.pts[i - 1][1] + t * (s.pts[i][1] - s.pts[i - 1][1])]); }
    const near = samples.filter((p) => kept.some((k) => p[0] > k.bb0[0] - 3 && p[0] < k.bb0[2] + 3 && p[1] > k.bb0[1] - 3 && p[1] < k.bb0[3] + 3 && k.pts.some((a, i) => i && segD(p, k.pts[i - 1], a) < P.dupDist))).length;
    if (near / samples.length > 0.6) { s.dup = true; continue; }
    kept.push(s);
  }
}
const dropped = S.filter((s) => s.dup).length;
S.splice(0, S.length, ...S.filter((s) => !s.dup));
S.forEach((s, i) => (s.id = i));

// ── 교차 찾기 ──
const segX = (p, p2, q, q2) => {
  const r = [p2[0] - p[0], p2[1] - p[1]], s = [q2[0] - q[0], q2[1] - q[1]];
  const d = r[0] * s[1] - r[1] * s[0]; if (Math.abs(d) < 1e-12) return null;
  const t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / d, u = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / d;
  const E = 1e-6; if (t < -E || t > 1 + E || u < -E || u > 1 + E) return null; return { t, u };
};
const bbox = (s) => { let a = [1e9, 1e9, -1e9, -1e9]; for (const [x, y] of s.pts) a = [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)]; return a; };
S.forEach((s) => (s.bb = bbox(s)));
const X = [];
for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
  const A = S[i], B = S[j];
  if (A.bb[0] > B.bb[2] || B.bb[0] > A.bb[2] || A.bb[1] > B.bb[3] || B.bb[1] > A.bb[3]) continue;
  const found = [];
  for (let a = 1; a < A.pts.length; a++) for (let b = 1; b < B.pts.length; b++) {
    const r = segX(A.pts[a - 1], A.pts[a], B.pts[b - 1], B.pts[b]); if (!r) continue;
    const sa = A.cum[a - 1] + r.t * (A.cum[a] - A.cum[a - 1]), sb = B.cum[b - 1] + r.u * (B.cum[b] - B.cum[b - 1]);
    const pt = [A.pts[a - 1][0] + r.t * (A.pts[a][0] - A.pts[a - 1][0]), A.pts[a - 1][1] + r.t * (A.pts[a][1] - A.pts[a - 1][1])];
    if (found.some((f) => Math.hypot(f.pt[0] - pt[0], f.pt[1] - pt[1]) < 1)) continue;
    const ta = [A.pts[a][0] - A.pts[a - 1][0], A.pts[a][1] - A.pts[a - 1][1]], tb = [B.pts[b][0] - B.pts[b - 1][0], B.pts[b][1] - B.pts[b - 1][1]];
    const sin = Math.abs(ta[0] * tb[1] - ta[1] * tb[0]) / (Math.hypot(...ta) * Math.hypot(...tb) || 1);
    found.push({ a: i, b: j, sa, sb, pt, sin });
  }
  X.push(...found);
}
const END = 0.6;
X.forEach((x, k) => {
  x.k = k;
  x.aPass = x.sa > END && x.sa < S[x.a].len - END;
  x.bPass = x.sb > END && x.sb < S[x.b].len - END;
  x.over = null; // stroke id on top
  if (x.aPass && !x.bPass) x.over = x.a;
  else if (!x.aPass && x.bPass) x.over = x.b;
  x.fixed = x.over !== null;
});
// 실마다 교차 순서
const along = S.map(() => []);
for (const x of X) { along[x.a].push({ x, s: x.sa }); along[x.b].push({ x, s: x.sb }); }
along.forEach((l) => l.sort((p, q) => p.s - q.s || p.x.k - q.x.k));
// 번갈아 전파(BFS). 고정(T자) 먼저, 다음은 경사 위가 기본인 빈 교차부터.
const nbrs = X.map(() => []);
along.forEach((l, sid) => { for (let i = 1; i < l.length; i++) { nbrs[l[i - 1].x.k].push({ k: l[i].x.k, sid }); nbrs[l[i].x.k].push({ k: l[i - 1].x.k, sid }); } });
const other = (x, sid) => (x.a === sid ? x.b : x.a);
const queue = X.filter((x) => x.fixed).map((x) => x.k);
let conflicts = 0;
const run = () => {
  while (queue.length) {
    const k = queue.shift(); const x = X[k];
    for (const { k: k2, sid } of nbrs[k]) {
      const y = X[k2];
      const sOverAtX = x.over === sid;
      const want = sOverAtX ? other(y, sid) : sid; // 이 실을 따라 다음 교차는 반대
      if (y.over === null) { y.over = want; queue.push(k2); }
      else if (y.over !== want) conflicts++;
    }
  }
};
run();
for (const x of X) if (x.over === null) { x.over = S[x.a].warp ? x.a : x.b; queue.push(x.k); run(); }

// ── 그리기 ──
const f = (v) => (Math.round(v * 100) / 100).toString();
const pathOf = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('');
const slice = (s, from, to) => { // 호 길이 구간의 폴리라인
  from = Math.max(0, from); to = Math.min(s.len, to);
  const at = (d) => { let i = 1; while (i < s.cum.length - 1 && s.cum[i] < d) i++; const t = (d - s.cum[i - 1]) / ((s.cum[i] - s.cum[i - 1]) || 1); return [i, [s.pts[i - 1][0] + t * (s.pts[i][0] - s.pts[i - 1][0]), s.pts[i - 1][1] + t * (s.pts[i][1] - s.pts[i - 1][1])]]; };
  const [i0, p0] = at(from), [i1, p1] = at(to);
  const out = [p0]; for (let i = i0; i < i1; i++) out.push(s.pts[i]); out.push(p1); return out;
};
const W = P.w, G = P.gap;
const col = (s) => (s.warp ? P.warpColor : P.weftColor);
// 한 거리 = 가는 실 2n가닥의 띠. 각 가닥은 중심선을 법선 방향으로 평행 이동한 폴리라인(꼭짓점은 이등분 법선, 마이터 제한).
const N2 = 2 * P.plies, LW = P.ply, GW = (W - N2 * LW) / (N2 - 1);
const OFFS = Array.from({ length: N2 }, (_, k) => -W / 2 + LW / 2 + k * (LW + GW));
const offset = (pts, o) => {
  const q = pts.filter((p, i) => !i || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-4);
  if (q.length < 2) return [];
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); return [-dy / L, dx / L]; };
  return q.map((p, i) => {
    const n1 = i ? nrm(q[i - 1], p) : null, n2 = i < q.length - 1 ? nrm(p, q[i + 1]) : null;
    let n = n1 && n2 ? [n1[0] + n2[0], n1[1] + n2[1]] : (n1 || n2);
    const L = Math.hypot(...n) || 1; n = [n[0] / L, n[1] / L];
    const k = 1 / Math.max(n[0] * (n1 || n2)[0] + n[1] * (n1 || n2)[1], 0.6);
    return [p[0] + n[0] * o * k, p[1] + n[1] * o * k];
  });
};
const thread = (pts, s, under = true) => (under ? `<path d="${pathOf(pts)}" stroke="${P.bg}" stroke-width="${W}"/>` : '') + `<path d="${OFFS.map((o) => pathOf(offset(pts, o))).join('')}" stroke="${col(s)}" stroke-width="${LW}"/>`;
// 천 조각: 위사는 [y0,y1] 띠 안에서만, 경사는 위아래로 fringe만큼 더(술). 좌우는 재단까지.
const [y0, y1] = P.band, [FT, FB] = P.fringe;
const clipFor = (s) => (s.warp ? 'url(#cw)' : 'url(#cf)');
const layer = { w: '', f: '' };
for (const s of S) layer[s.warp ? 'w' : 'f'] += thread(s.pts, s);
const tops = { w: '', f: '' };
for (const x of X) {
  const s = S[x.over], sv = x.over === x.a ? x.sa : x.sb;
  if (x.pt[1] < y0 - 1 || x.pt[1] > y1 + 1) continue;
  const r = (W / 2 + G) / Math.max(x.sin, 0.45) + 0.4;
  const d = pathOf(slice(s, sv - r, sv + r)), d2 = slice(s, sv - r - 0.8, sv + r + 0.8); // 실 조각을 틈보다 길게 — 이음 자국 방지
  const piece = `<path d="${d}" stroke="${P.bg}" stroke-width="${W + 2 * G}"/>` + thread(d2, s, false);
  tops.w += `<g clip-path="${clipFor(s)}">${piece}</g>`;
}
const svgWeave = `<defs><clipPath id="cw"><rect x="-5" y="${y0 - FT}" width="220" height="${y1 - y0 + FT + FB}"/></clipPath><clipPath id="cf"><rect x="-5" y="${y0}" width="220" height="${y1 - y0}"/></clipPath></defs>`
  + `<g fill="none" stroke-linecap="butt" stroke-linejoin="round"><g clip-path="url(#cw)">${layer.w}</g><g clip-path="url(#cf)">${layer.f}</g>${tops.w}</g>`;

const stats = { dropped, strokes: S.length, warp: S.filter((s) => s.warp).length, weft: S.filter((s) => !s.warp).length, crossings: X.length, fixed: X.filter((x) => x.fixed).length, conflicts: conflicts / 2, betaDeg: +((beta / rad + 360) % 360).toFixed(2) };
fs.writeFileSync(new URL('./stats.json', import.meta.url), JSON.stringify(stats, null, 1));
console.error(stats);

// ── 조판 ──
const mastFile = P.bg === '#151b2c' ? 'mast-dark.svg' : 'mast-light.svg';
const mast = fs.readFileSync('/home/user/manabi/docs/japanology/magazine/prototype/cover-machi01/03-mast/' + mastFile, 'utf8').trim().replace('<svg ', '<svg class="mast" ');
const T = P.text;
const html = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8')
  .replaceAll('{{BG}}', P.bg).replaceAll('{{INK}}', P.ink)
  .replace('{{WEAVE}}', svgWeave).replace('{{MAST}}', mast)
  .replace('{{CSS}}', P.css)
  .replace('{{STATS}}', JSON.stringify(stats))
  .replace('{{BODY}}', T);
fs.writeFileSync(outFile, html);
// ── 디버그 표식(검토용, 출력 html에는 넣지 않음) ──
if (process.env.DEBUG) {
  const pins = { station: [35.49773, 138.80353], gekkoji: [35.48836, 138.80268], kanatorii: [35.4832112, 138.7979629], miyagawa: [35.4948725, 138.8044326], honcho2: [ORIGIN.lat, ORIGIN.lon] };
  const out = Object.fromEntries(Object.entries(pins).map(([k, v]) => [k, proj(...v).map((n) => +n.toFixed(1))]));
  console.error(out);
  const dots = Object.entries(out).map(([k, [x, y]]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#0f0"/><text x="${x + 3}" y="${y}" font-size="5" fill="#0f0">${k}</text>`).join('');
  fs.writeFileSync(outFile, fs.readFileSync(outFile, 'utf8').replace('</svg>', dots + '</svg>'));
}
