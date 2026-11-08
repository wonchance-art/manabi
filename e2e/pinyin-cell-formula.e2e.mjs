import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';

/**
 * 병음 칸 식 e2e(ZH-SSR-001, 2026-11-08 KST) — 서버가 재지 않고 낸 병음 칸(pinyinCellFormula)이 실제 글꼴로 잰 칸(measurePinyinCell)과
 * 같은지 **실제 Noto Sans**로 대조한다. 같아야 중국어 본문을 서버가 그려도 하이드레이션 뒤 본문이 다시 흐르지 않는다(1px 이하 차이 계약).
 *
 * 왜 앱 빌드가 아니라 정적 쪽인가: e2e 빌드의 글꼴은 대역(google-fonts-mock — 라틴 글리프 없음)이라 거기서 재면 대체 글꼴 폭이 나온다.
 * 배포 빌드가 쓰는 글꼴 사본(vendor/google-fonts — Noto Sans 라틴 · 라틴 확장 조각)을 fonts.gstatic 주소 그대로 물려 재고,
 * 잴 함수는 src/lib/pinyinLayout.js 실물을 쪽에 싣는다. 글꼴 사본이 바뀌어 폭이 달라지면 여기서 깨진다 — PINYIN_EM_WIDTH를 새로 잰다.
 */
const vendor = new URL('../vendor/google-fonts/', import.meta.url);
const FONT_CSS = fs.readFileSync(new URL('css/noto-sans-wght-400-500-700-swap.css', vendor), 'utf8');
const GSTATIC = 'https://fonts.gstatic.com/s/';
const LAYOUT = fs.readFileSync(new URL('../src/lib/pinyinLayout.js', import.meta.url), 'utf8');
// 설정 범위 = viewerPreferences ranges(fontSize 0.8–3 · pinyinSize 0.75–1). 단계는 0.1 · 0.05로 촘촘히.
const FONT_REMS = Array.from({ length: 23 }, (_, i) => Math.round((0.8 + i * 0.1) * 10) / 10);
const PINYIN_REMS = Array.from({ length: 6 }, (_, i) => Math.round((0.75 + i * 0.05) * 100) / 100);

let browser;
before(async () => { browser = await chromium.launch(config.use.launchOptions); });
after(async () => { await browser?.close(); });

test('병음 칸 식 = 실제 Noto Sans로 잰 칸 — 설정 전 범위', async () => {
  const page = await browser.newPage();
  try {
    await page.route(`${GSTATIC}**`, (route) => {
      const rel = route.request().url().slice(GSTATIC.length);
      const file = new URL(`files/${rel}`, vendor);
      assert.ok(fs.existsSync(file), `vendored font missing: ${rel}`);
      return route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(file) });
    });
    await page.setContent(`<style>${FONT_CSS}</style><style>body{--font-noto-sans:'Noto Sans';font-family:var(--font-noto-sans)}</style><body></body>`);
    await page.addScriptTag({ type: 'module', content: `${LAYOUT.replace(/^export /gm, '')}\nwindow.__pinyin={measurePinyinCell,pinyinCellFormula,PINYIN_MEASURE_SYLLABLES};` });
    await page.waitForFunction(() => !!window.__pinyin);
    const result = await page.evaluate(async ({ fontRems, pinyinRems }) => {
      const { measurePinyinCell, pinyinCellFormula, PINYIN_MEASURE_SYLLABLES } = window.__pinyin;
      // 앱과 같이 굵기 400 · 라틴 확장(성조 모음) 조각까지 받은 뒤에 잰다.
      await document.fonts.load("16px 'Noto Sans'", PINYIN_MEASURE_SYLLABLES.join(' '));
      await document.fonts.ready;
      const loaded = [...document.fonts].filter((f) => f.family.replace(/['"]/g, '') === 'Noto Sans' && f.status === 'loaded').length;
      const rows = [];
      for (const fontRem of fontRems) for (const pinyinRem of pinyinRems) {
        const measured = measurePinyinCell({ win: window, doc: document, root: () => null, pinyinRem, fontRem });
        rows.push({ fontRem, pinyinRem, measured, formula: pinyinCellFormula(fontRem, pinyinRem) });
      }
      return { loaded, rows };
    }, { fontRems: FONT_REMS, pinyinRems: PINYIN_REMS });
    assert.ok(result.loaded >= 2, `Noto Sans latin + latin-ext faces must load (loaded ${result.loaded})`);
    assert.equal(result.rows.length, FONT_REMS.length * PINYIN_REMS.length);
    const off = result.rows.filter((r) => Math.abs(r.measured - r.formula) > 1);
    assert.deepEqual(off, [], 'formula must stay within 1px of the measured cell');
    const exact = result.rows.filter((r) => r.measured === r.formula).length;
    assert.equal(exact, result.rows.length, `formula should equal the measured cell exactly (${exact}/${result.rows.length})`);
    // 기본 설정(글자 1.6rem · 병음 0.75rem)은 운영 실측 47px.
    assert.equal(result.rows.find((r) => r.fontRem === 1.6 && r.pinyinRem === 0.75)?.formula, 47);
  } finally {
    await page.close();
  }
});
