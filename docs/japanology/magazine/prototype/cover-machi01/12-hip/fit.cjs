// 큰 글자 역할(mast·kana·title)의 잉크 메트릭을 잰다 → fit.json (build.mjs 입력). 2026-10-15 KST.
// 사용(이 폴더에서): node fit.cjs   — Google Fonts를 받아 canvas measureText로 잰다(100px 기준, em 비율로 저장).
// 값: adv(진행 폭), asc/desc(기준선 위·아래 잉크), left/right(원점 기준 잉크 왼끝·오른끝). 자간은 build.mjs가 더한다.
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');
const req = createRequire('/home/user/manabi/package.json');
const { chromium } = req('playwright');
(async () => {
  const { SYSTEMS, BIG_TEXT } = await import(path.join(__dirname, 'systems.mjs'));
  const b = await chromium.launch();
  const p = await b.newPage();
  const css = Object.values(SYSTEMS).map((s) => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${s.css}&display=block">`).join('');
  await p.setContent(`<!doctype html><html><head>${css}</head><body><canvas id="c" width="10" height="10"></canvas></body></html>`);
  await p.waitForTimeout(1500);
  const jobs = [];
  for (const [id, s] of Object.entries(SYSTEMS)) for (const role of ['mast', 'kana', 'title']) jobs.push({ id, role, ...s[role], text: BIG_TEXT[role] });
  const out = await p.evaluate(async (jobs) => {
    const ctx = document.getElementById('c').getContext('2d');
    const res = {};
    for (const j of jobs) {
      const font = `${j.style} ${j.weight} 100px "${j.family}"`;
      await document.fonts.load(font, j.text);
      ctx.font = font;
      const m = ctx.measureText(j.text);
      const loaded = document.fonts.check(font, j.text);
      (res[j.id] = res[j.id] || {})[j.role] = { loaded, adv: m.width / 100, asc: m.actualBoundingBoxAscent / 100, desc: m.actualBoundingBoxDescent / 100, left: -m.actualBoundingBoxLeft / 100, right: m.actualBoundingBoxRight / 100 };
    }
    return res;
  }, jobs);
  await b.close();
  const r = (v) => +v.toFixed(4);
  for (const s of Object.values(out)) for (const k of Object.keys(s)) for (const q of ['adv', 'asc', 'desc', 'left', 'right']) s[k][q] = r(s[k][q]);
  fs.writeFileSync(path.join(__dirname, 'fit.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out));
})();
