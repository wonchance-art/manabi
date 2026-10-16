// 08-mast 확인: ① 표지 사본 10장 check-cover ② 제호와 글자 요소 겹침·안전선(잉크 상자) ③ compare.png 촬영
// 사용(리포 루트): node docs/japanology/magazine/prototype/cover-machi01/08-mast/shoot.cjs   (Node 24)
const path = require('path');
const { execFileSync } = require('child_process');
const { createRequire } = require('module');
const req = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = req('playwright');
const HERE = __dirname;
const CHECK = path.join(HERE, '..', '..', 'check-cover.cjs');
const KEYS = ['A', 'B', 'C', 'D', 'E'];

(async () => {
  let bad = 0;
  for (const k of KEYS) for (const w of ['ippon', 'danmen']) {
    const f = path.join(HERE, 'covers', `${k}-${w}.html`);
    try { const out = execFileSync('node', [CHECK, f], { encoding: 'utf8' }); console.log(`${k}-${w}: ${out.trim().split('\n').pop()}`); }
    catch (e) { bad++; console.log(`${k}-${w}: 실패\n${e.stdout}`); }
  }
  // 제호(SVG 잉크 상자) ↔ 글자 요소 겹침, 안전선 — check-cover는 SVG 그림을 보지 않으므로 따로 잰다.
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 422, height: 900 } });
  for (const k of KEYS) for (const w of ['ippon', 'danmen']) {
    await p.goto('file://' + path.join(HERE, 'covers', `${k}-${w}.html`));
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const c = document.querySelector('.cover').getBoundingClientRect(); const mm = c.width / 210;
      const m = document.querySelector('.cover .mast').getBoundingClientRect();
      const box = (q) => { const e = document.querySelector(q); const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()].filter((x) => x.width);
        return { l: Math.min(...rs.map((x) => x.left)), t: Math.min(...rs.map((x) => x.top)), r: Math.max(...rs.map((x) => x.right)), b: Math.max(...rs.map((x) => x.bottom)) }; };
      const toMm = (x) => ({ l: +((x.l - c.left) / mm).toFixed(2), t: +((x.t - c.top) / mm).toFixed(2), r: +((x.r - c.left) / mm).toFixed(2), b: +((x.b - c.top) / mm).toFixed(2) });
      const mast = toMm({ l: m.left, t: m.top, r: m.right, b: m.bottom });
      const fails = [];
      if (mast.l < 10 || mast.t < 10 || mast.r > 200 || mast.b > 287) fails.push('제호 안전선 밖');
      for (const q of ['.no', '.ttl', '.sub', '.credit']) {
        const t = toMm(box(q));
        if (mast.l < t.r && t.l < mast.r && mast.t < t.b && t.t < mast.b) fails.push(`제호×${q} 겹침`);
      }
      return { mast, no: toMm(box('.no')), px: { w: +m.width.toFixed(1), h: +m.height.toFixed(1) }, fails };
    });
    if (r.fails.length) bad++;
    console.log(`${k}-${w}: 제호 ${JSON.stringify(r.mast)} (${r.px.w}×${r.px.h}px) 호 표기 ${JSON.stringify(r.no)} ${r.fails.join(' ') || '겹침 0·안전선 안'}`);
  }
  const pg = await b.newPage({ viewport: { width: 2230, height: 1700 } });
  await pg.goto('file://' + path.join(HERE, 'compare.html'));
  await pg.waitForTimeout(3500);
  await pg.screenshot({ path: path.join(HERE, 'compare.png'), fullPage: true });
  await b.close();
  if (bad) { console.log(`문제 ${bad}건`); process.exit(1); }
  console.log('전부 통과');
})();
