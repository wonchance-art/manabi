import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';
import { WORLD_STORAGE_KEYS } from '../src/lib/world/storageSchema.js';
import { runPeerLoadBenchmark } from './world-peer-bench.mjs';

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

async function mockWorldShellRuntime(context, {
  position = null,
  positionState = null,
  positionWrites = null,
} = {}) {
  await context.route('**/api/world/stamps', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(route.request().method() === 'GET' ? { stamps: [] } : { ok: true }),
    });
  });
  await context.route('**/api/world/session', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'e2e-world-lease', expiresAt: Date.now() + 60000, spawn: null }),
    });
  });
  await context.route('**/api/world/session/leave', (route) => route.fulfill({ status: 204 }));
  await context.route('**/api/world/position', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ position: positionState?.current ?? position }),
      });
      return;
    }
    let nextPosition = null;
    try {
      nextPosition = route.request().postDataJSON();
    } catch {
      try { nextPosition = JSON.parse(route.request().postData() || 'null'); } catch { /* ignore */ }
    }
    if (nextPosition) {
      positionWrites?.push(nextPosition);
      if (positionState) positionState.current = nextPosition;
    }
    await route.fulfill({ status: 204 });
  });
  await context.routeWebSocket('**/realtime/v1/websocket**', (socket) => {
    socket.onMessage((message) => {
      if (typeof message !== 'string') return;
      let frame;
      try {
        frame = JSON.parse(message);
      } catch {
        return;
      }
      if (!Array.isArray(frame) || frame.length < 5) return;
      const [joinRef, ref, topic, event] = frame;
      if (!['phx_join', 'phx_leave', 'heartbeat', 'presence', 'access_token'].includes(event)) return;
      socket.send(JSON.stringify([
        joinRef,
        ref,
        topic,
        'phx_reply',
        { status: 'ok', response: {} },
      ]));
    });
  });
}

async function waitForWorldDebug(page) {
  try {
    await page.waitForFunction(() => Boolean(window.__MANABI_WORLD_DEBUG__?.snapshot?.()), null, {
      timeout: config.timeout,
    });
    const initial = await page.evaluate(() => window.__MANABI_WORLD_DEBUG__.snapshot());
    if (initial.committedUpdates === 0) {
      await page.evaluate(({ x, y }) => window.__MANABI_WORLD_DEBUG__.teleport(x, y), initial.tile);
    }
    await page.waitForFunction(() => {
      const snapshot = window.__MANABI_WORLD_DEBUG__?.snapshot?.();
      return snapshot?.committedUpdates > 0 && snapshot.visiblePages > 0;
    }, null, { timeout: config.timeout });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 500),
      canvases: document.querySelectorAll('canvas').length,
      bridge: Boolean(window.__MANABI_WORLD_DEBUG__),
      snapshot: window.__MANABI_WORLD_DEBUG__?.snapshot?.() ?? null,
      overlay: document.querySelector('[data-nextjs-dialog]')?.textContent ?? null,
    })).catch((diagnosticError) => ({ diagnosticError: diagnosticError.message }));
    throw new Error(`world debug did not become ready: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
}

async function readJsHeapUsedBytes(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Math.floor(metrics.find(({ name }) => name === 'JSHeapUsedSize')?.value ?? -1);
}

function assertWorldRuntimeCheckpoint(checkpoint) {
  assert.ok(checkpoint.visiblePages > 0, `${checkpoint.label}: visible pages disappeared`);
  assert.equal(checkpoint.blankFrameCount, 0, `${checkpoint.label}: renderer reported a blank commit`);
  assert.equal(checkpoint.sampledBlankFrames ?? 0, 0, `${checkpoint.label}: browser sampled a blank frame`);
  assert.ok(checkpoint.renderPages <= checkpoint.limits.renderPages, `${checkpoint.label}: page count exceeded limit`);
  assert.ok(checkpoint.renderPageBytes <= checkpoint.limits.renderPageBytes, `${checkpoint.label}: page bytes exceeded limit`);
  assert.ok(checkpoint.runtimeBytes <= checkpoint.limits.runtimeBytes, `${checkpoint.label}: 32 MiB runtime target exceeded`);
  assert.equal(checkpoint.estimatedGpuTextureBytes, checkpoint.renderPageBytes, `${checkpoint.label}: GPU estimate drifted`);
  assert.ok(checkpoint.cdpHeapUsedBytes > 0, `${checkpoint.label}: browser heap metric unavailable`);
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

test('world access: 비로그인 사용자는 로그인 안내 화면에서 차단한다', { timeout: config.timeout }, async () => {
  await runInFreshPage(async (page) => {
    await page.goto('/world', { waitUntil: 'domcontentloaded' });
    await assertVisible(
      page.getByRole('heading', { name: '로그인이 필요해요', exact: true }),
      'signed-out world gate heading'
    );
    assert.equal(await page.getByRole('heading', { name: /^학습 월드/ }).count(), 0);
  });
});

test('visibility: 일반 사용자에게 미완성 내비와 독해 트랙 진입을 숨긴다', { timeout: config.timeout }, async () => {
  await runInFreshPage(async (page, context) => {
    await seedMockSessionCookie(context, 'learner');
    await page.goto('/lessons?lang=Japanese', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByRole('heading', { name: '교재', exact: true }), 'lessons heading');
    await assertVisible(page.locator('.gnb__profile-btn[title="E2E 학습자"]'), 'non-admin profile');
    // AuthContext가 프로필 조회 뒤 last_login_at 갱신까지 마치기 전에 서버 redirect로
    // 이동하면 이전 문서의 fetch가 중단돼 console.error가 난다. mock 응답 완료를 기다린다.
    await page.waitForTimeout(500);

    const desktopNav = page.getByRole('navigation', { name: '메인 내비게이션' });
    // 기본 데스크톱 viewport 에서는 CSS 로 숨겨져 role locator 대상에서 빠지므로
    // DOM 계약 자체를 확인하는 안정적인 aria-label selector 를 사용한다.
    const mobileNav = page.locator('nav[aria-label="모바일 내비게이션"]');
    assert.equal(await desktopNav.locator('a[href="/learn"]').count(), 0);
    assert.equal(await desktopNav.locator('a[href="/cohorts"]').count(), 0);
    assert.equal(await mobileNav.locator('a[href="/learn"]').count(), 0);
    await assertVisible(
      desktopNav.getByRole('link', { name: '월드', exact: true }),
      'signed-in desktop world navigation link'
    );
    assert.equal(await mobileNav.locator('a[href="/world"]').count(), 1);
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
    for (const tile of ['ハルカ', 'さん', 'は', 'がくせい', 'ですか']) {
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
    await assertVisible(produceQuestion.getByText('· わたしは がくせいです。', { exact: true }), 'produce model answer');

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
    // 肉まん은 이미 쪄 보온 판매하므로 데움 대사가 아니다. 실제 데움 대상인 도시락 대사를 검증한다.
    await assertVisible(page.getByRole('button', { name: /おべんとう、あたためますか/ }).first(), 'konbini story dialogue');
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
    await assertVisible(page.locator('[role="button"][aria-expanded]').filter({ hasText: /なんめいさまですか/ }).first(), 'izakaya dialogue');
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

test('world: 일반 로그인 세션에서 GBC 게임 셸을 렌더한다', { timeout: config.timeout }, async () => {
  await runInFreshPage(async (page, context) => {
    await mockWorldShellRuntime(context);
    await signInWithMockSession(page, context, 'learner');

    await page.goto('/world', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByRole('heading', { name: /^학습 월드/ }), 'world heading');
    await assertVisible(page.getByText('ANATOMY BOY', { exact: true }), 'GBC shell wordmark');
    await assertVisible(page.getByRole('button', { name: 'A (말 걸기·상호작용)', exact: true }), 'GBC A button');
    await assertVisible(page.getByRole('button', { name: '펫 선택 (SELECT)', exact: true }), 'GBC SELECT button');
  });
});

test('world UI: 여행 수첩에서 캐릭터·가방·도감·임무를 사용할 수 있다', { timeout: config.timeout }, async () => {
  await runInFreshPage(async (page, context) => {
    await mockWorldShellRuntime(context);
    await signInWithMockSession(page, context, 'learner');
    await page.goto('/world', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: '여행 수첩 열기', exact: true }).click();
    await assertVisible(page.getByRole('dialog', { name: '여행 수첩', exact: true }), 'travel notebook dialog');
    await assertVisible(page.getByRole('img', { name: '캐릭터 미리보기', exact: true }), 'avatar preview');
    await page.getByRole('button', { name: '네이비', exact: true }).click();
    await page.getByRole('button', { name: '블루', exact: true }).click();
    await page.getByRole('button', { name: '단발', exact: true }).click();
    await page.getByRole('button', { name: '안경', exact: true }).click();
    if (process.env.E2E_WORLD_UI_SCREENSHOT) {
      await page.screenshot({ path: process.env.E2E_WORLD_UI_SCREENSHOT, fullPage: true });
    }
    await page.getByRole('button', { name: '이 모습으로 적용', exact: true }).click();
    const savedAvatar = await page.evaluate(
      (storageKey) => JSON.parse(localStorage.getItem(storageKey)),
      WORLD_STORAGE_KEYS.avatar,
    );
    assert.equal(savedAvatar.hair, 'navy');
    assert.equal(savedAvatar.top, 'blue');
    assert.equal(savedAvatar.style, 'bob');
    assert.equal(savedAvatar.acc, 'glasses');

    await page.getByRole('button', { name: /가방/, exact: true }).click();
    await page.getByRole('textbox', { name: '가방 검색', exact: true }).fill('すみません');
    await assertVisible(page.getByText('회화 카드「すみません」', { exact: true }), 'phrase inventory item');
    await page.getByRole('button', { name: '회화 카드「すみません」 즐겨찾기', exact: true }).click();
    const favorites = await page.evaluate(
      (storageKey) => JSON.parse(localStorage.getItem(storageKey)),
      WORLD_STORAGE_KEYS.inventoryFavorites,
    );
    assert.deepEqual(favorites, ['phrase-sumimasen']);

    await page.getByRole('button', { name: /도감/, exact: true }).click();
    await assertVisible(page.getByText('방문 기념 스탬프 0/', { exact: false }), 'codex stamp progress');
    await page.getByRole('button', { name: /임무/, exact: true }).click();
    await assertVisible(page.getByText('오늘의 즉석 복습', { exact: true }), 'quest list');
    await page.getByRole('button', { name: '닫기 Ⓑ', exact: true }).click();
    await page.getByRole('dialog', { name: '여행 수첩', exact: true }).waitFor({ state: 'hidden', timeout: config.timeout });
  });
});

test('world: 후쿠오카 노드에서 시내로 들어가 하카타항 EXIT로 복귀한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    const positionWrites = [];
    await mockWorldShellRuntime(context, {
      position: { scene: 'plaza', x: 135, y: 307 },
      positionWrites,
    });
    await signInWithMockSession(page, context, 'learner');

    await page.goto('/world', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByRole('heading', { name: /^학습 월드/ }), 'world heading');
    const spawnDeadline = Date.now() + 5000;
    while (!positionWrites.length && Date.now() < spawnDeadline) await page.waitForTimeout(50);
    assert.deepEqual(
      positionWrites[0],
      { scene: 'plaza', x: 135, y: 307 },
      `world should spawn at the mocked Fukuoka node: ${JSON.stringify(positionWrites)}`
    );
    await assertVisible(page.getByRole('button', { name: '들어가기', exact: true }), 'Fukuoka city gate');

    await page.getByRole('button', { name: '지도 열기', exact: true }).click();
    await assertVisible(page.getByRole('button', { name: '닫기 Ⓑ', exact: true }), 'national minimap');
    const nationalMapSize = await page.locator('canvas').last().evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
    }));
    await page.getByRole('button', { name: '닫기 Ⓑ', exact: true }).click();

    await page.getByRole('button', { name: '들어가기', exact: true }).click();
    await assertVisible(page.getByText('후쿠오카 시내로 들어갈까요?', { exact: true }), 'city confirmation');
    await page.getByRole('button', { name: '들어가기', exact: true }).click();

    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: '지도 열기', exact: true }).click();
    await assertVisible(page.getByRole('button', { name: '닫기 Ⓑ', exact: true }), 'Fukuoka city minimap');
    const cityMapSize = await page.locator('canvas').last().evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
    }));
    assert.notDeepEqual(cityMapSize, nationalMapSize, 'city shell should render the city minimap');
    assert.ok(cityMapSize.width > nationalMapSize.width, 'Fukuoka minimap should be wider than national minimap');
    assert.ok(cityMapSize.height > nationalMapSize.height, 'Fukuoka minimap should be taller than national minimap');
    await page.getByRole('button', { name: '닫기 Ⓑ', exact: true }).click();

    await page.waitForTimeout(350);
    await page.keyboard.down('b');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(1800);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.up('b');

    await assertVisible(page.getByRole('button', { name: '들어가기', exact: true }), 'returned Fukuoka city gate');
    await page.getByRole('button', { name: '지도 열기', exact: true }).click();
    await assertVisible(page.getByRole('button', { name: '닫기 Ⓑ', exact: true }), 'returned national minimap');
    const returnedMapSize = await page.locator('canvas').last().evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
    }));
    assert.deepEqual(returnedMapSize, nationalMapSize, 'Hakata Port EXIT should return to national map');
  });
});

test('world: 로그인 픽스처에서 라멘 문화 도어를 확인·취소한 뒤 문법 챕터로 이동한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    await mockWorldShellRuntime(context, {
      position: { scene: 'city:fukuoka', x: 205, y: 158 },
    });
    await signInWithMockSession(page, context, 'learner');

    await page.goto('/world', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByRole('heading', { name: /^학습 월드/ }), 'world heading');
    await assertVisible(page.getByText('🚪 Ⓐ 博多ラーメン 문화 챕터', { exact: true }), 'ramen culture door');

    const interact = page.getByRole('button', { name: 'A (말 걸기·상호작용)', exact: true });
    const confirmation = page.getByText('博多ラーメン 문화 챕터를 시작할까요?', { exact: true });
    await interact.click();
    await assertVisible(confirmation, 'culture chapter confirmation');

    await page.getByRole('button', { name: 'B (취소·닫기·홀드 달리기)', exact: true }).click();
    await confirmation.waitFor({ state: 'hidden', timeout: config.timeout });

    await interact.click();
    await assertVisible(confirmation, 'culture chapter confirmation after cancel');
    await page.getByRole('button', { name: '시작', exact: true }).click();
    await page.waitForURL('**/japanese/grammar/ot-10-ramen', { timeout: config.timeout });
    assert.equal(new URL(page.url()).pathname, '/japanese/grammar/ot-10-ramen');
  });
});

test('world A-2: 관리자는 하네다 장소 문을 확인·취소한 뒤 정확한 독해 글로 이동한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    await mockWorldShellRuntime(context, {
      position: { scene: 'plaza', x: 317, y: 258 },
    });
    await signInWithMockSession(page, context, 'admin');

    await page.goto('/world', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByRole('heading', { name: /^학습 월드/ }), 'world heading');
    await assertVisible(page.getByText('📖 Ⓐ 이 장소의 이야기 읽기', { exact: true }), 'Haneda reading door');

    const interact = page.getByRole('button', { name: 'A (말 걸기·상호작용)', exact: true });
    const confirmation = page.getByText('하네다에서 이어지는 이야기를 읽을까요?', { exact: true });
    await interact.click();
    await assertVisible(confirmation, 'Haneda reading confirmation');

    await page.getByRole('button', { name: 'B (취소·닫기·홀드 달리기)', exact: true }).click();
    await confirmation.waitFor({ state: 'hidden', timeout: config.timeout });

    await interact.click();
    await assertVisible(confirmation, 'Haneda reading confirmation after cancel');
    await page.getByRole('button', { name: '읽기', exact: true }).click();
    await page.waitForURL('**/japanese/reading?node=n5-tokyo-01', { timeout: config.timeout });
    const url = new URL(page.url());
    assert.equal(url.pathname, '/japanese/reading');
    assert.equal(url.searchParams.get('node'), 'n5-tokyo-01');
    await assertVisible(page.getByRole('heading', { name: '여권 확인', exact: true }), 'exact Haneda reading text');
  });
});

test('world A-2: 일반 학습자에게 하네다는 막힌 독해 문 대신 기존 설명 표지로 남는다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    await mockWorldShellRuntime(context, {
      position: { scene: 'plaza', x: 317, y: 258 },
    });
    await signInWithMockSession(page, context, 'learner');

    await page.goto('/world', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByText('Ⓐ 하네다 살펴보기', { exact: true }), 'Haneda description marker');
    assert.equal(await page.getByText('📖 Ⓐ 이 장소의 이야기 읽기', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'A (말 걸기·상호작용)', exact: true }).click();
    await assertVisible(page.getByText('도쿄의 바닷가 국제공항. 일본에서 가장 붐비는 하늘길이에요.', { exact: true }), 'Haneda description');
  });
});

test('world: 저장된 도쿄 시내에서 하네다 EXIT 세로회랑으로 전국맵에 복귀한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    const positionWrites = [];
    await mockWorldShellRuntime(context, {
      position: { scene: 'city:tokyo', x: 543, y: 1040 },
      positionWrites,
    });
    await signInWithMockSession(page, context, 'learner');

    await page.goto('/world', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByRole('heading', { name: /^학습 월드/ }), 'world heading');
    const spawnDeadline = Date.now() + 5000;
    while (!positionWrites.length && Date.now() < spawnDeadline) await page.waitForTimeout(50);
    assert.deepEqual(
      positionWrites[0],
      { scene: 'city:tokyo', x: 543, y: 1040 },
      `world should restore the mocked Tokyo entrance: ${JSON.stringify(positionWrites)}`
    );

    await page.getByRole('button', { name: '지도 열기', exact: true }).click();
    await assertVisible(page.getByRole('button', { name: '닫기 Ⓑ', exact: true }), 'Tokyo city minimap');
    const cityMapSize = await page.locator('canvas').last().evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
    }));
    assert.deepEqual(cityMapSize, { width: 824 * 3, height: 1086 * 3 }, 'Tokyo geo minimap dimensions');
    await page.getByRole('button', { name: '닫기 Ⓑ', exact: true }).click();

    await page.waitForTimeout(350);
    await page.keyboard.down('b');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(2200);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.up('b');

    await assertVisible(page.getByRole('button', { name: '들어가기', exact: true }), 'returned Tokyo city gate');
    await page.getByRole('button', { name: '지도 열기', exact: true }).click();
    await assertVisible(page.getByRole('button', { name: '닫기 Ⓑ', exact: true }), 'returned national minimap');
    const returnedMapSize = await page.locator('canvas').last().evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
    }));
    assert.notDeepEqual(returnedMapSize, cityMapSize, 'Haneda EXIT should return to national map');
  });
});

test('world runtime: 로그인 상태에서 장거리·왕복·순간이동·재접속에도 32 MiB와 무공백 계약을 지킨다', { timeout: config.timeout * 3 }, async () => {
  await runInFreshPage(async (page, context) => {
    const positionState = { current: { scene: 'plaza', x: 68, y: 208 } };
    const positionWrites = [];
    await mockWorldShellRuntime(context, { positionState, positionWrites });
    await signInWithMockSession(page, context, 'learner');
    await page.goto('/world?worldDebug=1', { waitUntil: 'domcontentloaded' });
    await waitForWorldDebug(page);

    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const checkpoints = [];
    const checkpoint = async (label, extra = {}) => {
      await page.waitForFunction(() => {
        const snapshot = window.__MANABI_WORLD_DEBUG__?.snapshot?.();
        return snapshot && snapshot.pendingPages === 0 && snapshot.pendingChunks === 0;
      }, null, { timeout: config.timeout });
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
      const runtime = await page.evaluate(() => window.__MANABI_WORLD_DEBUG__.snapshot());
      const measured = {
        label,
        ...runtime,
        ...extra,
        cdpHeapUsedBytes: await readJsHeapUsedBytes(cdp),
      };
      assertWorldRuntimeCheckpoint(measured);
      checkpoints.push(measured);
      return measured;
    };

    const baseline = await checkpoint('initial-seoul');
    for (const [label, x, y] of [
      ['long-fukuoka', 135, 307],
      ['long-osaka', 234, 276],
      ['long-haneda', 317, 258],
    ]) {
      await page.evaluate(([tx, ty]) => window.__MANABI_WORLD_DEBUG__.teleport(tx, ty), [x, y]);
      await checkpoint(label);
    }

    await page.evaluate(() => window.__MANABI_WORLD_DEBUG__.teleport(68, 208));
    await checkpoint('direct-teleport-seoul');

    const rapid = await page.evaluate(async (destinations) => {
      let done = false;
      let sampledBlankFrames = 0;
      let sampledFrames = 0;
      const monitor = (async () => {
        while (!done) {
          const snapshot = window.__MANABI_WORLD_DEBUG__.snapshot();
          if (snapshot.committedUpdates > 0 && snapshot.visiblePages === 0) sampledBlankFrames += 1;
          sampledFrames += 1;
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      })();
      await Promise.all(destinations.map(([x, y]) => window.__MANABI_WORLD_DEBUG__.teleport(x, y)));
      done = true;
      await monitor;
      return { sampledBlankFrames, sampledFrames };
    }, [[317, 258], [135, 307], [317, 258], [135, 307], [317, 258]]);
    assert.ok(rapid.sampledFrames > 0, 'rapid round trip should sample at least one rendered frame');
    const rapidCheckpoint = await checkpoint('rapid-round-trip', rapid);
    assert.deepEqual(rapidCheckpoint.tile, { x: 317, y: 258 }, 'rapid round trip should end at Haneda');
    positionState.current = { scene: 'plaza', ...rapidCheckpoint.tile };

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForWorldDebug(page);
    const reconnect = await checkpoint('reconnect-haneda');
    assert.deepEqual(reconnect.tile, { x: 317, y: 258 }, 'reconnect should restore final Haneda tile');

    const maxHeapGrowth = Math.max(...checkpoints.map(({ cdpHeapUsedBytes }) => cdpHeapUsedBytes))
      - baseline.cdpHeapUsedBytes;
    assert.ok(maxHeapGrowth < 48 * 1024 * 1024, `GC heap growth exceeded 48 MiB: ${maxHeapGrowth}`);
    console.log(`[world-runtime-metrics] ${JSON.stringify({
      checkpoints: checkpoints.map((item) => ({
        label: item.label,
        tile: item.tile,
        runtimeBytes: item.runtimeBytes,
        renderPages: item.renderPages,
        estimatedGpuTextureBytes: item.estimatedGpuTextureBytes,
        cdpHeapUsedBytes: item.cdpHeapUsedBytes,
      })),
      maxHeapGrowth,
      persistedWrites: positionWrites.length,
    })}`);
  });
});

test('world: 저장된 오사카 시내에서 梅田 EXIT 세로회랑으로 전국맵에 복귀한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    const positionWrites = [];
    await mockWorldShellRuntime(context, {
      position: { scene: 'city:osaka', x: 414, y: 187 },
      positionWrites,
    });
    await signInWithMockSession(page, context, 'learner');

    await page.goto('/world', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByRole('heading', { name: /^학습 월드/ }), 'world heading');
    const spawnDeadline = Date.now() + 5000;
    while (!positionWrites.length && Date.now() < spawnDeadline) await page.waitForTimeout(50);
    assert.deepEqual(
      positionWrites[0],
      { scene: 'city:osaka', x: 414, y: 187 },
      `world should restore the mocked osaka entrance: ${JSON.stringify(positionWrites)}`
    );

    await page.getByRole('button', { name: '지도 열기', exact: true }).click();
    await assertVisible(page.getByRole('button', { name: '닫기 Ⓑ', exact: true }), 'osaka city minimap');
    const cityMapSize = await page.locator('canvas').last().evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
    }));
    assert.deepEqual(cityMapSize, { width: 641 * 3, height: 668 * 3 }, 'osaka geo minimap dimensions');
    await page.getByRole('button', { name: '닫기 Ⓑ', exact: true }).click();

    await page.waitForTimeout(350);
    await page.keyboard.down('b');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(2200);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.up('b');

    await assertVisible(page.getByRole('button', { name: '들어가기', exact: true }), 'returned osaka city gate');
    await page.getByRole('button', { name: '지도 열기', exact: true }).click();
    await assertVisible(page.getByRole('button', { name: '닫기 Ⓑ', exact: true }), 'returned national minimap');
    const returnedMapSize = await page.locator('canvas').last().evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
    }));
    assert.notDeepEqual(returnedMapSize, cityMapSize, 'Osaka EXIT should return to national map');
  });
});

test('world: 저장된 교토 시내에서 京都駅 EXIT 세로회랑으로 전국맵에 복귀한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    const positionWrites = [];
    await mockWorldShellRuntime(context, {
      position: { scene: 'city:kyoto', x: 404, y: 422 },
      positionWrites,
    });
    await signInWithMockSession(page, context, 'learner');

    await page.goto('/world', { waitUntil: 'domcontentloaded' });
    await assertVisible(page.getByRole('heading', { name: /^학습 월드/ }), 'world heading');
    const spawnDeadline = Date.now() + 5000;
    while (!positionWrites.length && Date.now() < spawnDeadline) await page.waitForTimeout(50);
    assert.deepEqual(
      positionWrites[0],
      { scene: 'city:kyoto', x: 404, y: 422 },
      `world should restore the mocked kyoto entrance: ${JSON.stringify(positionWrites)}`
    );

    await page.getByRole('button', { name: '지도 열기', exact: true }).click();
    await assertVisible(page.getByRole('button', { name: '닫기 Ⓑ', exact: true }), 'kyoto city minimap');
    const cityMapSize = await page.locator('canvas').last().evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
    }));
    assert.deepEqual(cityMapSize, { width: 639 * 3, height: 668 * 3 }, 'kyoto geo minimap dimensions');
    await page.getByRole('button', { name: '닫기 Ⓑ', exact: true }).click();

    await page.waitForTimeout(350);
    await page.keyboard.down('b');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(2200);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.up('b');

    await assertVisible(page.getByRole('button', { name: '들어가기', exact: true }), 'returned kyoto city gate');
    await page.getByRole('button', { name: '지도 열기', exact: true }).click();
    await assertVisible(page.getByRole('button', { name: '닫기 Ⓑ', exact: true }), 'returned national minimap');
    const returnedMapSize = await page.locator('canvas').last().evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
    }));
    assert.notDeepEqual(returnedMapSize, cityMapSize, 'Kyoto EXIT should return to national map');
  });
});

test('world peers: 수십 명 렌더·거리·라벨 순수 부하를 측정한다', () => {
  const result = runPeerLoadBenchmark({ peerCount: 64, frames: 600, distancePasses: 200 });
  assert.equal(result.displayObjects, 128);
  assert.equal(result.distanceSamples, 64 * 200);
  assert.ok(result.totalMs < 5000, `peer pure benchmark exceeded 5s: ${JSON.stringify(result)}`);
  console.log(`[world-peer-bench] ${JSON.stringify(result)}`);
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
