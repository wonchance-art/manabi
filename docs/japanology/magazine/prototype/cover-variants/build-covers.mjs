// 一つの町 01 富士吉田 표지 3안 HTML 조립기 (2026-10-15 KST)
// 사용: node build-covers.mjs <build-map.mjs 출력 json> > fujiyoshida-3an.html
// 3안: A 실제 지도(밤 바탕) · B 활자 중심(밤 바탕, 지도 없음) · C 실제 지도(눈 바탕, 색 반전)
// 공통: cover-spec.md v0 고정 요소, 제호 『となり』(괄호는 틀과 같은 1.2mm 선으로 그림).
import fs from 'node:fs';

const map = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { pins, paths } = map;
const f = (v) => (+v).toFixed(1);

// 제호: 괄호 『』를 틀과 같은 굵기의 이중 꺾쇠로 그리고, 글자는 자간을 손으로 조인다.
const mast = `<svg class="mast" viewBox="0 0 54 17" role="img" aria-label="となり">
    <path class="br" d="M6 1.2H1.2V10M6 3.8H3.8V10M48 15.8H52.8V7M48 13.2H50.2V7" />
    <text class="mt" x="6.4" y="13.8" textLength="40.6" lengthAdjust="spacingAndGlyphs">となり</text>
  </svg>`;

function mapSvg(id, theme) {
  const p = pins;
  const torii = (x, y) => `<g transform="translate(${f(x)} ${f(y)})" class="torii"><rect x="-4.2" y="-3.6" width="8.4" height="1.4"/><rect x="-3.2" y="-1.6" width="6.4" height=".8"/><rect x="-2.8" y="-3.6" width="1" height="6.6"/><rect x="1.8" y="-3.6" width="1" height="6.6"/></g>`;
  return `<svg class="visual" viewBox="0 0 128 170" role="img" aria-label="富士吉田の地図。上が富士山頂の方角。富士みちが下の下吉田駅から金鳥居を通り、上の北口本宮へまっすぐ延びる。">
    <defs>
      <linearGradient id="fade-${id}-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".1" stop-color="#fff"/><stop offset=".9" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="fade-${id}-h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".08" stop-color="#fff"/><stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="mask-${id}"><rect width="128" height="170" fill="url(#fade-${id}-v)"/></mask>
      <mask id="mask-${id}-h"><rect width="128" height="170" fill="url(#fade-${id}-h)"/></mask>
      <clipPath id="clip-${id}"><rect width="128" height="170"/></clipPath>
    </defs>
    <g mask="url(#mask-${id})"><g clip-path="url(#clip-${id})" mask="url(#mask-${id}-h)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path class="m-minor" d="${paths.minor}"/>
      <path class="m-water" d="${paths.water}"/>
      <path class="m-major" d="${paths.major}"/>
      <path class="m-rail" d="${paths.rail}"/>
      <path class="m-fuji" d="${paths.fujimichi}"/>
    </g></g>
    <g class="pins">
      <circle cx="${f(p.kitaguchi.x)}" cy="${f(p.kitaguchi.y)}" r="2.4" class="pin-ring"/>
      ${torii(p.kanatorii.x, p.kanatorii.y)}
      <rect x="${f(p.fujisan.x - 1.6)}" y="${f(p.fujisan.y - 1.6)}" width="3.2" height="3.2" class="pin-st"/>
      <rect x="${f(p.shimoyoshida.x - 1.6)}" y="${f(p.shimoyoshida.y - 1.6)}" width="3.2" height="3.2" class="pin-st"/>
    </g>
    <g class="labels" font-size="5.6">
      <text x="${f(p.kitaguchi.x + 5)}" y="${f(p.kitaguchi.y + 2)}">北口本宮</text>
      <text x="${f(p.kanatorii.x - 6)}" y="${f(p.kanatorii.y + 2)}" text-anchor="end">金鳥居</text>
      <text x="${f(p.fujisan.x + 4.5)}" y="${f(p.fujisan.y + 2)}">富士山駅</text>
      <text x="${f(p.shimoyoshida.x + 4.5)}" y="${f(p.shimoyoshida.y + 2)}">下吉田駅</text>
    </g>
    <g class="summit"><path d="M10 15V3M6.6 6.6L10 3L13.4 6.6" fill="none"/><text x="15" y="9" font-size="5.6">富士山頂</text></g>
  </svg>`;
}

const typeSvg = `<svg class="visual" viewBox="0 0 128 170" role="img" aria-label="数字で見る富士吉田。1572年に町ができた。二つの駅の高低差125メートル。御師の家は多いとき86軒、今も講を迎える家は5軒。8月26日は火祭の夜。">
    <line x1="3" y1="4" x2="3" y2="166" class="t-road"/>
    <g class="t-dot"><circle cx="3" cy="28" r="1.8"/><circle cx="3" cy="76" r="1.8"/><circle cx="3" cy="114" r="1.8"/><circle cx="3" cy="152" r="1.8"/></g>
    <g class="t-num">
      <text x="10" y="40" font-size="34">1572</text>
      <text x="10" y="83" font-size="20">125<tspan font-size="11">m</tspan></text>
      <text x="10" y="121" font-size="20">86→5</text>
      <text x="10" y="159" font-size="20">8.26</text>
    </g>
    <g class="t-lab" font-size="5.6">
      <text x="10" y="57">上吉田に町ができた年</text>
      <text x="10" y="96">下吉田駅から富士山駅まで上る</text>
      <text x="10" y="134">御師の家、多いときと今も講を迎える家</text>
    </g>
    <text class="t-lab" x="60" y="159" font-size="5.6">火祭の夜</text>
  </svg>`;

const cover = (id, cls, visual, credit) => `<article id="cover-${id}" class="cover ${cls}" lang="ja" aria-label="『となり』一つの町 01 富士吉田 表紙 ${id.toUpperCase()}案">
  <div class="frame"></div>
  ${mast}
  <p class="no">一つの町　<b>01</b></p>
  <h1 class="vword">富士みち</h1>
  ${visual}
  <p class="sub">今の金鳥居は、もとの場所より30メートル山に近い。</p>
  <p class="ttl">一つの町　<b>富士吉田</b></p>
  <p class="credit">${credit}<br>『となり』編集部</p>
</article>`;

const mapCredit = '地図　© OpenStreetMap contributors（ODbL）<br>をもとに編集部作成・上が富士山頂の方角';

process.stdout.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>富士吉田 표지 3안</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700;800&family=Noto+Serif+JP:wght@400;600&family=Noto+Sans+KR:wght@400;600&display=swap">
<!--
  생성 파일 — build-covers.mjs가 만든다. 손으로 고치지 말 것. (2026-10-15 KST)
  규격: ../../cover-spec.md v0(A4, 1mm = 100cqw/210). 검사: node ../check-cover.cjs <이 파일> #cover-a (b, c)
  색 근거: 남색 = 吉田の火祭 밤(A45–A48), 주홍 = 北口本宮 丹塗り 大鳥居(A38). C안은 같은 두 색을 눈 바탕 위에 반전.
  지도: © OpenStreetMap contributors, ODbL 1.0(osm_base 2026-07-28 11:16 KST). 위 = 金鳥居에서 본 富士山頂(剣ヶ峰) 방위 ${map.betaDeg.toFixed(1)}°.
  B안 숫자: 원고 machi-fujiyoshida.md 본문(1572年 A·125m A·86軒/5軒 A·8月26日 A, 모두 원문 照合 행).
-->
<style>
:root{
  --night:#151b2c; --vermilion:#d4462a; --ember:#f2a066; --snow:#eef0f4; --mist:#b4bccd; --river:#5f86b8;
  --paper:#f6f4ef; --ink:#1b1d24; --muted:#5d6270;
  --font-display:'Shippori Mincho','Noto Serif JP',serif; --font-ja:'Noto Serif JP',serif; --font-ko:'Noto Sans KR',sans-serif;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ --paper:#14161c; --ink:#e9eaee; --muted:#a3a8b5; } }
:root[data-theme="dark"]{ --paper:#14161c; --ink:#e9eaee; --muted:#a3a8b5; }
*{box-sizing:border-box}
html,body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--font-ko)}
.grid{display:flex;flex-wrap:wrap;gap:28px;justify-content:center;padding:24px 16px 40px}
.cell{width:min(390px,100%)}
.cell h2{margin:0 0 8px;font-size:14px;font-weight:600}
.cell p.note{margin:8px 0 0;font-size:12.5px;line-height:1.6;color:var(--muted)}

/* ── 표지 공통: A4 210×297mm ── */
.cover{--mm:calc(100cqw / 210);--cover-bg:var(--night);--fg:var(--snow);--fg2:var(--mist);--accent:var(--vermilion);
  width:100%;aspect-ratio:210/297;position:relative;overflow:hidden;container-type:inline-size;background:var(--cover-bg);color:var(--fg)}
.cover .frame{position:absolute;inset:calc(var(--mm)*7);border:calc(var(--mm)*1.2) solid var(--accent);pointer-events:none}
.cover .mast{position:absolute;left:calc(var(--mm)*11);top:calc(var(--mm)*12);width:calc(var(--mm)*54);height:calc(var(--mm)*17);overflow:visible}
.cover .mast .br{fill:none;stroke:var(--accent);stroke-width:1.2;stroke-linecap:square}
.cover .mast .mt{font-family:var(--font-display);font-weight:800;font-size:13.6px;fill:var(--fg);font-feature-settings:'palt'}
.cover .no{position:absolute;left:calc(var(--mm)*12.6);top:calc(var(--mm)*31.5);margin:0;font-size:calc(var(--mm)*5.4);letter-spacing:.12em;color:var(--fg2)}
.cover .no b{color:var(--fg);font-weight:600}
.cover .vword{position:absolute;right:calc(var(--mm)*18);top:calc(var(--mm)*18);margin:0;writing-mode:vertical-rl;font-family:var(--font-display);font-weight:800;font-size:calc(var(--mm)*33);line-height:1;letter-spacing:.04em;font-feature-settings:'vpal'}
.cover .visual{position:absolute;left:calc(var(--mm)*10);top:calc(var(--mm)*45);width:calc(var(--mm)*128);height:calc(var(--mm)*170);overflow:visible}
.cover .sub{position:absolute;left:calc(var(--mm)*12.6);right:calc(var(--mm)*12.6);top:calc(var(--mm)*226);margin:0;font-family:var(--font-display);font-weight:700;font-size:calc(var(--mm)*6.2);line-height:1.5;font-feature-settings:'palt'}
.cover .ttl{position:absolute;left:calc(var(--mm)*12.6);top:calc(var(--mm)*266);margin:0;font-size:calc(var(--mm)*5.4);letter-spacing:.12em;color:var(--fg2)}
.cover .ttl b{color:var(--fg);font-weight:600}
.cover .credit{position:absolute;right:calc(var(--mm)*12.6);top:calc(var(--mm)*266);margin:0;font-size:calc(var(--mm)*3.4);line-height:1.5;color:var(--fg2);text-align:right}
.cover svg text{font-family:var(--font-ja)}

/* 지도(A·C) */
.cover .m-minor{stroke:var(--fg2);stroke-width:.32;opacity:.38}
.cover .m-major{stroke:var(--fg2);stroke-width:.8;opacity:.7}
.cover .m-water{stroke:var(--river);stroke-width:.6;opacity:.85}
.cover .m-rail{stroke:var(--fg);stroke-width:.7;stroke-dasharray:2.2 1.4;opacity:.8}
.cover .m-fuji{stroke:var(--accent);stroke-width:2.6}
.cover .torii rect{fill:var(--accent)}
.cover .torii{stroke:var(--cover-bg);stroke-width:.5;paint-order:stroke}
.cover .pin-ring{fill:var(--cover-bg);stroke:var(--ember);stroke-width:1.2}
.cover .pin-st{fill:var(--fg);stroke:var(--cover-bg);stroke-width:.6}
.cover .labels text{fill:var(--fg);font-weight:600;stroke:var(--cover-bg);stroke-width:1.6;paint-order:stroke;stroke-linejoin:round}
.cover .summit path{stroke:var(--fg);stroke-width:.9;stroke-linecap:round;stroke-linejoin:round}
.cover .summit text{fill:var(--fg)}

/* 활자(B) */
.cover .t-road{stroke:var(--accent);stroke-width:1.6;stroke-linecap:round}
.cover .t-dot circle{fill:var(--cover-bg);stroke:var(--accent);stroke-width:1}
.cover .t-num text{font-family:var(--font-display);font-weight:800;fill:var(--fg);font-feature-settings:'palt'}
.cover .t-lab, .cover .t-lab text{fill:var(--fg2)}

/* C: 눈 바탕 — 같은 두 색을 반전 */
.cover.light{--cover-bg:var(--snow);--fg:var(--night);--fg2:#4a5268;--river:#3f6ea6;--ember:var(--vermilion)}
.cover.light .vword{color:var(--vermilion)}
.cover.light .m-minor{opacity:.3}
.cover.light .m-major{opacity:.55}
</style>
</head>
<body>
<div class="grid">
  <section class="cell"><h2>A안 · 실제 지도(밤)</h2>
  ${cover('a', '', mapSvg('a'), mapCredit)}
  <p class="note">OSM 실제 도로망. 위 = 金鳥居에서 본 富士山頂 방향. 주홍 굵은 선 = OSM에서 이름이 「富士みち」인 도로.</p></section>
  <section class="cell"><h2>B안 · 활자 중심(밤)</h2>
  ${cover('b', '', typeSvg, '数字　本文より')}
  <p class="note">지도 없이 본문 숫자 넷. 왼쪽 주홍 선이 길, 점이 정거장.</p></section>
  <section class="cell"><h2>C안 · 실제 지도(눈 바탕, 반전)</h2>
  ${cover('c', 'light', mapSvg('c'), mapCredit)}
  <p class="note">A와 같은 지도·같은 두 색을 밝은 바탕에 반전. 세로 표지어만 주홍.</p></section>
</div>
</body>
</html>
`);
