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
const heapSamples = [];

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

async function runInFreshPage(run, { allowErrors = [] } = {}) {
  const context = await browser.newContext({ baseURL: config.use.baseURL });
  const page = await context.newPage();
  const errors = runtimeErrors(page);
  try {
    await run(page, context);
    await page.waitForTimeout(250);
    const unexpected = errors.filter((error) => !allowErrors.some((pattern) => pattern.test(error)));
    assert.deepEqual(unexpected, [], unexpected.join('\n'));
  } finally {
    await context.close();
  }
}

async function assertVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: config.timeout });
  assert.equal(await locator.isVisible(), true, `${label} should be visible`);
}

async function sampleHeap(page, label) {
  const bytes = await page.evaluate(() => Math.floor(performance.memory?.usedJSHeapSize ?? -1));
  if (bytes > 0) heapSamples.push({ label, bytes });
}

async function mockTts(context) {
  const emptyPcmWav = Buffer.from(
    'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
    'base64',
  );
  await context.route('**/api/tts?**', (route) => route.fulfill({
    status: 200,
    contentType: 'audio/wav',
    body: emptyPcmWav,
  }));
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function fakeLearnerSession() {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: '00000000-0000-4000-8000-000000000172',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e-learner@example.com',
    email_confirmed_at: new Date((now - 60) * 1000).toISOString(),
    confirmed_at: new Date((now - 60) * 1000).toISOString(),
    last_sign_in_at: new Date(now * 1000).toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: 'E2E 학습자' },
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

async function mockAuthenticatedVocab(context) {
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

  const session = fakeLearnerSession();
  const storedWords = [];
  const writes = [];
  const writesByTable = {};
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
    else await json(route, session);
  });
  await context.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }

    const url = new URL(request.url());
    const table = url.pathname.split('/').pop();
    // SRS 정본 경로 검증용 — 어느 테이블에 무엇을 썼는지 전부 모은다.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      let payload = null;
      try { payload = request.postDataJSON(); } catch { payload = null; }
      const rows = Array.isArray(payload) ? payload : [payload].filter(Boolean);
      writesByTable[table] = (writesByTable[table] || []).concat(rows);
    }
    if (table === 'profiles') {
      await json(route, {
        id: session.user.id,
        display_name: 'E2E 학습자',
        role: 'learner',
        onboarded: true,
        streak_count: 1,
        last_login_at: '2026-08-06T00:00:00.000Z',
      });
      return;
    }
    if (request.method() === 'HEAD') {
      await route.fulfill({ status: 200, headers: { ...cors, 'content-range': '*/0' } });
      return;
    }
    if (table === 'user_vocabulary') {
      if (request.method() === 'GET') {
        const selectedWordsOnly = url.searchParams.get('select') === 'word_text';
        await json(route, selectedWordsOnly
          ? storedWords.map(({ word_text }) => ({ word_text }))
          : storedWords);
        return;
      }
      const payload = request.postDataJSON();
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const row of rows) {
        writes.push({ ...row });
        const existing = storedWords.findIndex((item) => (
          item.user_id === row.user_id && item.word_text === row.word_text
        ));
        const persisted = {
          id: existing >= 0 ? storedWords[existing].id : `e2e-vocab-${storedWords.length + 1}`,
          created_at: '2026-08-06T00:00:00.000Z',
          next_review_at: '2000-01-01T00:00:00.000Z',
          interval: 0,
          ease_factor: 0,
          repetitions: 0,
          last_reviewed_at: null,
          ...row,
        };
        if (existing >= 0) storedWords[existing] = persisted;
        else storedWords.push(persisted);
      }
      await json(route, []);
      return;
    }
    await json(route, []);
  });

  const projectRef = new URL(config.webServer.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  await context.addCookies([{
    name: `sb-${projectRef}-auth-token`,
    value: cookieValue,
    url: config.use.baseURL,
    sameSite: 'Lax',
  }]);

  return { session, storedWords, writes, writesByTable };
}

async function openTrackChapter(page, track) {
  await page.goto('/lessons', { waitUntil: 'domcontentloaded', timeout: config.timeout });
  await page.getByRole('button', { name: track.label, exact: true }).click();
  await page.waitForFunction(
    (key) => globalThis.localStorage?.getItem('lessons_lang') === key,
    track.key,
  );
  await page.getByRole('button', { name: track.level, exact: true }).click();

  const groupHeader = page.locator('.lessons-list__group-header').filter({ hasText: track.level }).first();
  await assertVisible(groupHeader, `${track.label} ${track.level} group`);
  if (await groupHeader.getAttribute('aria-expanded') !== 'true') await groupHeader.click();

  const chapterRow = page.locator(`#lessons-ch-${track.slug}`);
  await assertVisible(chapterRow, `${track.label} manifest chapter`);
  await chapterRow.click();
  await page.waitForURL(`**${track.path}`, { timeout: config.timeout });
  assert.equal(new URL(page.url()).pathname, track.path);
  await assertVisible(page.getByRole('heading', { level: 1 }).first(), `${track.label} chapter heading`);
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
  if (heapSamples.length > 0) {
    const peak = heapSamples.reduce((max, sample) => (sample.bytes > max.bytes ? sample : max));
    process.stdout.write(`[learning-flow] peak JS heap ${peak.bytes} bytes (${peak.label})\n`);
  }
});

// 언어 칩이나 레벨 아코디언, 매니페스트 링크가 끊기면 4트랙의 실제 첫 챕터 진입에서 잡는다.
test('lessons: 4트랙을 전환하고 실재 레벨 그룹에서 챕터로 진입한다', { timeout: config.timeout * 4 }, async () => {
  const tracks = [
    { key: 'English', label: '영어', level: 'A1', slug: 'a1-01-be-verb', path: '/english/grammar/a1-01-be-verb' },
    { key: 'French', label: '프랑스어', level: 'A1', slug: 'a1-01-pronouns-etre', path: '/french/grammar/a1-01-pronouns-etre' },
    { key: 'Japanese', label: '일본어', level: 'N5', slug: 'n5-04-desu-da', path: '/japanese/grammar/n5-04-desu-da' },
    { key: 'Chinese', label: '중국어', level: 'H1', slug: 'h1-01-shi', path: '/chinese/grammar/h1-01-shi' },
  ];
  await runInFreshPage(async (page) => {
    for (const track of tracks) await openTrackChapter(page, track);
    await sampleHeap(page, 'four-track chapter navigation');
  });
});

// 드릴 렌더·채점·게스트 SRS 기록·복습 링크 중 하나가 깨지면 6문항 완주 계약에서 잡는다.
test('chapter drills: choice·fill·order·listen 6문항의 정오답과 복습 넛지를 검증한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    await mockTts(context);
    await openTrackChapter(page, {
      key: 'Japanese',
      label: '일본어',
      level: 'N5',
      slug: 'n5-04-desu-da',
      path: '/japanese/grammar/n5-04-desu-da',
    });

    const drills = page.locator('section.card.fr-section').filter({
      has: page.getByRole('heading', { name: '변형 드릴 — 새 문장으로 손 풀기', exact: true }),
    });
    await assertVisible(drills, 'chapter drills');
    const items = drills.locator('ol > li');
    assert.equal(await items.count(), 6, 'the manifest chapter must keep its six drills');

    await items.nth(0).getByPlaceholder('정답 입력').fill('です');
    await items.nth(0).getByRole('button', { name: '확인', exact: true }).click();
    await assertVisible(items.nth(0).getByText('정답이에요!', { exact: true }), 'correct fill result');

    await items.nth(1).getByPlaceholder('정답 입력').fill('です');
    await items.nth(1).getByRole('button', { name: '확인', exact: true }).click();
    await assertVisible(items.nth(1).getByText('아쉬워요 — 정답: だ', { exact: true }), 'incorrect fill result');

    await items.nth(2).getByRole('button', { name: 'です=과거, だ=현재', exact: true }).click();
    await assertVisible(items.nth(2).getByText(/아쉬워요 — 정답: です=정중/), 'incorrect choice result');

    await items.nth(3).getByRole('button', { name: 'がくせいです', exact: true }).click();
    await assertVisible(items.nth(3).getByText('정답이에요!', { exact: true }), 'correct choice result');

    await items.nth(4).getByRole('button', { name: 'あには', exact: true }).click();
    await items.nth(4).getByRole('button', { name: 'かいしゃいんです。', exact: true }).click();
    await items.nth(4).getByRole('button', { name: '확인', exact: true }).click();
    await assertVisible(items.nth(4).getByText('정답이에요!', { exact: true }), 'correct order result');

    const listen = items.nth(5);
    await listen.getByRole('button', { name: '발음 듣기', exact: true }).click();
    await listen.getByRole('button', { name: '처음 뵙겠습니다', exact: true }).click();
    await assertVisible(listen.getByText('들은 문장: はじめまして。', { exact: true }), 'listen transcript');
    await assertVisible(listen.getByText('정답이에요!', { exact: true }), 'correct listen result');

    await assertVisible(drills.getByText('6문항 중 4개 정답 — 틀린 문항은 위 문형 설명을 다시 보고 와요.', { exact: true }), 'drill summary');
    const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('manabi-drill-review-v1') || '[]'));
    assert.equal(queued.length, 6, 'all six guest drill results should enter the local review queue');

    // 게스트를 /review/grammar로 보내면 안 된다 — 그 페이지는 로그인 세션에서만 큐를 읽으므로
    // "복습 대기 N개"라고 해놓고 빈 화면이 나오는 막다른 길이 된다(이전 계약의 결함).
    // 게스트에겐 기록이 이 기기에 남았다는 사실만 알리고 그 자리에서 로그인을 권유해야 한다.
    const nudgeLink = drills.getByRole('link', { name: /로그인하면 며칠 뒤 복습 큐로 돌아와요/ });
    await assertVisible(nudgeLink, 'guest review nudge invites sign-in');
    assert.equal(
      await drills.getByRole('link', { name: /문법 복습/ }).count(),
      0,
      'guests must not be pointed at the signed-in-only review session',
    );
    await nudgeLink.click();
    await page.waitForURL('**/auth**', { timeout: config.timeout });
    await sampleHeap(page, 'six drills and review nudge');
  });
});

// 초안·체크리스트 저장이나 하이드레이션 복원이 깨지면 새로고침 뒤 써 보기 상태에서 잡는다.
test('writing: 초안과 체크리스트를 새로고침 뒤 복원하고 이어서 학습 카드를 최상단에 둔다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page) => {
    const chapterPath = '/french/grammar/a1-01-pronouns-etre';
    const draft = "Je m'appelle Mina. Je suis coréenne.";
    await openTrackChapter(page, {
      key: 'French',
      label: '프랑스어',
      level: 'A1',
      slug: 'a1-01-pronouns-etre',
      path: chapterPath,
    });
    await page.waitForFunction(() => localStorage.getItem('lessons_lang') === 'French');

    let writing = page.locator('section.card.fr-section').filter({
      has: page.getByRole('heading', { name: '써 보기 — 배운 문형으로 직접', exact: true }),
    });
    await assertVisible(writing, 'writing practice');
    await writing.getByPlaceholder('여기에 직접 써 보세요 — 이 기기에만 저장돼요.').fill(draft);
    assert.equal(
      await page.evaluate(() => localStorage.getItem('French_writing_a1-01-pronouns-etre')),
      draft,
    );
    await writing.getByRole('button', { name: '다 썼어요 — 모범답 보기', exact: true }).click();
    await assertVisible(writing.getByText("Je m'appelle Minji. Je suis coréenne.", { exact: false }), 'model answer');
    const beforeReload = writing.getByRole('checkbox');
    assert.equal(await beforeReload.count(), 3, 'the writing checklist should keep three checks');
    await beforeReload.nth(0).check();

    await page.reload({ waitUntil: 'domcontentloaded', timeout: config.timeout });
    writing = page.locator('section.card.fr-section').filter({
      has: page.getByRole('heading', { name: '써 보기 — 배운 문형으로 직접', exact: true }),
    });
    await assertVisible(writing, 'reloaded writing practice');
    // 저장분 복원은 hydration 안전을 위해 '마운트 후 useEffect'에서 일어난다(서버 렌더는 빈 상태).
    // 즉시 읽으면 복원 전 빈 값을 읽어 flaky해지므로 값이 들어올 때까지 기다린다.
    await page.waitForFunction(
      (expected) => [...document.querySelectorAll('textarea')]
        .some((el) => el.placeholder.startsWith('여기에 직접') && el.value === expected),
      draft,
      { timeout: config.timeout },
    );
    assert.equal(await writing.getByPlaceholder('여기에 직접 써 보세요 — 이 기기에만 저장돼요.').inputValue(), draft);
    await writing.getByRole('button', { name: '다 썼어요 — 모범답 보기', exact: true }).click();
    const restoredChecks = writing.getByRole('checkbox');
    // 체크리스트도 같은 이유로 복원을 기다린다.
    await page.waitForFunction(
      () => {
        const boxes = [...document.querySelectorAll('input[type="checkbox"]')];
        return boxes.length >= 3 && boxes[0].checked;
      },
      undefined,
      { timeout: config.timeout },
    );
    assert.equal(await restoredChecks.nth(0).isChecked(), true, 'the first checklist item should restore');
    await restoredChecks.nth(1).check();
    await restoredChecks.nth(2).check();
    await assertVisible(writing.getByText('점검 완료. 고친 문장으로 한 번 더 써 보면 완전히 내 것이 돼요.', { exact: true }), 'completed checklist');

    await page.goto('/lessons', { waitUntil: 'domcontentloaded', timeout: config.timeout });
    const continueCard = page.locator('button.lessons-continue');
    await assertVisible(continueCard, 'continue learning card');
    assert.match(await continueCard.innerText(), /이어서 학습/);
    const precedesFilters = await page.evaluate(() => {
      const card = document.querySelector('.lessons-continue');
      const filters = document.querySelector('.materials-filters');
      return Boolean(card && filters && (card.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    assert.equal(precedesFilters, true, 'the continue card should precede language and level filters');
    await continueCard.click();
    await page.waitForURL('**/french/grammar/**', { timeout: config.timeout });
    await sampleHeap(page, 'writing restore and continue card');
  });
});

// 인증 세션·DB upsert·캐시 재조회 중 하나가 끊기면 실재 어휘 저장부터 복습 카드 진입까지에서 잡는다.
test('authenticated vocab: 레퍼런스 단어 저장을 /vocab 새 단어 복습 큐에 반영한다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    const { session, storedWords, writes } = await mockAuthenticatedVocab(context);
    await page.goto('/french/vocab/a1', { waitUntil: 'domcontentloaded', timeout: config.timeout });
    await assertVisible(page.getByRole('heading', { name: 'A1 기초 어휘', exact: true }), 'French A1 vocabulary heading');

    const familyRow = page.locator('.fr-vrow').filter({
      has: page.getByText('la famille', { exact: true }),
    }).first();
    await assertVisible(familyRow, 'real French vocabulary row');
    const saveButton = familyRow.getByRole('button', { name: '단어장에 저장', exact: true });
    await page.waitForFunction(
      () => [...document.querySelectorAll('.fr-vrow')].some((row) => (
        row.textContent.includes('la famille')
        && row.querySelector('button[title="단어장에 저장 (FSRS 복습 시작)"]')
      )),
      undefined,
      { timeout: config.timeout },
    );
    await saveButton.click();
    await assertVisible(familyRow.getByRole('button', { name: '단어장에 저장됨', exact: true }), 'saved vocabulary state');

    assert.equal(writes.length, 1, 'the save action should issue one authenticated upsert');
    assert.equal(storedWords.length, 1, 'the mocked account should persist one vocabulary row');
    assert.deepEqual(
      {
        user_id: storedWords[0].user_id,
        word_text: storedWords[0].word_text,
        meaning: storedWords[0].meaning,
        language: storedWords[0].language,
        source_ref: storedWords[0].source_ref,
      },
      {
        user_id: session.user.id,
        word_text: 'la famille',
        meaning: '가족',
        language: 'French',
        source_ref: '프랑스어 · A1',
      },
    );

    await page.getByRole('link', { name: '복습', exact: true }).first().click();
    await page.waitForURL('**/vocab', { timeout: config.timeout });
    assert.equal(new URL(page.url()).pathname, '/vocab');
    await assertVisible(page.getByRole('heading', { name: '복습', exact: true }), 'vocabulary review heading');
    await assertVisible(page.getByRole('button', { name: 'la famille — 가족 상세 열기', exact: true }), 'saved word in vocabulary list');
    // 카드는 총계 하나만 말하고, 분해는 버튼 라벨이 대신한다 — 같은 수를 두 번 적지 않는다.
    await assertVisible(page.getByText('오늘 할 일', { exact: false }), 'todo kicker');
    assert.equal((await page.locator('.vocab-hero__num').textContent()).trim(), '1', 'hero total counts the one saved word');
    assert.equal(
      await page.getByText('복습 0', { exact: false }).count(),
      0,
      'a zero bucket must not be spelled out anywhere',
    );

    await page.getByRole('button', { name: '단어 1개 시작 →', exact: true }).click();
    // 진행은 카드 안 '남은 단어'에서 상단바 'n / m'으로 옮겼다 — 세션 화면은 문항만 남긴다.
    await assertVisible(page.getByRole('progressbar', { name: '복습 진행' }), 'session progress bar');
    await assertVisible(page.getByText('0 / 1', { exact: true }), 'one-word review queue');
    await assertVisible(page.getByRole('group', { name: '문맥에 맞는 뜻 고르기', exact: true }), 'saved word review card');
    await assertVisible(page.getByRole('button', { name: '가족', exact: true }), 'saved word review answer');
    await sampleHeap(page, 'authenticated vocabulary save and review queue');
  });
});

// 학습의 핵심 루프 — 드릴 채점이 SRS 정본(review_events + grammar_review)에 실제로 닿는지.
// 로컬 카운터만 늘고 서버 기록이 끊기면 기기를 바꾼 순간 학습 이력이 사라지는데, 화면에는
// 아무 표시도 나지 않는다. 그래서 "무엇을 어느 테이블에 썼는지"를 여기서 붙잡아 둔다.
test('authenticated drills: 드릴 채점이 review_events·grammar_review 정본에 기록된다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    const { session, writesByTable } = await mockAuthenticatedVocab(context);
    await mockTts(context);
    await page.goto('/japanese/grammar/n5-04-desu-da', { waitUntil: 'domcontentloaded', timeout: config.timeout });

    const drills = page.locator('section.card.fr-section').filter({
      has: page.getByRole('heading', { name: '변형 드릴 — 새 문장으로 손 풀기', exact: true }),
    });
    await assertVisible(drills, 'chapter drills');
    const items = drills.locator('ol > li');

    // 로그인 상태가 클라이언트에 반영된 뒤에 채점해야 정본 경로(서버)로 간다.
    await page.waitForFunction(
      () => document.cookie.includes('auth-token'),
      undefined,
      { timeout: config.timeout },
    );
    await items.nth(0).getByPlaceholder('정답 입력').fill('です');
    await items.nth(0).getByRole('button', { name: '확인', exact: true }).click();
    await assertVisible(items.nth(0).getByText('정답이에요!', { exact: true }), 'correct fill result');

    // 쓰기는 채점 직후 비동기로 나간다 — 도착할 때까지 조건 대기(고정 대기는 경합).
    const deadline = Date.now() + config.timeout;
    while (!(writesByTable.review_events || []).length && Date.now() < deadline) {
      await page.waitForTimeout(150);
    }

    const events = writesByTable.review_events || [];
    assert.ok(events.length >= 1, 'grading a drill must log a review event to the server');
    assert.equal(events[0].user_id, session.user.id, 'the event belongs to the signed-in learner');
    assert.equal(events[0].source, 'grammar', 'drill events are recorded under the grammar source');
    assert.equal(events[0].correct, true, 'the correct answer is recorded as correct');

    // 게스트 로컬 카운터는 로그인 사용자에게 쓰이면 안 된다(이중 집계 방지 계약).
    const guestQueue = await page.evaluate(
      () => JSON.parse(localStorage.getItem('manabi-drill-review-v1') || '[]'),
    );
    assert.equal(guestQueue.length, 0, 'signed-in grading must not also write the guest queue');
    await sampleHeap(page, 'authenticated drill grading reaches the SRS tables');
  });
});

// 비로그인 복습 — 기기 큐로 세션이 실제로 돌아가는지. 문항 조립은 /api/review/drills(서버)가 한다.
// 이게 끊기면 게스트는 드릴을 아무리 풀어도 복습을 못 하고, 화면에는 아무 에러도 안 뜬다.
test('guest review: 기기 큐로 복습 세션을 열고 채점이 카드를 전진시킨다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    await mockTts(context);
    await page.goto('/japanese/grammar/n5-04-desu-da', { waitUntil: 'domcontentloaded', timeout: config.timeout });

    const drills = page.locator('section.card.fr-section').filter({
      has: page.getByRole('heading', { name: '변형 드릴 — 새 문장으로 손 풀기', exact: true }),
    });
    await assertVisible(drills, 'chapter drills');
    await drills.locator('ol > li').nth(3).getByRole('button', { name: 'がくせいです', exact: true }).click();
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('manabi-drill-review-v1') || '[]').length > 0,
      undefined,
      { timeout: config.timeout },
    );

    // 방금 푼 카드는 미래 due라 당장은 안 잡힌다 — 복습 시점이 된 상황으로 당긴다.
    const before = await page.evaluate(() => {
      const rows = JSON.parse(localStorage.getItem('manabi-drill-review-v1') || '[]');
      rows.forEach((row) => { row.next_review_at = '2000-01-01T00:00:00.000Z'; });
      localStorage.setItem('manabi-drill-review-v1', JSON.stringify(rows));
      return rows[0];
    });
    assert.ok(before.slug.startsWith('drill:'), 'the guest queue stores drill cards by drill id');

    await page.goto('/review/grammar', { waitUntil: 'domcontentloaded', timeout: config.timeout });
    await assertVisible(page.getByText('이 기기에 쌓인 복습이에요.'), 'guest review notice');
    const choice = page.getByRole('button', { name: 'がくせいです', exact: true });
    await assertVisible(choice, 'review question rebuilt from the drill id');
    await choice.click();

    // 채점이 반영되면 카드의 다음 복습일이 미래로 간다(안 그러면 영원히 due로 남는다).
    await page.waitForFunction(
      () => {
        const rows = JSON.parse(localStorage.getItem('manabi-drill-review-v1') || '[]');
        return rows[0] && rows[0].next_review_at > '2000-01-01T00:00:00.000Z';
      },
      undefined,
      { timeout: config.timeout },
    );
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('manabi-drill-review-v1'))[0]);
    assert.ok(after.next_review_at > before.next_review_at, 'grading must advance the guest card');
    assert.equal(after.slug, before.slug, 'grading advances the same card instead of adding one');
    await sampleHeap(page, 'guest review session from the device queue');
  });
});

// 게스트로 쌓은 복습이 로그인과 함께 사라지면 안 된다. 이 이관이 끊겨도 화면엔 아무 표시가 없다.
test('queue migration: 로그인하면 기기 복습 큐가 서버로 옮겨진다', { timeout: config.timeout * 2 }, async () => {
  await runInFreshPage(async (page, context) => {
    const { session, writesByTable } = await mockAuthenticatedVocab(context);

    // 로그인 전에 기기 큐가 있던 상황을 만든다(게스트로 드릴을 풀어 둔 상태).
    await context.addInitScript(() => {
      if (localStorage.getItem('manabi-drill-review-v1')) return;
      localStorage.setItem('manabi-drill-review-v1', JSON.stringify([{
        user_id: 'guest',
        lang: 'Japanese',
        slug: 'drill:ja-n504-d4',
        interval: 3,
        ease_factor: 5,
        repetitions: 0,
        next_review_at: '2026-09-01T00:00:00.000Z',
        last_reviewed_at: '2026-08-08T00:00:00.000Z',
      }]));
    });

    await page.goto('/lessons', { waitUntil: 'domcontentloaded', timeout: config.timeout });

    // 이관은 로그인 인지 직후 비동기로 나간다 — 도착할 때까지 조건 대기.
    const deadline = Date.now() + config.timeout;
    while (!(writesByTable.grammar_review || []).length && Date.now() < deadline) {
      await page.waitForTimeout(150);
    }

    const migrated = writesByTable.grammar_review || [];
    assert.equal(migrated.length, 1, 'the device queue card must be written to the server');
    assert.equal(migrated[0].user_id, session.user.id, 'the card is claimed by the signed-in learner');
    assert.equal(migrated[0].slug, 'drill:ja-n504-d4', 'the drill card keeps its identity');
    assert.equal(migrated[0].interval, 3, 'the FSRS state carries over instead of restarting');

    // 서버가 정본이 됐으니 기기 큐는 비워야 한다 — 안 그러면 다음 로그인마다 다시 쓴다.
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('manabi-drill-review-v1') || '[]').length === 0,
      undefined,
      { timeout: config.timeout },
    );
    await sampleHeap(page, 'guest queue migration on sign-in');
  });
});

// 동적 slug 폴백이 되살아나 soft 404가 생기면 실제 HTTP 상태와 전용 404 화면에서 잡는다.
test('chapter 404: 매니페스트에 없는 slug는 HTTP 404로 응답한다', { timeout: config.timeout }, async () => {
  await runInFreshPage(async (page) => {
    const response = await page.goto('/japanese/grammar/n5-e2e-missing-slug', {
      waitUntil: 'domcontentloaded',
      timeout: config.timeout,
    });
    assert.ok(response, 'the direct navigation should return a document response');
    assert.equal(response.status(), 404, `missing chapter returned ${response.status()}\n${serverOutput}`);
    await assertVisible(page.getByRole('heading', { name: '404', exact: true }), 'not-found heading');
    await assertVisible(page.getByRole('heading', { name: '길을 잃으셨군요', exact: true }), 'not-found guidance');
    await sampleHeap(page, 'hard 404');
  }, { allowErrors: [/Failed to load resource: the server responded with a status of 404/] });
});
