// 09-mast-lab 검사·촬영: 표지 사본마다 check-cover + 제호(SVG)↔글자 요소 겹침·안전선 → results.json → 시트 재생성 → matrix.png
// 사용(리포 루트, Node 24): node docs/japanology/magazine/prototype/cover-machi01/09-mast-lab/shoot.cjs
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createRequire } = require('module');
const req = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = req('playwright');
const HERE = __dirname;
const CHECK = path.join(HERE, '..', '..', 'check-cover.cjs');

(async () => {
  const files = fs.readdirSync(path.join(HERE, 'covers')).filter((f) => f.endsWith('.html')).sort();
  const results = {};
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 422, height: 900 } });
  for (const f of files) {
    const name = f.replace('.html', '');
    const fails = [];
    try { execFileSync('node', [CHECK, path.join(HERE, 'covers', f)], { encoding: 'utf8' }); }
    catch (e) { (e.stdout || '').split('\n').filter((l) => l.startsWith(' - ')).forEach((l) => fails.push('check-cover ' + l.slice(3))); }
    await p.goto('file://' + path.join(HERE, 'covers', f));
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const c = document.querySelector('.cover').getBoundingClientRect(); const mm = c.width / 210;
      const m = document.querySelector('.cover .mast').getBoundingClientRect();
      const box = (q) => { const e = document.querySelector(q); if (!e) return null; const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()].filter((x) => x.width);
        return { l: Math.min(...rs.map((x) => x.left)), t: Math.min(...rs.map((x) => x.top)), r: Math.max(...rs.map((x) => x.right)), b: Math.max(...rs.map((x) => x.bottom)) }; };
      const toMm = (x) => ({ l: (x.l - c.left) / mm, t: (x.t - c.top) / mm, r: (x.r - c.left) / mm, b: (x.b - c.top) / mm });
      const mast = toMm({ l: m.left, t: m.top, r: m.right, b: m.bottom });
      const out = [];
      if (mast.l < 9.9 || mast.t < 9.9 || mast.r > 200.1 || mast.b > 287.1) out.push('제호 안전선 밖');
      for (const [q, n] of [['.no', '호 표기'], ['.ttl', '제목'], ['.sub', '부제'], ['.credit', '크레딧'], ['.line1', '문구']]) {
        const bx = box(q); if (!bx) continue; const t = toMm(bx);
        if (mast.l < t.r - 0.2 && t.l < mast.r - 0.2 && mast.t < t.b - 0.2 && t.t < mast.b - 0.2) out.push(`제호×${n} 겹침`);
      }
      return out;
    });
    fails.push(...r);
    results[name] = { ok: fails.length === 0, fails };
    console.log(`${name}: ${fails.length ? '실패 ' + fails.join(' / ') : '통과'}`);
  }
  fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify(results, null, 1) + '\n');
  execFileSync('python3', ['-I', path.join(HERE, 'build-lab.py')], { stdio: 'inherit' });
  const pg = await b.newPage({ viewport: { width: 760, height: 7200 } });
  await pg.goto('file://' + path.join(HERE, 'matrix.html'));
  await pg.waitForTimeout(6000);
  await pg.screenshot({ path: path.join(HERE, 'matrix.png'), fullPage: true });
  await b.close();
})();
