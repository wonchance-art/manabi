// specimen.html → specimen.png (390px 표지 실제 크기 견본 포함). 사용(리포 루트, Node 24):
//   node docs/japanology/magazine/prototype/cover-machi01/10-mh/mast/shoot.cjs
const path = require('path');
const { createRequire } = require('module');
const req = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = req('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 2600 } });
  await p.goto('file://' + path.join(__dirname, 'specimen.html'));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(__dirname, 'specimen.png'), fullPage: true });
  await b.close();
})();
