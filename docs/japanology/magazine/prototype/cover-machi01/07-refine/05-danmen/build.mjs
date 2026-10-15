// 『となり』 一つの町 01 富士吉田 표지 ⑤ 「断面」 07-refine — 결정적 생성 (2026-10-15 KST)
// 원본: ../../06-variants/05-danmen/ (보존). 이 판은 07-refine/critic.md ⑤·§3 적용.
// 사용(이 폴더에서): node fetch.mjs && node fetch-crater.mjs && node fetch-extend.mjs   (1회, 국토지리원 標高API → data.json)
//                    node build.mjs   → cover.html, layout.json
// 입력: data.json, ../../03-mast/mast-dark.svg
// 시각·난수·환경값을 읽지 않는다. 같은 입력이면 같은 바이트.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, 'data.json'), 'utf8'));
const BG = '#151b2c', INK = '#eef0f4';   // 밤 바탕 확정(편집장, critic ⑤-3)
const mast = fs.readFileSync(path.join(here, '../../03-mast/mast-dark.svg'), 'utf8').trim().replace('<svg ', '<svg class="mast" ');

// ── 단면(mm, 재단선 기준) ──
// 가로 = 下吉田駅에서의 수평거리, 세로 = 標高. 縦横同縮尺: 같은 k(mm/km)를 두 축에 쓴다.
// 보강 표본(20 m)이 기본 표본(100 m)과 5 m 안에서 겹치면 기본 표본을 쓴다.
const S = data.samples.filter((p, i, a) => !(p.dense && a.some((q) => !q.dense && Math.abs(q.d - p.d) < 5)));
const iKen = S.findIndex((p) => p.mark === 'kengamine');
const iKana = S.findIndex((p) => p.mark === 'kanadorii');
const DKEN = S[iKen].d;                  // 下吉田駅 → 剣ヶ峯 수평거리(m)
// 下吉田駅 = x13(제호·호 표기·크레딧 왼끝 열), 剣ヶ峯 = x197. 축척은 06-variants판 그대로.
// 剣ヶ峯 너머는 같은 직선의 실측 연장(ext 표본)으로 재단 여유 x213까지 잇는다 — 오른쪽 수직 절단면 없음.
const X0 = 13, XKEN = 197, BLEED_R = 213;
const k = (XKEN - X0) / (DKEN / 1000);   // mm/km (가로·세로 공통)
const BASE = 258;                        // 標高 0m(海面) 선 — 06판 250에서 8mm 내림(critic ⑤-2ⓑ)
const px = (d) => X0 + (d / 1000) * k;
const py = (h) => BASE - (h / 1000) * k;
const f = (v) => +v.toFixed(2);
const lastI = S.findIndex((p) => px(p.d) >= BLEED_R);   // 재단 여유를 처음 넘는 표본까지 쓴다
if (lastI < 0) throw new Error('연장 표본이 x213에 닿지 않는다');
const P = S.slice(0, lastI + 1);
const xEnd = px(P[P.length - 1].d);

// 단면 몸체(snow): 下吉田駅 벽 → 지표 → (剣ヶ峯 → 연장) → 재단 밖에서 海面으로 닫음
const surf = P.map((p) => `${f(px(p.d))} ${f(py(p.h))}`);
const body = `M${X0} ${BASE}L${surf.join('L')}L${f(xEnd)} ${BASE}Z`;
// 朱: 下吉田駅 → 金鳥居 지표 띠(지표에서 안쪽으로 RED_T mm)
const RED_T = 2.6;
const top = S.slice(0, iKana + 1).map((p) => [f(px(p.d)), f(py(p.h))]);
const red = `M${top.map(([x, y]) => `${x} ${y}`).join('L')}L${top.slice().reverse().map(([x, y]) => `${x} ${f(y + RED_T)}`).join('L')}Z`;
const peak = P.reduce((a, b) => (b.h > a.h ? b : a));

const ground = f(py(S[0].h));             // 下吉田駅 지표
const redMid = f((X0 + px(S[iKana].d)) / 2);
const L = {
  k: +k.toFixed(4), mPerMm: +(1000 / k).toFixed(2), base: BASE,
  shimoyoshida: { x: X0, y: ground, h: S[0].h },
  kanadorii: { x: f(px(S[iKana].d)), y: f(py(S[iKana].h)), h: S[iKana].h, d: S[iKana].d },
  kengamine: { x: XKEN, y: f(py(S[iKen].h)), h: S[iKen].h, d: DKEN },
  peakOnLine: { x: f(px(peak.d)), y: f(py(peak.h)), h: peak.h, d: peak.d, beyondKengamine_m: f(peak.d - DKEN) },
  rightEnd: { x: f(xEnd), y: f(py(P[P.length - 1].h)), h: P[P.length - 1].h, beyondKengamine_m: f(P[P.length - 1].d - DKEN) },
  redMidX: redMid,
  // 제목: 세로 전용 face(상자 = 1em). left는 잉크 중심이 朱 띠 중심에 오도록 실측(measure.cjs)으로 정한 값.
  title: { left: 12.08, size: 20 },
  // 부제: 세로 2열, 제목 곁 지표 위
  sub: { left: 36.6, size: 6.0, lh: 1.7 },
  no: { left: 12.57, top: 30.31, gap: 2.5 },
  credit: { left: 12.88, bottom: 287, size: 3.25, lh: 1.45 },  // critic 3.2·1.4 → 390px 6px 하한·행 상자 겹침 때문에 3.25·1.45
};
// 제목·부제 잉크 아래끝을 한 줄(下吉田駅 지표 위 4.5mm)에 맞춘다. inkDrop = 상자 아래끝 − 잉크 아래끝(실측)
const INK_BOTTOM = f(ground - 4.5);
const TD = { ttl: 1.56, sub: 3.62 };      // 실측 inkDrop(mm) — measure.cjs
const subGroundY = Math.min(...S.filter((p) => px(p.d) >= L.sub.left && px(p.d) <= L.sub.left + 21).map((p) => py(p.h)));
const mm = (v) => `calc(var(--mm)*${+v.toFixed(3)})`;
// 제목 세로 전용 face: Google Fonts text= 부분집합(U+0020 + 富士吉田 — 공백이 있어야 override가 줄 상자에 확실히 듣는다(⑥ 발견), Shippori Mincho 800, OFL). ascent/descent 합 100% → 세로 글자 상자 = 1em.
const TATE_SRC = 'https://fonts.gstatic.com/l/font?kit=VdGDAZweH5EbgHY6YExcZfDoj0B4e9Om4YkHzws-Rvno4bYAL9HQmQ&skey=83f0168429c2df65&v=v17';

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>富士吉田 表紙 断面</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;800&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap">
<!--
  『となり』 一つの町 01 富士吉田 표지 ⑤「断面」 07-refine — 생성 파일(build.mjs). 손으로 고치지 말 것. 2026-10-15 KST.
  색(2색 + 바탕): 바탕 night #151b2c(吉田の火祭の夜 — 빈 곳이 하늘·높이로 읽히게) · snow #eef0f4(글자·단면 몸체) · vermilion #d4462a(下吉田駅〜金鳥居 지표 띠·제호 괄호 — 글자 금지)
  단면: ${data.source}
    열람 ${data.accessed}(185점) · ${data.accessedCraterRefine}(산정부 20m 보강) · ${data.accessedExtend}(剣ヶ峯 너머 연장 20m×75). 그린 표본 ${P.length}점.
    방식: ${data.method}
    下吉田駅 ${L.shimoyoshida.h}m → 金鳥居 ${L.kanadorii.h}m(${(L.kanadorii.d / 1000).toFixed(2)}km) → 剣ヶ峯 ${L.kengamine.h}m(${(DKEN / 1000).toFixed(2)}km) → 재단 x${L.rightEnd.x} ${L.rightEnd.h}m(剣ヶ峯 너머 ${L.rightEnd.beyondKengamine_m}m).
    縦横同縮尺 ${L.k}mm/km(1mm = ${L.mPerMm}m), 수직 과장 없음. 밑변 y${BASE} = 標高0m.
  부제: 원고 machi-fujiyoshida.md 56행 「標高700〜900メートルほどの冷涼な気候と火山灰の土のため、この地は昔から稲づくりに向かなかった。」(출처표 B49). 숫자는 縦中横 아라비아 숫자(편집장 결정: 漢数字 되돌림 — 첫 열이 제목보다 솟지 않게).
  제목 세로 face 'Shippori Mincho Tate': 같은 Shippori Mincho 800(OFL), ascent-override 88% / descent-override 12% — 세로 글자 상자를 1em으로(critic ⑤-1).
-->
<style>
@font-face{font-family:'Shippori Mincho Tate';font-style:normal;font-weight:800;font-display:swap;
  src:url(${TATE_SRC}) format('woff2');ascent-override:88%;descent-override:12%;line-gap-override:0%}
:root{--night:#151b2c;--vermilion:#d4462a;--snow:#eef0f4;--page:#d9dce3;--page-ink:#151b2c}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--page:#0e1220;--page-ink:#eef0f4}}
:root[data-theme="dark"]{--page:#0e1220;--page-ink:#eef0f4}
*{box-sizing:border-box}
html,body{margin:0;background:var(--page);color:var(--page-ink)}
body{padding:16px}
.wrap{max-width:860px;margin:0 auto;container-type:inline-size}
.cover{--mm:calc(100cqw / 210);--cover-bg:${BG};
  width:100%;aspect-ratio:210/297;position:relative;overflow:hidden;background:var(--cover-bg);color:${INK}}
.cover > *{position:absolute;margin:0}
.cover .plate{inset:0;width:100%;height:100%;display:block}
.cover .mast{left:${mm(13)};top:${mm(13)};width:${mm(32.87)};height:${mm(16)}}
.cover .no{left:${mm(L.no.left)};top:${mm(L.no.top)};font-family:'Zen Kaku Gothic New',sans-serif;font-weight:500;
  font-size:${mm(5.64)};line-height:1;letter-spacing:.08em;font-variant-numeric:tabular-nums;white-space:nowrap}
.cover .no span{margin-left:${mm(L.no.gap)}}
.cover .ttl{left:${mm(L.title.left)};bottom:${mm(297 - INK_BOTTOM - TD.ttl)};writing-mode:vertical-rl;font-family:'Shippori Mincho Tate','Shippori Mincho',serif;font-weight:800;
  font-size:${mm(L.title.size)};line-height:1;letter-spacing:.04em;white-space:nowrap}
.cover .sub{left:${mm(L.sub.left)};bottom:${mm(297 - INK_BOTTOM - TD.sub)};writing-mode:vertical-rl;text-align:end;font-family:'Shippori Mincho',serif;font-weight:500;
  font-size:${mm(L.sub.size)};line-height:${L.sub.lh};letter-spacing:0;white-space:nowrap}
.cover .sub .tcy{text-combine-upright:all}
.cover .credit{left:${mm(L.credit.left)};bottom:${mm(297 - L.credit.bottom)};font-family:'Zen Kaku Gothic New',sans-serif;font-weight:400;
  font-size:${mm(L.credit.size)};line-height:${L.credit.lh};white-space:nowrap;font-feature-settings:'palt'}
.cover .credit span{display:block}
.cover .credit .hang{text-indent:-.5em}
</style>
</head>
<body>
<div class="wrap">
<article class="cover" lang="ja" aria-label="『となり』一つの町 01 富士吉田 表紙">
  <svg class="plate" viewBox="0 0 210 297" preserveAspectRatio="none" role="img" aria-label="下吉田駅から金鳥居を通って富士山頂の剣ヶ峯まで、さらに同じ直線の先までの地面の断面。縦と横は同じ縮尺。下吉田駅から金鳥居までの短い区間を朱で示す。">
    <!-- 단면 몸체 · 縦横同縮尺 ${L.k}mm/km · 밑변 = 標高0m · 剣ヶ峯 x${XKEN} 너머는 같은 직선의 실측 연장 -->
    <path d="${body}" fill="${INK}"/>
    <!-- 下吉田駅 → 金鳥居 지표 띠 · vermilion ${RED_T}mm -->
    <path d="${red}" fill="#d4462a"/>
  </svg>
  ${mast}
  <p class="no">一つの町<span>01</span></p>
  <h1 class="ttl">富士吉田</h1>
  <p class="sub">標高<span class="tcy">700</span>〜<span class="tcy">900</span>メートルほど、<br>稲づくりに向かない土地。</p>
  <p class="credit"><span>標高　国土地理院（標高API）</span><span>下吉田駅—金鳥居—剣ヶ峯とその延長線の断面</span><span>縦横同縮尺（誇張なし）・底辺は標高0m</span><span>朱は下吉田駅から金鳥居まで</span><span class="hang">『となり』編集部</span></p>
</article>
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(here, 'cover.html'), html);
fs.writeFileSync(path.join(here, 'layout.json'), JSON.stringify({ ...L, inkBottom: INK_BOTTOM, inkDrop: TD, subGroundGap: f(subGroundY - INK_BOTTOM), redThickness: RED_T, samplesDrawn: P.length }, null, 1) + '\n');
console.log(JSON.stringify(L));
