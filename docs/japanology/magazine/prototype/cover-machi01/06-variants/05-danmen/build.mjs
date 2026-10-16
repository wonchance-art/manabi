// 『となり』 一つの町 01 富士吉田 표지 ⑤ 「断面」 — 결정적 생성 (2026-10-15 KST)
// 사용(이 폴더에서): node fetch.mjs   (1회, 국토지리원 標高API → data.json)
//                    node build.mjs   → cover.html, layout.json
// 입력: data.json, /home/user/manabi/docs/japanology/magazine/prototype/cover-machi01/03-mast/mast-light.svg
// 시각·난수·환경값을 읽지 않는다. 같은 입력이면 같은 바이트.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, 'data.json'), 'utf8'));
// 판: night(기본) = 밤하늘 바탕·snow 단면 / snow = 밝은 바탕·night 단면. 인자로 비교용 판을 만든다.
const THEME = process.argv[2] || 'night';
const OUT = process.argv[3] || 'cover.html';
const DARK = THEME === 'night';
const BG = DARK ? '#151b2c' : '#eef0f4', INK = DARK ? '#eef0f4' : '#151b2c';
const MAST = `/home/user/manabi/docs/japanology/magazine/prototype/cover-machi01/03-mast/mast-${DARK ? 'dark' : 'light'}.svg`;
const mast = fs.readFileSync(MAST, 'utf8').trim().replace('<svg ', '<svg class="mast" ');

// ── 단면 판면 배치(mm, 재단선 기준) ──
// 가로 = 下吉田駅에서의 수평거리, 세로 = 標高. 縦横同縮尺(수직 과장 없음): 같은 k(mm/km)를 두 축에 쓴다.
// 보강 표본(20 m)이 기본 표본(100 m)과 5 m 안에서 겹치면 기본 표본을 쓴다.
const S = data.samples.filter((p, i, a) => !(p.dense && a.some((q) => !q.dense && Math.abs(q.d - p.d) < 5)));
const D = S[S.length - 1].d;             // 下吉田駅 → 剣ヶ峯 수평거리(m)
// 下吉田駅 = x13(제호·호 표기·크레딧과 같은 왼끝), 剣ヶ峯 = x197(오른쪽 안전선) — 좌우 여백 13mm 대칭.
// (검토 후 기각: 단면 왼끝을 제목 잉크 x15.63에 맞추는 안 — 朱 띠 폭 = 제목 폭이 되지만 왼끝이 제호·크레딧과 2.6mm 어긋나 보였다)
const X0 = 13, X1 = 197;
const k = (X1 - X0) / (D / 1000);        // mm/km (가로·세로 공통)
const BASE = 250;                        // 標高 0m(海面) 선
const px = (d) => X0 + (d / 1000) * k;
const py = (h) => BASE - (h / 1000) * k;
const f = (v) => +v.toFixed(2);
const iKana = S.findIndex((p) => p.mark === 'kanadorii');

// 단면 몸체(night): 下吉田駅 벽 → 지표 → 剣ヶ峯 벽 → 海面
const surf = S.map((p) => `${f(px(p.d))} ${f(py(p.h))}`);
const body = `M${f(px(0))} ${BASE}L${surf.join('L')}L${f(px(D))} ${BASE}Z`;
// 朱: 下吉田駅 → 金鳥居 구간의 지표 띠(지표에서 안쪽으로 RED_T mm). 실루엣 밖으로 나가지 않는다.
const RED_T = 2.6;
const top = S.slice(0, iKana + 1).map((p) => [f(px(p.d)), f(py(p.h))]);
const red = `M${top.map(([x, y]) => `${x} ${y}`).join('L')}L${top.slice().reverse().map(([x, y]) => `${x} ${f(y + RED_T)}`).join('L')}Z`;

const L = {
  k: +k.toFixed(4), mPerMm: +(1000 / k).toFixed(2),
  shimoyoshida: { x: X0, y: f(py(S[0].h)), h: S[0].h },
  kanadorii: { x: f(px(S[iKana].d)), y: f(py(S[iKana].h)), h: S[iKana].h, d: S[iKana].d },
  kengamine: { x: f(X1), y: f(py(S[S.length - 1].h)), h: S[S.length - 1].h, d: D },
  base: BASE,
  title: { x: 14.47, size: 20, inkDrop: 1.59 },  // 세로 1열. 상자 왼끝 10.05(안전선), 잉크 x15.63–33.46. 잉크 아래끝 = 상자 아래끝 − inkDrop(실측)
  sub: { x: 38.75, size: 6.0, lh: 1.7, inkDrop: 3.63 },        // 세로 2열, 제목 오른쪽 · 지표 위에 선다(아래 맞춤)
  credit: { x: 12.81, bottom: 287, size: 3.4, lh: 1.5 },
};
const ground = L.shimoyoshida.y;
const mm = (v) => `calc(var(--mm)*${+v.toFixed(3)})`;
// 부제 열 아래 끝: 부제가 서는 x 구간의 지표 중 가장 높은 곳(y 최소) 위로 gap
const subGroundY = Math.min(...S.filter((p) => px(p.d) >= L.sub.x - 1 && px(p.d) <= L.sub.x + 22).map((p) => py(p.h)));
// 제목·부제 잉크 아래끝을 한 줄(下吉田駅 지표 위 4.5mm)에 맞춰 '지표 위에 선' 글자로 둔다. 부제 쪽 지표와의 최소 간격은 layout.json에 남긴다.
const INK_BOTTOM = +(ground - 4.5).toFixed(2);

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
  『となり』 一つの町 01 富士吉田 표지 ⑤「断面」 — 생성 파일(build.mjs). 손으로 고치지 말 것. 2026-10-15 KST.
  색(2색 + 바탕): 바탕 ${DARK ? 'night #151b2c(吉田の火祭の夜) · snow #eef0f4(글자·단면 몸체)' : 'snow #eef0f4 · night #151b2c(글자·단면 몸체)'} · vermilion #d4462a(下吉田駅〜金鳥居 지표 띠·제호 괄호 — 글자 금지)
  단면: ${data.source}, 열람 ${data.accessed}. 표본 ${S.length}점(${data.method})
    下吉田駅 ${L.shimoyoshida.h}m → 金鳥居 ${L.kanadorii.h}m(${(L.kanadorii.d / 1000).toFixed(2)}km) → 剣ヶ峯 ${L.kengamine.h}m(${(D / 1000).toFixed(2)}km).
    縦横同縮尺 ${L.k}mm/km(1mm = ${L.mPerMm}m), 수직 과장 없음. 밑변 y${BASE} = 標高0m.
  부제: 원고 machi-fujiyoshida.md 56행 「標高700〜900メートルほどの冷涼な気候と火山灰の土のため、この地は昔から稲づくりに向かなかった。」(출처표 B49)
-->
<style>
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
.cover .no{left:${mm(12.57)};top:${mm(33.5)};font-family:'Zen Kaku Gothic New',sans-serif;font-weight:500;
  font-size:${mm(5.64)};line-height:1;letter-spacing:.08em;font-variant-numeric:tabular-nums;white-space:nowrap}
.cover .ttl{left:${mm(L.title.x)};bottom:${mm(297 - INK_BOTTOM - L.title.inkDrop)};writing-mode:vertical-rl;font-family:'Shippori Mincho',serif;font-weight:800;
  font-size:${mm(L.title.size)};line-height:1;letter-spacing:.04em;white-space:nowrap}
.cover .sub{left:${mm(L.sub.x)};bottom:${mm(297 - INK_BOTTOM - L.sub.inkDrop)};writing-mode:vertical-rl;text-align:end;font-family:'Shippori Mincho',serif;font-weight:500;
  font-size:${mm(L.sub.size)};line-height:${L.sub.lh};letter-spacing:0;white-space:nowrap}
.cover .sub .tcy{text-combine-upright:all}
.cover .credit{left:${mm(L.credit.x)};bottom:${mm(297 - L.credit.bottom)};font-family:'Zen Kaku Gothic New',sans-serif;font-weight:400;
  font-size:${mm(L.credit.size)};line-height:${L.credit.lh};white-space:nowrap;font-feature-settings:'palt'}
.cover .credit span{display:block}
.cover .credit .hang{text-indent:-.5em}
</style>
</head>
<body>
<div class="wrap">
<article class="cover" lang="ja" aria-label="『となり』一つの町 01 富士吉田 表紙">
  <svg class="plate" viewBox="0 0 210 297" preserveAspectRatio="none" role="img" aria-label="下吉田駅から金鳥居を通って富士山頂の剣ヶ峯までの地面の断面。縦と横は同じ縮尺。下吉田駅から金鳥居までの短い区間を朱で示す。">
    <!-- 단면 몸체 · 縦横同縮尺 ${L.k}mm/km · 밑변 = 標高0m -->
    <path d="${body}" fill="${INK}"/>
    <!-- 下吉田駅 → 金鳥居 지표 띠 · vermilion ${RED_T}mm -->
    <path d="${red}" fill="#d4462a"/>
  </svg>
  ${mast}
  <p class="no">一つの町　01</p>
  <h1 class="ttl">富士吉田</h1>
  <p class="sub">標高<span class="tcy">700</span>〜<span class="tcy">900</span>メートルほど、<br>稲づくりに向かない土地。</p>
  <p class="credit"><span>標高　国土地理院（標高API）</span><span>下吉田駅—金鳥居—剣ヶ峯の断面・縦横同縮尺（誇張なし）・底辺は標高0m</span><span>朱は下吉田駅から金鳥居まで</span><span class="hang">『となり』編集部</span></p>
</article>
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(here, OUT), html);
fs.writeFileSync(path.join(here, 'layout.json'), JSON.stringify({ ...L, inkBottom: INK_BOTTOM, subGroundGap: f(subGroundY - INK_BOTTOM), redThickness: RED_T }, null, 1) + '\n');
console.log(JSON.stringify(L));
