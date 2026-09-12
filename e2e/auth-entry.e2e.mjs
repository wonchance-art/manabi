// Isolated browser regression: the shared header must preserve classroom context.
// Network fixtures stop every auth/API request before it can reach a real account.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, webkit } from 'playwright-core';

const base = new URL(process.env.QA_BASE || 'http://127.0.0.1:3100').origin;
const out = process.env.QA_OUT || '/private/tmp/manabi-auth-entry-qa';
const engine = process.env.QA_ENGINE || 'chromium';
fs.mkdirSync(out, { recursive: true });
const browser = await (engine === 'webkit' ? webkit : chromium).launch({
  headless: true,
  ...(engine === 'webkit' ? {} : { executablePath: process.env.QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }),
});
const report = { base, engine, checks: [], errors: [] };
const now = Math.floor(Date.now() / 1000);
const user = {
  id: '00000000-0000-4000-8000-000000000172', email: 'learner@example.invalid',
  aud: 'authenticated', role: 'authenticated', email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
};
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const session = {
  access_token: [enc({ alg: 'HS256', typ: 'JWT' }), enc({ sub: user.id, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 }), 'fixture'].join('.'),
  refresh_token: 'fixture', expires_in: 3600, expires_at: now + 3600, token_type: 'bearer', user,
};
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS,HEAD' };
let activePage;
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const requests = [];
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (url.pathname === '/auth/v1/authorize') {
        requests.push(url);
        return route.fulfill({ contentType: 'text/html', body: '<p>Intercepted provider</p>' });
      }
      if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ headers: cors, json: url.pathname.endsWith('/user') ? user : session });
      if (url.pathname.startsWith('/rest/v1/')) {
        const profile = { id: user.id, role: 'student', onboarded: true, display_name: '학생 검수', last_login_at: new Date().toISOString() };
        return route.fulfill({ headers: cors, json: url.pathname.endsWith('/profiles') ? profile : [] });
      }
      if (url.origin === base && url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
      // Never forward the fixture session to the preview server.
      if (url.origin === base) return route.continue({ headers: { ...request.headers(), cookie: '' } });
      return route.abort();
    });
    const page = await context.newPage(); activePage = page;
    page.on('pageerror', error => report.errors.push(error.message));
    const path = '/class/fixture-class?view=history&q=%E5%9B%BE%E4%B9%A6%E9%A6%86&restoreY=355#class-history';
    await page.goto(base + path);
    await page.getByRole('textbox', { name: '팀 암호', exact: true }).waitFor();
    await page.getByRole('banner').getByRole('button', { name: '로그인', exact: true }).press('Enter');
    await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('from'), path);
    report.checks.push(`${width}px: header keeps team, history search, scroll and hash`);
    await page.getByRole('banner').getByRole('button', { name: '로그인', exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get('from'), path);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${out}/auth-entry-${width}.png` });
    await page.getByRole('button', { name: 'Google로 계속하기', exact: true }).click();
    await page.waitForURL('**/auth/v1/authorize?**');
    const callback = new URL(requests.at(-1).searchParams.get('redirect_to'));
    assert.equal(callback.origin, base);
    assert.equal(callback.pathname, '/auth/callback');
    assert.equal(callback.searchParams.get('next'), path);
    assert.equal(requests.at(-1).searchParams.get('code_challenge_method'), 's256');
    report.checks.push(`${width}px: repeated sign-in keeps Google PKCE callback destination`);
    await page.goto(base + '/auth?' + new URLSearchParams({ from: path }));
    await page.getByLabel('이메일', { exact: true }).fill(user.email);
    await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password');
    await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
    await page.waitForURL(base + path);
    await page.getByRole('textbox', { name: '팀 암호', exact: true }).waitFor();
    report.checks.push(`${width}px: email sign-in returns to the exact classroom URL`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message;
  await activePage?.screenshot({ path: out + '/failure.png' }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await browser.close();
}
