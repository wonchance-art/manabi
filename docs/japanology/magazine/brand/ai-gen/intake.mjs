// AI 생성 마크 후보 → 단색 벡터 → 표지·사용처 비교 시트. 오너 결정 2026-10-16 KST 「AI 돌릴 거임」.
// 사용(리포 루트, Node 24): node docs/japanology/magazine/brand/ai-gen/intake.mjs [--base ippon-H1,danmen-H5]
// 입력: inbox/<역할>-<도구>-<번호>.<png|jpg|webp|svg>  역할 = TONARI | hira | kata
// 출력(out/, 커밋 안 함): svg/<id>.svg·json, covers/<id>__<base>.html·png, sheet.html, sheet.png
// 표지 바탕은 12-hip/covers/<base>.html — 제호 자리(<p class="c mast">)만 후보 SVG로 바꾼다.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../../..');
const { chromium } = createRequire(path.join(ROOT, 'package.json'))('playwright');
const COVERS = path.resolve(HERE, '../../prototype/cover-machi01/12-hip/covers');
const INBOX = path.join(HERE, 'inbox');
const OUT = path.join(HERE, 'out');
const argBase = process.argv.indexOf('--base');
const BASES = (argBase > 0 ? process.argv[argBase + 1] : 'ippon-H1,danmen-H5').split(',');

// 제호 틀(12-hip과 같은 값): 잉크 위 끝 13mm, 폭 ≤157.7mm, 가운데 축 x105. 높이 상한은 바탕 체계의
// 제호 잉크 높이(layout.json size×(asc+desc)) — 그 아래 となり 줄과의 간격을 바탕 그대로 지킨다.
const LAYOUT = JSON.parse(readFileSync(path.resolve(COVERS, '../layout.json'), 'utf8'));
const MAST = { top: 13, maxW: 157.7 };
const maxH = (base) => { const m = LAYOUT.mast[base.split('-')[1]].mast; return +(m.size * (m.asc + m.desc)).toFixed(3); };
const NAME = /^(TONARI|hira|kata)-([\w.]+)-(\w+)\.(png|jpe?g|webp|svg)$/i;
const LABEL = { TONARI: 'TONARI', hira: 'となり', kata: 'トナリ' };

for (const d of ['raster', 'svg', 'covers']) mkdirSync(path.join(OUT, d), { recursive: true });
const files = existsSync(INBOX) ? readdirSync(INBOX).filter((f) => !f.startsWith('.')).sort() : [];
const skipped = files.filter((f) => !NAME.test(f));
const items = files.filter((f) => NAME.test(f)).map((f) => {
  const [, role, tool, no, ext] = f.match(NAME);
  return { file: f, id: f.replace(/\.[^.]+$/, ''), role: role === 'tonari' ? 'TONARI' : role, tool, no, ext: ext.toLowerCase() };
});
if (skipped.length) console.warn('이름 규칙 밖이라 건너뜀:', skipped.join(', '));
if (!items.length) { console.error('inbox/에 후보가 없다. README.md의 이름 규칙을 볼 것.'); process.exit(2); }

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

// ⑴ 래스터화(svg·webp만 — png·jpg는 그대로) → ⑵ 추적
for (const it of items) {
  const src = path.join(INBOX, it.file);
  it.raster = src;
  if (it.ext === 'svg' || it.ext === 'webp') {
    it.raster = path.join(OUT, 'raster', it.id + '.png');
    await page.setViewportSize({ width: 2400, height: 1600 });
    // about:blank에서는 file:// 이미지가 막히므로 임시 HTML을 파일로 열어 그린다
    const tmp = path.join(OUT, 'raster', it.id + '.html');
    writeFileSync(tmp, `<!doctype html><body style="margin:0;background:#fff"><img id="i" src="${path.relative(path.dirname(tmp), src)}" style="display:block;width:2400px;height:auto"></body>`);
    await page.goto('file://' + tmp);
    await page.waitForFunction(() => document.getElementById('i').complete);
    if (!(await page.evaluate(() => document.getElementById('i').naturalWidth))) throw new Error(it.file + ': 이미지를 읽지 못했다');
    await page.locator('#i').screenshot({ path: it.raster });
  }
  const svg = path.join(OUT, 'svg', it.id + '.svg'), js = path.join(OUT, 'svg', it.id + '.json');
  execFileSync('python3', ['-I', path.join(HERE, 'trace.py'), it.raster, svg, js], { stdio: 'inherit' });
  it.svgText = readFileSync(svg, 'utf8').replace(/ data-src="[^"]*"/, '');
  it.meta = JSON.parse(readFileSync(js, 'utf8'));
}

// ⑶ 표지에 앉히기
const fit = (a, H) => (MAST.maxW / a <= H ? { w: MAST.maxW, h: MAST.maxW / a } : { w: H * a, h: H });
// 색은 표지의 글자색을 물려받는다(밤 바탕 표지는 흰 제호). 위 끝 맞춤 — 넓은 마크는 낮아지고 아래가 빈다.
const CSS = `.cover .mast-ai{top:calc(var(--mm)*${MAST.top});left:0;right:0;display:flex;justify-content:center}
.cover .mast-ai svg{display:block}
.cover .kana.alt{font-family:'Hip Mast'}`;
for (const it of items) {
  it.covers = [];
  for (const base of BASES) {
    const { w, h } = fit(it.meta.aspect, maxH(base));
    it.fit = { w: +w.toFixed(2), h: +h.toFixed(2) };
    const tpl = readFileSync(path.join(COVERS, base + '.html'), 'utf8');
    const svg = it.svgText.replace('<svg ', `<svg role="img" aria-label="${LABEL[it.role]}" style="width:calc(var(--mm)*${it.fit.w});height:calc(var(--mm)*${it.fit.h})" `);
    let html = tpl
      .replace('</style>', CSS + '\n</style>')
      .replace(/<p class="c mast"[^>]*>.*?<\/p>/, `<div class="mast-ai">${svg}</div>`);
    // 가나 후보면 아래 줄은 TONARI(라이브)로 — 같은 이름 두 번을 피한다
    if (it.role !== 'TONARI') html = html.replace(/<p class="c kana">.*?<\/p>/, '<p class="c kana alt"><span>TONARI</span></p>');
    html = html.replace(/<!--[\s\S]*?-->/, `<!-- ai-gen/intake.mjs 생성 — 후보 ${it.file}, 바탕 12-hip/covers/${base}.html. 손으로 고치지 말 것. -->`);
    const out = path.join(OUT, 'covers', `${it.id}__${base}.html`);
    writeFileSync(out, html);
    // 제호 SVG와 글자 상자 겹침·안전선 검사(check-cover는 글자만 본다)
    await page.setViewportSize({ width: 632, height: 1000 });
    await page.goto('file://' + out);
    await page.evaluate(() => document.fonts.ready);
    const chk = await page.evaluate(() => {
      const cover = document.querySelector('.cover'), cr = cover.getBoundingClientRect(), mm = cr.width / 210;
      const m = document.querySelector('.mast-ai svg').getBoundingClientRect();
      const fails = [];
      if (m.left < cr.left + 10 * mm || m.right > cr.right - 10 * mm || m.top < cr.top + 10 * mm) fails.push('제호가 안전선 밖');
      for (const el of cover.querySelectorAll('p:not(.mast-ai),h1')) {
        for (const r of el.getClientRects()) {
          if (r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top) fails.push('제호 ↔ ' + el.className);
        }
      }
      return fails;
    });
    const png = out.replace(/\.html$/, '.png');
    await page.locator('.cover').screenshot({ path: png });
    let cc = 'ok';
    try { execFileSync('node', [path.join(HERE, '../../prototype/check-cover.cjs'), out], { cwd: ROOT, stdio: 'pipe' }); }
    catch (e) { cc = String(e.stdout).trim().split('\n').slice(1).join(' / '); }
    it.covers.push({ base, png: path.relative(OUT, png), fails: chk, checkCover: cc });
  }
}

// ⑷ 비교 시트
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rows = items.map((it) => {
  const mono = it.svgText.replace('<svg ', '<svg style="height:100%;width:auto;display:block" ');
  const sizes = [48, 24, 16].map((px) => `<div class="sz" style="height:${px}px">${it.svgText.replace('<svg ', `<svg style="height:${px}px;width:auto;display:block" `)}</div>`).join('');
  const covers = it.covers.map((c) => `<figure><img src="${c.png}" alt=""><figcaption>${c.base} · ${c.fails.length || c.checkCover !== 'ok' ? '⚠ ' + esc([...c.fails, c.checkCover !== 'ok' ? c.checkCover : ''].filter(Boolean).join(' / ')) : '검사 통과'}</figcaption></figure>`).join('');
  return `<section class="row">
  <header><b>${esc(it.id)}</b><span>${LABEL[it.role]} · ${esc(it.tool)} · 비율 ${it.meta.aspect} · 경로 ${it.meta.paths} · 노드 ${it.meta.nodes}${it.meta.inverted ? ' · 어두운 바탕 반전' : ''}</span></header>
  <div class="cells">
    <figure><img class="orig" src="${path.relative(OUT, it.raster)}" alt=""><figcaption>원본</figcaption></figure>
    <figure><div class="mono paper">${mono}</div><div class="mono night">${mono}</div><figcaption>추적 결과 · 단색 · 반전</figcaption></figure>
    <figure><div class="sizes">${sizes}</div><figcaption>48 / 24 / 16px</figcaption></figure>
    ${covers}
  </div>
</section>`;
}).join('\n');
writeFileSync(path.join(OUT, 'sheet.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI 마크 후보</title>
<style>
:root{--bg:#e9e6df;--ink:#151b2c;--card:#f7f5f0;--night:#151b2c;--snow:#eef0f4}
body{margin:0;padding:24px;background:var(--bg);color:var(--ink);font:13px/1.5 system-ui,sans-serif}
h1{font-size:18px;margin:0 0 16px}
.row{background:var(--card);padding:14px;margin-bottom:16px;border-radius:6px}
.row header{display:flex;gap:12px;align-items:baseline;margin-bottom:10px}.row header span{color:#555}
.cells{display:flex;gap:14px;align-items:flex-start}
figure{margin:0}figcaption{font-size:11px;color:#555;margin-top:4px;max-width:260px}
.orig{display:block;width:260px;height:150px;object-fit:contain;background:#fff;border:1px solid #ccc}
.mono{width:260px;height:70px;display:flex;align-items:center;justify-content:center;padding:6px 10px;box-sizing:border-box}
.paper{background:var(--snow);color:var(--ink)}.night{background:var(--night);color:var(--snow)}
.sizes{width:fit-content;min-width:140px;display:flex;flex-direction:column;gap:8px;padding:8px;background:#fff;color:var(--ink)}
.cells figure img:not(.orig){display:block;width:220px;border:1px solid #bbb}
</style></head><body><h1>AI 마크 후보 ${items.length}개 — 단색 추적 · 사용 크기 · 표지(${BASES.join(', ')})</h1>
${rows}
</body></html>
`);
await page.setViewportSize({ width: 260 + 260 + 400 + BASES.length * 234 + 120, height: 800 });
await page.goto('file://' + path.join(OUT, 'sheet.html'));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(OUT, 'sheet.png'), fullPage: true });
await browser.close();
console.log(`후보 ${items.length}개 → ${path.relative(ROOT, path.join(OUT, 'sheet.png'))}`);
