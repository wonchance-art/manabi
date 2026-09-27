// Isolated browser regression: sign-in must preserve classroom, vocabulary, and personal-note entry.
// Network fixtures stop every auth/API request before it can reach a real account.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launchQaBrowser, traceQa, finishQa } from './qa-runtime.mjs';

const base = new URL(process.env.QA_BASE || 'http://127.0.0.1:3100').origin;
const out = process.env.QA_OUT || '/private/tmp/manabi-auth-entry-qa';
const engine = process.env.QA_BROWSER || process.env.QA_ENGINE || 'chromium';
fs.mkdirSync(out, { recursive: true });
const report = { base, engine, groups: [], checks: [], errors: [] };
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
const candidateId = '00000000-0000-4000-8000-000000000173';
const noteFixture = () => ({
  id: '23', title: '로그인 복귀 검수', revision: '00000000-0000-4000-8000-000000000174',
  document: {version: 1, key: '00000000-0000-4000-8000-000000000175', language: 'Japanese', origin: null,
    board: {version: 1, activePage: 'page-one', pages: ['page-one', 'page-two'].map(id => ({id, elements: [], camera: {scrollX: 0, scrollY: 0, zoom: {value: 1}}}))},
    candidates: [
      {id: candidateId, pageId: 'page-two', elementIds: [], original: '橋', text: '橋', base: '', reading: 'はし', meaning: '다리', language: 'Japanese', originKey: 'fixture:bridge', reviewed: false, excluded: true},
      {id: '00000000-0000-4000-8000-000000000176', pageId: 'page-one', elementIds: [], original: '図書館', text: '図書館', base: '', reading: 'としょかん', meaning: '도서관', language: 'Japanese', originKey: 'fixture:library', reviewed: false, excluded: false},
    ],
  },
});
let browser, context, activePage;
try {
  browser = await launchQaBrowser(engine);
  for (const entry of [
    { name: 'classroom', path: '/class/fixture-class?view=history&q=%E5%9B%BE%E4%B9%A6%E9%A6%86&restoreY=355#class-history' },
    { name: 'vocabulary', path: '/vocab' },
    { name: 'note-review', path: '/notes/23?review=1' },
    { name: 'note-candidate', path: `/notes/23?candidate=${candidateId}#note-page-two` },
    { name: 'note-new', path: '/notes/new?language=Chinese&material=23' },
    { name: 'note', path: '/notes/23' },
  ]) {
    for (const width of [1440, 390]) {
      context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      await traceQa(context);
      context.setDefaultNavigationTimeout(180000);
      const requests = [], writes = [];
      let note = noteFixture();
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        if (url.pathname === '/auth/v1/authorize') {
          requests.push(url);
          return route.fulfill({ contentType: 'text/html', body: '<p>Intercepted provider</p>' });
        }
        if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ headers: cors, json: url.pathname.endsWith('/user') ? user : session });
        if (url.pathname.startsWith('/rest/v1/')) {
          if (!['GET', 'HEAD'].includes(request.method())) writes.push(url.pathname);
          const profile = { id: user.id, role: 'student', onboarded: true, display_name: '학생 검수', last_login_at: new Date().toISOString() };
          return route.fulfill({ headers: cors, json: url.pathname.endsWith('/profiles') ? profile : [] });
        }
        if (url.origin === base && url.pathname === '/api/notes/23') {
          if (request.method() === 'PUT') note = {...note, ...request.postDataJSON(), revision: crypto.randomUUID()};
          return route.fulfill({json: note});
        }
        if (url.origin === base && url.pathname === '/api/notes' && request.method() === 'POST') writes.push(url.pathname);
        if (url.origin === base && url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
        // Never forward the fixture session to the preview server.
        if (url.origin === base) return route.continue({ headers: { ...request.headers(), cookie: '' } });
        return route.abort();
      });
      const page = await context.newPage(); activePage = page;
      page.on('pageerror', error => report.errors.push(error.message));
      const path = entry.path;
      await page.goto(base + path);
      if (entry.name === 'classroom') {
        await page.getByRole('textbox', { name: '팀 암호', exact: true }).waitFor();
        await page.getByRole('banner').getByRole('button', { name: '로그인', exact: true }).press('Enter');
      } else if (entry.name === 'vocabulary') {
        const signIn = page.getByRole('link', { name: '로그인하고 단어장 쓰기', exact: true });
        await signIn.waitFor();
        await page.screenshot({ path: `${out}/vocab-entry-${width}.png` });
        await signIn.press('Enter');
      } else {
        const signIn = page.getByRole('link', {name: '로그인하고 노트 열기 ↗', exact: true});
        await signIn.waitFor();
        if (entry.name === 'note-candidate') {
          for (const hash of ['#temporary-position', '#note-page-two']) {
            await page.evaluate(value => {location.hash = value;}, hash);
            await page.waitForFunction(expected => {
              const link = document.querySelector('.note-gate a');
              return new URL(link.href).searchParams.get('from') === expected;
            }, path.split('#')[0] + hash);
          }
        }
        await signIn.press('Enter');
      }
      await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('from'), path);
      report.checks.push(`${entry.name} ${width}px: keyboard entry preserves the complete destination`);
      await page.getByRole('banner').getByRole('button', { name: '로그인', exact: true }).click();
      assert.equal(new URL(page.url()).searchParams.get('from'), path);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `${out}/auth-entry-${entry.name}-${width}.png` });
      await page.getByRole('button', { name: 'Google로 계속하기', exact: true }).click();
      await page.waitForURL('**/auth/v1/authorize?**');
      const callback = new URL(requests.at(-1).searchParams.get('redirect_to'));
      assert.equal(callback.origin, base);
      assert.equal(callback.pathname, '/auth/callback');
      assert.equal(callback.searchParams.get('next'), path);
      assert.equal(requests.at(-1).searchParams.get('code_challenge_method'), 's256');
      report.checks.push(`${entry.name} ${width}px: repeated sign-in keeps Google PKCE callback destination`);
      await page.goto(base + '/auth?' + new URLSearchParams({ from: path }));
      await page.getByLabel('이메일', { exact: true }).fill(user.email);
      await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password');
      await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
      await page.waitForURL(base + path);
      if (entry.name === 'classroom') await page.getByRole('textbox', { name: '팀 암호', exact: true }).waitFor();
      else if (entry.name === 'vocabulary') {
        await page.getByRole('heading', { name: '복습', exact: true }).waitFor();
        assert.equal(await page.getByRole('link', { name: '로그인하고 단어장 쓰기', exact: true }).count(), 0);
      }
      else if (entry.name === 'note-new') {
        assert.equal(await page.getByRole('combobox', {name: /공부하는 언어/}).inputValue(), 'Chinese');
        await page.getByText('열어 둔 교재를 이 노트의 출처로 연결합니다.', {exact: true}).waitFor();
      } else {
        await page.getByRole('button', {name: '노트 정보', exact: true}).waitFor();
        if (entry.name === 'note-review') {
          await page.locator('.note-review').waitFor();
          assert.equal(await page.getByLabel('표현 표기', {exact: true}).inputValue(), '図書館');
        }
        if (entry.name === 'note-candidate') {
          await page.locator('[role="status"]').filter({hasText: '이 표현을 적었던 노트입니다. 원문이 바뀌었다면 저장 당시 문장을 함께 확인하세요.'}).waitFor();
          await page.getByRole('button', {name: '전체 메뉴', exact: true}).click();
          await page.getByRole('button', {name: '페이지 메뉴', exact: true}).click();
          assert.equal(await page.getByRole('button', {name: '2번 판', exact: true}).getAttribute('aria-current'), 'page');
          await page.getByRole('button', {name: '메뉴 닫기', exact: true}).click();
          if (width >= 900) assert.equal(await page.locator('.note-review .note-candidate').count(), 1);
        }
        assert.deepEqual(note.document.candidates, noteFixture().document.candidates);
      }
      assert.deepEqual(writes, []);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({path: `${out}/returned-${entry.name}-${width}.png`});
      report.checks.push(`${entry.name} ${width}px: email sign-in returns to the authenticated destination`);
      if (process.env.QA_TRACE === '1') await context.tracing.stop();
      await context.close();
      context = undefined;
    }
  }
  assert.deepEqual(report.errors, []);
  report.groups.push('auth.classroom', 'auth.vocabulary', 'auth.notes', 'auth.visual');
} catch (error) {
  report.failure = error.message;
  await activePage?.screenshot({ path: out + '/failure.png' }).catch(() => {});
  throw error;
} finally {
  await finishQa({ browser, context, report, out });
  console.log(JSON.stringify(report));
}
