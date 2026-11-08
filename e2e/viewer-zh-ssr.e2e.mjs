// 중국어 뷰어 서버 렌더(ZH-SSR-001, 2026-11-08 KST) — 손님의 분석된 공개 중국어 자료도 서버가 본문까지 그린다. 실제 뷰어 · 공개 시드 사본만,
// 계정 · 제공자 · 운영 DB 없음(server-fetch-mock의 ZH_SSR_MATERIAL_ID 행).
// 계약: 서버 HTML의 병음 칸(--pinyin-cell)과 하이드레이션 뒤의 칸이 1px 이하로 같고(오케스트레이터 조건 2026-11-08 KST), 첫 그림의 낱말이
// 하이드레이션 · 글꼴 도착 뒤에도 제자리다. 예전에는 서버 값 44px을 붙은 뒤에 잰 값으로 바꾸며 본문이 다시 흘러 중국어를 서버 본문에서 뺐다.
// 칸 식과 실제 글꼴(Noto Sans)의 대조는 e2e/pinyin-cell-formula.e2e.mjs가 한다 — 이 e2e 빌드의 글꼴은 대역이다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { fixture } from './fixtures/material-editing-backend.mjs';

const row = JSON.parse(fs.readFileSync(new URL('./fixtures/zh-public-viewer.json', import.meta.url), 'utf8'));
const cellOf = (html) => Number(/--pinyin-cell:(\d+(?:\.\d+)?)px/.exec(html)?.[1]);

for (const width of [390, 1280]) {
  test(`guest Chinese public reading: server body, pinyin cell and first tokens hold through hydration (${width}px)`, async () => {
    const f = await fixture({ guest: true, width, height: 844 });
    try {
      f.rows.push(row);
      const html = await (await f.context.request.get(`/viewer/${row.id}`)).text();
      assert.ok(html.includes('<ruby data-pinyin="1">'), 'server HTML carries the Chinese body');
      const server = cellOf(html);
      assert.equal(server, 47, 'server pinyin cell = formula at default settings');
      await f.page.addInitScript(() => {
        window.__shifts = [];
        new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) for (const s of e.sources || []) {
          const el = s.node?.nodeType === 1 ? s.node : s.node?.parentElement;
          if (el?.closest('.reader-area')) window.__shifts.push(`${el.tagName} ${e.value.toFixed(4)} ${Math.round(s.previousRect.x)},${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.x)},${Math.round(s.currentRect.y)}`);
        } }).observe({ type: 'layout-shift', buffered: true });
        const rects = () => [...document.querySelectorAll('.reader-area ruby[data-pinyin]')].slice(0, 30).map((t) => { const r = t.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}`; });
        window.__rects = rects;
        // 첫 그림 = 서버 본문이 처음 보이는 프레임(쪽 맞추기 감춤 'fit'이 풀린 뒤 — 일본어 서버 본문과 같은 단계).
        const grab = () => {
          const r = rects();
          if (r.length && !r[0].startsWith('0,0,0') && !document.documentElement.hasAttribute('data-viewer-hold')) { window.__first = r; window.__firstAt = performance.now(); return; }
          requestAnimationFrame(grab);
        };
        document.addEventListener('readystatechange', () => { if (document.readyState === 'interactive') grab(); });
      });
      await f.page.goto(`/viewer/${row.id}`, { waitUntil: 'load' });
      await f.page.locator('.reader-area ruby[data-pinyin]').first().waitFor();
      await f.page.evaluate(() => document.fonts.ready);
      await f.page.waitForTimeout(2000);
      const after = await f.page.evaluate(() => ({
        hold: document.documentElement.hasAttribute('data-viewer-hold'),
        cell: parseFloat(getComputedStyle(document.querySelector('.viewer-layout')).getPropertyValue('--pinyin-cell')),
        first: window.__first, now: window.__rects(), shifts: window.__shifts,
      }));
      assert.equal(after.hold, false, 'default settings keep the server body visible');
      assert.ok(Math.abs(after.cell - server) <= 1, `pinyin cell after hydration ${after.cell}px vs server ${server}px`);
      assert.ok(after.first?.length >= 20, 'server body tokens were on the first paint');
      assert.deepEqual(after.now, after.first, 'first tokens stay in place through hydration and font arrival');
      assert.deepEqual(after.shifts, [], 'no layout shift inside the reading area');
    } finally {
      await f.context.close();
    }
  });
}
