// Existing real-app fixture, with held responses. No live account, provider or database.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fixture } from './fixtures/material-editing-backend.mjs';

const owner = '00000000-0000-4000-8000-000000000172';
const held = () => { let release; const wait = new Promise(resolve => { release = resolve; }); return { wait, release }; };
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const respond = (r, value, status = 200) => r.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(value) });
const word = (text, i) => ({ id: `word-${i}`, user_id: owner, word_text: text, base_form: text, meaning: text === '猫' ? '고양이' : '개', language: 'Japanese', interval: 2, ease_factor: 5, repetitions: 1, next_review_at: '2020-01-01T00:00:00Z', last_reviewed_at: null });
async function waitUntil(check) {
  const deadline = Date.now() + 3000;
  while (!check() && Date.now() < deadline) await delay(10);
  assert.ok(check(), 'expected request reached the held fixture');
}

async function setup({ due = false, fail = false, failInsert = false, width = 1440 } = {}) {
  const f = await fixture({ width });
  const primary = held(), auxiliary = held(), review = held();
  const rows = due ? [word('猫', 1), word('犬', 2)] : [];
  const posts = [], reviews = [], speech = [];
  let auxiliaryStarted = false;
  f.rows.push({ id: 94101, user_id: owner, title: '응답 검수 자료', raw_text: '猫 犬', source_type: 'text', created_at: new Date().toISOString(),
    processed_json: { status: 'completed', metadata: { language: 'Japanese' }, sequence: ['id_0_0', 'id_0_1'],
      dictionary: { id_0_0: { text: '猫', base_form: '猫', furigana: 'ねこ', meaning: '고양이', pos: '명사' }, id_0_1: { text: '犬', base_form: '犬', furigana: 'いぬ', meaning: '개', pos: '명사' } } } });
  await f.context.addInitScript(({ fail }) => {
    localStorage.setItem('viewer_preferences_v2', JSON.stringify({ version: 2, languages: {
      Japanese: { autoSpeakOnClick: true, wordStateHl: true },
    } }));
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ lang: 'ja-JP', voiceURI: 'fixture-ja', localService: true }],
      addEventListener() {}, removeEventListener() {}, cancel() {},
      speak(u) { (window.fixtureSpeech ||= []).push({ text: u.text, at: performance.now() }); },
    } });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    if (fail) Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open() { throw new Error('fixture queue unavailable'); } } });
  }, { fail });
  await f.context.route('**/api/tts?**', r => { speech.push(r.request().url()); return respond(r, { error: 'No server speech for immediate words' }, 500); });
  await f.context.route('**/api/dict?**', r => respond(r, null));
  await f.context.route('**/api/learning/vocabulary', async r => { auxiliaryStarted = true; await auxiliary.wait; return respond(r, { contextAdded: true }); });
  await f.context.route('**/rest/v1/user_vocabulary*', async r => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (req.method() === 'POST') {
      const payload = req.postDataJSON(); const row = Array.isArray(payload) ? payload[0] : payload;
      posts.push(row); await primary.wait;
      if (failInsert) return respond(r, { message: 'fixture INSERT unavailable' }, 503);
      const saved = { ...row, id: `saved-${posts.indexOf(row)}` }; rows.push(saved);
      return respond(r, [saved]);
    }
    if (req.method() === 'PATCH') {
      await review.wait;
      if (fail) return respond(r, { message: 'fixture SRS unavailable' }, 503);
      const id = new URL(req.url()).searchParams.get('id')?.replace('eq.', '');
      const target = rows.find(w => w.id === id); if (target) Object.assign(target, req.postDataJSON());
    }
    return respond(r, rows);
  });
  await f.context.route('**/rest/v1/review_events*', async r => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (r.request().method() !== 'POST') return respond(r, []);
    reviews.push(r.request().postDataJSON()); await review.wait;
    return respond(r, fail ? { message: 'fixture review unavailable' } : [], fail ? 503 : 200);
  });
  await f.page.goto('/viewer/94101', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await f.page.locator('[data-source-token="id_0_0"]').waitFor();
  const select = async index => {
    await f.page.locator(`[data-source-token="id_0_${index}"]`).click();
    await f.page.locator('.reader-card-actions').filter({ visible: true }).first().waitFor();
  };
  const actions = f.page.locator('.reader-card-actions').filter({ visible: true }).first();
  return { ...f, primary, auxiliary, review, rows, posts, reviews, speech, select, actions, get auxiliaryStarted() { return auxiliaryStarted; } };
}

test('new grades react before held INSERT, next word is usable, and saved membership precedes slow context/undo', async () => {
  const f = await setup({ width: 390 });
  try {
    await f.select(0);
    await f.actions.getByRole('button', { name: /^쉬움/ }).click();
    await f.actions.getByRole('button', { name: '저장 중…', exact: true }).waitFor({ timeout: 750 });
    if (process.env.COMPOSER_SCREENSHOTS) await f.page.screenshot({ path: `${process.env.COMPOSER_SCREENSHOTS}/new-pending-390.png`, fullPage: true });
    await f.page.keyboard.press('4');
    await f.select(1);
    await f.actions.getByRole('button', { name: /^알맞음/ }).click();
    await f.actions.getByRole('button', { name: '저장 중…', exact: true }).waitFor({ timeout: 750 });
    await waitUntil(() => f.posts.length === 2);
    assert.equal(f.posts.length, 2, 'different words may save concurrently; duplicate rating is ignored');
    f.primary.release();
    await f.actions.getByRole('button', { name: '✓ 단어장에 있음', exact: true }).waitFor({ timeout: 3000 });
    if (process.env.COMPOSER_SCREENSHOTS) await f.page.screenshot({ path: `${process.env.COMPOSER_SCREENSHOTS}/new-confirmed-390.png`, fullPage: true });
    await waitUntil(() => f.auxiliaryStarted);
    assert.ok(await f.page.locator('[data-source-token="id_0_1"]').evaluate(el => el.classList.contains('word-token--saved')));
    f.auxiliary.release();
    await f.page.waitForTimeout(200);
    assert.deepEqual(f.errors, []);
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  } finally { f.primary.release(); f.auxiliary.release(); f.review.release(); await f.context.close(); }
});

test('inline grades react before held remote write, another due word is usable, and failure restores grades', async () => {
  const f = await setup({ due: true, fail: true });
  try {
    await f.select(0);
    await f.actions.getByRole('button', { name: /^쉬움/ }).click();
    await f.actions.getByRole('button', { name: '저장 중…', exact: true }).waitFor({ timeout: 750 });
    if (process.env.COMPOSER_SCREENSHOTS) await f.page.screenshot({ path: `${process.env.COMPOSER_SCREENSHOTS}/inline-pending-1440.png`, fullPage: true });
    assert.equal(await f.page.locator('[data-source-token="id_0_0"]').evaluate(el => el.classList.contains('word-token--due')), false);
    await f.select(1);
    await f.actions.getByRole('button', { name: /^알맞음/ }).click();
    await f.actions.getByRole('button', { name: '저장 중…', exact: true }).waitFor({ timeout: 750 });
    await waitUntil(() => f.reviews.length === 2);
    f.review.release();
    await f.actions.getByRole('button', { name: /^알맞음/ }).waitFor({ timeout: 5000 });
    assert.equal(await f.page.locator('[data-source-token="id_0_1"]').evaluate(el => el.classList.contains('word-token--due')), true);
    await f.select(0);
    await f.actions.getByRole('button', { name: /^쉬움/ }).waitFor();
    assert.equal(f.rows[0].next_review_at, '2020-01-01T00:00:00Z');
    assert.deepEqual(f.errors, []);
  } finally { f.primary.release(); f.auxiliary.release(); f.review.release(); await f.context.close(); }
});

test('click and explicit pronunciation enqueue native speech without calling the audio server', async () => {
  const f = await setup();
  try {
    await f.select(0);
    await f.page.waitForFunction(() => window.fixtureSpeech?.length === 1, null, { timeout: 750 });
    const play = f.page.getByRole('button', { name: '발음 듣기', exact: true }).filter({ visible: true }).first();
    await play.click();
    await f.page.waitForFunction(() => window.fixtureSpeech?.length === 2, null, { timeout: 750 });
    assert.equal(f.speech.length, 0);
    assert.equal(await f.page.evaluate(() => window.fixtureSpeech.at(-1).text), '猫');
    assert.deepEqual(f.errors, []);
  } finally { f.primary.release(); f.auxiliary.release(); f.review.release(); await f.context.close(); }
});

test('failed new INSERT restores four grades without inventing a saved word or context', async () => {
  const f = await setup({ failInsert: true });
  try {
    await f.select(0);
    await f.actions.getByRole('button', { name: /^어려움/ }).click();
    await f.actions.getByRole('button', { name: '저장 중…', exact: true }).waitFor({ timeout: 750 });
    await waitUntil(() => f.posts.length === 1);
    f.primary.release();
    await f.actions.getByRole('button', { name: /^어려움/ }).waitFor({ timeout: 3000 });
    assert.equal(f.rows.length, 0);
    assert.equal(f.auxiliaryStarted, false);
    assert.equal(await f.page.locator('[data-source-token="id_0_0"]').evaluate(el => el.classList.contains('word-token--saved')), false);
    assert.deepEqual(f.errors, []);
  } finally { f.primary.release(); f.auxiliary.release(); f.review.release(); await f.context.close(); }
});

test('concurrent successful inline grades retain both schedules and personal meanings after reconnect', async () => {
  const f = await setup({ due: true });
  try {
    await f.select(0);
    await f.actions.getByRole('button', { name: /^쉬움/ }).click();
    await f.actions.getByRole('button', { name: '저장 중…', exact: true }).waitFor({ timeout: 750 });
    await f.select(1);
    await f.actions.getByRole('button', { name: /^알맞음/ }).click();
    await waitUntil(() => f.reviews.length === 2);
    f.review.release();
    await f.actions.getByRole('button', { name: '✓ 단어장에 있음', exact: true }).waitFor({ timeout: 5000 });
    await waitUntil(() => f.rows.every(row => row.last_reviewed_at));
    assert.deepEqual(f.rows.map(row => row.meaning), ['고양이', '개']);
    assert.ok(f.rows.every(row => new Date(row.next_review_at) > new Date()));
    await f.page.reload({ waitUntil: 'domcontentloaded' });
    await f.select(0);
    await f.actions.getByRole('button', { name: '✓ 단어장에 있음', exact: true }).waitFor();
    await f.select(1);
    await f.actions.getByRole('button', { name: '✓ 단어장에 있음', exact: true }).waitFor();
    assert.equal(f.reviews.length, 2);
    assert.deepEqual(f.errors, []);
  } finally { f.primary.release(); f.auxiliary.release(); f.review.release(); await f.context.close(); }
});
