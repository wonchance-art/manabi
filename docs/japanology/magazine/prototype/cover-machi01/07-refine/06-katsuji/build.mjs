// 『となり』 一つの町 01 富士吉田 표지 ⑥ 活字 — 다듬기판(07-refine). 결정적 생성기. 사용: node build.mjs → cover.html, boxes.json
// 원본: ../../06-variants/06-katsuji/ (보존). 비평: ../critic.md ⑥·§3.
// 그림 없이 글자만. 표지어 「富士みち」 네 글자(같은 활자 Shippori 500)를 등비 r로 키우며 세로로 쌓는다.
// 정사각 상자를 등비로 쌓으면 상자 모서리가 직선 위에 놓이고, 그 직선들이 한 점(소실점)에서 만난다.
// 소실점 = (판면 중심 x105, 주홍 지평선 y72). 위(먼 곳)로 갈수록 작아져 지평의 한 점으로 모인다.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const MAST = join(here, '../../03-mast/mast-light.svg');
const L = JSON.parse(readFileSync(join(here, 'layout.json'), 'utf8'));

// ── 판면 상수 (mm, 재단선 기준) ──
const P = {
  cx: 105,        // 표지어 축 = 판면 중심 = 소실점 x (critic ⑥-3ⓑ)
  horizon: 72,    // 지평 = 소실점 y (critic ⑥-2: 호 표기와 30mm 이상 떨어뜨림)
  end: 284,       // 「ち」 상자 아래 끝
  r: 1.9,         // 등비 (critic ⑥-3: 1.8과 1장 비교 후 1.9 채택 — 수렴이 더 뚜렷)
  rule: 0.9,      // 주홍 지평선 굵기, 재단~재단
  weight: 500,    // 네 글자 모두 500 (critic ⑥-3ⓐ)
};
const chars = ['富', '士', 'み', 'ち'];
const a = (P.end - P.horizon) / P.r ** 4; // 소실점 → 첫 상자 위 끝 거리
const s0 = a * (P.r - 1);
const f = (n) => +n.toFixed(3);
const boxes = [];
let y = P.horizon + a;
chars.forEach((ch, i) => {
  const s = s0 * P.r ** i;
  boxes.push({ ch, s: f(s), x: f(P.cx - s / 2), y: f(y) });
  y += s;
});

const mast = readFileSync(MAST, 'utf8').trim()
  .replace('<svg ', '<svg class="mast" ')
  .replace(/ width="[^"]+" height="[^"]+"/, '');

// 세로 표시용 서체: 같은 Shippori Mincho woff2(Google Fonts text= 부분집합, v17)에 metric override를 걸어
// 세로쓰기 글자 상자를 1em으로 맞춘다. 공백 U+0020을 부분집합에 넣어야 이 서체가 '첫 사용 가능 서체'가 되어 상자 메트릭에 쓰인다(없으면 무시됨, 실측)(critic ⑤-1·⑥-S3). 잉크 위치는 바꾸지 않고 상자만 실제 글자 크기로.
const TATE_SRC = {
  500: 'https://fonts.gstatic.com/l/font?kit=VdGDAZweH5EbgHY6YExcZfDoj0B4L9am4YkZzw0vbv_K9bY_KtPngsZkQaTtHA&skey=29e0a978c4dc8f62&v=v17',
  800: 'https://fonts.gstatic.com/l/font?kit=VdGDAZweH5EbgHY6YExcZfDoj0B4e9Om4YkZzw0vbv_K9bY_KtPngsZkQaTtHA&skey=83f0168429c2df65&v=v17',
};
const tateFace = Object.entries(TATE_SRC).map(([w, u]) =>
  `@font-face{font-family:'Shippori Mincho Tate';font-style:normal;font-weight:${w};font-display:block;src:url(${u}) format('woff2');` +
  `ascent-override:88%;descent-override:12%;line-gap-override:0%;unicode-range:U+0020,U+3061,U+307F,U+5409,U+58EB,U+5BCC,U+7530}`).join('\n');

const heroCss = boxes.map((b, i) =>
  `.cover .k${i}{left:calc(var(--mm)*${b.x});top:calc(var(--mm)*${b.y});font-size:calc(var(--mm)*${b.s})}`).join('\n');
const heroHtml = boxes.map((b, i) => `<span class="k k${i}">${b.ch}</span>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>富士吉田 表紙 活字</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;800&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap">
<!--
  『となり』 一つの町 01 富士吉田 표지 ⑥「活字」 다듬기판 — 생성 파일(07-refine/06-katsuji/build.mjs). 손으로 고치지 말 것. 2026-10-15 KST.
  검사: node docs/japanology/magazine/prototype/check-cover.cjs cover.html

  색(바탕 + 2색)
  - 바탕 snow #eef0f4 — 재단까지. 틀 없음. 빈 곳 = 글자의 여백(종이)이므로 snow(critic §3 바탕 규칙).
  - night #151b2c(吉田の火祭 밤·먹): 모든 글자. night/snow 15.0:1.
  - vermilion #d4462a(北口本宮冨士浅間神社 大鳥居의 丹塗り): 지평선 한 줄(비글자)·제호 괄호만. 글자 금지(3.91:1).

  주인공: 원고 (1)扉 「縦の表紙語: 富士みち」. 그림 없음 → 略図·OSM 크레딧 없음.
  구성: 같은 활자(Shippori Mincho 500) 네 글자를 등비 r=${P.r}로 쌓음. 상자 모서리의 연장선이 (${P.cx}, ${P.horizon})에서 만난다(원근 구성, 실측 아님).
  상자: ${boxes.map((b) => `${b.ch} ${b.s}mm@(${b.x},${b.y})`).join(' / ')}
  제목: Shippori 800 20mm 자간 .04em, 「ち」 곁 오른쪽 아래, 잉크 아래 끝 = 「ち」 상자 아래 끝 y${P.end}.
  부제(편집장 결정 유지): 「富士吉田に入った道は、富士山へまっすぐ延びる。」
        ← 원고 本文 46행 「富士吉田に入った富士道は下吉田のあたりで南へ向きを変え、富士山へまっすぐ延びる」 ← 取材 A16 山梨県 「富士道モデルコース④」(1次).
-->
<style>
${tateFace}
:root{--night:#151b2c;--vermilion:#d4462a;--snow:#eef0f4;--page:#d9dce3;--page-ink:#151b2c}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--page:#0e1220;--page-ink:#eef0f4}}
:root[data-theme="dark"]{--page:#0e1220;--page-ink:#eef0f4}
*{box-sizing:border-box}
html,body{margin:0;background:var(--page);color:var(--page-ink)}
body{padding:16px}
.wrap{max-width:860px;margin:0 auto;container-type:inline-size}

/* ── 표지: A4 210×297mm, 1mm = 100cqw/210 ── */
.cover{--mm:calc(100cqw / 210);--cover-bg:#eef0f4;
  width:100%;aspect-ratio:210/297;position:relative;overflow:hidden;background:var(--cover-bg);color:var(--night)}
.cover > *{position:absolute;margin:0}
.cover .plate{inset:0;width:100%;height:100%;display:block}
.cover .mast{left:calc(var(--mm)*13);top:calc(var(--mm)*13);width:calc(var(--mm)*32.87);height:calc(var(--mm)*16)}
.cover .no{left:calc(var(--mm)*12.57);top:calc(var(--mm)*${L.noTop});font-family:'Zen Kaku Gothic New',sans-serif;font-weight:500;
  font-size:calc(var(--mm)*5.64);line-height:1;letter-spacing:.08em;font-variant-numeric:tabular-nums;white-space:nowrap}
.cover .no .n{margin-left:calc(var(--mm)*2.5)}
.cover .hero{inset:0}
.cover .k{position:absolute;display:block;writing-mode:vertical-rl;font-family:'Shippori Mincho Tate','Shippori Mincho',serif;font-weight:${P.weight};
  line-height:1;width:1em;height:1em;white-space:nowrap}
${heroCss}
.cover .ttl{left:calc(var(--mm)*${L.ttlLeft});top:calc(var(--mm)*${L.ttlTop});writing-mode:vertical-rl;font-family:'Shippori Mincho Tate','Shippori Mincho',serif;font-weight:800;
  font-size:calc(var(--mm)*20);line-height:1;letter-spacing:.04em;white-space:nowrap}
.cover .sub{left:calc(var(--mm)*${L.subLeft});top:calc(var(--mm)*${L.subTop});writing-mode:vertical-rl;font-family:'Shippori Mincho',serif;font-weight:500;
  font-size:calc(var(--mm)*6);line-height:1.7;letter-spacing:0;white-space:nowrap}
.cover .credit{left:calc(var(--mm)*12.81);bottom:calc(var(--mm)*10);font-family:'Zen Kaku Gothic New',sans-serif;font-weight:400;
  font-size:calc(var(--mm)*3.24);line-height:1.4;white-space:nowrap;font-feature-settings:'palt'}
.cover .credit span{display:block}
.cover .credit .hang{text-indent:-.5em}
</style>
</head>
<body>
<div class="wrap">
<article class="cover" lang="ja" aria-label="『となり』一つの町 01 富士吉田 表紙">
  <svg class="plate" viewBox="0 0 210 297" preserveAspectRatio="none" aria-hidden="true">
    <!-- 지평 = 소실점 높이 · vermilion · 재단에서 재단까지 -->
    <path d="M-3 ${P.horizon}H213" stroke="#d4462a" stroke-width="${P.rule}" fill="none"/>
  </svg>
  ${mast}
  <p class="no">一つの町<span class="n">01</span></p>
  <p class="hero" role="img" aria-label="富士みち">${heroHtml}</p>
  <h1 class="ttl">富士吉田</h1>
  <p class="sub">${L.subText}</p>
  <p class="credit"><span class="hang">『となり』編集部</span></p>
</article>
</div>
</body>
</html>
`;

writeFileSync(join(here, 'cover.html'), html);
writeFileSync(join(here, 'boxes.json'), JSON.stringify({ P, a: f(a), s0: f(s0), boxes }, null, 2) + '\n');
console.log(boxes.map((b) => `${b.ch} s=${b.s} x=${b.x} y=${b.y}`).join('\n'));
