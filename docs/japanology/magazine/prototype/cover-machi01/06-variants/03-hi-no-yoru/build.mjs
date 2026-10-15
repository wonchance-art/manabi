// 『となり』 一つの町 01 富士吉田 표지 ③「火の夜」 — 결정적 생성 (2026-10-15 KST)
// 사용(이 폴더에서): node build.mjs → cover.html
// 결정적: 시각·난수·환경값을 읽지 않는다. 같은 입력이면 같은 바이트.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAST = '/home/user/manabi/docs/japanology/magazine/prototype/cover-machi01/03-mast/mast-dark.svg';
const mast = fs.readFileSync(MAST, 'utf8').trim().replace('<svg ', '<svg class="mast" ');
const BUILT = '2026-10-15 KST';
const r2 = (v) => +v.toFixed(2);

// ── 大松明: 원고 「高さ約3メートル、直径約90センチの筍の形」 → 높이:지름 = 3.0 : 0.9 (m) ──
const TORCH = { h: 3.0, d: 0.9 };
// 筍形 윤곽: 바닥 지름 d, 위로 갈수록 볼록하게(배부른 원뿔) 가늘어져 끝이 뾰족. hw(t) = d/2 · (1 − t)(1 + c·t), t = 0(밑)…1(끝)
const SHAPE = { c: 0.85, n: 32 };
const profile = () => {
  const pts = [];
  for (let i = 0; i <= SHAPE.n; i++) {
    const t = i / SHAPE.n;
    pts.push([(TORCH.d / 2) * (1 - t) * (1 + SHAPE.c * t), t * TORCH.h]);
  }
  return pts; // [반폭 m, 높이 m]
};
const PROF = profile();

// ── 원근(1점 투시, 模式): 눈높이 E m, 소실점 (vx, vy) mm, 초점 f mm·m ──
// 화면 x = vx + f·X/Z, y = vy + f·(E − Y)/Z. 같은 깊이에서 가로·세로 배율이 같으므로 높이:지름 비 3.0:0.9가 판면에서도 그대로 유지된다.
// 소실점 = 판면 가운데 축(x105) — 제목 「富士吉田」이 같은 축 위에 선다. 눈높이 7m(2층 창 높이쯤에서 길을 내려다본 模式) → 松明 전부가 지평선 아래, 위쪽은 밤하늘로 비운다.
const CAM = { vx: 105, vy: 116, E: 7, f: 100 };
// 길 양쪽 두 줄(길 중심에서 ±3.2m), 2.2m 간격, 왼줄은 반 칸 어긋남. 간격·개수·양쪽 배치는 模式(원고에 본수 없음).
// 앞쪽은 재단 밖으로 잘리고 뒤쪽은 소실점에서 겹쳐 사라진다 → 그림에서 개수를 셀 수 없다(개수 주장 없음).
const ROW = { sides: [3.2, -3.2], z0: 1.5, step: 2.2, stagger: 0.5, zMax: 400, minH: 0.9 };
const COL = { near: '#f2a066', far: '#d4462a', z1: 5, z2: 60 };  // z1m까지 = 불빛(ember) 그대로, z2m에서 주홍. 사이는 로그 깊이로 섞는다

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [a, b] = [p(c1), p(c2)];
  return '#' + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join('');
};

const torches = [];
const sides = ROW.sides || [ROW.X];
sides.forEach((X, si) => {
  for (let z = ROW.z0 + (si % 2) * (ROW.stagger || 0) * ROW.step; z <= ROW.zMax; z += ROW.step) {
    const s = CAM.f / z;                     // mm per m at depth z
    const hmm = TORCH.h * s;
    if (hmm < ROW.minH) break;
    const cx = CAM.vx + X * s, by = CAM.vy + CAM.E * s;
    const hw = (TORCH.d / 2) * s;
    if (cx + hw <= 0 || cx - hw >= 210 || by - hmm >= 297) continue; // 판면 밖에 통째로 있는 것은 생략
    const pts = [];
    for (const [w, y] of PROF) pts.push([cx + w * s, by - y * s]);
    for (let i = PROF.length - 1; i >= 0; i--) { const [w, y] = PROF[i]; pts.push([cx - w * s, by - y * s]); }
    const t = Math.max(0, Math.min(1, Math.log(z / COL.z1) / Math.log(COL.z2 / COL.z1)));
    torches.push({ z, s, cx, by, hmm, col: mix(COL.near, COL.far, t), d: 'M' + pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L') + 'Z' });
  }
});
torches.sort((a, b) => b.z - a.z || a.cx - b.cx); // 먼 것부터 그린다(가까운 것이 위)

// ── 글자 좌표(mm) ──
const L = {
  mast: { x: 13, y: 13, w: 32.87, h: 16 },
  no: { x: 12.57, y: 33.5, size: 5.64 },
  title: { x: 95, y: 18, size: 20, track: 0.04 },   // 가운데 축 x95–115, 소실점 위
  sub: { x: 96.5, y: 148, size: 6.0, lh: 1.7 },      // 두 줄 사이 '길' 위, 「道」가 소실점 쪽 맨 위
  credit: { x: 12.81, bottom: 10, size: 3.4, lh: 1.5 },
};
const mm = (v) => `calc(var(--mm)*${+v.toFixed(3)})`;

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>富士吉田 表紙 火の夜</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;800&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap">
<!--
  『となり』 一つの町 01 富士吉田 표지 ③「火の夜」 — 생성 파일(build.mjs). 손으로 고치지 말 것. 조립 ${BUILT}.
  검사: node docs/japanology/magazine/prototype/check-cover.cjs cover.html  (바탕 = .cover의 --cover-bg = night)

  색(바탕 + 2색)
  - 바탕 night #151b2c(吉田の火祭의 밤) — 재단까지. 틀 없음.
  - snow #eef0f4: 모든 글자. snow/night 15.0:1.
  - ember #f2a066: 大松明(가까운 것). 근거 — 원고 「村の中が真昼のように明るかった」(『甲斐国志』 전언)의 불빛. 주홍만으로는 밤 바탕에서 '빛'이 아니라 '붉은 물체'로 읽힌다.
    멀어질수록 vermilion #d4462a로 옮겨 간다(공기 원근). 둘 다 비글자 전용.
  - vermilion #d4462a: 먼 大松明·제호 괄호.

  사실 근거
  - 大松明 筍形, 높이 약 3m · 지름 약 90cm, 表通り, 8月26日の夜 = 원고 (2)火の夜 第1段(출처표 A45·A47, 北口本宮冨士浅間神社 himatsuri 원문 조회 2026-10-15 09:20 KST).
    판면의 모든 松明은 같은 깊이에서 높이:지름 = 3.0:0.9 (1점 투시라 가로·세로 배율 동일).
  - 개수·간격·배치(길 양쪽 두 줄, 반 칸 어긋남)·눈높이 ${CAM.E}m는 模式 — 원고에 본수 없음(취재 D3 이견 80〜120본). 앞쪽은 재단 밖, 뒤쪽은 점으로 사라져 셀 수 없게 했다.
  - 부제: 원고 72행 「道がいちばん明るくなるのは、8月26日の夜である。」 그대로.
  - 제호: 03-mast/mast-dark.svg 그대로(무수정).
  - 활자: Shippori Mincho 800(제목)·500(부제), Zen Kaku Gothic New 500(호 표기)·400(크레딧) — OFL, Google Fonts.
  - 大松明 ${torches.length}개 그림(개수 주장 아님), 눈높이 ${CAM.E}m.
-->
<style>
:root{--night:#151b2c;--vermilion:#d4462a;--snow:#eef0f4;--ember:#f2a066;--page:#d9dce3;--page-ink:#151b2c}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--page:#0e1220;--page-ink:#eef0f4}}
:root[data-theme="dark"]{--page:#0e1220;--page-ink:#eef0f4}
*{box-sizing:border-box}
html,body{margin:0;background:var(--page);color:var(--page-ink)}
body{padding:16px}
.wrap{max-width:860px;margin:0 auto;container-type:inline-size}

/* ── 표지: A4 210×297mm, 1mm = 100cqw/210 ── */
.cover{--mm:calc(100cqw / 210);--cover-bg:#151b2c;
  width:100%;aspect-ratio:210/297;position:relative;overflow:hidden;background:var(--cover-bg);color:var(--snow)}
.cover > *{position:absolute;margin:0}
.cover .plate{inset:0;width:100%;height:100%;display:block}
.cover .mast{left:${mm(L.mast.x)};top:${mm(L.mast.y)};width:${mm(L.mast.w)};height:${mm(L.mast.h)}}
.cover .no{left:${mm(L.no.x)};top:${mm(L.no.y)};font-family:'Zen Kaku Gothic New',sans-serif;font-weight:500;
  font-size:${mm(L.no.size)};line-height:1;letter-spacing:.08em;font-variant-numeric:tabular-nums;white-space:nowrap}
.cover .ttl{left:${mm(L.title.x)};top:${mm(L.title.y)};writing-mode:vertical-rl;font-family:'Shippori Mincho',serif;font-weight:800;
  font-size:${mm(L.title.size)};line-height:1;letter-spacing:${L.title.track}em;white-space:nowrap}
.cover .sub{left:${mm(L.sub.x)};top:${mm(L.sub.y)};writing-mode:vertical-rl;font-family:'Shippori Mincho',serif;font-weight:500;
  font-size:${mm(L.sub.size)};line-height:${L.sub.lh};letter-spacing:0;white-space:nowrap}
.cover .sub .tcy{text-combine-upright:all}
.cover .credit{left:${mm(L.credit.x)};bottom:${mm(L.credit.bottom)};font-family:'Zen Kaku Gothic New',sans-serif;font-weight:400;
  font-size:${mm(L.credit.size)};line-height:${L.credit.lh};white-space:nowrap;font-feature-settings:'palt'}
.cover .credit span{display:block}
.cover .credit .hang{text-indent:-.5em}
</style>
</head>
<body>
<div class="wrap">
<article class="cover" lang="ja" aria-label="『となり』一つの町 01 富士吉田 表紙">
  <svg class="plate" viewBox="0 0 210 297" preserveAspectRatio="none" role="img" aria-label="夜の表通りに、筍の形をした大松明が奥へ向かって並ぶ模式図。">
${torches.map((t) => `    <path d="${t.d}" fill="${t.col}"/>`).join('\n')}
  </svg>
  ${mast}
  <p class="no">一つの町　01</p>
  <h1 class="ttl">富士吉田</h1>
  <p class="sub">道がいちばん明るくなるのは、<br><span class="tcy">8</span>月<span class="tcy">26</span>日の夜である。</p>
  <p class="credit"><span>大松明の数と並びは模式</span><span class="hang">『となり』編集部</span></p>
</article>
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(here, 'cover.html'), html);
console.log(`大松明 ${torches.length}`);
