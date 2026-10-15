// 『となり』 一つの町 01 富士吉田 표지 ⑥ 活字 — 결정적 생성기. 사용: node build.mjs  → cover.html
// 그림 없이 글자만. 표지어 「富士みち」 네 글자를 등비로 키워 세로로 쌓는다.
// 등비 r로 쌓은 정사각 글자 상자의 모서리는 한 직선 위에 놓이고, 그 직선들은 한 점(소실점)에서 만난다.
// 소실점 높이 = 주홍 수평선(지평). 글자가 위로 갈수록 작아져 지평의 한 점으로 모인다 = 산으로 가는 길의 원근.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const MAST = '/home/user/manabi/docs/japanology/magazine/prototype/cover-machi01/03-mast/mast-light.svg';

// ── 판면 상수 (mm, 재단선 기준) ──
const P = {
  cx: 108,        // 표지어 축(소실점 x)
  horizon: 52,    // 지평 = 소실점 y (주홍 선)
  end: 280,      // 「ち」 상자 아래 끝 (크레딧 위 281.9와 겹치지 않게)
  r: 1.8,         // 등비
  rule: 0.9,      // 주홍 지평선 굵기
  weights: [800, 800, 500, 500], // 富士 = 산의 덩어리(굵게), みち = 발밑의 길(가늘게)
};
const chars = ['富', '士', 'み', 'ち'];
// a = s0/(r-1) = 소실점에서 첫 상자 위까지의 거리. end = horizon + a·r^4
const a = (P.end - P.horizon) / P.r ** 4;
const s0 = a * (P.r - 1);
const boxes = [];
let y = P.horizon + a;
chars.forEach((ch, i) => {
  const s = s0 * P.r ** i;
  boxes.push({ ch, s: +s.toFixed(3), x: +(P.cx - s / 2).toFixed(3), y: +y.toFixed(3), w: P.weights[i] });
  y += s;
});

const f = (n) => +n.toFixed(3);
const mast = readFileSync(MAST, 'utf8').trim()
  .replace('<svg ', '<svg class="mast" ')
  .replace(/ width="[^"]+" height="[^"]+"/, '');

const heroCss = boxes.map((b, i) =>
  `.cover .k${i}{left:calc(var(--mm)*${b.x});top:calc(var(--mm)*${b.y});font-size:calc(var(--mm)*${b.s});font-weight:${b.w}}`).join('\n');
const heroHtml = boxes.map((b, i) => `<span class="k k${i}" aria-hidden="true">${b.ch}</span>`).join('');

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
  『となり』 一つの町 01 富士吉田 표지 ⑥「活字」 — 생성 파일(build.mjs). 손으로 고치지 말 것. 2026-10-15 KST.
  검사: node docs/japanology/magazine/prototype/check-cover.cjs cover.html

  색(바탕 + 2색)
  - 바탕 snow #eef0f4 — 재단까지. 틀 없음.
  - night #151b2c(吉田の火祭 밤·먹): 모든 글자. night/snow 15.0:1.
  - vermilion #d4462a(北口本宮冨士浅間神社 大鳥居의 丹塗り): 지평선 한 줄(비글자)·제호 괄호만. 글자 금지(3.91:1).

  주인공: 원고 (1)扉 「縦の表紙語: 富士みち」. 그림 없음 → 略図·OSM 크레딧 없음.
  구성: 네 글자 정사각 상자를 등비 r=${P.r}로 쌓음. 상자 모서리의 연장선이 (${P.cx}, ${P.horizon})에서 만난다(소실점) — 원근 모식, 실측 아님.
  상자: ${boxes.map((b) => `${b.ch} ${b.s}mm@(${b.x},${b.y}) ${b.w}`).join(' / ')}
  부제(편집장 정정 2026-10-15 KST): 「富士吉田に入った道は、富士山へまっすぐ延びる。」
        ← 원고 本文 46행 「富士吉田に入った富士道は下吉田のあたりで南へ向きを変え、富士山へまっすぐ延びる」 ← 取材 A16 山梨県 「富士道モデルコース④」(1次).
-->
<style>
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
.cover .no{left:calc(var(--mm)*12.57);top:calc(var(--mm)*33.5);font-family:'Zen Kaku Gothic New',sans-serif;font-weight:500;
  font-size:calc(var(--mm)*5.64);line-height:1;letter-spacing:.08em;font-variant-numeric:tabular-nums;white-space:nowrap}
.cover .hero{inset:0}
.cover .k{position:absolute;display:block;writing-mode:vertical-rl;font-family:'Shippori Mincho',serif;line-height:1;
  width:1em;height:1em;text-align:center;white-space:nowrap}
${heroCss}
.cover .ttl{RIGHT_TTL;writing-mode:vertical-rl;font-family:'Shippori Mincho',serif;font-weight:800;
  font-size:calc(var(--mm)*TTL_SIZE);line-height:1;letter-spacing:0.08em;white-space:nowrap}
.cover .sub{SUB_POS;writing-mode:vertical-rl;font-family:'Shippori Mincho',serif;font-weight:500;
  font-size:calc(var(--mm)*6);line-height:1.7;letter-spacing:0;white-space:nowrap}
.cover .sub .tcy{text-combine-upright:all}
.cover .credit{left:calc(var(--mm)*12.81);bottom:calc(var(--mm)*10);font-family:'Zen Kaku Gothic New',sans-serif;font-weight:400;
  font-size:calc(var(--mm)*3.4);line-height:1.5;white-space:nowrap;font-feature-settings:'palt'}
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
  <p class="no">一つの町　01</p>
  <p class="hero" role="img" aria-label="富士みち">${heroHtml}</p>
  <h1 class="ttl">富士吉田</h1>
  <p class="sub">SUB_TEXT</p>
  <p class="credit"><span class="hang">『となり』編集部</span></p>
</article>
</div>
</body>
</html>
`;

// ── 제목·부제 자리 ──
const L = JSON.parse(readFileSync(join(here, 'layout.json'), 'utf8'));
const out = html
  .replace('RIGHT_TTL', L.ttl)
  .replace('TTL_SIZE', String(L.ttlSize))
  .replace('SUB_POS', L.sub)
  .replace('SUB_TEXT', L.subText);
writeFileSync(join(here, 'cover.html'), out);
writeFileSync(join(here, 'boxes.json'), JSON.stringify({ P, a: f(a), s0: f(s0), boxes }, null, 2) + '\n');
console.log(boxes.map((b) => `${b.ch} s=${b.s} x=${b.x} y=${b.y}`).join('\n'));
