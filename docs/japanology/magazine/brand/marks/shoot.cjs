// sheet.html → sheet.png. 사용(리포 루트, Node 24): node docs/japanology/magazine/brand/marks/shoot.cjs
const path = require('path');
const { createRequire } = require('module');
const req = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = req('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 9000 } });
  await p.goto('file://' + path.join(__dirname, 'sheet.html'));
  await p.waitForTimeout(3000);
  await p.screenshot({ path: path.join(__dirname, 'sheet.png'), fullPage: true });
  await b.close();
})();
