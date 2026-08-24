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
const appendOutput = (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-20000); };
const stopped = () => !server || server.exitCode != null || server.signalCode != null;

async function waitForServer() {
  const deadline = Date.now() + config.webServer.timeout;
  while (Date.now() < deadline) {
    if (stopped()) throw new Error(`next start exited early\n${serverOutput}`);
    try {
      const response = await fetch(config.webServer.url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* starting */ }
    await delay(100);
  }
  throw new Error(`next start did not become ready\n${serverOutput}`);
}

async function stopServer() {
  if (stopped()) return;
  const kill = (signal) => {
    try { process.platform === 'win32' ? server.kill(signal) : process.kill(-server.pid, signal); } catch { /* stopped */ }
  };
  const exited = once(server, 'exit').catch(() => {});
  kill('SIGTERM');
  await Promise.race([exited, delay(3000)]);
  if (!stopped()) kill('SIGKILL');
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function learnerSession() {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: '00000000-0000-4000-8000-000000000272', aud: 'authenticated', role: 'authenticated',
    email: 'features-r2@example.com', user_metadata: { display_name: 'R2 학습자' }, identities: [],
    created_at: new Date((now - 3600) * 1000).toISOString(), updated_at: new Date().toISOString(),
  };
  const access_token = [
    base64urlJson({ alg: 'HS256', typ: 'JWT' }),
    base64urlJson({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: now + 3600 }),
    'e2e',
  ].join('.');
  return { access_token, refresh_token: 'e2e-refresh', expires_in: 3600, expires_at: now + 3600, token_type: 'bearer', user };
}

async function mockAccount(context, { material, reread = false, outputWords = false } = {}) {
  const session = learnerSession();
  const known = new Set();
  const cors = {
    'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD',
    'access-control-expose-headers': 'content-range',
  };
  const reply = (route, body, headers = {}) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { ...cors, ...headers }, body: JSON.stringify(body),
  });
  await context.addInitScript(() => {
    class Observer { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: Observer });
  });
  await context.route('**/api/suggestions/today', (route) => reply(route, []));
  await context.route('**/auth/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    return reply(route, new URL(route.request().url()).pathname.endsWith('/user') ? session.user : session);
  });
  await context.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop();
    const select = url.searchParams.get('select') || '';
    if (request.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...cors, 'content-range': '*/0' } });
    if (table === 'profiles') return reply(route, { id: session.user.id, display_name: 'R2 학습자', role: 'learner', onboarded: true, learning_language: ['English'] });
    if (table === 'reading_materials' && material) return reply(route, material);
    if (table === 'user_known_words') {
      if (request.method() === 'DELETE') known.clear();
      else if (request.method() !== 'GET') known.add(request.postDataJSON().word_text);
      return reply(route, request.method() === 'GET' ? [...known].map((word_text) => ({ word_text })) : []);
    }
    if (table === 'reading_progress' && reread && select.includes('reading_materials(title)')) {
      return reply(route, [{ material_id: 92001, is_completed: true, completed_at: '2026-07-01T00:00:00.000Z', reading_materials: { title: '오래된 E2E 읽기' } }]);
    }
    if (table === 'user_vocabulary' && outputWords && select.includes('last_reviewed_at')) {
      return reply(route, [{ id: 'word-1', word_text: 'practice', meaning: '연습하다', language: 'English', last_reviewed_at: new Date().toISOString() }]);
    }
    if (table === 'review_events' && outputWords) {
      return reply(route, [{ source: 'vocab', correct: true, created_at: new Date().toISOString(), detail: { word_id: 'word-1' } }]);
    }
    if (table === 'study_group_members') return reply(route, []);
    return reply(route, []);
  });
  const project = new URL(config.webServer.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  await context.addCookies([{
    name: `sb-${project}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    url: config.use.baseURL, sameSite: 'Lax',
  }]);
  return { known };
}

function viewerMaterial() {
  return {
    id: 92001, title: 'R2 영어 읽기', raw_text: 'Hello world.', status: 'completed', visibility: 'public',
    owner_id: '00000000-0000-4000-8000-000000000272',
    processed_json: {
      status: 'completed', metadata: { language: 'English', level: 'A1' },
      sequence: ['id_0_0', 'id_0_1', 'id_0_2'],
      dictionary: {
        id_0_0: { text: 'Hello', base_form: 'hello', pos: '감탄사', meaning: '안녕하세요' },
        id_0_1: { text: 'world', base_form: 'world', pos: '명사', meaning: '세계' },
        id_0_2: { text: '.', base_form: '.', pos: '기호', meaning: '' },
      },
    },
  };
}

async function fresh(run) {
  const context = await browser.newContext({ baseURL: config.use.baseURL });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await run(page, context);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { await context.close(); }
}

async function visible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: config.timeout });
  assert.equal(await locator.isVisible(), true, `${label} should be visible`);
}

async function openSentenceSheet(page) {
  await page.evaluate(() => document.fonts.ready);
  const start = await page.locator('[data-tid="id_0_0"] .surface').boundingBox();
  const end = await page.locator('[data-tid="id_0_1"] .surface').boundingBox();
  assert.ok(start && end);
  await page.mouse.move(start.x + 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width - 2, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();
  await visible(page.getByRole('dialog', { name: 'AI 분석 결과' }), 'sentence sheet');
}

before(async () => {
  try { await fetch(config.webServer.url, { signal: AbortSignal.timeout(500) }); throw new Error('port is already in use'); } catch (error) {
    if (error.message === 'port is already in use') throw error;
  }
  server = spawn(config.webServer.command, config.webServer.args, {
    cwd: config.webServer.cwd, env: { ...process.env, ...config.webServer.env, GEMINI_API_KEY: 'e2e-never-sent' },
    detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', appendOutput);
  server.stderr.on('data', appendOutput);
  await waitForServer();
  browser = await chromium.launch(config.use.launchOptions);
}, { timeout: config.webServer.timeout + config.timeout });

after(async () => { try { await browser?.close(); } finally { await stopServer(); } });

test('받아쓰기: 지정 문장을 가린 채 입력·채점하고 diff와 본문 보기를 렌더한다', async () => {
  await fresh(async (page, context) => {
    await mockAccount(context, { material: viewerMaterial() });
    await context.route('**/api/analyze', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [{ sequence: ['a', 'b'], dictionary: { a: { text: 'Hello', base_form: 'hello', meaning: '안녕하세요' }, b: { text: 'world', base_form: 'world', meaning: '세계' } } }] }) }));
    await page.goto('/viewer/92001', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('viewer_tx:English:Hello world', '안녕하세요, 세계.'));
    await openSentenceSheet(page);
    await page.getByRole('button', { name: '이 문장 받아쓰기' }).click();
    const dialog = page.getByRole('dialog', { name: '받아쓰기' });
    await visible(dialog.getByPlaceholder('들리는 대로 입력해 보세요'), 'dictation input');
    assert.equal(await dialog.getByText('Hello world', { exact: false }).count(), 0, 'original stays hidden before reveal');
    await dialog.getByPlaceholder('들리는 대로 입력해 보세요').fill('Hello word');
    await dialog.getByRole('button', { name: '채점', exact: true }).click();
    await visible(dialog.getByText(/정답률 \d+%/), 'accuracy');
    await visible(dialog.getByText('파랑 = 놓친 글자 · 취소선 = 잘못 들어간 글자', { exact: true }), 'diff legend');
    await dialog.getByRole('button', { name: '본문 보기', exact: true }).click();
    await visible(dialog.getByText('"Hello world"', { exact: true }), 'revealed original');
  });
});

test('/quick: 게스트 가드와 로그인 사용자의 fixture 분석 결과를 렌더한다', async () => {
  await fresh(async (page, context) => {
    await page.goto('/quick', { waitUntil: 'domcontentloaded' });
    await visible(page.getByText('빠른 분석은 로그인 후 쓸 수 있어요', { exact: true }), 'guest login card');
    await mockAccount(context);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('분석할 텍스트를 붙여넣으세요').fill('hello world');
    await page.getByRole('button', { name: '분석', exact: true }).click();
    await visible(page.getByText('저장 안 됨', { exact: true }), 'analysis result');
    await visible(page.getByText('hello', { exact: true }), 'fixture token');
    await visible(page.getByText('world', { exact: true }), 'fixture token');
  });
});

test('이미 알아요: 뷰어 단어 시트에서 토글 문구가 왕복한다', async () => {
  await fresh(async (page, context) => {
    await mockAccount(context, { material: viewerMaterial() });
    await page.goto('/viewer/92001', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-tid="id_0_1"]').click();
    const button = page.getByRole('button', { name: '👌 이미 알아요', exact: true });
    await visible(button, 'known-word toggle');
    await button.click();
    const undo = page.getByRole('button', { name: '👌 아는 말로 표시됨 — 취소', exact: true });
    await visible(undo, 'known-word undo state');
    await undo.click();
    await visible(page.getByRole('button', { name: '👌 이미 알아요', exact: true }), 'restored known-word state');
  });
});

test('fixture 데이터로 홈 재독 카드와 작문 산출 칩을 렌더한다', async () => {
  await fresh(async (page, context) => {
    await mockAccount(context, { reread: true, outputWords: true });
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await visible(page.getByText('📖 다시 읽어볼까요', { exact: true }), 'reread card');
    await visible(page.getByText(/오래된 E2E 읽기/), 'reread fixture title');
    await page.goto('/writing', { waitUntil: 'domcontentloaded' });
    await visible(page.getByText('✍️ 오늘 복습한 말 써먹기:', { exact: true }), 'output chip label');
    await visible(page.getByRole('button', { name: 'practice', exact: true }), 'output word chip');
  });
});

test('학습 그룹: 게스트 가드와 로그인 사용자의 초대 코드 폼을 렌더한다', async () => {
  await fresh(async (page, context) => {
    await page.goto('/groups', { waitUntil: 'domcontentloaded' });
    await visible(page.getByText('로그인하면 그룹을 만들어 같은 자료를 함께 읽을 수 있어요.', { exact: true }), 'groups guest guard');
    await mockAccount(context);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await visible(page.getByPlaceholder('초대 코드 6자'), 'join-code input');
    await visible(page.getByRole('button', { name: '코드로 참가', exact: true }), 'join-code submit');
  });
});
