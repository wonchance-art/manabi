// 一つの町 01 富士吉田 표지 「一本の線」 — 3단계 조립(compositor) (2026-10-15 KST)
// 사용(이 폴더에서): node build-line.mjs ../../osm/fy.json line   ← 산정 = 국토지리원 剣ヶ峯로 바꾼 사본
//                    node build-cover.mjs                         → cover.html, layout.json  (v1)
//   v2(편집장 수정 지시 2026-10-15 KST): node build-line.mjs ../../osm/fy.json v2/line v2 && node build-cover.mjs v2 → v2/cover.html, v2/layout.json
//   v3(07-refine ①): node build-line.mjs <fy.json> ../07-refine/01-ippon/line v3 && node build-cover.mjs v3 → ../07-refine/01-ippon/cover.html, layout.json
// 입력: line/line.svg.txt · line/ridge.svg.txt(B안) · line/torii-bar.json · line/metrics.json · ../03-mast/mast-light.svg
// 결정적: 시각·난수·환경값을 읽지 않는다. 같은 입력이면 같은 바이트.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rd = (p) => fs.readFileSync(path.join(here, p), 'utf8');
const V = process.argv[2] || 'v1';
if (!['v1', 'v2', 'v3'].includes(V)) throw new Error('판본: v1 | v2 | v3');
const V3 = V === 'v3';
// v1 산출물은 그대로 보존, v2는 하위 폴더, v3(07-refine ① 다듬기)는 ../07-refine/01-ippon/
const D = { v1: '', v2: 'v2/', v3: '../07-refine/01-ippon/' }[V];

const BUILT = '2026-10-15 KST'; // 조립 날짜(고정 문자열 — 결정성 위해 실행 시각을 읽지 않는다)
const metrics = JSON.parse(rd(D + 'line/metrics.json'));
const torii = JSON.parse(rd(D + 'line/torii-bar.json'));
const pathOnly = (txt) => txt.match(/<path [^>]*\/>/)[0];
const linePath = pathOnly(rd(D + 'line/line.svg.txt'));
const ridgePath = pathOnly(rd(D + 'line/ridge.svg.txt'));
// 제호: 03-mast/mast-light.svg 그대로(path·색 무수정). 크기는 CSS로 32.87×16mm 고정, class만 붙인다.
const mast = rd('../03-mast/mast-light.svg').trim().replace('<svg ', '<svg class="mast" ');

// ── 판면 좌표표(mm, 재단선 기준 왼쪽 위 원점). NOTES.md 좌표표와 1:1 ──
const L = {
  mast: { x: 13, y: 13, w: 32.87, h: 16 },
  no: V3
    ? { x: 12.57, y: 30.31, size: 5.64, gap: 2.5 }         // v3 시리즈 규칙: 잉크 위끝 y31(제호 잉크 아래끝 26.9에서 4mm), 「町」–「01」 2.5mm(전각 공백 삭제)
    : { x: 12.57, y: 33.5, size: 5.64 },                    // 16pt. 「一」 잉크 왼끝을 『 바깥선 x13에 맞춤(곁 여백 0.43 보정)
  title: V === 'v1'
    ? { x: 150, y: 117.67, size: 14.11, track: 0.04 }    // 40pt, 세로 1열. 「富」 잉크 위끝 = 선 위끝(上宿) y118.2
    : { x: 146, y: 94.3, size: 20, track: 0.04 },        // v2: 20mm(≈57pt), x146–166. 「田」 잉크 아래끝 ≈176.5 → 부제 위끝 178 직전
  sub: { right: 115.6, y: 178, size: 6.0, lh: 1.7 },         // 17pt, 세로 2열. 「鳥」 중심 ≈ 막대 왼끝 y199, 오른열 잉크 끝 ≈113.5 → 막대 왼끝(116.9)과 3.4mm
  credit: V3
    ? { x: 12.82, bottom: 287, size: 3.24, lh: 1.42 }      // v3: 편집장 보충(세 안 공통) 3.24mm = 390px에서 6px 하한. 행간 1.4는 Zen Kaku 내용 영역 1.49em 때문에 행 상자가 겹쳐(check 실패 3건 실측) 통과하는 최소값 1.42. 5행, 오른끝 x≤85
    : { x: 12.81, bottom: 287, size: 3.4, lh: 1.5 },  // 잉크 왼끝 x13(곁 여백 0.19 보정)
  bar: { x: torii.page.x, y: torii.page.y, w: torii.bar.w, h: torii.bar.h, rot: torii.bar.rotateDeg },
};
// v2: 金鳥居 = night 도리이 윤곽(정면, 지도기호 수준 일반형). 국소 좌표(mm), 원점 = 金鳥居 실측점, 도로 직교 회전.
// 笠木 11mm(양끝 0.9mm 반림, 선 1.2) · 貫 8mm(선 1.1) · 기둥 둘 7mm(간격 5.8, 선 1.1 — 390px에서 3mm 주홍 선에 눌리지 않게). 주홍 선 위에 그린다(실물은 銅張り — 주홍 금지).
const TORII = V3 // v3: 선 3.4mm에 눌리지 않게 笠木 1.3·貫/기둥 1.2(07-refine ①-1). 기둥 간격 5.8→6.4: 주홍 선과 기둥 안쪽 틈을 v2와 같은 0.9mm로 유지(5.8이면 0.6mm로 붙어 보임)
  ? { kasagi: { w: 11, rise: 0.9, y: -3.6, sw: 1.3 }, nuki: { w: 8, y: -1.5, sw: 1.2 }, pillar: { dx: 3.2, y0: -3.6, y1: 3.4, sw: 1.2 } }
  : { kasagi: { w: 11, rise: 0.9, y: -3.6, sw: 1.2 }, nuki: { w: 8, y: -1.5, sw: 1.1 }, pillar: { dx: 2.9, y0: -3.6, y1: 3.4, sw: 1.1 } };
// v3 세로 제목 메트릭(시리즈 규칙): 같은 Shippori Mincho 800 woff2(Google Fonts v17 분할 파일 중 富·士·吉·田이 든 4개, 2026-10-15 15:03 KST CSS2 열람)를
// 「Shippori Mincho Tate」로 다시 선언하고 ascent/descent-override로 세로 글자 상자 폭을 1em으로 맞춘다. 글리프·굵기는 그대로.
// 첫 면에 U+20을 넣는 이유: 줄 상자의 기준(first available font)은 unicode-range에 U+0020을 포함한 첫 면이라, 없으면 원래 Shippori 메트릭(1.454em)이 쓰인다(실측).
const TATE_SLICES = [['5bcc', 107], ['58eb', 108], ['5409', 103], ['7530', 114]]; // 富 士 吉 田
const TATE_METRIC = { ascent: 88, descent: 12 };
const tateCss = () => TATE_SLICES.map(([cp, n]) => `@font-face{font-family:'Shippori Mincho Tate';font-style:normal;font-weight:800;font-display:swap;` +
  `src:url(https://fonts.gstatic.com/s/shipporimincho/v17/VdGDAZweH5EbgHY6YExcZfDoj0B4e9Om4fke5f7ErmwqJDbcxmkgTEWquC8NvBI.${n}.woff2) format('woff2');` +
  `unicode-range:U+${cp}${cp === '5bcc' ? ',U+20' : ''};ascent-override:${TATE_METRIC.ascent}%;descent-override:${TATE_METRIC.descent}%;line-gap-override:0%}`).join('\n') + '\n';
if (V !== 'v1') L.torii = { x: torii.page.x, y: torii.page.y, rot: torii.bar.rotateDeg, ...TORII };
const toriiSvg = () => {
  const { kasagi: k, nuki: n, pillar: q } = TORII, hw = k.w / 2;
  // 笠木: 가운데 y, 양끝 rise만큼 위로(2차 곡선 — 가운데 접점이 y가 되도록 제어점 y + rise)
  return `<g transform="translate(${L.torii.x} ${L.torii.y}) rotate(${L.torii.rot})" fill="none" stroke="#151b2c" stroke-linecap="butt">
      <path d="M${-q.dx} ${q.y0}V${q.y1}M${q.dx} ${q.y0}V${q.y1}" stroke-width="${q.sw}"/>
      <path d="M${-n.w / 2} ${n.y}H${n.w / 2}" stroke-width="${n.sw}"/>
      <path d="M${-hw} ${+(k.y - k.rise).toFixed(2)}Q0 ${+(k.y + k.rise).toFixed(2)} ${hw} ${+(k.y - k.rise).toFixed(2)}" stroke-width="${k.sw}"/>
    </g>`;
};
const mm = (v) => `calc(var(--mm)*${+v.toFixed(3)})`;

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>富士吉田 表紙</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;800&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap">
<!--
  『となり』 一つの町 01 富士吉田 표지 「一本の線」 — 생성 파일(05-compose/build-cover.mjs). 손으로 고치지 말 것. 조립 ${BUILT}.
  검사: node docs/japanology/magazine/prototype/check-cover.cjs cover.html  (바탕 = .cover의 --cover-bg)

  색(2색 + 바탕)
  - 바탕 snow #eef0f4 — 재단까지. 틀 없음.
  - night #151b2c(吉田の火祭 밤·먹): 모든 글자, 산 능선. night/snow 15.0:1.
${V === 'v1' ? `  - vermilion #d4462a(北口本宮冨士浅間神社 丹塗り 大鳥居의 색): 富士みち 선·金鳥居 막대·제호 괄호만. vermilion/snow 3.91:1 → 글자에는 쓰지 않는다.
    실물 金鳥居는 銅張りのコンクリート(観光庁 多言語解説文 001553179) — 막대 주홍은 경로 표시색이지 鳥居 색이 아니다.` : `  - vermilion #d4462a(北口本宮冨士浅間神社 丹塗り 大鳥居의 색): 富士みち 선·제호 괄호만. vermilion/snow 3.91:1 → 글자에는 쓰지 않는다.
  - 金鳥居 도리이 윤곽은 night — 실물 金鳥居는 銅張りのコンクリート(観光庁 多言語解説文 001553179)라 주홍으로 칠하지 않는다.`}

  출처
  - 富士みち 중심선: © OpenStreetMap contributors（ODbL 1.0）, Overpass osm_base 2026-07-28 11:16 KST, way ${metrics.osm.ways.join(',')}.
    위 끝 = OSM 富士みち 남단 노드 ${metrics.lineTopEnd.node}(上宿交差点) (${metrics.lineTopEnd.page.x}, ${metrics.lineTopEnd.page.y}). 아래 = 재단 y300에서 노드 사이 보간으로 자름. 직선화·회전 보정 없음.
  - 위 방향 = 金鳥居(OSM way 1482786848 중점 35.4832112, 138.7979629)에서 본 剣ヶ峯 방위 ${metrics.summitBearingDeg}°(국소 정거) —
    剣ヶ峯 35.360738, 138.727373 = 국토지리원 「日本の主な山岳標高（1003山）」 CSV 2026-03-31판. 축척 1mm = ${metrics.scale.mPerMm}m. 산은 축척 밖 略図(능선 B안).
${V === 'v1' ? `  - 金鳥居 막대: 판면 (${L.bar.x}, ${L.bar.y}), ${L.bar.w}×${L.bar.h}mm, rotate(${L.bar.rot}°) = 도로(±150m 주성분)에 직교.` : `  - 金鳥居 도리이: 판면 (${L.torii.x}, ${L.torii.y}) = OSM way 1482786848 중점, rotate(${L.torii.rot}°) = 도로(±150m 주성분)에 직교. 笠木 ${TORII.kasagi.w}·貫 ${TORII.nuki.w}·기둥 ${TORII.pillar.y1 - TORII.pillar.y0}mm, 일반형(특정 마크 모방 없음).`}
  - 부제: 観光庁 多言語解説文 「金鳥居」 「…30 メートルほど富士山に近く」(원고 B93). 「ほど」 유지.
  - 제호: 03-mast/mast-light.svg(Shippori Mincho ExtraBold 아웃라인 수정, OFL 1.1 — 그림이므로 OFL 적용 밖). 괄호 0.75mm 겹선.
  - 활자: Shippori Mincho 800(제목)·500(부제), Zen Kaku Gothic New 500(호 표기)·400(크레딧) — 모두 OFL, Google Fonts.

  편집장 결정(2026-10-15 KST)
  1 부제 「今の金鳥居は、もとの場所より30メートルほど山に近い。」 세로 2열, 「金鳥居」를 막대 높이에, 막대 왼끝과 띄움.
  2 산정 = 국토지리원 剣ヶ峯, build-line.mjs 사본으로 재투영. 3 능선 B안. 4 제호 (13,13) 16mm.
  5 명조(제호 외 제목·부제)/고딕(호 표기·크레딧). 6 크레딧 3줄 내용(인쇄 URL 포함), 3.4mm.
  7 틀 없음·2색·주홍 글자 금지. 8 --mm = 100cqw/210(cqi 금지). 9 요소 7개.${V === 'v1' ? '' : `
  v2 수정 지시(비평 05-critic-ad·05-critic-readers 종합): 金鳥居 = night 도리이 윤곽 · 축척 ${metrics.scale.mPerMm}m/mm(上宿 y${metrics.lineTopEnd.page.y}) ·
  산 꼭짓점 (126, ${metrics.ridge.B.kengamine.y}) 평탄 ${(metrics.ridge.B.flat[1] - metrics.ridge.B.flat[0]).toFixed(1)}mm 능선 1.4mm · 선 3.0mm · 제목 20mm. 선을 산정까지 늘리는 안은 사실 위반으로 기각.`}${V3 ? `
  v3 다듬기(07-refine/critic.md ①·§3 시리즈 규칙, 오너 선택 2026-10-15 KST): 선 ${'3.4'}mm · 능선 1.6mm · 도리이 1.3/1.2mm · 평탄부 필렛 반경 ${metrics.ridge.B.filletR}mm ·
  호 표기 잉크 위끝 y31·「町」–「01」 2.5mm · 크레딧 3.2mm/행간 1.4/5행 · 세로 제목 메트릭 override(상자 = 1em). 축척·선 형상·꼭짓점·평탄 폭은 v2 그대로(직선화·회전 금지).` : ''}
-->
<style>
${V3 ? tateCss() : ''}:root{--night:#151b2c;--vermilion:#d4462a;--snow:#eef0f4;--page:#d9dce3;--page-ink:#151b2c}
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
.cover .mast{left:${mm(L.mast.x)};top:${mm(L.mast.y)};width:${mm(L.mast.w)};height:${mm(L.mast.h)}}
.cover .no{left:${mm(L.no.x)};top:${mm(L.no.y)};font-family:'Zen Kaku Gothic New',sans-serif;font-weight:500;
  font-size:${mm(L.no.size)};line-height:1;letter-spacing:.08em;font-variant-numeric:tabular-nums;white-space:nowrap}
.cover .ttl{left:${mm(L.title.x)};top:${mm(L.title.y)};writing-mode:vertical-rl;font-family:${V3 ? "'Shippori Mincho Tate'," : ''}'Shippori Mincho',serif;font-weight:800;
  font-size:${mm(L.title.size)};line-height:1;letter-spacing:${L.title.track}em;white-space:nowrap}
.cover .sub{right:${mm(210 - L.sub.right)};top:${mm(L.sub.y)};writing-mode:vertical-rl;font-family:'Shippori Mincho',serif;font-weight:500;
  font-size:${mm(L.sub.size)};line-height:${L.sub.lh};letter-spacing:0;white-space:nowrap}
.cover .sub .tcy{text-combine-upright:all}
.cover .credit{left:${mm(L.credit.x)};bottom:${mm(297 - L.credit.bottom)};font-family:'Zen Kaku Gothic New',sans-serif;font-weight:400;
  font-size:${mm(L.credit.size)};line-height:${L.credit.lh};white-space:nowrap;font-feature-settings:'palt'}
.cover .credit span{display:block}
${V3 ? `.cover .no .n{margin-left:${mm(L.no.gap)}}
` : ''}.cover .credit .hang{text-indent:-.5em} /* 行頭の『 — 全角括弧の左アキ半角を詰め、잉크 왼끝을 x13에 맞춤(Zen Kaku는 palt 미적용 확인) */
</style>
</head>
<body>
<div class="wrap">
<article class="cover" lang="ja" aria-label="『となり』一つの町 01 富士吉田 表紙">
  <svg class="plate" viewBox="0 0 210 297" preserveAspectRatio="none" role="img" aria-label="富士山の略図と、下から上宿へのびる富士みちの線。上は金鳥居から見た富士山頂の方角。${V === 'v1' ? '線の途中の横棒' : '線の上の鳥居の形'}が金鳥居の位置。">
    ${V === 'v1' ? `<!-- 산 능선 略図 B안(축척 밖) · 剣ヶ峯 (126,46) · night 1mm -->
    ${ridgePath}
    <!-- 富士みち 중심선 · © OpenStreetMap contributors（ODbL） · vermilion 2.4mm -->
    ${linePath}
    <!-- 金鳥居 막대 · 도로 직교 -->
    <rect x="${-L.bar.w / 2}" y="${-L.bar.h / 2}" width="${L.bar.w}" height="${L.bar.h}" transform="translate(${L.bar.x} ${L.bar.y}) rotate(${L.bar.rot})" fill="#d4462a"/>` : `<!-- 산 능선 略図 B안(축척 밖) · 剣ヶ峯 (126,${metrics.ridge.B.kengamine.y}) · night ${V3 ? '1.6' : '1.4'}mm -->
    ${ridgePath}
    <!-- 富士みち 중심선 · © OpenStreetMap contributors（ODbL） · vermilion ${V3 ? '3.4' : '3.0'}mm -->
    ${linePath}
    <!-- 金鳥居 도리이 윤곽 · night · 도로 직교 · 선 위에 선다 -->
    ${toriiSvg()}`}
  </svg>
  ${mast}
  <p class="no">${V3 ? '一つの町<span class="n">01</span>' : '一つの町　01'}</p>
  <h1 class="ttl">富士吉田</h1>
  <p class="sub">今の金鳥居は、もとの場所より<br><span class="tcy">30</span>メートルほど山に近い。</p>
  <p class="credit">${V3
    ? '<span>地図　© OpenStreetMap contributors（ODbL）</span><span>openstreetmap.org/copyright</span><span>上は金鳥居から見た</span><span>富士山頂（剣ヶ峯）の方角・山は略図</span><span class="hang">『となり』編集部</span>'
    : '<span>地図　© OpenStreetMap contributors（ODbL）</span><span>openstreetmap.org/copyright</span><span>上は金鳥居から見た富士山頂（剣ヶ峯）の方角・山は略図</span><span class="hang">『となり』編集部</span>'}</p>
</article>
</div>
</body>
</html>
`;

fs.writeFileSync(path.join(here, D + 'cover.html'), html);
fs.writeFileSync(path.join(here, D + 'layout.json'), JSON.stringify(L, null, 1) + '\n');
console.log('cover.html', html.length, 'bytes');
