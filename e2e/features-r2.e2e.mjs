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

// 문장 지정은 드래그가 아니라 문장 막대(¦)로 한다. 드래그는 선택 텍스트가 폰트·레이아웃에
// 따라 흔들려 좌측 번역 캐시 키(viewer_tx:{lang}:{sel})가 빗나가는데, 이 화면의 🎧 진입
// 버튼은 **번역 결과가 있을 때만** 렌더되므로 캐시가 빗나가면 버튼 자체가 없다.
// 막대 경로의 지정 텍스트는 원문 줄(cleanLineText)로 결정적이라 캐시를 정확히 시드할 수 있다.
const SENTENCE = 'Hello world.';

async function pickSentence(page) {
  await page.evaluate((text) => {
    localStorage.setItem(`viewer_tx:English:${text}`, '**번역**\n안녕, 세계.\n\n**맥락**\nE2E 캐시 문장입니다.');
  }, SENTENCE);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.line-pick').first().click();
  // 좌측 패널은 넓은 화면의 aside와 좁은 화면의 시트 양쪽에 같은 내용을 렌더한다 —
  // 레이아웃에 의존하지 않도록 첫 번째만 집는다.
  await visible(page.getByRole('button', { name: '이 문장 받아쓰기' }).first(), 'dictation entry');
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
    await pickSentence(page);
    await page.getByRole('button', { name: '이 문장 받아쓰기' }).first().click();
    const dialog = page.getByRole('dialog', { name: '받아쓰기' });
    await visible(dialog.getByPlaceholder('들리는 대로 입력해 보세요'), 'dictation input');
    assert.equal(await dialog.getByText(SENTENCE, { exact: false }).count(), 0, 'original stays hidden before reveal');
    await dialog.getByPlaceholder('들리는 대로 입력해 보세요').fill('Hello word');
    await dialog.getByRole('button', { name: '채점', exact: true }).click();
    await visible(dialog.getByText(/정답률 \d+%/), 'accuracy');
    await visible(dialog.getByText('파랑 = 놓친 글자 · 취소선 = 잘못 들어간 글자', { exact: true }), 'diff legend');
    await dialog.getByRole('button', { name: '본문 보기', exact: true }).click();
    await visible(dialog.getByText(`"${SENTENCE}"`, { exact: true }), 'revealed original');
  });
});

test('/quick: 게스트 가드와 로그인 사용자의 fixture 분석 결과를 렌더한다', async () => {
  await fresh(async (page, context) => {
    await page.goto('/quick', { waitUntil: 'domcontentloaded' });
    await visible(page.getByText('빠른 분석은 로그인 후 쓸 수 있어요', { exact: true }), 'guest login card');
    await mockAccount(context);
    // 분석 응답은 이 스위트의 다른 테스트와 같은 층(브라우저 레벨)에서 고정한다.
    // 서버 라우트를 그대로 태우면 SUPABASE_SERVICE_ROLE_KEY가 없는 e2e 환경에서 500이
    // 나고(실측), 화면 렌더 계약이 아니라 서버 환경을 시험하게 된다 — 라우트는 자체
    // 단위 테스트의 소관이다.
    await context.route('**/api/analyze', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ results: [{ sequence: ['q0', 'q1'], dictionary: {
        q0: { text: 'hello', base_form: 'hello', pos: '감탄사', meaning: '안녕하세요' },
        q1: { text: 'world', base_form: 'world', pos: '명사', meaning: '세계' },
      } }] }),
    }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.selectOption('select', 'English'); // 기본값은 일본어 — 입력과 언어를 맞춘다
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
    // 재독은 '교재 이어서 학습'과 같은 부품(.lessons-continue)으로 통합됐다(오너 지시).
    await visible(page.getByText('다시 읽기 · 두 번째는 훨씬 빨라요', { exact: true }), 'reread row');
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
