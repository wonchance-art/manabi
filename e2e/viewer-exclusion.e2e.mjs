// Same maintained local app fixture. No live credentials, DB, speech provider or accounts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fixture } from './fixtures/material-editing-backend.mjs';
const owner = '00000000-0000-4000-8000-000000000172';
const cardId = '10000000-0000-4000-8000-000000000001';
const entryId = '20000000-0000-4000-8000-000000000001';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (r, data, status = 200) => r.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) });
async function setup({ width = 1440, saved = false, due = true } = {}) {
 const f = await fixture({ width });
 const words = saved ? [{ id: cardId, user_id: owner, word_text: '猫', base_form: '猫', meaning: '내 고양이 뜻', language: 'Japanese', interval: 15, ease_factor: 3.2, repetitions: 8, next_review_at: due ? '2020-01-01T00:00:00Z' : '2099-01-01T00:00:00Z', last_reviewed_at: '2019-01-01T00:00:00Z', source_sentence: '猫 犬', source_material_id: 94101 }] : [];
 const exclusions = [], writes = [], grades = [];
 let failNext = false, release = null, wait = null;
 f.rows.push({ id: 94101, user_id: owner, owner_id: owner, title: '제외 검수 자료', raw_text: '猫 犬', source_type: 'text', created_at: new Date().toISOString(),
 processed_json: { status: 'completed', metadata: { language: 'Japanese' }, sequence: ['id_0_0', 'id_0_1'], dictionary: {
 id_0_0: { text: '猫', base_form: '猫', furigana: 'ねこ', meaning: '고양이', pos: '명사' }, id_0_1: { text: '犬', base_form: '犬', furigana: 'いぬ', meaning: '개', pos: '명사' } } } });
 await f.context.addInitScript(() => {
  localStorage.setItem('viewer_preferences_v2', JSON.stringify({ version: 2, languages: { Japanese: { autoSpeakOnClick: true, wordStateHl: true } } }));
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'ja-JP', voiceURI: 'fixture-ja', localService: true }], addEventListener() {}, removeEventListener() {}, cancel() {}, speak(u) { (window.fixtureSpeech ||= []).push(u.text); } } });
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
 });
 await f.context.route('**/api/tts?**', r => json(r, { error: 'fixture native speech' }, 500));
 await f.context.route('**/api/dict?**', r => json(r, null));
 await f.context.route('**/api/learning/exclusions', async r => {
  if (r.request().method() === 'GET') return json(r, { items: exclusions });
  const body = r.request().postDataJSON(); writes.push(body); if (wait) await wait;
  if (failNext) { failNext = false; return json(r, { error: 'fixture write failure' }, 503); }
  let entry = exclusions.find(e => e.id === body.exclusionId || (body.vocabularyId && e.vocabulary_id === body.vocabularyId));
  if (body.excluded) { entry ||= { id: entryId, language: 'Japanese', word_text: body.tokenId === 'id_0_1' ? '犬' : '猫', vocabulary_id: body.vocabularyId || null }; if (!exclusions.includes(entry)) exclusions.push(entry); }
  else { const i = exclusions.indexOf(entry); if (i >= 0) exclusions.splice(i, 1); }
  return json(r, { excluded: body.excluded, entry });
 });
 const vocabRows = () => words.map(w => ({ ...w, is_excluded: exclusions.some(e => e.vocabulary_id === w.id || (e.word_text === w.base_form && e.language === w.language)) }));
 await f.context.route('**/rest/v1/vocabulary_with_exclusions*', r => json(r, vocabRows()));
 await f.context.route('**/rest/v1/active_vocabulary*', r => json(r, vocabRows().filter(w => !w.is_excluded)));
 for (const table of ['user_vocabulary', 'review_events']) await f.context.route(`**/rest/v1/${table}*`, r => {
  if (['POST', 'PATCH'].includes(r.request().method())) grades.push({ table, body: r.request().postDataJSON() });
  return json(r, table === 'user_vocabulary' ? words : []);
 });
 await f.page.goto('/viewer/94101', { waitUntil: 'domcontentloaded', timeout: 120000 });
 await f.page.locator('[data-source-token="id_0_0"]').waitFor();
 const select = async i => { await f.page.locator(`[data-source-token="id_0_${i}"]`).click(); await f.page.locator('.reader-card-actions').filter({ visible: true }).first().waitFor(); };
 const actions = f.page.locator('.reader-card-actions').filter({ visible: true }).first();
 const toggle = name => actions.getByRole('button', { name, exact: true });
 const gradesUI = actions.locator('.review-score-btn');
 return { ...f, words, exclusions, writes, grades, select, actions, toggle, gradesUI,
  fail: () => { failNext = true; }, hold: () => { wait = new Promise(resolve => { release = resolve; }); }, release: () => { release?.(); wait = null; } };
}
for (const width of [320, 390, 1440]) test(`미저장 제외/재접속/목록 해제와 4칸·발음 보존 ${width}px`, async () => {
 const f = await setup({ width });
 try {
  await f.select(0); await f.toggle('제외').click(); await f.toggle('제외 해제').waitFor();
  assert.equal(await f.gradesUI.count(), 4);
  for (const b of await f.gradesUI.all()) assert.equal(await b.isDisabled(), true);
  for (const key of ['1', '2', '3', '4']) await f.page.keyboard.press(key);
  assert.equal(f.grades.length, 0); assert.equal(f.words.length, 0);
  const header = await f.actions.locator('.save-grade__header').boundingBox();
  const button = await f.toggle('제외 해제').boundingBox();
  assert.ok(button.x >= header.x + header.width / 2 && button.x + button.width <= header.x + header.width + 1);
  assert.ok((await f.page.evaluate(() => window.fixtureSpeech)).includes('ねこ'));
  assert.equal(await f.page.locator('[data-source-token="id_0_0"]').textContent(), '猫');
  if (process.env.COMPOSER_SCREENSHOTS) await f.page.screenshot({ path: `${process.env.COMPOSER_SCREENSHOTS}/excluded-${width}.png`, fullPage: true });
  await f.page.reload({ waitUntil: 'domcontentloaded' }); await f.select(0); await f.toggle('제외 해제').waitFor();
  await f.page.goto('/vocab', { waitUntil: 'domcontentloaded' });
  const list = f.page.locator('.vocabulary-exclusions').filter({ visible: true }).first();
  await list.locator('summary').click(); await list.getByRole('button', { name: '제외 해제', exact: true }).click();
  await list.waitFor({ state: 'detached' });
  assert.equal(f.exclusions.length, 0); assert.equal(f.words.length, 0); assert.equal(f.grades.length, 0);
  await f.page.goto('/viewer/94101', { waitUntil: 'domcontentloaded' }); await f.select(0);
  assert.equal(await f.gradesUI.count(), 4); for (const b of await f.gradesUI.all()) assert.equal(await b.isEnabled(), true);
  assert.deepEqual(f.errors, []);
 } finally { await f.context.close(); }
});
for (const due of [true, false]) test(`저장 ${due ? '도래' : '미도래'} 카드 제외/해제의 뜻·출처·일정 보존`, async () => {
 const f = await setup({ saved: true, due }); const before = structuredClone(f.words);
 try {
  await f.select(0); await f.toggle('제외').click(); await f.toggle('제외 해제').waitFor();
  assert.equal(await f.gradesUI.count(), 4); for (const b of await f.gradesUI.all()) assert.equal(await b.isDisabled(), true);
  assert.deepEqual(f.words, before); assert.equal(f.grades.length, 0);
  await f.toggle('제외 해제').click(); await f.toggle('제외').waitFor();
  assert.deepEqual(f.words, before); assert.equal(f.grades.length, 0);
  assert.equal(f.writes[0].vocabularyId, cardId); assert.equal(f.writes[0].accountId, owner);
  assert.deepEqual(f.errors, []);
 } finally { await f.context.close(); }
});
test('실패/중복/이동 뒤 늦은 제외 응답은 현재 단어를 바꾸지 않는다', async () => {
 const f = await setup({ width: 390 });
 try {
  await f.select(0); f.fail(); await f.toggle('제외').click();
  await f.page.getByText('fixture write failure', { exact: true }).waitFor();
  assert.equal(f.exclusions.length, 0); assert.equal(await f.gradesUI.first().isEnabled(), true);
  f.hold(); await f.toggle('제외').click(); await delay(100);
  assert.equal(await f.toggle('제외').isDisabled(), true);
  await f.select(1); f.release(); await delay(400);
  assert.equal(await f.toggle('제외').isEnabled(), true); assert.equal(await f.gradesUI.first().isEnabled(), true);
  await f.select(0); await f.toggle('제외 해제').waitFor(); assert.equal(await f.gradesUI.first().isDisabled(), true);
  assert.equal(f.writes.length, 2); assert.equal(f.grades.length, 0); assert.deepEqual(f.errors, []);
 } finally { f.release(); await f.context.close(); }
});
