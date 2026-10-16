// 『となり』 一つの町 01 富士吉田 — 12-hip: 11-center 레이아웃(가운데 정렬·좌우 14mm·①⑤) 그대로, 서체 체계만 '힙한' 5종으로 (2026-10-15 KST)
// 오너 요청: 「폰트 힙한 걸로 못 바꾸나, 사용 자유로운 걸로」. 제호 TONARI·となり도 서체를 바꾼다(탐색 단계 — 웹폰트 라이브 텍스트, 확정 시 아웃라인화는 별도).
// 사용(이 폴더에서):
//   node fit.cjs                                ← 큰 글자 잉크 메트릭(fit.json). 서체를 바꿀 때만
//   node build.mjs                              → covers/{ippon,danmen}-{H1..H5}.html, compare.html, layout.json
//   (①의 선·능선은 11-center/data/ippon 복사본 data/ippon — 다시 만들려면 node build.mjs --lines <Overpass fy.json>)
// 결정적: 시각·난수·환경값을 읽지 않는다. 사실·문구·크레딧·실측 그림은 11-center와 같다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SYSTEMS } from './systems.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const rd = (p) => fs.readFileSync(path.join(here, p), 'utf8');
const wr = (p, s) => { fs.mkdirSync(path.dirname(path.join(here, p)), { recursive: true }); fs.writeFileSync(path.join(here, p), s); };
const f = (v) => +(+v).toFixed(3);
const mm = (v) => `calc(var(--mm)*${f(v)})`;

// ── 좌우 안쪽 여백: 변수 하나. 모든 글자 상자 = left M · right M · text-align center → 축 x105에 대칭 ──
const M = 14;
const AXIS = 105;

// ── 제호(라이브 텍스트): TONARI 잉크 위 끝 y13, 폭 ≤157.7mm(11-center B3c와 같은 폭)·대문자 잉크 높이 ≤28.14mm 중 작은 쪽,
//    となり는 그 아래 3mm에 잉크 높이 9.2mm. 그 아래 배치는 11-center와 같은 값(제호 아래 끝 53.298 고정). ──
const pairsOf = (d) => [...d.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map((m) => [+m[1], +m[2]]);
const FIT = JSON.parse(rd('fit.json'));
const MAST_Y = 13, MAST_BOTTOM = 53.298, MAST_MAXW = 157.7, MAST_MAXCAP = 28.14, KANA_H = 9.2;
// 큰 글자 한 역할의 치수: 크기(mm)·상자 줄높이(잉크 높이 em)·광학 중심 보정(em)
const big = (H, role, size) => {
  const m = FIT[H][role], ls = SYSTEMS[H][role].ls, n = { mast: 6, kana: 3, title: 4 }[role];
  const h = m.asc + m.desc, advW = m.adv + ls * (n - 1);
  const inkC = (m.left + m.right + ls * (n - 1)) / 2;
  return { size: f(size), lh: f(h + 0.01), ls, shift: f(advW / 2 - inkC), asc: f(m.asc + 0.005), desc: f(m.desc + 0.005), inkW: f((m.right - m.left + ls * (n - 1)) * size) };
};
const mastOf = (H) => {
  const m = FIT[H].mast, ls = SYSTEMS[H].mast.ls;
  const S = Math.min(MAST_MAXW / (m.adv + ls * 5), MAST_MAXCAP / (m.asc + m.desc));
  const M1 = big(H, 'mast', S);
  const k = FIT[H].kana, K = big(H, 'kana', KANA_H / (k.asc + k.desc));
  return { mast: M1, kana: K, kanaTop: f(MAST_Y + S * (m.asc + m.desc) + 3) };
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

function page({ id, H, bg, ink, plate, css, body, comment, TS }) {
  const sy = SYSTEMS[H], MS = mastOf(H), TT = big(H, 'title', TS);
  const face = (name, role, d) => `@font-face{font-family:'${name}';font-style:${sy[role].style};font-weight:${sy[role].weight};font-display:block;src:url(${sy[role].kit}) format('woff2');ascent-override:${f(d.asc * 100)}%;descent-override:${f(d.desc * 100)}%;line-gap-override:0%}`;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>富士吉田 表紙 ${id}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${sy.css}&display=swap">
<!--
  『となり』 一つの町 01 富士吉田 — 12-hip 표지 ${id} · 생성 파일(12-hip/build.mjs). 손으로 고치지 말 것. 2026-10-15 KST.
  레이아웃은 11-center와 같다: 모든 글자 상자 left ${M}mm · right ${M}mm · text-align center(축 x${AXIS}).
  서체 체계 ${sy.label}(${sy.note}): ${sy.families.join(' · ')} — 모두 Google Fonts, SIL OFL 1.1(확인 표 NOTES.md).
  제호(탐색 단계 라이브 텍스트): TONARI ${MS.mast.size}mm(잉크 폭 ${MS.mast.inkW}mm) · となり ${MS.kana.size}mm. 큰 글자 3역할은 같은 woff2를 ascent/descent-override로 다시 선언(상자 = 잉크 높이).
  색: 바탕 ${bg} · 글자 ${ink} · 주홍 #d4462a는 그림의 한 곳(비글자)에만.
${comment}
-->
<style>
${face('Hip Mast', 'mast', MS.mast)}
${face('Hip Kana', 'kana', MS.kana)}
${face('Hip Title', 'title', TT)}
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
.cover .mast{top:${mm(MAST_Y)};font-family:'Hip Mast';font-style:${sy.mast.style};font-weight:${sy.mast.weight};font-size:${mm(MS.mast.size)};line-height:${MS.mast.lh};letter-spacing:${MS.mast.ls}em}
.cover .mast > span:first-child{display:inline-block;transform:translateX(${MS.mast.shift}em)}
.cover .kana{top:${mm(MS.kanaTop)};font-family:'Hip Kana';font-style:${sy.kana.style};font-weight:${sy.kana.weight};font-size:${mm(MS.kana.size)};line-height:${MS.kana.lh};letter-spacing:${MS.kana.ls}em}
.cover .kana > span:first-child{display:inline-block;transform:translateX(${MS.kana.shift}em)}
.cover .c{left:var(--m);right:var(--m);text-align:center;white-space:nowrap}
.cover .kick{top:${mm(KICK.top)};font-family:${sy.kick};font-size:${mm(KICK.size)};line-height:1;letter-spacing:.1em}
.cover .kick .no{font-family:${sy.no};font-size:${mm(KICK.no)};margin-left:${mm(2.5)};letter-spacing:.04em}
.cover .ttl{font-family:'Hip Title';font-style:${sy.title.style};font-weight:${sy.title.weight};line-height:1;letter-spacing:${TT.ls}em}
.cover .ttl > span:first-child{display:inline-block;transform:translateX(${TT.shift}em)} /* 광학 중심 보정(fit.json 잉크 실측) — 상자는 M·M 그대로 */
.cover .z{letter-spacing:0}
.cover .hr{margin-right:-.5em}
.cover .hl{margin-left:-.5em}
.cover .line{font-family:${sy.line};font-size:${mm(LINE.size)};line-height:${LINE.lh}}
.cover .story{font-family:${sy.story};font-size:${mm(STORY.size)};line-height:1.6}
.cover .line > span,.cover .story > span,.cover .credit > span{display:block}
.cover .credit{bottom:${mm(10)};font-family:${sy.credit};font-size:${mm(CREDIT.size)};line-height:${CREDIT.lh};font-feature-settings:'palt'}
${css}
</style>
</head>
<body>
<div class="wrap">
<article class="cover" lang="ja" aria-label="TONARI となり 一つの町 01 富士吉田 表紙">
  ${plate}
  <p class="c mast" aria-label="TONARI"><span>TONAR<span class="z">I</span></span></p>
  <p class="c kana"><span>とな<span class="z">り</span></span></p>
  <p class="c kick">一つの町<span class="no">0<span class="z">1</span></span></p>
${body}
</article>
</div>
</body>
</html>
`;
}

const layout = { M, AXIS, mast: Object.fromEntries(Object.keys(SYSTEMS).map((H) => [H, mastOf(H)])), kickTop: KICK.top, ippon: IP, danmen: { TS: DM.TS, titleTop: DM.titleTop, storyTop: DM.storyTop, L2top: DM.L2top, L3top: DM.L3top } };
const ids = [];
for (const H of Object.keys(SYSTEMS)) {
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
    const body = `  <h1 class="c ttl"><span>${lastTight('富士吉田')}</span></h1>
  <p class="c line l2">${lines(COPY.seizoku)}</p>
  <p class="c story">${lines([COPY.torii])}</p>
  <p class="c credit">${lines(['地図　© OpenStreetMap contributors（ODbL）openstreetmap.org/copyright', '上は金鳥居から見た富士山頂（剣ヶ峯）の方角・山は略図', 'となり編集部'])}</p>`;
    const comment = `  주인공 ①一本の線: 10-mh와 같은 투영(축척 11.3m/mm·剣ヶ峯 방위가 위·직선화/회전/좌우 이동 없음), 金鳥居 y${IP.toriiY}·꼭짓점 y${IP.apexY}로 평행 이동.
    선은 上宿 (${met.lineTopEnd.page.x}, ${met.lineTopEnd.page.y})에서 金鳥居 아래 y${IP.lineEndY}까지만 그린다 — 가운데 정렬한 문장·크레딧이 선과 겹치지 않게 데이터를 자른 것(형상 불변).
    © OpenStreetMap contributors（ODbL）, osm_base 2026-07-28 11:16 KST.
  문구: 聖なる町と俗なる町 = 원고 46행(A17 山梨県) · 金鳥居 30メートルほど = 20·74행(B93 観光庁, 도리이 바로 아래).`;
    const id = `ippon-${H}`;
    wr(`covers/${id}.html`, page({ id, H, TS: IP.TS, bg: '#eef0f4', ink: '#151b2c', plate, css, body, comment }));
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
    const body = `  <h1 class="c ttl"><span>${lastTight('富士吉田')}</span></h1>
  <p class="c line l2">${lines(COPY.himatsuri)}</p>
  <p class="c line l3">${lines(COPY.necktie)}</p>
  <p class="c story">${lines(COPY.hyoko)}</p>
  <p class="c credit">${lines(['標高　国土地理院（標高API）・下吉田駅—金鳥居—剣ヶ峯とその延長線の断面', '縦横同縮尺（誇張なし）・底辺は標高0m・朱は下吉田駅から金鳥居まで', 'となり編集部'])}</p>`;
    const comment = `  주인공 ⑤断面: 07-refine/05-danmen/data.json 그대로(${DM.data.source}; 열람 ${DM.data.accessed}·${DM.data.accessedCraterRefine}·${DM.data.accessedExtend}). 縦横同縮尺 ${DM.k.toFixed(4)}mm/km, 밑변 y258, 위치·형상 불변.
  문구: 8月26日の夜 = 원고 72행 · ネクタイ生地の4割 = 54행(B06 山梨県) · 標高700〜900 = 56행(B49).`;
    const id = `danmen-${H}`;
    wr(`covers/${id}.html`, page({ id, H, TS: DM.TS, bg: '#151b2c', ink: '#eef0f4', plate, css, body, comment }));
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
<title>12-hip 표지 비교</title>
<!-- 12-hip 비교 시트(build.mjs 생성, 2026-10-15 KST). 행 = 표지, 열 = 서체 체계 5. 각 칸은 표지 HTML을 iframe으로 띄운다(표지 폭 360px). -->
<style>
:root{--bg:#d9dce3;--ink:#151b2c;--muted:#4a5268}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0e1220;--ink:#eef0f4;--muted:#b4bccd}}
:root[data-theme="dark"]{--bg:#0e1220;--ink:#eef0f4;--muted:#b4bccd}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif}
body{padding:24px 16px}
h1{font-size:18px;margin:0 0 4px}
p{margin:0 0 16px;color:var(--muted);font-size:13px}
.grid{display:grid;grid-template-columns:110px repeat(5,392px);gap:12px 20px;align-items:start;overflow-x:auto}
.ch{font-size:14px;font-weight:600}
.ch small{display:block;font-weight:400;color:var(--muted);font-size:12px;margin-top:2px}
.rh{font-size:14px;font-weight:600;padding-top:16px}
iframe{width:392px;height:541px;border:0;display:block}
</style>
</head>
<body>
<h1>12-hip — 11-center 레이아웃(가운데·좌우 ${M}mm) × 서체 체계 5</h1>
<p>제호 TONARI·となり도 체계별 서체(탐색 단계 라이브 텍스트). 모든 서체 SIL OFL 1.1. 행 = 표지, 열 = 체계.</p>
<div class="grid">
<div></div>${Object.values(SYSTEMS).map((t) => `<div class="ch">${t.label}<small>${t.families.join(' · ')}</small></div>`).join('')}
${rows.map(([r, rt]) => `<div class="rh">${rt}</div>${Object.keys(SYSTEMS).map((H) => `<iframe src="covers/${r}-${H}.html" title="${r}-${H}"></iframe>`).join('')}`).join('\n')}
</div>
</body>
</html>
`);
wr('layout.json', JSON.stringify(layout, null, 1) + '\n');
console.log(ids.join(' '), JSON.stringify(layout));
