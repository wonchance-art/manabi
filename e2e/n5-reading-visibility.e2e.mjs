// Real reader UI with synthetic roles and a local-only backend. No hosted writes.
// Start the QA build with e2e/server-fetch-mock.mjs; QA_BASE/QA_OUT are optional.
import { chromium, webkit } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixtureSession, revisionBackend } from './fixtures/n5-revision-backend.mjs';

const base = process.env.QA_BASE || 'http://127.0.0.1:48995';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Only a local QA app is allowed');
const out = path.resolve(process.env.QA_OUT || '.qa/runs/n5-reading-visibility/browser');
fs.mkdirSync(out, { recursive: true });
const edition = '8a8c1c1fd452773810abaf8c';
const backendPort = 48996;
const backend = revisionBackend({ port: backendPort, app: base });
const report = { edition, scope: 'Synthetic auth/API; actual app UI. No real account, physical device or hosted write.', engines: [] };
const href = id => `${base}/books/japanese-n5?edition=${edition}#${id}`;

function session(role) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const value = JSON.parse(Buffer.from(fixtureSession(role).slice('base64-'.length), 'base64url'));
  const parts = value.access_token.split('.');
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
  parts[1] = encode({ ...claims, e2e_role: role });
  value.access_token = parts.join('.');
  return 'base64-' + encode(value);
}

async function contextFor(browser, role) {
  const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  if (role) await context.addCookies([{ name: 'sb-e2e-auth-token', value: session(role), url: base, sameSite: 'Lax' }]);
  await context.route('https://e2e.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `http://127.0.0.1:${backendPort}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  return context;
}

async function inspect(page, id, row, label) {
  await page.locator('#' + id).waitFor();
  await page.evaluate(() => document.fonts.ready);
  // Wait for the reader's real navigation/font effect, without scrolling for it.
  await page.waitForFunction(id => {
    const target = document.getElementById(id), bar = document.querySelector('.manabi-reader-toolbar');
    if (!target || !bar) return false;
    const delta = target.getBoundingClientRect().top - bar.getBoundingClientRect().bottom;
    return delta >= 14 && delta <= 18;
  }, id);
  const sample = await page.evaluate(id => {
    const bar = document.querySelector('.manabi-reader-toolbar'), header = document.querySelector('.gnb');
    const rect = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
    // Closed reference links have no visible text rectangles in WebKit. Check the
    // visible toolbar, including its summary, rather than demanding a hidden line.
    const labels = [...bar.querySelectorAll('a,button,summary')].filter(el => !el.closest('details:not([open]) nav')).map(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      return { text: el.textContent, lines: new Set([...range.getClientRects()].filter(r => r.width > 0 && r.height > 0).map(r => Math.round(r.top))).size };
    });
    return { id, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, toolbar: rect(bar), target: rect(document.getElementById(id)), headerBottom: getComputedStyle(header).display === 'none' ? 0 : header.getBoundingClientRect().bottom, background: getComputedStyle(bar).backgroundColor, measuredHeight: parseFloat(getComputedStyle(bar).getPropertyValue('--book-toolbar-height')), focused: document.querySelector('.book-reader').classList.contains('is-focused'), heapBytes: performance.memory?.usedJSHeapSize ?? null, labels };
  }, id);
  assert(Math.abs(sample.toolbar.top - sample.headerBottom) < 1, `${label}: gap/overlap at the header`);
  assert(!sample.background.startsWith('rgba(') && sample.background !== 'transparent', `${label}: translucent toolbar`);
  assert(Math.abs(sample.measuredHeight - sample.toolbar.height) < 1, `${label}: stale toolbar measurement`);
  assert(sample.scrollWidth <= sample.width + 1, `${label}: horizontal overflow`);
  assert(sample.labels.every(item => item.lines === 1), `${label}: a navigation label broke across lines`);
  row.layouts.push({ label, ...sample });
}

await backend.start();
try {
  for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await type.launch(name === 'chromium' ? { executablePath: process.env.QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true } : { headless: true });
    const row = { name, checks: [], layouts: [], errors: [], writes: [] };
    report.engines.push(row);
    let context, page;
    try {
      for (const [role, status] of [[null, 401], ['student', 404]]) {
        const denied = await contextFor(browser, role);
        try { assert.equal((await denied.request.get(`/api/books/japanese-n5/${edition}/asset?file=index.html`)).status(), status); }
        finally { await denied.close(); }
      }
      row.checks.push('unpublished asset anonymous401/member404');
      context = await contextFor(browser, 'admin');
      page = await context.newPage();
      page.on('pageerror', error => row.errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
      page.on('request', request => { if (['POST', 'PATCH', 'DELETE'].includes(request.method()) && !request.url().endsWith('/rpc/is_admin')) row.writes.push(new URL(request.url()).pathname); });
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const id of ['u42-message-reading', 'msg-rina-bring', 'lex-250', 'kanji-4e8c']) {
          await page.goto(href(id));
          await inspect(page, id, row, `normal-${width}-${id}`);
          if (width === 390 || (width === 1440 && id === 'msg-rina-bring')) await page.screenshot({ path: path.join(out, `${name}-${id}-${width}.png`) });
        }
        await page.getByRole('button', { name: '집중 읽기', exact: true }).click();
        await page.goto(href('msg-rina-bring'));
        await inspect(page, 'msg-rina-bring', row, `focus-${width}`);
        assert.equal(await page.locator('.gnb').isVisible(), false);
        await page.goto(href('kanji-4e8c'));
        await inspect(page, 'kanji-4e8c', row, `focus-kanji-${width}`);
        assert.equal(await page.locator('#kanji-4e8c').evaluate(el => el === document.activeElement), true);
        await page.getByRole('button', { name: '기본 보기', exact: true }).click();
      }
      row.checks.push('article/exercise/word/kanji anchors clear opaque toolbar at1440/768/390/320; focus clears hidden header and kanji receives focus');
      // Reflow the mounted toolbar without a reload, including enlarged text.
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(href('u42-message-reading'));
      await inspect(page, 'u42-message-reading', row, 'before-resize');
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto(href('msg-rina-bring'));
      await inspect(page, 'msg-rina-bring', row, 'after-resize');
      const largerText = await page.addStyleTag({ content: '.manabi-reader-toolbar,.manabi-reader-toolbar a,.manabi-reader-toolbar button{font-size:20px!important}' });
      await page.goto(href('msg-rina-meet'));
      await inspect(page, 'msg-rina-meet', row, 'enlarged-text-320');
      await page.screenshot({ path: path.join(out, `${name}-enlarged-text-320.png`) });
      await largerText.evaluate(el => el.remove());
      row.checks.push('mounted resize and enlarged toolbar text update anchor offset');
      // A learner chooses an answer, checks a prerequisite, and returns by keyboard.
      await page.goto(href('u42-message-reading'));
      const answer = page.locator('input[data-save="msg-rina-bring"][value="1"]');
      await answer.focus(); await page.keyboard.press('Space');
      await page.getByText('답안을 이 브라우저에 저장했어요.', { exact: true }).waitFor();
      await page.reload();
      const saved = async () => page.waitForFunction(() => document.querySelector('input[data-save="msg-rina-bring"][value="1"]')?.checked);
      await saved();
      await page.locator('#u42-message-reading a[href="#lex-250"]').focus();
      await page.keyboard.press('Enter');
      await inspect(page, 'lex-250', row, 'keyboard-word-help');
      await page.goBack(); await saved();
      await inspect(page, 'u42-message-reading', row, 'back-from-word-help');
      await page.getByRole('link', { name: '← 책 목차', exact: true }).focus();
      await page.keyboard.press('Enter'); await page.waitForURL('**#cover');
      await page.goBack(); await saved();
      await inspect(page, 'u42-message-reading', row, 'back-from-cover');
      await page.screenshot({ path: path.join(out, `${name}-keyboard-return-320.png`) });
      row.checks.push('keyboard answer/reload/help/back/cover/back retain answer and visible heading');
      // Ordinary motion exposed a gap hidden by the reduced-motion layout checks.
      // A repeated hash can have a different browser-restored scroll position.
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto(href('u42-message-reading'));
      await inspect(page, 'u42-message-reading', row, 'normal-motion-reconnect');
      assert.equal(await page.evaluate(() => history.scrollRestoration), 'manual');
      await saved();
      await page.evaluate(() => document.getElementById('u42-text-transfer').scrollIntoView({ behavior: 'instant', block: 'start' }));
      await page.waitForTimeout(180);
      await page.locator('.manabi-mobile-toc summary').click();
      await page.locator('.manabi-mobile-toc a[href$="#u42-message-reading"]').click();
      await inspect(page, 'u42-message-reading', row, 'same-page-toc');
      await page.goBack();
      await page.waitForTimeout(180);
      await inspect(page, 'u42-message-reading', row, 'same-hash-back');
      await saved();
      await page.locator('.manabi-reference-menu>summary').click();
      await page.getByRole('link', { name: '문화 읽기', exact: true }).click();
      const returnLink = page.getByRole('link', { name: '읽던 교재로 돌아가기', exact: true });
      await returnLink.waitFor();
      assert.equal(await page.evaluate(() => history.scrollRestoration), 'auto');
      assert.equal(await returnLink.getAttribute('href'), `/books/japanese-n5?edition=${edition}#u42-message-reading`);
      await returnLink.click();
      await inspect(page, 'u42-message-reading', row, 'normal-motion-material-return');
      await saved();
      await page.reload();
      await inspect(page, 'u42-message-reading', row, 'normal-motion-reload');
      await saved();
      assert.equal(await page.locator('#u42-message-reading h2').textContent(), '리나가 보낸 두 통의 연락');
      row.checks.push('ordinary-motion repeated-hash back/material return/reload preserve visible article, resume source and answer');
      assert.deepEqual(row.errors, []); assert.deepEqual(row.writes, []);
      row.checks.push('console/runtime errors0 and server writes0');
    } catch (error) {
      row.failure = error.stack;
      if (page) row.failureLayout = await page.evaluate(() => {
        const target = document.getElementById(location.hash.slice(1)), bar = document.querySelector('.manabi-reader-toolbar');
        return { id: location.hash, targetTop: target?.getBoundingClientRect().top, margin: target && getComputedStyle(target).scrollMarginTop, toolbarBottom: bar?.getBoundingClientRect().bottom, width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
      }).catch(() => null);
      if (page) await page.screenshot({ path: path.join(out, `${name}-failure.png`) }).catch(() => {});
      throw error;
    } finally {
      if (context) await context.close();
      await browser.close();
      fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    }
  }
} finally { await backend.close(); }
console.log(JSON.stringify(report));
