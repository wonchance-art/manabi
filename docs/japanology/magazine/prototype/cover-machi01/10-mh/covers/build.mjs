// 『となり』 一つの町 01 富士吉田 — 10-mh 표지 9장(제호 B1·B2·B3 × 주인공 ①一本の線·⑤断面·⑥活字) 결정적 생성기 (2026-10-15 KST)
// 오너 결정 「&Premium, BRUTUS 계열로」 = マガジンハウス 생활지 문법: 위쪽 큰 라틴 제호 + 큰 특집 제목 + 그림 한 장 + 표지 문구 2–3.
// 사용(이 폴더에서):
//   node build.mjs --lines <Overpass fy.json>   ← ①의 선·능선을 제호 높이별로 다시 투영(data/ippon-B?/). 1회
//   node build.mjs                              → ippon-B1.html … katsuji-B3.html, compare.html, layout.json
// 원본 보존: 07-refine/01-ippon·05-danmen·06-katsuji는 읽기만 한다. 실측 형상(선·단면)은 평행 이동만, 보정 없음.
// 시각·난수·환경값을 읽지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rd = (p) => fs.readFileSync(path.join(here, p), 'utf8');
const wr = (p, s) => fs.writeFileSync(path.join(here, p), s);
const f = (v) => +(+v).toFixed(2);
const mm = (v) => `calc(var(--mm)*${+(+v).toFixed(3)})`;

// ── 공통 틀(mm, 재단선 기준) ──
const MAST = { x: 13, y: 13, w: 168 };            // 제호: 폭 80%, 왼쪽 열 x13(시리즈의 제호·크레딧 열)에 붙임. 가운데 정렬은 쓰지 않는다
const MASTS = ['B1', 'B2', 'B3'].map((id) => {
  const vb = rd(`../mast/svg/${id}-light.svg`).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const h = MAST.w * (+vb[2] / +vb[1]);
  return { id, h: f(h), bottom: f(MAST.y + h) };
});
const KICK = { size: 8, no: 5.64, gap: 2.5 };     // 「一つの町」 Shippori 800 8mm + 「01」 Zen Kaku 500 5.64mm(호 표기는 작게)
const LINE = { size: 5.6, lh: 1.55 };             // 표지 문구(고딕) — 15pt 이상
const STORY = { size: 6, lh: 1.6 };               // 그림에 붙는 문구(명조)
const CREDIT = { size: 3.24, lh: 1.42 };          // 시리즈 크레딧(편집장: 3.24mm·390px 6px 하한)

// ── 원고 문장(照合된 사실, ja/machi-fujiyoshida.md) ──
const COPY = {
  torii: ['今の金鳥居は、もとの場所より', '<span class="n">30</span>メートルほど山に近い。'], // 20행 副題 = 74행 本文(B93, 観光庁)
  seizoku: ['富士に真向かう一直線の道に沿って、', '「聖なる町と俗なる町」が隣り合う。'],          // 46행(A17, 山梨県)
  necktie: ['国産ネクタイ生地の<span class="n">4</span>割に、', 'ここの生地が使われている。'],     // 54행(B06, 山梨県)
  himatsuri: ['<span class="n">8</span>月<span class="n">26</span>日の夜、', '道がいちばん明るくなる。'],  // 72행(文化庁 解説과 같은 절)
  hyoko: ['標高<span class="n">700</span>〜<span class="n">900</span>メートルほど、', '稲づくりに向かない土地。'], // 56행(B49) — 07-refine ⑤ 편집장 승인 압축
  michi: ['富士吉田に入った道は、', '富士山へまっすぐ延びる。'],                                  // 46행(A16) — 07-refine ⑥ 편집장 승인 압축
};

// ── ① 一本の線: 제호 높이에 따라 산·선·金鳥居를 아래로 평행 이동 ──
const ippon = (m) => {
  const kickTop = m.bottom + 5, ttlTop = kickTop + 12.5, TS = 30;
  const apexY = f(ttlTop + TS + 9);               // 제목 아래 9mm에 산 꼭짓점
  const toriiY = f(apexY + 46 + 93.4);             // 꼭짓점–선 끝 46mm(v2 비평) + 金鳥居–上宿 1055m/11.3
  return { kickTop, ttlTop, TS, apexY, toriiY };
};
const argi = process.argv.indexOf('--lines');
if (argi > 0) {
  for (const m of MASTS) {
    const g = ippon(m), out = path.join(here, `data/ippon-${m.id}`);
    fs.mkdirSync(out, { recursive: true });
    execFileSync(process.execPath, [path.join(here, 'lib/build-line.mjs'), process.argv[argi + 1], out, 'mh', String(g.toriiY), String(g.apexY)], { stdio: 'ignore' });
  }
}

// ── ⑤ 断面: 07-refine 데이터 그대로(縦横同縮尺, 밑변 258) ──
const danmen = (() => {
  const data = JSON.parse(rd('../../07-refine/05-danmen/data.json'));
  const S = data.samples.filter((p, i, a) => !(p.dense && a.some((q) => !q.dense && Math.abs(q.d - p.d) < 5)));
  const iKen = S.findIndex((p) => p.mark === 'kengamine'), iKana = S.findIndex((p) => p.mark === 'kanadorii');
  const X0 = 13, XKEN = 197, BLEED_R = 213, BASE = 258, k = (XKEN - X0) / (S[iKen].d / 1000);
  const px = (d) => X0 + (d / 1000) * k, py = (h) => BASE - (h / 1000) * k;
  const P = S.slice(0, S.findIndex((p) => px(p.d) >= BLEED_R) + 1);
  const body = `M${X0} ${BASE}L${P.map((p) => `${f(px(p.d))} ${f(py(p.h))}`).join('L')}L${f(px(P.at(-1).d))} ${BASE}Z`;
  const top = S.slice(0, iKana + 1).map((p) => [f(px(p.d)), f(py(p.h))]);
  const red = `M${top.map(([x, y]) => `${x} ${y}`).join('L')}L${top.slice().reverse().map(([x, y]) => `${x} ${f(y + 2.6)}`).join('L')}Z`;
  const groundMin = (x0, x1) => Math.min(...P.filter((p) => px(p.d) >= x0 && px(p.d) <= x1).map((p) => py(p.h)));
  return { body, red, groundMin, k, data, iKen, S, px, py };
})();

// ── ⑥ 活字: 등비 상자(07-refine 기하, 지평만 제호 아래로). 지평은 제호에서 30mm 띄운다(16mm에서는 제호 밑줄 괘선으로 읽혔다 — critic ⑥-2와 같은 문제, 1차 시트 실측) ──
const katsuji = (m) => {
  const horizon = f(m.bottom + 30), end = 284, r = 1.9, cx = 105;
  const a = (end - horizon) / r ** 4, s0 = a * (r - 1);
  let y = horizon + a;
  const boxes = ['富', '士', 'み', 'ち'].map((ch, i) => { const s = s0 * r ** i; const b = { ch, s: f(s), x: f(cx - s / 2), y: f(y) }; y += s; return b; });
  return { horizon, end, r, cx, boxes };
};

// ── 서체 ──
// 세로·큰 제목 전용 face: 07-refine/06-katsuji와 같은 Shippori Mincho 500·800 woff2(Google Fonts text= 부분집합 v17: 공백+富士吉田みち).
// ascent/descent-override 88/12 → 글자 상자 = 1em(세로·가로 모두). 공백 U+0020이 있어야 줄 상자에 듣는다(⑥ 발견).
const TATE = {
  500: 'https://fonts.gstatic.com/l/font?kit=VdGDAZweH5EbgHY6YExcZfDoj0B4L9am4YkZzw0vbv_K9bY_KtPngsZkQaTtHA&skey=29e0a978c4dc8f62&v=v17',
  800: 'https://fonts.gstatic.com/l/font?kit=VdGDAZweH5EbgHY6YExcZfDoj0B4e9Om4YkZzw0vbv_K9bY_KtPngsZkQaTtHA&skey=83f0168429c2df65&v=v17',
};
const tateCss = Object.entries(TATE).map(([w, u]) => `@font-face{font-family:'Shippori Mincho Tate';font-style:normal;font-weight:${w};font-display:block;src:url(${u}) format('woff2');` +
  `ascent-override:88%;descent-override:12%;line-gap-override:0%;unicode-range:U+0020,U+3061,U+307F,U+5409,U+58EB,U+5BCC,U+7530}`).join('\n');

const lines = (arr, cls = '') => arr.map((s) => `<span${cls ? ` class="${cls}"` : ''}>${s}</span>`).join('');

function page({ id, title, bg, ink, mastSvg, plate, css, body, comment }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;800&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap">
<!--
  『となり』 一つの町 01 富士吉田 — 10-mh 표지 ${id} · 생성 파일(10-mh/covers/build.mjs). 손으로 고치지 말 것. 2026-10-15 KST.
  문법: マガジンハウス 생활지(위쪽 큰 라틴 제호·큰 특집 제목·그림 한 장·표지 문구 2–3). 두 잡지의 배치·태그라인·색은 옮기지 않았다(영문 태그라인 없음, 남색·눈·주홍 3색 고정).
  색: 바탕 ${bg} · 글자 ${ink} · 주홍 #d4462a는 비글자 1개(주인공의 '여기')에만. 제호 ${mastSvg}(10-mh/mast, 폭 168mm = 80%, 자간·형태 무수정).
${comment}
-->
<style>
${tateCss}
:root{--night:#151b2c;--vermilion:#d4462a;--snow:#eef0f4;--page:#d9dce3;--page-ink:#151b2c}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--page:#0e1220;--page-ink:#eef0f4}}
:root[data-theme="dark"]{--page:#0e1220;--page-ink:#eef0f4}
*{box-sizing:border-box}
html,body{margin:0;background:var(--page);color:var(--page-ink)}
body{padding:16px}
.wrap{max-width:860px;margin:0 auto;container-type:inline-size}
.cover{--mm:calc(100cqw / 210);--cover-bg:${bg};width:100%;aspect-ratio:210/297;position:relative;overflow:hidden;background:var(--cover-bg);color:${ink}}
.cover > *{position:absolute;margin:0}
.cover .plate{inset:0;width:100%;height:100%;display:block}
.cover .mast{left:${mm(MAST.x)};top:${mm(MAST.y)};width:${mm(MAST.w)};height:auto}
.cover .kick{font-family:'Shippori Mincho',serif;font-weight:800;font-size:${mm(KICK.size)};line-height:1;letter-spacing:.06em;white-space:nowrap}
.cover .kick .no{font-family:'Zen Kaku Gothic New',sans-serif;font-weight:500;font-size:${mm(KICK.no)};letter-spacing:.04em;margin-left:${mm(KICK.gap)};font-variant-numeric:tabular-nums}
.cover .ttl{font-family:'Shippori Mincho Tate','Shippori Mincho',serif;font-weight:800;line-height:1;white-space:nowrap}
.cover .line{font-family:'Zen Kaku Gothic New',sans-serif;font-weight:500;font-size:${mm(LINE.size)};line-height:${LINE.lh};white-space:nowrap;font-feature-settings:'palt'}
.cover .story{font-family:'Shippori Mincho',serif;font-weight:500;font-size:${mm(STORY.size)};line-height:${STORY.lh};white-space:nowrap}
.cover .line > span,.cover .story > span,.cover .credit > span{display:block}
.cover .credit{font-family:'Zen Kaku Gothic New',sans-serif;font-weight:400;font-size:${mm(CREDIT.size)};line-height:${CREDIT.lh};white-space:nowrap;font-feature-settings:'palt'}
.cover .tate{writing-mode:vertical-rl}
.cover .tate .n{text-combine-upright:all}
${css}
</style>
</head>
<body>
<div class="wrap">
<article class="cover" lang="ja" aria-label="TONARI となり 一つの町 01 富士吉田 表紙">
  ${plate}
  ${rd(`../mast/svg/${mastSvg}`).trim().replace('<svg ', '<svg class="mast" ').replace(/ width="[^"]+" height="[^"]+"/, '')}
${body}
</article>
</div>
</body>
</html>
`;
}

const layout = {};
const files = [];
for (const m of MASTS) {
  // ① 一本の線 (snow) ─────────────────────────────
  {
    const g = ippon(m), dir = `data/ippon-${m.id}`;
    const met = JSON.parse(rd(`${dir}/metrics.json`)), tor = JSON.parse(rd(`${dir}/torii-bar.json`));
    const pathOnly = (t) => t.match(/<path [^>]*\/>/)[0];
    const T = { kasagi: { w: 11, rise: 0.9, y: -3.6, sw: 1.3 }, nuki: { w: 8, y: -1.5, sw: 1.2 }, pillar: { dx: 3.2, y0: -3.6, y1: 3.4, sw: 1.2 } }; // 07-refine v3 그대로
    const torii = `<g transform="translate(${tor.page.x} ${tor.page.y}) rotate(${tor.bar.rotateDeg})" fill="none" stroke="#151b2c" stroke-linecap="butt">
      <path d="M${-T.pillar.dx} ${T.pillar.y0}V${T.pillar.y1}M${T.pillar.dx} ${T.pillar.y0}V${T.pillar.y1}" stroke-width="${T.pillar.sw}"/>
      <path d="M${-T.nuki.w / 2} ${T.nuki.y}H${T.nuki.w / 2}" stroke-width="${T.nuki.sw}"/>
      <path d="M${-T.kasagi.w / 2} ${f(T.kasagi.y - T.kasagi.rise)}Q0 ${f(T.kasagi.y + T.kasagi.rise)} ${T.kasagi.w / 2} ${f(T.kasagi.y - T.kasagi.rise)}" stroke-width="${T.kasagi.sw}"/>
    </g>`;
    const plate = `<svg class="plate" viewBox="0 0 210 297" preserveAspectRatio="none" role="img" aria-label="富士山の略図と、下から上宿へのびる富士みちの線。上は金鳥居から見た富士山頂の方角。線の上の鳥居の形が金鳥居の位置。">
    ${pathOnly(rd(`${dir}/ridge.svg.txt`))}
    ${pathOnly(rd(`${dir}/line.svg.txt`))}
    ${torii}
  </svg>`;
    const ridgeLeftY = met.ridge.B.leftBleed.y;
    const L2top = f(g.apexY + 50), L3top = f(L2top + 2 * LINE.size * LINE.lh + 6);
    const storyTop = f(g.toriiY - STORY.size * STORY.lh / 2);   // 1행(「今の金鳥居は、…」) 가운데 = 金鳥居 높이(D5)
    const css = `.cover .kick{left:${mm(13)};top:${mm(g.kickTop)}}
.cover .ttl{left:${mm(13)};top:${mm(g.ttlTop)};font-size:${mm(g.TS)};letter-spacing:.06em}
.cover .l2{left:${mm(13)};top:${mm(L2top)}}
.cover .l3{left:${mm(13)};top:${mm(L3top)}}
.cover .story{right:${mm(210 - 114)};top:${mm(storyTop)};text-align:right}
.cover .credit{left:${mm(131)};bottom:${mm(10)}}`;
    const body = `  <p class="kick">一つの町<span class="no">01</span></p>
  <h1 class="ttl">富士吉田</h1>
  <p class="line l2">${lines(COPY.seizoku)}</p>
  <p class="line l3">${lines(COPY.necktie)}</p>
  <p class="story">${lines(COPY.torii)}</p>
  <p class="credit">${lines(['地図　© OpenStreetMap contributors（ODbL）', 'openstreetmap.org/copyright', '上は金鳥居から見た', '富士山頂（剣ヶ峯）の方角・山は略図', 'となり編集部'])}</p>`;
    const comment = `  주인공 ①一本の線: 07-refine/01-ippon(v3)과 같은 투영(축척 11.3m/mm·剣ヶ峯 방위가 위·직선화/회전 없음)을 金鳥居 y${g.toriiY}·꼭짓점 y${g.apexY}로 평행 이동(lib/build-line.mjs mh).
    上宿 (${met.lineTopEnd.page.x}, ${met.lineTopEnd.page.y}) · 아래 재단 꼬리 최대 이탈 ${met.bottomTail?.fromY260MaxDevMm}mm · 下吉田 꺾임 y${met.shimoyoshidaBend.page.y}(재단 밖). © OpenStreetMap contributors（ODbL）, osm_base 2026-07-28 11:16 KST.
  문구: 金鳥居 = 원고 20·74행(B93 観光庁) · 聖なる町と俗なる町 = 46행(A17 山梨県) · ネクタイ生地の4割 = 54행(B06 山梨県).`;
    const id = `ippon-${m.id}`;
    wr(`${id}.html`, page({ id, title: `富士吉田 表紙 一本の線 ${m.id}`, bg: '#eef0f4', ink: '#151b2c', mastSvg: `${m.id}-light.svg`, plate, css, body, comment }));
    files.push(id);
    layout[id] = { mast: m, ...g, lineTop: met.lineTopEnd.page, ridgeLeftY, L2top, L3top, storyTop, bottomTailDev: met.bottomTail?.fromY260MaxDevMm, bendY: met.shimoyoshidaBend.page.y };
  }
  // ⑤ 断面 (night) ─────────────────────────────
  {
    const kickTop = f(m.bottom + 5), ttlTop = f(kickTop + 12.5), TS = 38;
    const storyW = 82, storyBottom = f(danmen.groundMin(13, 13 + storyW) - 5);
    const storyTop = f(storyBottom - 2 * STORY.size * STORY.lh);
    const lineBlock = 2 * LINE.size * LINE.lh;
    const L3bottom = f(danmen.py(danmen.S[danmen.iKen].h) - 16);   // 剣ヶ峯 위 16mm
    const L3top = f(L3bottom - lineBlock), L2top = f(L3top - 6 - lineBlock);
    const plate = `<svg class="plate" viewBox="0 0 210 297" preserveAspectRatio="none" role="img" aria-label="下吉田駅から金鳥居を通って富士山頂の剣ヶ峯まで、さらに同じ直線の先までの地面の断面。縦と横は同じ縮尺。下吉田駅から金鳥居までの短い区間を朱で示す。">
    <path d="${danmen.body}" fill="#eef0f4"/>
    <path d="${danmen.red}" fill="#d4462a"/>
  </svg>`;
    const css = `.cover .kick{left:${mm(13)};top:${mm(kickTop)}}
.cover .ttl{left:${mm(13)};top:${mm(ttlTop)};font-size:${mm(TS)};letter-spacing:.06em}
.cover .l2{right:${mm(13)};top:${mm(L2top)};text-align:right}
.cover .l3{right:${mm(13)};top:${mm(L3top)};text-align:right}
.cover .story{left:${mm(13)};top:${mm(storyTop)}}
.cover .credit{left:${mm(13)};bottom:${mm(10)}}`;
    const body = `  <p class="kick">一つの町<span class="no">01</span></p>
  <h1 class="ttl">富士吉田</h1>
  <p class="line l2">${lines(COPY.himatsuri)}</p>
  <p class="line l3">${lines(COPY.necktie)}</p>
  <p class="story">${lines(COPY.hyoko)}</p>
  <p class="credit">${lines(['標高　国土地理院（標高API）', '下吉田駅—金鳥居—剣ヶ峯とその延長線の断面', '縦横同縮尺（誇張なし）・底辺は標高0m', '朱は下吉田駅から金鳥居まで', 'となり編集部'])}</p>`;
    const comment = `  주인공 ⑤断面: 07-refine/05-danmen/data.json 그대로(${danmen.data.source}; 열람 ${danmen.data.accessed}·${danmen.data.accessedCraterRefine}·${danmen.data.accessedExtend}).
    縦横同縮尺 ${danmen.k.toFixed(4)}mm/km, 밑변 y258 = 標高0m, 위치·형상 07-refine와 같다.
  문구: 標高700〜900 = 원고 56행(B49) · 8月26日の夜 = 72행 · ネクタイ生地の4割 = 54행(B06 山梨県).`;
    const id = `danmen-${m.id}`;
    wr(`${id}.html`, page({ id, title: `富士吉田 表紙 断面 ${m.id}`, bg: '#151b2c', ink: '#eef0f4', mastSvg: `${m.id}-dark.svg`, plate, css, body, comment }));
    files.push(id);
    layout[id] = { mast: m, kickTop, ttlTop, TS, storyTop, storyBottom, L2top, L3top };
  }
  // ⑥ 活字 (snow) ─────────────────────────────
  {
    const K = katsuji(m), TS = 26;
    const chi = K.boxes[3], shi = K.boxes[1], mi = K.boxes[2];
    const ttlBottom = f(K.end - 4);                 // 「ち」 잉크 아래 끝 근처(07-refine 실측: 상자 끝 284 → 잉크 ≈279)
    const heroCss = K.boxes.map((b, i) => `.cover .k${i}{left:${mm(b.x)};top:${mm(b.y)};font-size:${mm(b.s)}}`).join('\n');
    const plate = `<svg class="plate" viewBox="0 0 210 297" preserveAspectRatio="none" aria-hidden="true">
    <path d="M-3 ${K.horizon}H213" stroke="#d4462a" stroke-width="0.9"/>
  </svg>`;
    const css = `.cover .k{writing-mode:vertical-rl;font-family:'Shippori Mincho Tate','Shippori Mincho',serif;font-weight:500;line-height:1;white-space:nowrap}
${heroCss}
.cover .ttl{right:${mm(14)};bottom:${mm(297 - ttlBottom)};font-size:${mm(TS)};letter-spacing:.04em}
.cover .kick.tate{right:${mm(14 + TS + 3)};bottom:${mm(297 - ttlBottom)};letter-spacing:.06em}
.cover .kick.tate .no{margin-left:0;margin-top:${mm(KICK.gap)}}
.cover .story{right:${mm(210 - 66)};top:${mm(shi.y)}}
.cover .l2{right:${mm(13)};top:${mm(shi.y)};text-align:right}
.cover .credit{left:${mm(13)};bottom:${mm(10)}}`;
    const body = `  ${K.boxes.map((b, i) => `<span class="k k${i}">${b.ch}</span>`).join('')}
  <h1 class="ttl tate">富士吉田</h1>
  <p class="kick tate">一つの町<span class="no n">01</span></p>
  <p class="story tate">${lines(COPY.michi)}</p>
  <p class="line l2">${lines(COPY.himatsuri)}</p>
  <p class="credit"><span>となり編集部</span></p>`;
    const comment = `  주인공 ⑥活字: 07-refine/06-katsuji 기하(같은 활자 Shippori 500 「富士みち」, 등비 r ${K.r}, 축 x${K.cx}, 「ち」 상자 끝 y${K.end})에서 지평만 제호 아래 y${K.horizon}로. 원근 구성(실측 아님) — 지도·略図 크레딧 없음.
    상자: ${K.boxes.map((b) => `${b.ch} ${b.s}mm@(${b.x},${b.y})`).join(' / ')}
  문구: 富士吉田に入った道は… = 원고 46행(A16 山梨県, 07-refine ⑥ 승인 압축) · 8月26日の夜 = 72행.`;
    const id = `katsuji-${m.id}`;
    wr(`${id}.html`, page({ id, title: `富士吉田 表紙 活字 ${m.id}`, bg: '#eef0f4', ink: '#151b2c', mastSvg: `${m.id}-light.svg`, plate, css, body, comment }));
    files.push(id);
    layout[id] = { mast: m, horizon: K.horizon, boxes: K.boxes, ttlBottom, TS };
  }
}

// ── 비교 시트: 3×3, 열 = 제호, 행 = 주인공 ──
const rows = [['ippon', '① 一本の線(밝음)'], ['danmen', '⑤ 断面(밤)'], ['katsuji', '⑥ 活字']];
const cols = [['B1', 'B1 굵은 세리프'], ['B2', 'B2 압축 그로테스크'], ['B3', 'B3 명조 + 세로 となり']];
wr('compare.html', `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>10-mh 표지 비교</title>
<!-- 10-mh 표지 9장 비교 시트(build.mjs 생성, 2026-10-15 KST). 열 = 제호, 행 = 주인공. 각 칸은 표지 HTML을 그대로 iframe으로 띄운다(표지 폭 360px). -->
<style>
:root{--bg:#d9dce3;--ink:#151b2c;--muted:#4a5268}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0e1220;--ink:#eef0f4;--muted:#b4bccd}}
:root[data-theme="dark"]{--bg:#0e1220;--ink:#eef0f4;--muted:#b4bccd}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif}
body{padding:24px 16px}
h1{font-size:18px;margin:0 0 4px}
p{margin:0 0 16px;color:var(--muted);font-size:13px}
.grid{display:grid;grid-template-columns:120px repeat(3,392px);gap:12px 20px;align-items:start;overflow-x:auto}
.ch{font-size:14px;font-weight:600;padding-bottom:4px}
.rh{font-size:14px;font-weight:600;padding-top:16px}
iframe{width:392px;height:541px;border:0;display:block;background:transparent}
</style>
</head>
<body>
<h1>TONARI × 一つの町 01 富士吉田 — 제호 3 × 표지 3</h1>
<p>열 = 제호(10-mh/mast, 폭 80%), 행 = 주인공(07-refine 원본에서 복사·재배치). 각 표지는 390px 폭 기준 check-cover 대상.</p>
<div class="grid">
<div></div>${cols.map(([, t]) => `<div class="ch">${t}</div>`).join('')}
${rows.map(([r, rt]) => `<div class="rh">${rt}</div>${cols.map(([c]) => `<iframe src="${r}-${c}.html" title="${r}-${c}" loading="eager"></iframe>`).join('')}`).join('\n')}
</div>
</body>
</html>
`);
wr('layout.json', JSON.stringify(layout, null, 1) + '\n');
console.log(files.join(' '));
