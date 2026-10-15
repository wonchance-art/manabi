// 『となり』 一つの町 01 富士吉田 표지 ② 「短冊」 — 결정적 생성기.
// 사용: node build.mjs [out=cover.html]   (같은 입력 → 같은 바이트)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const MAST = '/home/user/manabi/docs/japanology/magazine/prototype/cover-machi01/03-mast/mast-light.svg';
const out = join(here, process.argv[2] || 'cover.html');

// ── 사실(원고 (2) 「山へ引かれた道」 第1段, 출처표 A06 山梨県埋蔵文化財センター「中世の吉田宿」) ──
const EAST = 31; // 東町
const WEST = 39; // 西町
if (EAST + WEST !== 70) throw new Error('軒数が原稿(70軒)と合わない');

// ── 판면(mm, 마무리선 기준. 재단 여유 3mm) ──
const P = {
  townTop: 49,      // 町の南端(山側) — 模式
  townBot: 257,     // 町の北端 — 模式
  roadL: 89.5,      // 道の東側の家並み(表通りに面した前端)
  roadR: 120.5,     // 道の西側
  gap: 1.15,        // 区切り(地割りの境) — 両側同じ幅
  bleed: 3,
  bar: 2.4,        // null = 칸 - gap(경계 폭 고정). 숫자 = 줄 굵기 고정
  edge: false,      // 길 가장자리 주홍선
};
if (process.env.TZ_OPT) Object.assign(P, JSON.parse(process.env.TZ_OPT));
const r = (v) => Math.round(v * 1000) / 1000;

// 한 쪽 가로줄 N개: y구간을 N등분, 각 칸 아래쪽에 gap만큼 비운다(맨 아래 칸 끝 = townBot 정확히)
function strips(n, x0, x1) {
  const pitch = P.bar == null ? (P.townBot - P.townTop + P.gap) / n : (P.townBot - P.townTop - P.bar) / (n - 1); // 마지막 칸의 gap은 바깥으로 — 위 끝·아래 끝 모두 잉크
  let d = '';
  for (let i = 0; i < n; i++) {
    const y = P.townTop + i * pitch;
    const h = P.bar ?? pitch - P.gap;
    d += `M${r(x0)} ${r(y)}H${r(x1)}V${r(y + h)}H${r(x0)}Z`;
  }
  return { d, pitch: r(pitch), bar: r(P.bar ?? pitch - P.gap) };
}
// 위 = 南(富士山の方). 南を上にすると東は左、西は右.
const east = strips(EAST, -P.bleed, P.roadL);
const west = strips(WEST, P.roadR, 210 + P.bleed);

const mast = readFileSync(MAST, 'utf8').trim().replace('<svg ', '<svg class="mast" ');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>富士吉田 表紙 短冊</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;800&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap">
<!--
  『となり』 一つの町 01 富士吉田 표지 ②「短冊」 — 생성 파일(build.mjs). 손으로 고치지 말 것. 2026-10-15 KST.
  주인공: 길 하나를 사이에 두고 늘어선 短冊 地割り. 東町 ${EAST}本(左)・西町 ${WEST}本(右) = 70軒.
    원고 (2)「山へ引かれた道」: 「道の両側は短冊のように細長く区切られ、東町に31軒、西町に39軒、あわせて70軒に御師や神職、商人、職人が住んだ。」
    출처표 A06 = 山梨県埋蔵文化財センター 遺跡トピックスNo.0310「中世の吉田宿」(1次, 원문 대조 2026-10-15 09:22 KST).
  模式: 필지의 폭·깊이·길이(町の長さ)는 실측이 아니다. 같은 칸 폭으로 고르게 나눴다(실제 間口는 집마다 달랐다 — A08 大玉屋 18間).
    위 = 南(富士山の方, A02 「富士山に向かって南方に延びる街路」). 그래서 東町이 왼쪽, 西町이 오른쪽.
  판면: 町 y${P.townTop}–${P.townBot}. 東 칸 ${east.pitch}mm(줄 ${east.bar}), 西 칸 ${west.pitch}mm(줄 ${west.bar}), 줄 굵기 양쪽 같음 — 밀도 차가 곧 軒数 차. 길 x${P.roadL}–${P.roadR}.
  색(2색 + 바탕): 바탕 snow #eef0f4 · night #151b2c(글자·필지) · vermilion #d4462a(제호 괄호만. 길 가장자리 주홍선은 시험 후 뺐다(edge:false) — 글자 금지, snow 대비 3.91).
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
.cover .ttl{left:calc(var(--mm)*95);top:calc(var(--mm)*__TTLTOP__);writing-mode:vertical-rl;font-family:'Shippori Mincho',serif;font-weight:800;
  font-size:calc(var(--mm)*20);line-height:1;letter-spacing:.06em;white-space:nowrap}
.cover .sub{left:calc(var(--mm)*__SUBL__);top:calc(var(--mm)*__SUBTOP__);writing-mode:vertical-rl;font-family:'Shippori Mincho',serif;font-weight:500;
  font-size:calc(var(--mm)*6);line-height:1.75;letter-spacing:.02em;white-space:nowrap}
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
  <svg class="plate" viewBox="0 0 210 297" preserveAspectRatio="none" role="img" aria-label="一本の道の両側に、細長い屋敷地が短冊のように並ぶ模式図。左（東町）に31本、右（西町）に39本。上が富士山の方。">
    <!-- 東町 ${EAST}軒 · 模式 · night -->
    <path d="${east.d}" fill="#151b2c"/>
    <!-- 西町 ${WEST}軒 · 模式 · night -->
    <path d="${west.d}" fill="#151b2c"/>
    <!-- 道の両側の家並みの前端 · vermilion 0.75mm · 天地とも재단까지(道は町の外へ続く) -->
    ${P.edge ? '' : '<!--'}<path d="M${P.roadL + 0.375} -3V300M${P.roadR - 0.375} -3V300" fill="none" stroke="#d4462a" stroke-width="0.75"/>${P.edge ? '' : '-->'}
  </svg>
  ${mast}
  <p class="no">一つの町　01</p>
  <h1 class="ttl">富士吉田</h1>
  <p class="sub">道の両側は短冊のように区切られ、<br>東に<span class="tcy">31</span>軒、西に<span class="tcy">39</span>軒。</p>
  <p class="credit"><span>図は模式　屋敷地の幅と奥行きは実測ではない</span><span>上が富士山の方（南）　左が東町、右が西町</span><span>軒数　山梨県埋蔵文化財センター「中世の吉田宿」</span><span class="hang">『となり』編集部</span></p>
</article>
</div>
</body>
</html>
`;
const fill = html.replace('__TTLTOP__', '57').replace('__SUBL__', '94.3').replace('__SUBTOP__', '158');
writeFileSync(out, fill);
console.log(out, `east pitch ${east.pitch} bar ${east.bar} · west pitch ${west.pitch} bar ${west.bar}`);
