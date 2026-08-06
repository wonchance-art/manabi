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

    const reviewLink = drills.getByRole('link', { name: /문법 복습/ });
    await assertVisible(reviewLink, 'review nudge link');
    await reviewLink.click();
    await page.waitForURL('**/review/grammar', { timeout: config.timeout });
    await assertVisible(page.getByRole('heading', { name: '문법 복습', exact: true }), 'grammar review page');
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
