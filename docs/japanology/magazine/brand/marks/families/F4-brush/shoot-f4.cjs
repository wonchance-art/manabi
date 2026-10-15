// F4 card.html → card.png(폭 1500, 전체 높이). 리포 루트에서 Node 24: node docs/japanology/magazine/brand/marks/families/F4-brush/shoot-f4.cjs
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const dir = __dirname;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  await p.goto('file://' + path.join(dir, 'card.html'));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(dir, 'card.png'), fullPage: true });
  await b.close();
})();
