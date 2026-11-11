// N5-NOTATION-001 B(2026-11-11 KST) — 로컬 프로덕션 앱(NODE_OPTIONS=--import=./e2e/server-fetch-mock.mjs · E2E_PUBLISHED_EDITION=후보)에서 후보 판본을 연다.
// 합성 백엔드 · 손님 브라우저 — 운영 · 실계정에 닿지 않는다. 184조건 = 폭 320 · 390 · 768 · 1440 × 목차 46쪽(2026-09-06 발행 검수와 같은 격자). 기록: docs/verification/n5-notation-release-20261111.md
import fs from 'node:fs';
import assert from 'node:assert/strict';

import { chromium } from 'playwright-core';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8891', ED = process.env.QA_EDITION || '86593008c8f915a0b71aa15e';
const OUT = process.env.QA_OUT || 'n5-notation-qa'; fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const html = fs.readFileSync(process.env.QA_HTML, 'utf8');
const first = {}; for (const m of html.matchAll(/<article\b[^>]*>/g)) { const id = m[0].match(/\bid="([^"]+)"/)?.[1], u = m[0].match(/data-unit-page="([^"]+)"/)?.[1]; if (id && u && !first[u]) first[u] = id; }
const toc = Object.values(first); assert.equal(toc.length, 46);
const url = hash => `${BASE}/books/japanese-n5?edition=${ED}&returnTo=%2Flessons#${hash}`;
const report = { base: BASE, edition: ED, startedAt: new Date().toISOString(), conditions: [], flows: [], errors: [], assetFailures: [], shots: [] };
const browser = await chromium.launch(process.env.QA_CHROME ? { executablePath: process.env.QA_CHROME } : {});
const watch = page => {
  page.on('pageerror', e => report.errors.push({ url: page.url(), message: e.message }));
  page.on('response', r => { const u = r.url(); if (r.status() >= 400 && (u.includes('/api/books/') || u.includes('/_next/static/') || /\.(css|js|woff2?|png|jpe?g|svg|mp3)(\?|$)/.test(u))) report.assetFailures.push({ status: r.status(), url: u }); });
};
const settle = async page => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150); };
const measure = page => page.evaluate(() => ({ width: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
for (const width of [320, 390, 768, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage(); watch(page);
  for (const id of toc) {
    await page.goto(url(id), { waitUntil: 'domcontentloaded', timeout: 120000 });
    // cover는 책 첫 화면(목차) — 본문 article이 없다
    const target = id === 'cover' ? page.locator('main h1').first() : page.locator(`.book-reading-content [id="${id}"]`);
    await target.waitFor({ state: 'attached', timeout: 60000 });
    await settle(page);
    const m = await measure(page);
    const top = await target.evaluate(el => Math.round(el.getBoundingClientRect().top));
    report.conditions.push({ width, id, overflow: m.doc > m.width + 1 || m.body > m.width + 1, doc: m.doc, top });
  }
  await ctx.close();
}
// 눈 검수 캡처: 폰(iPhone 13 에뮬) · PC 1440
const SHOTS = ['u10-dialogue', 'u26-study1', 'u35-study1', 'u35-dialogue', 'u27-dialogue'];
for (const [label, opts] of [['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['pc', { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }]]) {
  const ctx = await browser.newContext(opts); const page = await ctx.newPage(); watch(page);
  for (const id of SHOTS) {
    await page.goto(url(id), { waitUntil: 'domcontentloaded', timeout: 120000 });
    const el = page.locator(`.book-reading-content [id="${id}"]`); await el.waitFor(); await settle(page);
    const file = `shots/${id}.${label}.png`; await el.screenshot({ path: `${OUT}/${file}` }); report.shots.push(file);
  }
  await ctx.close();
}
// 흐름: 답안 유지 · 찾아보기 · 루비가 실제로 그려짐 · 정답 칸 가나 유지
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage(); watch(page);
  await page.goto(url('u10-practice'), { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.locator('#u10-practice').waitFor();
  const radio = page.locator('#u10-practice input[type=radio][data-save]').first(); await radio.check();
  const key = await radio.getAttribute('data-save'), value = await radio.getAttribute('value');
  const area = page.locator('textarea[data-save]').first(); await area.fill('로컬 검수 답안'); const areaKey = await area.getAttribute('data-save');
  await page.waitForTimeout(500); await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#u10-practice').waitFor();
  await page.waitForFunction(({ key, value }) => [...document.querySelectorAll('input[data-save]')].some(i => i.dataset.save === key && i.value === value && i.checked), { key, value }, { timeout: 30000 });
  assert.equal(await page.locator(`textarea[data-save="${areaKey}"]`).inputValue(), '로컬 검수 답안');
  report.flows.push('answers-survive-reload(radio+textarea)');
  await page.goto(url('u23-patterns'), { waitUntil: 'domcontentloaded' }); await page.locator('#u23-patterns').waitFor();
  assert.ok(await page.locator('#u23-patterns ruby:has-text("友達")').count() > 0, '友達 ruby'); report.flows.push('ruby-rendered(友達 23과)');
  await page.goto(url('u27-dialogue'), { waitUntil: 'domcontentloaded' }); await page.locator('#u27-dialogue').waitFor();
  const t27 = await page.locator('#u27-dialogue').innerText(); assert.ok(t27.includes('いけません') && !t27.includes('池'), 'いけません kana'); report.flows.push('いけません-kana(27과)');
  await page.goto(url('reference-start'), { waitUntil: 'domcontentloaded' }); await page.locator('.lex-card').first().waitFor();
  const box = page.getByRole('searchbox', { name: '어휘·문형·한자 검색' });
  const count = async q => { await box.fill(q); await page.waitForTimeout(300); return page.locator('.lex-card:visible').count(); };
  report.lookup = { ともだち: await count('ともだち'), 友達: await count('友達'), はし: await count('はし'), ZZZ: await count('ZZZZNORESULT') };
  assert.ok(report.lookup['ともだち'] > 0 && report.lookup['友達'] > 0 && report.lookup.ZZZ === 0); report.flows.push('reference-search(kana · 友達)');
  await ctx.close();
}
await browser.close();
const bad = report.conditions.filter(c => c.overflow);
report.summary = { conditions: report.conditions.length, overflow: bad.length, jsErrors: report.errors.length, assetFailures: report.assetFailures.length, flows: report.flows.length };
report.finishedAt = new Date().toISOString();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report.summary, overflowAt: bad.slice(0, 10), errors: report.errors.slice(0, 5), assetFailures: report.assetFailures.slice(0, 5), lookup: report.lookup }));
