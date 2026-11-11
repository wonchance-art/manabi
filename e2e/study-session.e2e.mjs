// STUDY-FIXTURE-001 — /study 일일 세션 한 바퀴: 열기 → 답 1개 → 채점 표시 → 다음 문항(2026-11-08 KST).
// 새 고정물을 만들지 않는다 — 화면 벽 환경(scripts/wall-capture.mjs startWallEnv)이 합성 무거운 계정 백엔드(e2e/fixtures/heavy-account.mjs)와
// server-fetch-mock을 단 next start를 띄우고, 서버의 세션 조립(assembleStudyMaterials → fsrs_vocabulary_snapshot_light 등)이 그 백엔드를 읽는다.
// 운영 DB · 실계정 · LLM과 무관하다(문단 생성 /api/study-paragraph는 키가 없어 실패하지만 세션은 그대로 진행한다 — 그 실패는 단언하지 않는다).
// 응답 모양 계약: src/lib/__tests__/studyFixtureContract.test.js. 빌드: CI의 npm run e2e:build(또는 npm run wall:build) 뒤에.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { startWallEnv } from '../scripts/wall-capture.mjs';

let env;
before(async () => { env = await startWallEnv({ out: await mkdtemp(join(tmpdir(), 'study-session-')), port: Number(process.env.STUDY_E2E_PORT || 3172) }); });
after(async () => { await env?.close(); });

// 진행 「완료/전체」 — 전체는 고정하지 않는다: 문단 생성(/api/study-paragraph)이 실패하면 그 문단 문항이 세션에서 빠져 분모가 줄어든다(0/9 → 1/7 실측).
// 문단을 만드는 동안 몸풀기 구간은 「몸풀기 완료/몸풀기 수」로 읽힌다(STUDY-DENOM-001 A안 — 분모가 몸풀기 도중에 바뀌지 않게).
// 고정하는 기대값은 「답한 수」다.
const progressOf = async (page) => page.getByRole('progressbar', { name: '세션 진행' }).getAttribute('aria-valuetext');
const doneOf = async (page) => { const m = /^(?:몸풀기 )?(\d+)\/(\d+)$/.exec(await progressOf(page)); assert.ok(m && Number(m[2]) >= 1, `progress reads done/total: ${await progressOf(page)}`); return Number(m[1]); };

test('/study: 세션을 열고 답 하나를 내면 채점이 보이고 다음 문항으로 넘어간다', async () => {
  const context = await env.newContext({ persona: 'filled', viewportKey: 'mobile' });
  try {
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error.message).slice(0, 160)));
    const reviewWrites = [];
    page.on('request', (request) => { if (request.method() === 'POST' && /\/rest\/v1\/review_events/.test(request.url())) reviewWrites.push(request.url()); });

    const response = await page.goto(`${env.baseURL}/study`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert.equal(response.status(), 200);
    const options = page.locator('.fr-quiz__opt');
    await options.first().waitFor({ timeout: 60000 });

    // 열림: 답한 수 0 · 문항 머리 · 보기 넷 · 모두 누를 수 있음
    assert.equal(await doneOf(page), 0, 'progress starts at 0 answered');
    const firstHead = (await page.locator('[data-item-head]').first().innerText()).trim();
    assert.ok(firstHead.length > 0, 'item head is drawn');
    assert.equal(await options.count(), 4, 'four choices');
    for (const option of await options.all()) assert.equal(await option.isDisabled(), false);

    // 답 하나: 첫 보기를 누른다(맞든 틀리든 채점이 보여야 한다). 기록 응답 대기는 누르기 전에 건다 — 누른 뒤에 걸면 이미 끝난 응답을 30초 기다린다
    // (반복 10회 중 4회 실측).
    const recorded = page.waitForResponse((r) => /\/rest\/v1\/review_events/.test(r.url()) && r.request().method() === 'POST');
    await options.first().click();
    const next = page.getByRole('button', { name: /^(계속|결과 보기) →$/ });
    await next.waitFor();
    assert.equal(await page.locator('.fr-quiz__opt.is-correct').count(), 1, 'exactly one choice is marked correct');
    for (const option of await options.all()) assert.equal(await option.isDisabled(), true, 'choices lock after answering');
    const picked = await options.first().getAttribute('class');
    assert.match(picked, /\bis-(correct|wrong)\b/, 'the picked choice shows its grade');
    assert.equal(await doneOf(page), 1, 'progress counts the answer');
    // 채점 결과는 화면 읽기에도 한 줄(A11Y-AUTH-001) — 보기 색과 같은 판정이어야 한다
    const announced = (await page.locator('[data-settle-announce]').innerText()).trim();
    assert.match(announced, /^(정답이에요\.|틀렸어요\.( 정답: .+)?)$/, `settle announcement: ${announced}`);
    assert.equal(announced.startsWith('정답'), /\bis-correct\b/.test(picked), 'announcement agrees with the picked choice grade');
    await recorded;
    assert.ok(reviewWrites.length >= 1, 'the answer is recorded as a review event');

    // 다음 문항: 다른 머리 · 보기가 다시 열린다 · 진행은 그대로 1/N
    await next.click();
    await page.waitForFunction((prev) => {
      const head = document.querySelector('[data-item-head]');
      return head && head.textContent.trim() && head.textContent.trim() !== prev;
    }, firstHead);
    await options.first().waitFor();
    for (const option of await options.all()) assert.equal(await option.isDisabled(), false, 'next item choices are open');
    assert.equal(await page.locator('.fr-quiz__opt.is-correct, .fr-quiz__opt.is-wrong').count(), 0, 'no grade marks carried over');
    assert.equal(await doneOf(page), 1, 'moving on does not count another answer');
    assert.deepEqual(pageErrors, []);
  } finally { await context.close(); }
});
