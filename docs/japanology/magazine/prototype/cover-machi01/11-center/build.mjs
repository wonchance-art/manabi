// 『となり』 一つの町 01 富士吉田 — 11-center: 중앙 정렬·좌우 여백 대칭·서체 조합 3종 (2026-10-15 KST)
// 오너 피드백: 「오른쪽 표지들(B3 열)이 예쁜데, 폰트 다양하게, 글자 정렬 중앙으로, 양쪽 여백 동일하게」.
// 기반: 10-mh/covers의 B3 열(①一本の線·⑤断面). ⑥은 이번 라운드 제외.
// 사용(이 폴더에서):
//   node build.mjs --lines <Overpass fy.json>   ← ①의 선·능선 투영(data/ippon/). 1회
//   node build.mjs                              → mast/B3c-*.svg, covers/{ippon,danmen}-{T1,T2,T3}.html, compare.html, layout.json
// 결정적: 시각·난수·환경값을 읽지 않는다. 원본(10-mh·07-refine)은 읽기만 한다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rd = (p) => fs.readFileSync(path.join(here, p), 'utf8');
const wr = (p, s) => { fs.mkdirSync(path.dirname(path.join(here, p)), { recursive: true }); fs.writeFileSync(path.join(here, p), s); };
const f = (v) => +(+v).toFixed(3);
const mm = (v) => `calc(var(--mm)*${f(v)})`;

// ── 좌우 안쪽 여백: 변수 하나. 모든 글자 상자 = left M · right M · text-align center → 축 x105에 대칭 ──
const M = 14;
const AXIS = 105;

// ── 제호 B3c: 10-mh/mast/svg/B3-*.svg의 글자 패스를 재배치만 한다(글자꼴 무수정) ──
// 원본은 한 path의 하위 경로 14개: 0–8 = TONARI, 9 = と, 10–12 = な, 13 = り(오른쪽 끝 세로 열).
// 재배치: TONARI는 그대로(원점 0), となり는 세로 열 → TONARI 아래 가운데 가로 한 줄.
//   글자 간격 = 원래 세로 열의 글자 중심 간격(9.6mm), 줄 위 끝 = TONARI 잉크 아래 끝 + 3mm. 각 글자는 평행 이동만.
const mastSrc = (tone) => rd(`../10-mh/mast/svg/B3-${tone}.svg`);
const pairsOf = (d) => [...d.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map((m) => [+m[1], +m[2]]);
const bbox = (ds) => { const p = ds.flatMap(pairsOf); const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
const shift = (d, dx, dy) => d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, x, y) => `${f(+x + dx)} ${f(+y + dy)}`);
const MAST = (() => {
  const src = mastSrc('light');
  const d = src.match(/ d="([^"]*)"/)[1];
  const subs = d.split('M').filter(Boolean).map((s) => 'M' + s);
  if (subs.length !== 14) throw new Error('B3 하위 경로 수가 다르다: ' + subs.length);
  const tonari = subs.slice(0, 9), kana = [[subs[9]], subs.slice(10, 13), [subs[13]]];
  const tb = bbox(tonari);
  const kb = kana.map(bbox);
  const pitch = f(((kb[2].y0 + kb[2].y1) / 2 - (kb[0].y0 + kb[0].y1) / 2) / 2); // 원래 세로 열 글자 중심 간격
  const rowH = Math.max(...kb.map((b) => b.y1 - b.y0));
  const rowTop = tb.y1 + 3, rowMid = rowTop + rowH / 2;
  const W = tb.x1 - tb.x0, cx = W / 2;
  const moved = kana.map((g, i) => {
    const b = kb[i], gx = (b.x0 + b.x1) / 2, gy = (b.y0 + b.y1) / 2;
    const dx = cx + (i - 1) * pitch - gx, dy = rowMid - gy;
    return { d: g.map((s) => shift(s, dx, dy)).join(''), dx: f(dx), dy: f(dy) };
  });
  const H = f(rowTop + rowH);
  const svg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${H}" width="${f(W)}mm" height="${H}mm" role="img" aria-label="TONARI となり"><title>TONARI となり</title><path fill="${fill}" d="${tonari.map((s) => shift(s, -tb.x0, 0)).join('')}${moved.map((m) => m.d).join('')}"/></svg>\n`;
  return { W: f(W), H, pitch, rowTop: f(rowTop), rowH: f(rowH), moved, svg };
})();
wr('mast/B3c-light.svg', MAST.svg('#151b2c'));
wr('mast/B3c-dark.svg', MAST.svg('#eef0f4'));
const MAST_X = f(AXIS - MAST.W / 2), MAST_Y = 13, MAST_BOTTOM = f(MAST_Y + MAST.H);

// ── 서체 조합 ──
// 한 표지 안 서체 계열 ≤ 3(제호는 아웃라인 그림이라 세지 않음). 모두 Google Fonts·SIL OFL 1.1.
const TYPE = {
  T1: { label: 'T1 명조 중심', css: 'Shippori+Mincho+B1:wght@800&family=Zen+Old+Mincho:wght@500;600&family=Zen+Kaku+Gothic+New:wght@400;500',
    title: "'Shippori Mincho B1',serif;font-weight:800", line: "'Zen Old Mincho',serif;font-weight:600", story: "'Zen Old Mincho',serif;font-weight:500",
    kick: "'Zen Kaku Gothic New',sans-serif;font-weight:500", no: "'Zen Kaku Gothic New',sans-serif;font-weight:500", credit: "'Zen Kaku Gothic New',sans-serif;font-weight:400",
    ttlOptical: 0.008, families: ['Shippori Mincho B1(제목)', 'Zen Old Mincho(문구)', 'Zen Kaku Gothic New(호 표기·크레딧)'] },
  T2: { label: 'T2 명조+고딕 대비', css: 'Zen+Kaku+Gothic+New:wght@400;900&family=Shippori+Mincho:wght@500;700&family=EB+Garamond:wght@500',
    title: "'Zen Kaku Gothic New',sans-serif;font-weight:900", line: "'Shippori Mincho',serif;font-weight:700", story: "'Shippori Mincho',serif;font-weight:500",
    kick: "'Shippori Mincho',serif;font-weight:700", no: "'EB Garamond',serif;font-weight:500", credit: "'Zen Kaku Gothic New',sans-serif;font-weight:400",
    ttlOptical: 0.028, families: ['Zen Kaku Gothic New 900(제목)·400(크레딧)', 'Shippori Mincho(문구·호 표기)', 'EB Garamond(호수 01)'] },
  T3: { label: 'T3 개성 제목 + 고딕 문구', css: 'Kaisei+Decol:wght@700&family=Zen+Kaku+Gothic+New:wght@400;500&family=Klee+One:wght@600',
    title: "'Kaisei Decol',serif;font-weight:700", line: "'Zen Kaku Gothic New',sans-serif;font-weight:500", story: "'Klee One',cursive;font-weight:600",
    kick: "'Zen Kaku Gothic New',sans-serif;font-weight:500", no: "'Zen Kaku Gothic New',sans-serif;font-weight:500", credit: "'Zen Kaku Gothic New',sans-serif;font-weight:400",
    ttlOptical: 0.008, families: ['Kaisei Decol(제목)', 'Zen Kaku Gothic New(문구·호 표기·크레딧)', 'Klee One(그림 곁 문장 — 교과서체 획)'] },
};

// ── 원고 문장(照合된 사실, ja/machi-fujiyoshida.md) — 10-mh와 같은 출처 ──
const COPY = {
  torii: '今の金鳥居は、もとの場所より30メートルほど山に近い。',                                   // 20·74행 B93 観光庁
  seizoku: ['富士に真向かう一直線の道に沿って、', '「聖なる町と俗なる町」が隣り合う。'],           // 46행 A17 山梨県
  necktie: ['国産ネクタイ生地の4割に、', 'ここの生地が使われている。'],                              // 54행 B06 山梨県
  himatsuri: ['8月26日の夜、', '道がいちばん明るくなる。'],                                        // 72행
  hyoko: ['標高700〜900メートルほど、', '稲づくりに向かない土地。'],                                // 56행 B49(07-refine 승인 압축)
};

// ── 공통 수직 배치(mm) ──
const KICK = { top: f(MAST_BOTTOM + 5), size: 6.4, no: 6.4 };
// 제목 상자 위 끝: 호 표기 내용 영역(≈1.45em) 아래 2mm + 제목 내용 영역이 줄 상자 위로 넘치는 몫(≈0.23em) — check-cover 겹침 실측으로 정함
const titleTopFor = (TS) => f(KICK.top + KICK.size * 1.45 + 2 + 0.23 * TS);
const LINE = { size: 5.6, lh: 1.6 };
const STORY = { size: 6 };
const CREDIT = { size: 3.24, lh: 1.42 };

// ── ① 一本の線: 꼭짓점·金鳥居는 평행 이동만, 좌우는 지형 그대로(x126 = 剣ヶ峯 방위선) ──
const IP = (() => {
  const TS = 30, titleTop = titleTopFor(TS), titleBottom = titleTop + TS;
  const L2top = f(titleBottom + 0.23 * TS + 3);   // 제목 내용 영역이 줄 상자 아래로 넘치는 몫(≈0.23em) + 3mm
  const apexY = f(L2top + 2 * LINE.size * LINE.lh + 6);
  const toriiY = f(apexY + 14 + 93.4);   // 꼭짓점–上宿 14mm(略図 위치 — 가운데 정렬로 문구가 산 위에 모여 간격을 줄임) + 金鳥居–上宿 1055m / 11.3
  const lineEndY = f(toriiY + 3.4);      // 선 아래 끝 = 도리이 기둥 아래 끝. 그 아래는 그리지 않는다(데이터 자르기 — 형상 불변)
  const storyTop = f(lineEndY + 5);
  return { TS, titleTop, L2top, apexY, toriiY, lineEndY, storyTop };
})();
const argi = process.argv.indexOf('--lines');
if (argi > 0) {
  fs.mkdirSync(path.join(here, 'data/ippon'), { recursive: true });
  execFileSync(process.execPath, [path.join(here, 'lib/build-line.mjs'), process.argv[argi + 1], path.join(here, 'data/ippon'), 'mh', String(IP.toriiY), String(IP.apexY)], { stdio: 'ignore' });
}
// 선 경로를 y = lineEndY에서 자른다: 아래→위 순서의 꺾은선에서 lineEndY보다 아래 점을 버리고 경계점을 선형 보간(새 점 없음, 방향 불변).
const clipLine = (d, yMax) => {
  const pts = pairsOf(d);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (y > yMax) { const n = pts[i + 1]; if (n && n[1] <= yMax) { const t = (yMax - y) / (n[1] - y); out.push([f(x + t * (n[0] - x)), f(yMax)]); } continue; }
    out.push([x, y]);
  }
  return 'M' + out.map(([x, y]) => `${x} ${y}`).join('L');
};

// ── ⑤ 断面: 07-refine 데이터 그대로 ──
const DM = (() => {
  const data = JSON.parse(rd('../07-refine/05-danmen/data.json'));
  const S = data.samples.filter((p, i, a) => !(p.dense && a.some((q) => !q.dense && Math.abs(q.d - p.d) < 5)));
  const iKen = S.findIndex((p) => p.mark === 'kengamine'), iKana = S.findIndex((p) => p.mark === 'kanadorii');
  const X0 = 13, XKEN = 197, BLEED_R = 213, BASE = 258, k = (XKEN - X0) / (S[iKen].d / 1000);
  const px = (d) => X0 + (d / 1000) * k, py = (h) => BASE - (h / 1000) * k;
  const P = S.slice(0, S.findIndex((p) => px(p.d) >= BLEED_R) + 1);
  const body = `M${X0} ${BASE}L${P.map((p) => `${f(px(p.d))} ${f(py(p.h))}`).join('L')}L${f(px(P.at(-1).d))} ${BASE}Z`;
  const top = S.slice(0, iKana + 1).map((p) => [f(px(p.d)), f(py(p.h))]);
  const red = `M${top.map(([x, y]) => `${x} ${y}`).join('L')}L${top.slice().reverse().map(([x, y]) => `${x} ${f(y + 2.6)}`).join('L')}Z`;
  const groundMin = (x0, x1) => Math.min(...P.filter((p) => px(p.d) >= x0 && px(p.d) <= x1).map((p) => py(p.h)));
  const TS = 38, titleTop = titleTopFor(TS);
  const storyBottom = f(groundMin(AXIS - 45, AXIS + 45) - 6);   // 가운데 정렬 문장(폭 ≤90mm)의 아래 지표에서 6mm 위
  const storyTop = f(storyBottom - 2 * STORY.size * 1.6);
  const L3top = f(storyTop - 14 - 2 * LINE.size * LINE.lh), L2top = f(L3top - 6 - 2 * LINE.size * LINE.lh);
  return { data, body, red, k, TS, titleTop, storyTop, L2top, L3top, BASE };
})();

// 가운데 정렬의 광학 보정: 줄 끝 「、。」」·줄 머리 「「（」는 전각 상자의 반이 빈칸이라 잉크가 한쪽으로 쏠린다 → 반각 내어 단다(.hr/.hl).
// 자간을 준 줄(제목·호 표기)은 마지막 글자의 자간을 0으로(뒤 공백 없음) → 상자·잉크 모두 축 대칭.
const hang = (t) => t.replace(/^([「（])/, '<span class="hl">$1</span>').replace(/([、。」])$/, '<span class="hr">$1</span>');
const lines = (arr) => arr.map((s) => `<span>${hang(s)}</span>`).join('');
const lastTight = (t) => t.slice(0, -1) + `<span class="z">${t.slice(-1)}</span>`;

function page({ id, T, bg, ink, tone, plate, css, body, comment }) {
  const ty = TYPE[T];
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>富士吉田 表紙 ${id}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${ty.css}&display=swap">
<!--
  『となり』 一つの町 01 富士吉田 — 11-center 표지 ${id} · 생성 파일(11-center/build.mjs). 손으로 고치지 말 것. 2026-10-15 KST.
  중앙 정렬: 모든 글자 상자 left ${M}mm · right ${M}mm · text-align center(축 x${AXIS}). 제호 B3c(B3 글자 패스 재배치, 폭 ${MAST.W}mm)는 x${MAST_X}–${f(MAST_X + MAST.W)}.
  서체(${ty.label}): ${ty.families.join(' · ')} — 모두 Google Fonts, SIL OFL 1.1.
  색: 바탕 ${bg} · 글자 ${ink} · 주홍 #d4462a는 그림의 한 곳(비글자)에만.
${comment}
-->
<style>
:root{--night:#151b2c;--vermilion:#d4462a;--snow:#eef0f4;--page:#d9dce3;--page-ink:#151b2c}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--page:#0e1220;--page-ink:#eef0f4}}
:root[data-theme="dark"]{--page:#0e1220;--page-ink:#eef0f4}
*{box-sizing:border-box}
html,body{margin:0;background:var(--page);color:var(--page-ink)}
body{padding:16px}
.wrap{max-width:860px;margin:0 auto;container-type:inline-size}
.cover{--mm:calc(100cqw / 210);--cover-bg:${bg};--m:${mm(M)};width:100%;aspect-ratio:210/297;position:relative;overflow:hidden;background:var(--cover-bg);color:${ink}}
.cover > *{position:absolute;margin:0}
.cover .plate{inset:0;width:100%;height:100%;display:block}
.cover .mast{left:${mm(MAST_X)};top:${mm(MAST_Y)};width:${mm(MAST.W)};height:${mm(MAST.H)}}
.cover .c{left:var(--m);right:var(--m);text-align:center;white-space:nowrap}
.cover .kick{top:${mm(KICK.top)};font-family:${ty.kick};font-size:${mm(KICK.size)};line-height:1;letter-spacing:.1em}
.cover .kick .no{font-family:${ty.no};font-size:${mm(KICK.no)};margin-left:${mm(2.5)};letter-spacing:.04em}
.cover .ttl{font-family:${ty.title};line-height:1;letter-spacing:.08em;padding-left:${ty.ttlOptical * 2}em} /* 광학 보정: 서체의 좌우 곁 여백 차이(잉크 실측, measure.cjs)만큼 내용을 오른쪽으로 — 상자는 M·M 그대로 */
.cover .z{letter-spacing:0}
.cover .hr{margin-right:-.5em}
.cover .hl{margin-left:-.5em}
.cover .line{font-family:${ty.line};font-size:${mm(LINE.size)};line-height:${LINE.lh}}
.cover .story{font-family:${ty.story};font-size:${mm(STORY.size)};line-height:1.6}
.cover .line > span,.cover .story > span,.cover .credit > span{display:block}
.cover .credit{bottom:${mm(10)};font-family:${ty.credit};font-size:${mm(CREDIT.size)};line-height:${CREDIT.lh};font-feature-settings:'palt'}
${css}
</style>
</head>
<body>
<div class="wrap">
<article class="cover" lang="ja" aria-label="TONARI となり 一つの町 01 富士吉田 表紙">
  ${plate}
  ${rd(`mast/B3c-${tone}.svg`).trim().replace('<svg ', '<svg class="mast" ').replace(/ width="[^"]+" height="[^"]+"/, '')}
  <p class="c kick">一つの町<span class="no">0<span class="z">1</span></span></p>
${body}
</article>
</div>
</body>
</html>
`;
}

const layout = { M, AXIS, mast: { x: MAST_X, y: MAST_Y, w: MAST.W, h: MAST.H, pitch: MAST.pitch, rowTop: MAST.rowTop, kanaMoves: MAST.moved.map((m) => ({ dx: m.dx, dy: m.dy })) }, kickTop: KICK.top, ippon: IP, danmen: { TS: DM.TS, titleTop: DM.titleTop, storyTop: DM.storyTop, L2top: DM.L2top, L3top: DM.L3top } };
const ids = [];
for (const T of Object.keys(TYPE)) {
  // ① 一本の線 (snow)
  {
    const dir = 'data/ippon';
    const met = JSON.parse(rd(`${dir}/metrics.json`)), tor = JSON.parse(rd(`${dir}/torii-bar.json`));
    const lineTag = rd(`${dir}/line.svg.txt`).match(/<path [^>]*\/>/)[0];
    const lineClipped = lineTag.replace(/ d="([^"]*)"/, (_, d) => ` d="${clipLine(d, IP.lineEndY)}"`);
    const TT = { kasagi: { w: 11, rise: 0.9, y: -3.6, sw: 1.3 }, nuki: { w: 8, y: -1.5, sw: 1.2 }, pillar: { dx: 3.2, y0: -3.6, y1: 3.4, sw: 1.2 } };
    const plate = `<svg class="plate" viewBox="0 0 210 297" preserveAspectRatio="none" role="img" aria-label="富士山の略図と、金鳥居から上宿へのびる富士みちの線。上は金鳥居から見た富士山頂の方角。">
    ${rd(`${dir}/ridge.svg.txt`).match(/<path [^>]*\/>/)[0]}
    ${lineClipped}
    <g transform="translate(${tor.page.x} ${tor.page.y}) rotate(${tor.bar.rotateDeg})" fill="none" stroke="#151b2c" stroke-linecap="butt">
      <path d="M${-TT.pillar.dx} ${TT.pillar.y0}V${TT.pillar.y1}M${TT.pillar.dx} ${TT.pillar.y0}V${TT.pillar.y1}" stroke-width="${TT.pillar.sw}"/>
      <path d="M${-TT.nuki.w / 2} ${TT.nuki.y}H${TT.nuki.w / 2}" stroke-width="${TT.nuki.sw}"/>
      <path d="M${-TT.kasagi.w / 2} ${f(TT.kasagi.y - TT.kasagi.rise)}Q0 ${f(TT.kasagi.y + TT.kasagi.rise)} ${TT.kasagi.w / 2} ${f(TT.kasagi.y - TT.kasagi.rise)}" stroke-width="${TT.kasagi.sw}"/>
    </g>
  </svg>`;
    const css = `.cover .ttl{top:${mm(IP.titleTop)};font-size:${mm(IP.TS)}}
.cover .l2{top:${mm(IP.L2top)}}
.cover .story{top:${mm(IP.storyTop)}}`;
    const body = `  <h1 class="c ttl">${lastTight('富士吉田')}</h1>
  <p class="c line l2">${lines(COPY.seizoku)}</p>
  <p class="c story">${lines([COPY.torii])}</p>
  <p class="c credit">${lines(['地図　© OpenStreetMap contributors（ODbL）openstreetmap.org/copyright', '上は金鳥居から見た富士山頂（剣ヶ峯）の方角・山は略図', 'となり編集部'])}</p>`;
    const comment = `  주인공 ①一本の線: 10-mh와 같은 투영(축척 11.3m/mm·剣ヶ峯 방위가 위·직선화/회전/좌우 이동 없음), 金鳥居 y${IP.toriiY}·꼭짓점 y${IP.apexY}로 평행 이동.
    선은 上宿 (${met.lineTopEnd.page.x}, ${met.lineTopEnd.page.y})에서 金鳥居 아래 y${IP.lineEndY}까지만 그린다 — 가운데 정렬한 문장·크레딧이 선과 겹치지 않게 데이터를 자른 것(형상 불변).
    © OpenStreetMap contributors（ODbL）, osm_base 2026-07-28 11:16 KST.
  문구: 聖なる町と俗なる町 = 원고 46행(A17 山梨県) · 金鳥居 30メートルほど = 20·74행(B93 観光庁, 도리이 바로 아래).`;
    const id = `ippon-${T}`;
    wr(`covers/${id}.html`, page({ id, T, bg: '#eef0f4', ink: '#151b2c', tone: 'light', plate, css, body, comment }));
    ids.push(id);
  }
  // ⑤ 断面 (night)
  {
    const plate = `<svg class="plate" viewBox="0 0 210 297" preserveAspectRatio="none" role="img" aria-label="下吉田駅から金鳥居を通って富士山頂の剣ヶ峯まで、さらに同じ直線の先までの地面の断面。縦と横は同じ縮尺。下吉田駅から金鳥居までの短い区間を朱で示す。">
    <path d="${DM.body}" fill="#eef0f4"/>
    <path d="${DM.red}" fill="#d4462a"/>
  </svg>`;
    const css = `.cover .ttl{top:${mm(DM.titleTop)};font-size:${mm(DM.TS)}}
.cover .l2{top:${mm(DM.L2top)}}
.cover .l3{top:${mm(DM.L3top)}}
.cover .story{top:${mm(DM.storyTop)}}`;
    const body = `  <h1 class="c ttl">${lastTight('富士吉田')}</h1>
  <p class="c line l2">${lines(COPY.himatsuri)}</p>
  <p class="c line l3">${lines(COPY.necktie)}</p>
  <p class="c story">${lines(COPY.hyoko)}</p>
  <p class="c credit">${lines(['標高　国土地理院（標高API）・下吉田駅—金鳥居—剣ヶ峯とその延長線の断面', '縦横同縮尺（誇張なし）・底辺は標高0m・朱は下吉田駅から金鳥居まで', 'となり編集部'])}</p>`;
    const comment = `  주인공 ⑤断面: 07-refine/05-danmen/data.json 그대로(${DM.data.source}; 열람 ${DM.data.accessed}·${DM.data.accessedCraterRefine}·${DM.data.accessedExtend}). 縦横同縮尺 ${DM.k.toFixed(4)}mm/km, 밑변 y258, 위치·형상 불변.
  문구: 8月26日の夜 = 원고 72행 · ネクタイ生地の4割 = 54행(B06 山梨県) · 標高700〜900 = 56행(B49).`;
    const id = `danmen-${T}`;
    wr(`covers/${id}.html`, page({ id, T, bg: '#151b2c', ink: '#eef0f4', tone: 'dark', plate, css, body, comment }));
    ids.push(id);
  }
}

// ── 비교 시트: 행 = 표지, 열 = 서체 조합 ──
const rows = [['ippon', '① 一本の線'], ['danmen', '⑤ 断面']];
wr('compare.html', `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>11-center 표지 비교</title>
<!-- 11-center 비교 시트(build.mjs 생성, 2026-10-15 KST). 행 = 표지, 열 = 서체 조합. 각 칸은 표지 HTML을 iframe으로 띄운다(표지 폭 360px). -->
<style>
:root{--bg:#d9dce3;--ink:#151b2c;--muted:#4a5268}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0e1220;--ink:#eef0f4;--muted:#b4bccd}}
:root[data-theme="dark"]{--bg:#0e1220;--ink:#eef0f4;--muted:#b4bccd}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif}
body{padding:24px 16px}
h1{font-size:18px;margin:0 0 4px}
p{margin:0 0 16px;color:var(--muted);font-size:13px}
.grid{display:grid;grid-template-columns:110px repeat(3,392px);gap:12px 20px;align-items:start;overflow-x:auto}
.ch{font-size:14px;font-weight:600}
.ch small{display:block;font-weight:400;color:var(--muted);font-size:12px;margin-top:2px}
.rh{font-size:14px;font-weight:600;padding-top:16px}
iframe{width:392px;height:541px;border:0;display:block}
</style>
</head>
<body>
<h1>11-center — 가운데 정렬 · 좌우 여백 ${M}mm 대칭 · 서체 조합 3</h1>
<p>제호 B3c(B3 글자 패스 재배치: TONARI 아래 가운데 가로 となり). 행 = 표지, 열 = 서체 조합.</p>
<div class="grid">
<div></div>${Object.values(TYPE).map((t) => `<div class="ch">${t.label}<small>${t.families.join(' · ')}</small></div>`).join('')}
${rows.map(([r, rt]) => `<div class="rh">${rt}</div>${Object.keys(TYPE).map((T) => `<iframe src="covers/${r}-${T}.html" title="${r}-${T}"></iframe>`).join('')}`).join('\n')}
</div>
</body>
</html>
`);
wr('layout.json', JSON.stringify(layout, null, 1) + '\n');
console.log(ids.join(' '), JSON.stringify(layout));
