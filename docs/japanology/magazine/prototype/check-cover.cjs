// 표지 규격(cover-spec.md §6) 자동 검사 — 정적 시안용.
// 사용: node docs/japanology/magazine/prototype/check-cover.cjs <html 파일> [선택자=.cover]
// 검사: ⑴ 글자 상자 겹침 0 ⑵ 안전선(마무리선 안쪽 10mm) 안 ⑶ 폭 390px에서 글자 ≥10px(크레딧 ≥6px) ⑷ 대비(일반 4.5:1, 큰 글자 3:1)
const path = require('path');
const { createRequire } = require('module');
const req = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = req('playwright');

(async () => {
  const [file, selector = '.cover'] = process.argv.slice(2);
  if (!file) { console.error('usage: check-cover.cjs <html> [selector]'); process.exit(2); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390 + 32, height: 900 } });
  await page.goto('file://' + path.resolve(file));
  await page.waitForTimeout(2500);
  const result = await page.evaluate((sel) => {
    const cover = document.querySelector(sel);
    const cr = cover.getBoundingClientRect();
    const mm = cr.width / 210;
    const safe = { l: cr.left + 10 * mm, t: cr.top + 10 * mm, r: cr.right - 10 * mm, b: cr.bottom - 10 * mm };
    const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0]; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    // 표지 바탕: 표지 요소의 --cover-bg(없으면 --night). 그라디언트면 어두운 끝을 넣어 둔다.
    const hex = (getComputedStyle(cover).getPropertyValue('--cover-bg').trim() || getComputedStyle(document.documentElement).getPropertyValue('--night').trim()).replace('#', '');
    const bg = hex.match(/../g).map((h) => parseInt(h, 16));
    const items = [];
    const walker = document.createTreeWalker(cover, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode; if (!n.textContent.trim()) continue;
      const el = n.parentElement; const range = document.createRange(); range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((x) => x.width && x.height); if (!rects.length) continue;
      const cs = getComputedStyle(el);
      const isSvg = el instanceof SVGElement;
      const fill = isSvg ? cs.fill : cs.color;
      const size = parseFloat(cs.fontSize) * (isSvg ? (el.ownerSVGElement.getBoundingClientRect().width / el.ownerSVGElement.viewBox.baseVal.width) : 1);
      const credit = !!el.closest('.credit');
      const contrast = ratio(parse(fill), bg);
      rects.forEach((r, k) => items.push({ text: n.textContent.trim().slice(0, 16) + (rects.length > 1 ? `#${k + 1}` : ''), box: { l: r.left, t: r.top, r: r.right, b: r.bottom }, size, credit, contrast }));
    }
    const fails = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i].box, b = items[j].box;
      if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5 && items[i].text.split('#')[0] !== items[j].text.split('#')[0]) fails.push(`겹침: 「${items[i].text}」×「${items[j].text}」`);
    }
    for (const it of items) {
      const b = it.box;
      if (b.l < safe.l - 0.5 || b.t < safe.t - 0.5 || b.r > safe.r + 0.5 || b.b > safe.b + 0.5) fails.push(`안전선 밖: 「${it.text}」`);
      const min = it.credit ? 6 : 10;
      if (it.size < min) fails.push(`글자 작음: 「${it.text}」 ${it.size.toFixed(1)}px < ${min}px`);
      const need = it.size >= 24 ? 3 : 4.5;
      if (it.contrast < need) fails.push(`대비 부족: 「${it.text}」 ${it.contrast.toFixed(2)} < ${need}`);
    }
    return { coverWidth: cr.width, items: items.length, fails };
  }, selector);
  await browser.close();
  console.log(`표지 폭 ${result.coverWidth.toFixed(0)}px · 글자 요소 ${result.items}개`);
  if (result.fails.length) { console.log('실패 ' + result.fails.length + '건'); result.fails.forEach((f) => console.log(' - ' + f)); process.exit(1); }
  console.log('통과: 겹침 0 · 안전선 안 · 최소 글자 크기 · 대비');
})();
