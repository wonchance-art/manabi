// Exercise the deployed SDK's redirect construction. Every Supabase request is
// intercepted: no provider login, email, session, or account write is performed.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = new URL(process.env.QA_BASE || 'http://127.0.0.1:8880').origin;
const out = process.env.QA_OUT || '/private/tmp/manabi-auth-qa';
fs.mkdirSync(out, { recursive: true });
const report = { base, checks: [], layouts: [], errors: [], liveAuthRequests: 0 };
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
let activePage;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  context.setDefaultTimeout(30000);
  const authRequests = [];
  await context.route('https://*.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': base, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/auth/v1/authorize') {
      authRequests.push({ type: 'google', redirect: url.searchParams.get('redirect_to'), pkce: Boolean(url.searchParams.get('code_challenge')), method: url.searchParams.get('code_challenge_method') });
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Intercepted auth redirect</title><p>Offline provider boundary</p>' });
    }
    if (url.pathname === '/auth/v1/recover') {
      authRequests.push({ type: 'recovery', redirect: url.searchParams.get('redirect_to') });
      return route.fulfill({ status: 200, headers, json: {} });
    }
    report.errors.push(`Unexpected intercepted request: ${request.method()} ${url.pathname}`);
    return route.fulfill({ status: 403, headers, json: { message: 'Blocked by isolated QA' } });
  });
  const page = await context.newPage(); activePage = page;
  page.on('pageerror', error => report.errors.push(error.message));
  async function layout(label) {
    await page.evaluate(() => document.fonts.ready);
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert(dimensions.scrollWidth <= dimensions.width + 1, `${label}: horizontal overflow`);
    report.layouts.push({ label, ...dimensions });
    await page.screenshot({ path: `${out}/${label}.png`, fullPage: true });
  }
  const reader = '/books/japanese-n5?edition=known&mode=read#u29-patterns';
  for (const [from, expected] of [[reader, reader], ['/a/..//example.invalid', '/home'], ['/\\example.invalid', '/home']]) {
    await page.goto(`${base}/auth?${new URLSearchParams({ from })}`);
    const button = page.getByRole('button', { name: 'Google로 계속하기', exact: true });
    await button.waitFor();
    if (from === reader) {
      await layout('auth-desktop');
      await button.focus();
      assert(await button.evaluate(element => element === document.activeElement));
    }
    await Promise.all([page.waitForURL('**/auth/v1/authorize?**'), button.press('Enter')]);
    const request = authRequests.at(-1);
    assert.equal(request.type, 'google');
    assert.equal(request.pkce, true);
    assert.equal(request.method, 's256');
    const callback = new URL(request.redirect);
    assert.equal(callback.origin, base);
    assert.equal(callback.pathname, '/auth/callback');
    assert.equal(callback.searchParams.get('next'), expected);
    report.checks.push(`Google callback preserves safe return: ${expected}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/auth');
  await page.getByRole('button', { name: '비밀번호 찾기', exact: true }).click();
  await page.getByLabel('이메일', { exact: true }).fill('qa@example.invalid');
  await layout('password-recovery-mobile');
  await page.getByRole('button', { name: '재설정 링크 보내기', exact: true }).click();
  await page.getByText('비밀번호 재설정 링크를 이메일로 보냈습니다. 확인해주세요.', { exact: true }).waitFor();
  const recovery = authRequests.at(-1);
  assert.equal(recovery.type, 'recovery');
  const callback = new URL(recovery.redirect);
  assert.equal(callback.origin, base);
  assert.equal(callback.pathname, '/auth/callback');
  assert.equal(callback.searchParams.get('next'), '/auth?mode=reset');
  report.checks.push('Recovery uses the server exchange callback; email request was intercepted');

  await page.goto(base + '/auth?mode=reset');
  await page.getByRole('heading', { name: '새 비밀번호 설정', exact: true }).waitFor();
  assert.equal(await page.getByLabel('닉네임', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel('이메일', { exact: true }).count(), 0);
  await page.getByLabel('새 비밀번호', { exact: true }).fill('fixture-password-24');
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill('fixture-password-24');
  assert(await page.locator('form').evaluate(form => form.checkValidity()));
  await layout('password-reset-mobile');
  report.checks.push('Reset form only requires the two password fields; no password update submitted');

  for (const next of [reader, '//example.invalid', '/a/..//example.invalid']) {
    const response = await context.request.get(`${base}/auth/callback?${new URLSearchParams({ next })}`, { maxRedirects: 0 });
    assert.equal(response.status(), 307);
    assert.match(response.headers()['cache-control'], /no-store/);
    const target = new URL(response.headers().location);
    assert.equal(target.origin, base);
    assert.equal(target.pathname, '/auth');
    assert.equal(target.searchParams.get('error'), 'auth_callback_failed');
    assert.equal(target.searchParams.get('from'), next === reader ? reader : '/materials');
  }
  report.checks.push('Deployed callback without a code returns safely to sign-in without caching');
  await page.goto(base + '/auth?error=auth_callback_failed');
  await page.getByText('로그인을 완료하지 못했어요. 다시 시도해 주세요.', { exact: true }).waitFor();
  await layout('callback-error-mobile');
  report.checks.push('Callback failure is actionable in the deployed mobile UI');
  assert.deepEqual(report.errors, []);
  await context.close();
} catch (error) {
  report.errors.push(error.message);
  await activePage?.screenshot({ path: out + '/failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
