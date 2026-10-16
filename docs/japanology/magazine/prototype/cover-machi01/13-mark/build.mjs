// 13-mark — 오너 수렴 마크(TONARI 버블·となり, ai-gen/refine/v1)를 앉힌 표지 4안 (2026-10-16 KST)
// 사용(리포 루트, Node 24): node docs/japanology/magazine/prototype/cover-machi01/13-mark/build.mjs
// 사실·문구·그림은 12-hip(검수 완료)에서 그대로 가져온다: 一本の線 판(OSM 실측선·略図 능선), 断面 판(GSI 標高, 縦横同縮尺).
// 마크 = 그래픽(글자 아님). 표지 규격: 재단까지 바탕, 요소 ≤7, mm 단위 = 100cqw/210, check-cover.cjs 통과.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../../../..');
const { chromium } = createRequire(path.join(ROOT, 'package.json'))('playwright');
const HIP = path.resolve(HERE, '../12-hip/covers');
const MARK = path.resolve(HERE, '../../../brand/ai-gen/refine/v1');
mkdirSync(path.join(HERE, 'covers'), { recursive: true });

const grab = (file, re) => readFileSync(path.join(HIP, file), 'utf8').match(re)[0];
const PLATE = { ippon: grab('ippon-H1.html', /<svg class="plate"[\s\S]*?<\/svg>/), danmen: grab('danmen-H5.html', /<svg class="plate"[\s\S]*?<\/svg>/) };
const CREDIT = { ippon: grab('ippon-H1.html', /<p class="c credit">[\s\S]*?<\/p>/), danmen: grab('danmen-H5.html', /<p class="c credit">[\s\S]*?<\/p>/) };
const svgOf = (f) => { const s = readFileSync(path.join(MARK, f), 'utf8'); const vb = s.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number); return { d: s.match(/ d="([^"]+)"/)[1], vb, ar: vb[2] / vb[3] }; };
const TN = svgOf('TONARI-master.svg'), HI = svgOf('hira-v1.svg');
const mm = (v) => `calc(var(--mm)*${+v.toFixed(3)})`;
// 마크 하나: 왼쪽·위·폭(mm), 색, 회전(선택)
const mark = (m, { x, y, w, color, label, rot }) => {
  const h = w / m.ar;
  const t = rot ? `transform:rotate(90deg) translate(0,-100%);transform-origin:0 0;` : '';
  const style = rot
    ? `left:${mm(x)};top:${mm(y)};width:${mm(w)};height:${mm(h)};${t}color:${color}`
    : `left:${mm(x)};top:${mm(y)};width:${mm(w)};height:${mm(h)};color:${color}`;
  return { h, html: `<svg class="mk" viewBox="${m.vb.join(' ')}" style="${style}" role="img" aria-label="${label}"><path fill="currentColor" fill-rule="evenodd" d="${m.d}"/></svg>` };
};

const C = { night: '#151b2c', verm: '#d4462a', snow: '#eef0f4' };
const head = (title, bg, ink, extra) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<!-- 『となり』 一つの町 01 富士吉田 — 13-mark 표지 · 생성 파일(13-mark/build.mjs). 손으로 고치지 말 것. 2026-10-16 KST. 마크 = ai-gen/refine/v1. -->
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=block" rel="stylesheet">
<style>
:root{--night:#151b2c;--vermilion:#d4462a;--snow:#eef0f4;--page:#d9dce3;--page-ink:#151b2c}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--page:#0e1220;--page-ink:#eef0f4}}
:root[data-theme="dark"]{--page:#0e1220;--page-ink:#eef0f4}
*{box-sizing:border-box}html,body{margin:0;background:var(--page);color:var(--page-ink)}body{padding:16px}
.wrap{max-width:860px;margin:0 auto;container-type:inline-size}
.cover{--mm:calc(100cqw / 210);--cover-bg:${bg};width:100%;aspect-ratio:210/297;position:relative;overflow:hidden;background:var(--cover-bg);color:${ink}}
.cover > *{position:absolute;margin:0}
.cover .plate{inset:0;width:100%;height:100%;display:block}
.cover .mk{display:block;overflow:visible}
.go{font-family:'Zen Kaku Gothic New',sans-serif}
.mi{font-family:'Zen Old Mincho',serif;font-weight:700}
.cover .line{font-weight:500;font-size:${mm(5.6)};line-height:1.6}
.cover .line > span,.cover .story > span,.cover .credit > span{display:block;white-space:nowrap}
.cover .story{font-weight:700;font-size:${mm(6)};line-height:1.6}
.cover .kick{font-weight:500;font-size:${mm(6.4)};line-height:1;letter-spacing:.1em}
.cover .kick .no{margin-left:${mm(2.5)};letter-spacing:.04em}
.cover .credit{bottom:${mm(10)};left:${mm(14)};right:${mm(14)};text-align:center;font-weight:400;font-size:${mm(3.24)};line-height:1.42;font-feature-settings:'palt'}
.cover .tate{writing-mode:vertical-rl;text-orientation:upright;line-height:1}
.cover .hr{margin-right:-.5em}.cover .hl{margin-left:-.5em}
${extra}
</style></head><body><div class="wrap">`;
const tail = `</div></body></html>\n`;
const credit = (k) => CREDIT[k].replace('class="c credit"', 'class="credit go"');

// ── A 一本の線: 눈 바탕, 왼쪽 정렬 조합판(시안 01·05), 세로 제목이 능선 아래 비탈에
function A() {
  const t = mark(TN, { x: 14, y: 14, w: 182, color: C.night, label: 'TONARI' });
  const k = mark(HI, { x: 14, y: 14 + t.h + 4.4, w: 182 * 0.45, color: C.night, label: 'となり' });
  return head('A 一本の線', C.snow, C.night, `
.cover .kick{right:${mm(14)};top:${mm(14 + t.h + 4.4 + k.h - 6.4)};text-align:right}
.cover .l2{left:${mm(14)};top:${mm(104)}}
.cover .ttl{right:${mm(16)};top:${mm(178)};font-size:${mm(17)};letter-spacing:.04em}
.cover .story{left:${mm(14)};right:${mm(14)};top:${mm(256.098)};text-align:center}`) + `
<article class="cover" lang="ja" aria-label="TONARI となり 一つの町 01 富士吉田 表紙">
  ${PLATE.ippon}
  ${t.html}${k.html}
  <p class="kick go">一つの町<span class="no">01</span></p>
  <p class="line l2 go"><span>富士に真向かう一直線の道に沿って<span class="hr">、</span></span><span><span class="hl">「</span>聖なる町と俗なる町」が隣り合う<span class="hr">。</span></span></p>
  <h1 class="ttl mi tate">富士吉田</h1>
  <p class="story go"><span>今の金鳥居は、もとの場所より30メートルほど山に近い<span class="hr">。</span></span></p>
  ${credit('ippon')}
</article>` + tail;
}

// ── B 朱の名: 눈 바탕, 가운데 축(11-center 계보), 주홍 조합판 = 표지의 주인공
function B() {
  const w = 182, t = mark(TN, { x: 14, y: 14, w, color: C.verm, label: 'TONARI' });
  const kw = w * 0.45, k = mark(HI, { x: 105 - kw / 2, y: 14 + t.h + 4.4, w: kw, color: C.verm, label: 'となり' });
  return head('B 朱の名', C.snow, C.night, `
.cover .c{left:${mm(14)};right:${mm(14)};text-align:center;white-space:nowrap}
.cover .kick{top:${mm(101)}}
.cover .ttl{top:${mm(113)};font-size:${mm(19)};line-height:1;letter-spacing:.08em}
.cover .l2{left:${mm(14)};top:${mm(198)}}
.cover .story{top:${mm(256.098)}}`) + `
<article class="cover" lang="ja" aria-label="TONARI となり 一つの町 01 富士吉田 表紙">
  ${PLATE.ippon}
  ${t.html}${k.html}
  <p class="c kick go">一つの町<span class="no">01</span></p>
  <h1 class="c ttl mi">富士吉田</h1>
  <p class="line l2 go"><span>富士に真向かう一直線の道に沿って<span class="hr">、</span></span><span><span class="hl">「</span>聖なる町と俗なる町」が隣り合う<span class="hr">。</span></span></p>
  <p class="c story go"><span>今の金鳥居は、もとの場所より30メートルほど山に近い<span class="hr">。</span></span></p>
  ${credit('ippon')}
</article>` + tail;
}

// ── C 断面: 밤 바탕, 흰 조합판, 바닥에 실측 단면(12-hip danmen과 같은 문구·그림)
function C_() {
  const w = 182, t = mark(TN, { x: 14, y: 14, w, color: C.snow, label: 'TONARI' });
  const kw = w * 0.45, k = mark(HI, { x: 105 - kw / 2, y: 14 + t.h + 4.4, w: kw, color: C.snow, label: 'となり' });
  return head('C 断面', C.night, C.snow, `
.cover .c{left:${mm(14)};right:${mm(14)};text-align:center;white-space:nowrap}
.cover .kick{top:${mm(104)}}
.cover .ttl{top:${mm(121)};font-size:${mm(30)};line-height:1;letter-spacing:.06em}
.cover .l2{top:${mm(165)}}
.cover .story{top:${mm(195)}}`) + `
<article class="cover" lang="ja" aria-label="TONARI となり 一つの町 01 富士吉田 表紙">
  ${PLATE.danmen}
  ${t.html}${k.html}
  <p class="c kick go">一つの町<span class="no">01</span></p>
  <h1 class="c ttl mi">富士吉田</h1>
  <p class="c line l2 go"><span>8月26日の夜<span class="hr">、</span></span><span>道がいちばん明るくなる<span class="hr">。</span></span></p>
  <p class="c story go"><span>標高700〜900メートルほど<span class="hr">、</span></span><span>稲づくりに向かない土地<span class="hr">。</span></span></p>
  ${credit('danmen')}
</article>` + tail;
}

// ── D 背: 오른쪽 끝을 세로 TONARI가 통째로 차지(시안 08), 왼쪽 열에 となり·제목·이야기. 그림은 세로 마크 앞에서 잘린다
function D() {
  const L = 244, sp = mark(TN, { x: 196 - L / TN.ar, y: 14, w: L, color: C.night, label: 'TONARI', rot: true });
  const k = mark(HI, { x: 14, y: 14, w: 78, color: C.verm, label: 'となり' });
  const plate = PLATE.ippon.replace('<svg class="plate"', '<svg class="plate" style="clip-path:inset(0 calc(var(--mm)*' + (210 - (196 - L / TN.ar) + 4).toFixed(2) + ') 0 0)"')
    .replace(/<path d="M-3 188/, '<g transform="translate(-90 0)"><path d="M-3 188').replace(/<\/svg>$/, '</g></svg>');
  return head('D 背', C.snow, C.night, `
.cover .kick{left:${mm(14)};top:${mm(14 + k.h + 8)}}
.cover .ttl{left:${mm(14)};top:${mm(14 + k.h + 23)};font-size:${mm(24)};line-height:1;letter-spacing:.02em}
.cover .story{left:${mm(52)};top:${mm(198)}}`) + `
<article class="cover" lang="ja" aria-label="TONARI となり 一つの町 01 富士吉田 表紙">
  ${plate}
  ${sp.html}${k.html}
  <p class="kick go">一つの町<span class="no">01</span></p>
  <h1 class="ttl mi">富士吉田</h1>
  <p class="story go"><span>今の金鳥居は<span class="hr">、</span></span><span>もとの場所より</span><span>30メートルほど山に近い<span class="hr">。</span></span></p>
  ${credit('ippon')}
</article>` + tail;
}

const COVERS = { A: A(), B: B(), C: C_(), D: D() };
const NOTE = {
  A: ['一本の線', '능선 아래 비탈에 세로 제목. 조합판은 왼쪽 정렬(시안 01·05)'],
  B: ['朱の名', '가운데 축·좌우 같은 여백. 주홍 조합판이 주인공, 지도선과 같은 주홍'],
  C: ['断面', '밤 바탕에 흰 조합판. 바닥은 실측 단면(縦横同縮尺)'],
  D: ['背', '세로 TONARI가 오른쪽을 통째로(시안 08). 책등·선반에서도 읽힌다'],
};
for (const [id, html] of Object.entries(COVERS)) writeFileSync(path.join(HERE, 'covers', `${id}.html`), html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 632, height: 1000 }, deviceScaleFactor: 2 });
const results = {};
for (const id of Object.keys(COVERS)) {
  const f = path.join(HERE, 'covers', `${id}.html`);
  await page.goto('file://' + f); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
  results[id] = await page.evaluate(() => {
    const cover = document.querySelector('.cover'), cr = cover.getBoundingClientRect(), mm = cr.width / 210, fails = [];
    const marks = [...cover.querySelectorAll('.mk')].map((m) => m.getBoundingClientRect());
    for (const m of marks) {
      if (m.left < cr.left + 10 * mm - 0.5 || m.right > cr.right - 10 * mm + 0.5 || m.top < cr.top + 10 * mm - 0.5 || m.bottom > cr.bottom - 10 * mm + 0.5) fails.push('마크가 안전선 밖');
      for (const el of cover.querySelectorAll('p,h1')) for (const r of el.getClientRects())
        if (r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top) fails.push('마크 ↔ ' + el.className);
    }
    return fails;
  });
  await page.locator('.cover').screenshot({ path: path.join(HERE, 'covers', `${id}.png`) });
  try { execFileSync('node', [path.join(HERE, '../../check-cover.cjs'), f], { cwd: ROOT, stdio: 'pipe' }); results[id].push('check-cover 통과'); }
  catch (e) { results[id].push('check-cover 실패: ' + String(e.stdout).trim().split('\n').slice(1).join(' / ')); }
}
const cmp = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>13-mark 표지 4안</title><style>
body{margin:0;padding:28px;background:#e9e6df;color:#151b2c;font:13px/1.5 system-ui,sans-serif}h1{font-size:19px;margin:0 0 4px}p.lead{margin:0 0 18px;color:#444}
.row{display:flex;gap:22px}figure{margin:0;width:330px}img{width:330px;display:block;box-shadow:0 1px 4px rgba(0,0,0,.18)}figcaption{margin-top:8px}figcaption b{font-size:14px}figcaption small{display:block;color:#666;font-size:11px}
</style></head><body><h1>『となり』 一つの町 01 富士吉田 — 새 마크 표지 4안</h1><p class="lead">마크 = 오너 수렴안 정밀화 v1. 문구·지도·단면은 12-hip(검수 완료) 그대로. 2026-10-16 KST.</p><div class="row">
${Object.keys(COVERS).map((id) => `<figure><img src="covers/${id}.png" alt=""><figcaption><b>${id} ${NOTE[id][0]}</b> — ${NOTE[id][1]}<small>${results[id].join(' · ')}</small></figcaption></figure>`).join('')}
</div></body></html>`;
writeFileSync(path.join(HERE, 'compare.html'), cmp);
await page.setViewportSize({ width: 1480, height: 900 });
await page.goto('file://' + path.join(HERE, 'compare.html')); await page.waitForTimeout(300);
await page.screenshot({ path: path.join(HERE, 'compare.png'), fullPage: true });
await browser.close();
console.log(JSON.stringify(results, null, 1));
