// Real published book + isolated browser fixtures for member/error/empty states.
// Fixtures never reach Supabase or write any real user's records.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const base = process.env.QA_BASE || 'http://127.0.0.1:8880';
const out = process.env.QA_OUT || '/private/tmp/manabi-v2-qa';
// Local cold compilation may need a larger budget; deployed checks use the 30s default.
const timeout = Number(process.env.QA_TIMEOUT || 30000);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
let activePage;
let fixtureClosing = false;
const report = { base, realContent: [], fixtureStates: [], layouts: [], errors: [] };
const check = async (page, label) => {
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('main h1')?.textContent }));
  assert(result.scrollWidth <= result.width + 1, `${label}: overflow ${result.scrollWidth}/${result.width}`);
  report.layouts.push({ label, ...result });
  console.log('Checked', label);
};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  context.setDefaultTimeout(timeout);
  context.setDefaultNavigationTimeout(timeout);
  const page = await context.newPage(); activePage = page;
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(base + '/home');
  const first = page.getByRole('link', { name: '첫 페이지 열기', exact: true });
  await first.waitFor();
  await page.waitForFunction(() => !document.querySelector('.today-copy [aria-disabled="true"]'));
  const firstHref = await first.getAttribute('href');
  const edition = new URL(firstHref, base).searchParams.get('edition');
  assert(edition, 'home loads the verified published edition');
  assert.match(await page.locator('.today-record').first().innerText(), /0 \/ 42과/);
  await check(page, 'home-desktop-new');
  await page.screenshot({ path: out + '/home-desktop.png', fullPage: true });
  await page.getByRole('link', { name: '책장 둘러보기', exact: true }).click();
  await page.getByRole('link', { name: '일본어 N5 책 둘러보기', exact: true }).click();
  await page.getByRole('button', { name: '전체 42과', exact: true }).click();
  assert.equal(await page.locator('.manabi-toc-group li').count(), 42);
  const chapterGroup = page.locator('.manabi-toc-group').filter({ has: page.locator('a[href*="#u29-start"]') });
  await chapterGroup.locator('summary').click();
  await chapterGroup.locator('a[href*="#u29-start"]').click();
  await page.locator('#u29-start[data-book-source]').waitFor();
  await page.goto(base + `/books/japanese-n5?edition=${edition}#u29-patterns`);
  await page.locator('#u29-patterns .examples').first().waitFor();
  assert.equal(await page.locator('#u29-patterns .examples').first().evaluate(el => getComputedStyle(el).borderStyle), 'solid');
  await page.screenshot({ path: out + '/reader-examples-desktop.png' });
  await page.getByRole('link', { name: 'manabi 오늘', exact: true }).click();
  await page.getByRole('link', { name: '이어서 읽기', exact: true }).waitFor();
  assert.match(await page.getByRole('link', { name: '이어서 읽기', exact: true }).getAttribute('href'), /#u29-/);
  await page.getByRole('link', { name: '이어서 읽기', exact: true }).click();
  await page.locator('#u29-patterns').waitFor();
  await page.getByRole('link', { name: '← 책으로', exact: true }).click();
  await page.getByRole('heading', { name: '한 권의 흐름', exact: true }).waitFor();
  report.realContent.push('home → shelf → published book → lesson29 → home → same lesson anchor → book');
  if (process.env.QA_PART !== 'member') {
  for (const width of [320, 390, 768, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/home', '/lessons', '/books/japanese-n5', '/discover', '/materials', '/vocab']) {
      await page.goto(base + route);
      await page.locator('main').waitFor();
      await check(page, route + '-' + width);
      if ((width === 390 || width === 1440) && ['/home', '/lessons', '/discover', '/books/japanese-n5'].includes(route)) {
        await page.screenshot({ path: path.join(out, route.replaceAll('/', '_') + '-' + width + '.png'), fullPage: true });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/home');
  const nav = page.getByRole('navigation', { name: '모바일 내비게이션', exact: true });
  assert.equal(await nav.locator('a:visible').count(), 5);
  await nav.getByRole('link', { name: '발견', exact: true }).click();
  await page.getByRole('heading', { name: '말이 태어나는 곳.' }).waitFor();
  await page.locator('.discover-feature').click();
  await page.waitForURL(/\/studies\/japan\/jp-culture/, { timeout: 60000 });
  await page.locator('main h1').waitFor();
  assert.match(page.url(), /\/studies\/japan\/jp-culture/);
  report.realContent.push('mobile five destinations + discovery opens real regional document');
  await page.goto(base + '/books/japanese-n5#u29-patterns');
  await page.locator('#u29-patterns .examples').first().waitFor();
  await check(page, 'reader-examples-390');
  await page.screenshot({ path: out + '/reader-examples-mobile.png' });
  await page.getByRole('button', { name: '집중 읽기', exact: true }).click();
  assert.equal(await page.locator('.gnb').isVisible(), false);
  await page.getByRole('button', { name: '기본 보기', exact: true }).click();
  assert.equal(await page.locator('.gnb').isVisible(), true);
  report.realContent.push('mobile example boxes + focus mode and return');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/home');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').innerText(), '본문으로 건너뛰기');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'), 'main-content');
  report.realContent.push('keyboard skip-to-content');
  }
  await context.close();

  // Synthetic authenticated states use the existing sign-in UI, not a production bypass.
  const member = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  member.setDefaultTimeout(timeout);
  member.setDefaultNavigationTimeout(timeout);
  const uid = '00000000-0000-4000-8000-000000000077';
  const now = Math.floor(Date.now() / 1000);
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'web-v2-fixture@example.com', email_confirmed_at: new Date().toISOString(), confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, identities: [] };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const session = { user, access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: uid, aud: 'authenticated', role: 'authenticated', exp: now + 3600, iat: now })}.fixture`, refresh_token: 'fixture', expires_at: now + 3600, expires_in: 3600, token_type: 'bearer' };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' };
  let failed = false, due = 3, rows = [];
  const requests = [];
  // Server-rendered public pages use an anonymous request. Fixture cookies stay client-side.
  await member.route(base + '/**', async route => {
    try {
      const response = await route.fetch({ headers: { ...route.request().headers(), cookie: '' } });
      if (!fixtureClosing) await route.fulfill({ response });
    } catch (error) {
      // Closing the isolated context cancels its remaining background requests.
      if (!fixtureClosing || !/disposed|closed|Target.*close/i.test(error.message)) throw error;
    }
  });
  await member.route('**/auth/v1/**', route => route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 200, headers: cors, contentType: 'application/json', body: route.request().method() === 'OPTIONS' ? '' : JSON.stringify(route.request().url().includes('/user') ? user : session) }));
  await member.route('**/rest/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    requests.push({ path: url.pathname, search: url.search, method: request.method() });
    if (url.pathname.endsWith('/profiles')) return route.fulfill({ status: 200, headers: cors, json: { id: uid, display_name: '검수 계정', role: 'user', onboarded: true, last_login_at: new Date().toISOString(), learning_language: ['Japanese'] } });
    if (failed && (url.pathname.endsWith('/reading_progress') || url.pathname.endsWith('/user_vocabulary'))) return route.fulfill({ status: 503, headers: cors, json: { message: 'fixture unavailable' } });
    if (request.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...cors, 'content-range': `*/${due}` } });
    return route.fulfill({ status: 200, headers: cors, json: url.pathname.endsWith('/reading_progress') ? rows : [] });
  });
  await member.route('**/api/suggestions/today', route => route.fulfill({ json: [{ id: 'fixture-story', language: 'Japanese', source: 'nhk', title: '긴 제목 검수 '.repeat(15), level: 'N5', transcript: 'fixture', thumbnail_url: 'https://invalid.test/cover.png' }] }));
  await member.route('https://invalid.test/**', route => route.fulfill({ status: 404 }));
  await member.addInitScript(({ edition, uid }) => {
    localStorage.setItem(`manabi-book-progress:${edition}:guest`, JSON.stringify({ page: 'u29-patterns', completed: ['u29'] }));
    if (!localStorage.getItem(`manabi-book-progress:${edition}:${uid}`)) localStorage.setItem(`manabi-book-progress:${edition}:${uid}`, JSON.stringify({ page: 'u35-start', completed: ['u01', 'u35'], updatedAt: '2026-01-01T00:00:00Z' }));
  }, { edition, uid });
  const mp = await member.newPage(); activePage = mp;
  mp.on('pageerror', error => report.errors.push(error.message));
  await mp.goto(base + '/auth');
  await mp.getByLabel('이메일', { exact: true }).fill(user.email);
  await mp.getByPlaceholder('비밀번호', { exact: true }).fill('fixture-password');
  await mp.getByRole('button', { name: '로그인', exact: true }).last().click();
  await mp.waitForURL('**/home');
  await mp.getByRole('link', { name: '이어서 읽기', exact: true }).waitFor();
  assert.match(await mp.getByRole('link', { name: '이어서 읽기', exact: true }).getAttribute('href'), /#u35-start/);
  await mp.waitForFunction(() => document.querySelector('.today-review h2')?.textContent.includes('3개의'));
  assert.match(await mp.locator('.today-record').first().innerText(), /2 \/ 42과/);
  await mp.locator('.suggestion-artwork > span').waitFor();
  await check(mp, 'member-long-title-failed-image');
  report.fixtureStates.push('member has separate edition progress; real schedule count displayed; broken image fallback; long title');
  await mp.goto(base + '/materials/add?advanced=1');
  await mp.getByRole('button', { name: '프랑스어', exact: true }).click();
  assert.equal(await mp.getByRole('button', { name: '프랑스어', exact: true }).getAttribute('aria-pressed'), 'true');
  await check(mp, 'french-material-input');
  report.fixtureStates.push('French input selection');
  failed = true;
  await mp.goto(base + '/home');
  await mp.getByRole('alert').filter({ hasText: '학습 기록을 불러오지 못했어요' }).waitFor({ timeout: 30000 });
  assert.equal(await mp.getByRole('link', { name: '이어서 읽기', exact: true }).isVisible(), true);
  report.fixtureStates.push('server failure leaves local book readable and exposes retry');
  failed = false; due = 0;
  await mp.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await mp.getByRole('heading', { name: /첫 표현을 담아 보세요/ }).waitFor();
  assert.equal((await mp.locator('.today-review h2').innerText()).includes('<br'), false);
  assert.equal((await mp.locator('.today-review h2').innerText()).replace(/\s+/g, ' '), '기억하고 싶은 첫 표현을 담아 보세요.');
  await mp.screenshot({ path: out + '/member-empty-mobile.png', fullPage: true });
  report.fixtureStates.push('retry + empty vocabulary state');
  rows = [{ material_id: 'fixture-material', is_completed: false, updated_at: new Date().toISOString(), reading_materials: { id: 'fixture-material', title: '최근에 읽은 자료의 실제 기록 형태' } }];
  await mp.reload();
  await mp.waitForFunction(() => document.querySelector('.today-location strong')?.textContent === '최근에 읽은 자료의 실제 기록 형태');
  assert.equal(await mp.getByRole('link', { name: '이어서 읽기', exact: true }).getAttribute('href'), '/viewer/fixture-material');
  report.fixtureStates.push('newer server reading wins without combining its progress with book completion');
  assert(requests.filter(r => /\/(user_vocabulary|reading_progress)$/.test(r.path)).every(r => r.search.includes(`user_id=eq.${uid}`)), 'every personal reading/vocab query is scoped to the signed-in user');
  rows = [];
  await mp.evaluate(({ edition, uid }) => localStorage.setItem(`manabi-book-progress:${edition}:${uid}`, '{'), { edition, uid });
  await mp.reload();
  await mp.getByRole('link', { name: '첫 페이지 열기', exact: true }).waitFor();
  assert.match(await mp.locator('.today-record').first().innerText(), /0 \/ 42과/);
  assert.equal(await mp.getByText('이 브라우저에서는 읽던 위치를 저장할 수 없어요.', { exact: true }).count(), 0);
  report.fixtureStates.push('damaged local record recovers without claiming storage is unavailable');
  fixtureClosing = true;
  await member.close();
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify({ realContent: report.realContent, fixtureStates: report.fixtureStates, layouts: report.layouts.length, errors: report.errors }, null, 2));
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: out + '/failure.png', fullPage: true }).catch(() => {});
    fs.writeFileSync(out + '/failure.txt', await activePage.locator('body').innerText().catch(() => 'Page unavailable'));
  }
  throw error;
} finally {
  fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  fixtureClosing = true;
  await browser.close();
}
