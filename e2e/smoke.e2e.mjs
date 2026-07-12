import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';

let browser;
let server;
let serverOutput = '';

const appendServerOutput = (chunk) => {
  serverOutput = `${serverOutput}${chunk}`.slice(-20000);
};

const serverStopped = () => !server || server.exitCode != null || server.signalCode != null;

async function waitForServer() {
  const deadline = Date.now() + config.webServer.timeout;
  while (Date.now() < deadline) {
    if (serverStopped()) {
      throw new Error(`npm run start exited early (${server.exitCode ?? server.signalCode})\n${serverOutput}`);
    }
    try {
      const response = await fetch(config.webServer.url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await delay(100);
  }
  throw new Error(`npm run start did not become ready\n${serverOutput}`);
}

async function assertServerAbsent() {
  try {
    await fetch(config.webServer.url, { signal: AbortSignal.timeout(500) });
  } catch {
    return;
  }
  throw new Error(`A server is already responding at ${config.use.baseURL}; stop it or set PLAYWRIGHT_PORT.`);
}

async function stopServer() {
  if (serverStopped()) return;
  const signal = (name) => {
    try {
      if (process.platform === 'win32') server.kill(name);
      else process.kill(-server.pid, name);
    } catch { /* already stopped */ }
  };
  const exited = once(server, 'exit').catch(() => {});
  signal('SIGTERM');
  await Promise.race([exited, delay(3000)]);
  if (!serverStopped()) {
    const killed = once(server, 'exit').catch(() => {});
    signal('SIGKILL');
    await Promise.race([killed, delay(1000)]);
  }
}

function runtimeErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const source = message.location().url;
      errors.push(`console.error${source ? ` [${source}]` : ''}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
  return errors;
}

async function assertVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: config.timeout });
  assert.equal(await locator.isVisible(), true, `${label} should be visible`);
}

async function runInFreshPage(run) {
  const context = await browser.newContext({ baseURL: config.use.baseURL });
  const page = await context.newPage();
  const errors = runtimeErrors(page);
  try {
    await run(page, context);
    await page.waitForTimeout(300);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally {
    await context.close();
  }
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function fakeSession(role = 'admin') {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: '00000000-0000-4000-8000-000000000071',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e-admin@example.com',
    email_confirmed_at: new Date((now - 60) * 1000).toISOString(),
    confirmed_at: new Date((now - 60) * 1000).toISOString(),
    last_sign_in_at: new Date(now * 1000).toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: 'E2E 관리자' },
    identities: [],
    created_at: new Date((now - 3600) * 1000).toISOString(),
    updated_at: new Date(now * 1000).toISOString(),
  };
  const accessToken = [
    base64urlJson({ alg: 'HS256', typ: 'JWT' }),
    base64urlJson({
      sub: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      e2e_role: role,
      email: user.email,
      iat: now,
      exp: now + 3600,
    }),
    'e2e',
  ].join('.');
  return {
    access_token: accessToken,
    refresh_token: 'e2e-refresh-token',
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: 'bearer',
    user,
  };
}

async function mockSupabaseSession(context, { role = 'admin', restRequests = null } = {}) {
  // 프로덕션 Next Link가 헤더의 /admin을 viewport prefetch하면 미들웨어의 서버측
  // Supabase 호출은 브라우저 route mock 범위를 벗어난다. 화면 밖 링크의 기회성 prefetch만
  // 막고, 명시적으로 여는 /world와 그 동적 청크는 그대로 실제 네트워크 경로를 탄다.
  await context.addInitScript(() => {
    class NoopIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: NoopIntersectionObserver,
    });
  });
  const session = fakeSession(role);
  const displayName = role === 'admin' ? 'E2E 관리자' : 'E2E 학습자';
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD',
    'access-control-expose-headers': 'content-range',
  };
  const json = (route, body, extraHeaders = {}) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { ...cors, ...extraHeaders },
    body: JSON.stringify(body),
  });

  await context.route('**/api/suggestions/today', (route) => json(route, []));

  await context.route('**/auth/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/user')) await json(route, session.user);
    else if (pathname.endsWith('/logout')) await json(route, {});
    else await json(route, session);
  });

  await context.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    restRequests?.push(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const url = new URL(request.url());
    if (url.pathname.endsWith('/rpc/claim_world_session')) {
      await json(route, null); // duplicate 상태로 멀티만 끄고 Phaser 솔로 캔버스는 그대로 검증
      return;
    }
    if (url.pathname.endsWith('/profiles')) {
      await json(route, {
        id: session.user.id,
        display_name: displayName,
        role,
        onboarded: true,
        streak_count: 1,
        last_login_at: new Date().toISOString(),
      });
      return;
    }
    if (request.method() === 'HEAD') {
      await route.fulfill({ status: 200, headers: { ...cors, 'content-range': '*/0' } });
      return;
    }
    await json(route, []);
  });
}

async function signInWithMockSession(page, context, role) {
  await mockSupabaseSession(context, { role });
  await page.goto('/embed/review', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('이메일').fill('e2e-admin@example.com');
  await page.getByPlaceholder('비밀번호').fill('e2e-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForFunction(() => document.cookie.includes('auth-token'));
}

async function seedMockSessionCookie(context, role, options = {}) {
  await mockSupabaseSession(context, { role, ...options });
  const projectRef = new URL(config.webServer.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const value = `base64-${Buffer.from(JSON.stringify(fakeSession(role))).toString('base64url')}`;
  await context.addCookies([{
    name: `sb-${projectRef}-auth-token`,
    value,
    url: config.use.baseURL,
    sameSite: 'Lax',
  }]);
}

before(async () => {
  await assertServerAbsent();
  server = spawn(config.webServer.command, config.webServer.args, {
    cwd: config.webServer.cwd,
    env: { ...process.env, ...config.webServer.env },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', appendServerOutput);
  server.stderr.on('data', appendServerOutput);
  await waitForServer();
  browser = await chromium.launch(config.use.launchOptions);
}, { timeout: config.webServer.timeout + config.timeout });

after(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
});

test('reading: 관리자에게 글 1 본문·문항 UI를 렌더한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    await seedMockSessionCookie(context, 'admin');
    await page.goto('/japanese/reading', { waitUntil: 'domcontentloaded', timeout: config.timeout });
    assert.equal(new URL(page.url()).pathname, '/japanese/reading', `admin reading redirected\n${serverOutput}`);
    await assertVisible(page.getByRole('heading', { name: '도쿄 도착', exact: true }), 'reading track heading');
    await page.getByRole('button', { name: /글 1 ·/ }).click();
    await assertVisible(page.getByRole('heading', { name: '여권 확인', exact: true }), 'reading article heading');
    await assertVisible(page.locator('[role="button"][aria-expanded]').first(), 'reading body sentence');
    await page.getByRole('button', { name: /문제 풀기/ }).click();
    await assertVisible(page.getByRole('heading', { name: '문항', exact: true }), 'reading questions heading');
    await assertVisible(page.locator('.fr-quiz__item').first(), 'reading question');
  });
});

test('visibility: 일반 사용자에게 미완성 내비와 독해 트랙 진입을 숨긴다', { timeout: config.timeout }, async () => {
  await runInFreshPage(async (page, context) => {
    await seedMockSessionCookie(context, 'learner');
    await page.goto('/lessons?lang=Japanese', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByRole('heading', { name: '교재', exact: true }), 'lessons heading');
    await assertVisible(page.locator('.gnb__profile-btn[title="E2E 학습자"]'), 'non-admin profile');

    const desktopNav = page.getByRole('navigation', { name: '메인 내비게이션' });
    const mobileNav = page.getByRole('navigation', { name: '모바일 내비게이션' });
    assert.equal(await desktopNav.locator('a[href="/learn"]').count(), 0);
    assert.equal(await desktopNav.locator('a[href="/cohorts"]').count(), 0);
    assert.equal(await mobileNav.locator('a[href="/learn"]').count(), 0);
    assert.equal(await page.getByRole('button', { name: /도쿄 도착/ }).count(), 0);

    await page.goto('/japanese/reading', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname === '/home', { timeout: config.timeout });
    assert.equal(new URL(page.url()).pathname, '/home');
    await assertVisible(page.locator('.gnb__profile-btn[title="E2E 학습자"]'), 'redirected profile');
    assert.equal(await page.getByRole('heading', { name: '도쿄 도착', exact: true }).count(), 0);
  });
});

test('chapter story: 공개 N5 챕터에서 조립·빈칸 채점과 미디어를 제공한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page) => {
    await page.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>E2E YouTube placeholder</title>',
    }));
    await page.goto('/japanese/grammar/n5-04b-meishi-neg-past', { waitUntil: 'domcontentloaded' });

    await assertVisible(
      page.getByRole('heading', { name: /이야기 — 옆 테이블에서 말이 걸려왔다/ }),
      'N5 story heading'
    );
    await assertVisible(page.getByRole('button', { name: /はじめまして/ }).first(), 'N5 story dialogue');

    const orderQuestion = page.getByRole('listitem').filter({
      has: page.getByText('문장 만들기', { exact: true }),
    });
    for (const tile of ['ハルカ', 'さん', 'は', '学生', 'ですか']) {
      await orderQuestion.getByRole('button', { name: tile, exact: true }).click();
    }
    await orderQuestion.getByRole('button', { name: '확정', exact: true }).click();
    await assertVisible(orderQuestion.getByText(/○ 묻는 말도 어순/), 'order correct result');

    const fillQuestion = page.getByRole('listitem').filter({
      has: page.getByText('빈칸 채우기', { exact: true }),
    });
    await fillQuestion.getByRole('textbox', { name: '빈칸에 들어갈 말' }).fill('ありません');
    await fillQuestion.getByRole('button', { name: '제출', exact: true }).click();
    await assertVisible(fillQuestion.getByText(/○ 명사문의 부정/), 'fill correct result');

    const produceQuestion = page.getByRole('listitem').filter({
      has: page.getByText('문장 만들기 (모범답 확인)', { exact: true }),
    });
    await produceQuestion.getByRole('button', { name: '모범답 보기', exact: true }).click();
    await assertVisible(produceQuestion.getByText('모범답', { exact: true }), 'produce model label');
    await assertVisible(produceQuestion.getByText('· わたしは 学生です。', { exact: true }), 'produce model answer');

    const iframe = page.getByTitle('Pretender — Official髭男dism', { exact: true });
    await assertVisible(iframe, 'Pretender privacy-enhanced iframe');
    assert.match(
      await iframe.getAttribute('src'),
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/TQ8WlA2GXbk(?:[?&]|$)/
    );
  });
});

test('chapter story: 공개 입문 편의점 챕터에도 스토리 모듈을 렌더한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page) => {
    await page.goto('/japanese/grammar/ot-07-konbini', { waitUntil: 'domcontentloaded' });
    await assertVisible(
      page.getByRole('heading', { name: /이야기 — 민준, 첫 결제에 성공하다/ }),
      'konbini story heading'
    );
    await assertVisible(page.getByRole('button', { name: /肉まん/ }).first(), 'konbini story dialogue');
    await assertVisible(page.getByRole('textbox', { name: '빈칸에 들어갈 말' }), 'konbini fill input');
  });
});

test('chapter quiz: N4 자동사·타동사 챕터를 열고 첫 문항을 채점한다', { timeout: config.timeout }, async () => {
  await runInFreshPage(async (page) => {
    await page.goto('/japanese/grammar/n4-05c-jita-verbs', { waitUntil: 'domcontentloaded' });
    await assertVisible(
      page.getByRole('heading', { name: /문이 '열렸다' vs 문을 '열었다'/ }),
      'intransitive/transitive chapter heading'
    );
    const patternCheck = page.locator('.fr-check');
    await assertVisible(patternCheck, 'intransitive/transitive pattern check');
    const firstQuestion = page.locator('.fr-check .fr-quiz__item').first();
    await firstQuestion.locator('.fr-quiz__opt').first().click();
    await assertVisible(firstQuestion.locator('.fr-quiz__answer'), 'graded pattern answer');
    await assertVisible(page.locator('.fr-check__count').filter({ hasText: /^1\// }), 'pattern progress');
  });
});

test('chapter story: N5 이자카야 문화 도어의 장면과 산출 문항을 렌더한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page) => {
    await page.goto('/japanese/grammar/ot-08-izakaya', { waitUntil: 'domcontentloaded' });
    await assertVisible(
      page.getByRole('heading', { name: /안 시킨 안주가 나왔다/ }),
      'izakaya chapter heading'
    );
    await assertVisible(
      page.getByRole('heading', { name: /이야기 — 민준과 하루카, 이자카야에 가다/ }),
      'izakaya story heading'
    );
    await assertVisible(page.locator('[role="button"][aria-expanded]').filter({ hasText: /何名さまですか/ }).first(), 'izakaya dialogue');
    const produceQuestion = page.getByRole('listitem').filter({
      has: page.getByText('문장 만들기 (모범답 확인)', { exact: true }),
    });
    await produceQuestion.getByRole('button', { name: '모범답 보기', exact: true }).click();
    await assertVisible(produceQuestion.getByText(/とりあえず生で。/), 'izakaya model answer');
  });
});

test('vocab performance: N3 초기 DOM과 savedSet 요청을 예산 안에 유지한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    const restRequests = [];
    await seedMockSessionCookie(context, 'learner', { restRequests });
    const startedAt = Date.now();
    await page.goto('/japanese/vocab/n3', { waitUntil: 'load', timeout: config.timeout * 2 });
    await assertVisible(page.locator('.fr-vrow').first(), 'N3 first vocabulary row');
    const elapsed = Date.now() - startedAt;
    const rows = await page.locator('.fr-vrow').count();
    const nodes = await page.locator('*').count();

    assert.ok(elapsed < 8000, `N3 vocab load ${elapsed}ms exceeded 8000ms`);
    assert.equal(rows, 150, `N3 initial rows should be progressive, got ${rows}`);
    assert.ok(nodes < 10000, `N3 initial DOM ${nodes} nodes exceeded 10000`);

    const deadline = Date.now() + config.timeout;
    let savedRequests = [];
    while (Date.now() < deadline) {
      savedRequests = restRequests.filter(url => {
        const parsed = new URL(url);
        return parsed.pathname.endsWith('/user_vocabulary') && parsed.searchParams.has('word_text');
      });
      if (savedRequests.length > 1) break;
      await page.waitForTimeout(50);
    }
    assert.ok(savedRequests.length > 1, 'savedSet lookup should be split into multiple requests');
    assert.ok(
      Math.max(...savedRequests.map(url => url.length)) < 8000,
      `savedSet URL exceeded 8000 chars: ${Math.max(...savedRequests.map(url => url.length))}`
    );

    await page.getByRole('searchbox', { name: '단어 검색' }).fill('頬');
    await assertVisible(page.locator('.fr-vrow').filter({ hasText: '頬' }), 'word beyond initial slice remains searchable');
  });
});

test('world: 가짜 관리자 세션에서 Phaser 캔버스를 마운트한다', { timeout: config.timeout }, async () => {
  await runInFreshPage(async (page, context) => {
    await signInWithMockSession(page, context, 'admin');

    await page.goto('/world', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByRole('heading', { name: /^학습 월드/ }), 'world heading');
    const canvas = page.locator('canvas').first();
    await assertVisible(canvas, 'world canvas');
    const size = await canvas.evaluate((element) => ({ width: element.width, height: element.height }));
    assert.ok(size.width > 0 && size.height > 0, `world canvas has invalid size ${size.width}x${size.height}`);
  });
});

test('embed/review: 비로그인 즉석 복습 로그인 UI를 렌더한다', { timeout: config.timeout }, async () => {
  await runInFreshPage(async (page) => {
    await page.goto('/embed/review', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByText('🪧 즉석 복습', { exact: true }), 'embed review title');
    await assertVisible(page.getByPlaceholder('이메일'), 'embed email input');
    await assertVisible(page.getByPlaceholder('비밀번호'), 'embed password input');
    await assertVisible(page.getByRole('button', { name: '로그인', exact: true }), 'embed login button');
  });
});
