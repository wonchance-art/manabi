// Actual local Next UI and route handlers with synthetic identity + in-memory database.
// This fixture does not prove hosted authentication, PostgreSQL RLS, or deployed publication.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { fixtureSession } from './fixtures/n5-revision-backend.mjs';
import { learningDay } from '../src/lib/fsrsScheduler.js';
import { compactVocabularySnapshot } from '../src/lib/vocabularySnapshotLight.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const base = process.env.QA_BASE || 'http://localhost:49011';
const backendPort = Number(process.env.QA_BACKEND_PORT || 49012);
const backendOrigin = `http://127.0.0.1:${backendPort}`;
const out = process.env.QA_OUT || '/workspace/scratch/n4-integration/team/browser';
const uid = '00000000-0000-4000-8000-000000000042';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Synthetic authentication is restricted to loopback');
fs.mkdirSync(out, { recursive: true });

function bundles() {
  const root = path.join(repo, 'src/content/textbookEditions');
  return fs.readdirSync(root).flatMap(dir => {
    const file = path.join(root, dir, 'bundle.json');
    return fs.existsSync(file) ? [JSON.parse(fs.readFileSync(file, 'utf8'))] : [];
  });
}
function bookOf(bundle) { return bundle.bookId || bundle.manuscript?.bookId || bundle.manuscript?.id || 'japanese-n5'; }
function latest(bookId) {
  const indexPath = path.join(repo, 'src/content/textbookEditions', ...(bookId === 'japanese-n5' ? [] : [bookId]), 'index.json');
  const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : null;
  const all = bundles().filter(bundle => bookOf(bundle) === bookId);
  return all.find(bundle => bundle.editionId === index?.current) || all.at(-1);
}
function publishedRow(bundle) {
  return bundle && { book_id: bookOf(bundle), edition_id: bundle.editionId, content_hash: bundle.contentHash,
    manuscript: bundle.manuscript, artifact_manifest: bundle.artifactManifest, published_at: '2026-10-17T00:00:00Z' };
}

export function createN4Fixture() {
  const state = { words: [], contexts: [], writes: [], reads: [], admitted: [], scopeFail: false, scopeEmpty: false, readingFail: false };
  const reset = () => Object.assign(state, { words: [], contexts: [], writes: [], reads: [], admitted: [], scopeFail: false, scopeEmpty: false, readingFail: false });
  const quota = () => {
    const now = new Date().toISOString(), used = state.admitted.length;
    return { version: 1, actorId: uid, installed: true, enabled: true, active: true, fsrsEnabled: true,
      startsAt: '2026-01-01T19:00:00.000Z', now, learningDay: new Date(learningDay(now) * 86400000).toISOString().slice(0, 10),
      timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 1, used, remaining: 15 - used,
      fsrsUsed: 0, legacyUsed: used, admittedLegacyCardIds: [...state.admitted] };
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, backendOrigin), table = url.pathname.split('/').at(-1);
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*',
      'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' };
    const send = (data, status = 200) => { res.writeHead(status, headers); res.end(JSON.stringify(data)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, headers); return res.end(); }
    let body;
    if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
      let raw = ''; for await (const chunk of req) raw += chunk;
      body = raw ? JSON.parse(raw) : null;
    }
    if (url.pathname === '/__qa/reset') { reset(); return send({ ok: true }); }
    if (url.pathname === '/__qa/control') {
      for (const key of ['scopeFail', 'scopeEmpty', 'readingFail']) if (typeof body?.[key] === 'boolean') state[key] = body[key];
      return send({ ok: true });
    }
    if (url.pathname === '/__qa/state') return send(state);
    if (url.pathname === '/__qa/catalog') return send({ n4: latest('japanese-n4')?.editionId, n5: latest('japanese-n5')?.editionId });
    let claims = null;
    try { claims = JSON.parse(Buffer.from((req.headers.authorization || '').split('.')[1], 'base64url')); } catch { /* anonymous */ }
    if (url.pathname.startsWith('/auth/v1/')) {
      if (!claims?.sub) return send({ message: 'No synthetic session' }, 401);
      return send({ id: uid, email: 'n4-fixture@example.invalid', email_confirmed_at: '2026-10-17T00:00:00Z',
        aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { name: '합성 N4 학습자' } });
    }
    if (['POST', 'PATCH', 'DELETE'].includes(req.method)) state.writes.push({ table, method: req.method, body,
      target: url.searchParams.get('id')?.replace(/^eq\./, '') });
    state.reads.push({ table, method: req.method, params: Object.fromEntries(url.searchParams) });
    if (table === 'is_admin') return send(claims?.e2e_role === 'admin');
    if (table === 'fsrs_capabilities') return send({ version: 1, enabled: true, policyVersion: 'anki-v2' });
    // 가벼운 읽기(SNAPSHOT-LIGHT-001 — 요약 조회 · 복습방 첫 숫자 · /study)는 같은 snapshot을 기준 구현으로 줄여 돌려준다.
    if (table === 'fsrs_vocabulary_snapshot' || table === 'fsrs_vocabulary_snapshot_light') {
      const snapshot = { version: 1, actorId: uid, enabled: true, complete: true, registryAvailable: true,
      rows: state.words, registry: state.words.map(word => ({ cardId: word.id, userId: uid, enrolled: false, eligible: true,
        known: false, excluded: false, card: null, attempt: null, nextQuestionAt: null, firstQuestionAt: null })), now: new Date().toISOString() };
      return send(table === 'fsrs_vocabulary_snapshot' ? snapshot
        : compactVocabularySnapshot(snapshot, { language: body?.p_language ?? null, summary: body?.p_summary === true }));
    }
    if (table === 'fsrs_list_states') return send([]);
    if (table === 'learning_admission_status') return send(quota());
    if (table === 'learning_admit_legacy') {
      const request = body.p_request, duplicate = state.admitted.includes(request.cardId);
      if (!duplicate) state.admitted.push(request.cardId);
      const current = quota();
      return send({ version: 1, actorId: uid, operationId: request.operationId, cardId: request.cardId,
        admitted: true, consumed: !duplicate, duplicate, firstQuestionAt: current.now, admittedAt: current.now,
        startsAt: current.startsAt, learningDay: current.learningDay, quota: current });
    }
    if (table === 'fsrs_legacy_boundary') return send({ version: 1, actorId: uid, enrolled: false });
    if (table === 'profiles') return send({ id: uid, role: claims?.e2e_role === 'admin' ? 'admin' : 'learner',
      display_name: '합성 N4 학습자', onboarded: true, streak_count: 1, learning_language: ['Japanese'], last_login_at: new Date().toISOString() });
    if (table === 'textbook_book_releases') {
      const bookId = url.searchParams.get('book_id')?.replace(/^eq\./, '') || 'japanese-n5', bundle = latest(bookId);
      return send(bundle ? { book_id: bookId, edition_id: bundle.editionId, version: 1 } : null);
    }
    if (table === 'textbook_book_editions') {
      if (state.readingFail) return send({ message: 'Synthetic edition read unavailable' }, 503);
      const requested = url.searchParams.get('edition_id')?.replace(/^eq\./, ''), requestedBook = url.searchParams.get('book_id')?.replace(/^eq\./, '');
      const bundle = bundles().find(item => item.editionId === requested && (!requestedBook || bookOf(item) === requestedBook));
      return send(publishedRow(bundle) || null);
    }
    if (table === 'save_vocabulary_context') {
      assert.equal(claims?.sub, uid); assert.equal(body.p_source.kind, 'textbook');
      const source = body.p_source, locator = source.locator;
      assert(['japanese-n4', 'japanese-n5'].includes(locator.bookId));
      const duplicate = state.contexts.find(item => JSON.stringify(item.locator) === JSON.stringify(locator) && item.quote === source.quote);
      if (duplicate) return send({ contextAdded: false, vocabularyId: duplicate.vocabulary_id });
      let word = state.words.find(item => item.word_text === body.p_word.word_text && item.language === body.p_word.language);
      if (!word) {
        word = { id: id(state.words.length + 1), user_id: uid, ...body.p_word, base_form: body.p_word.word_text, source_material_id: null, interval: 0, ease_factor: 5, repetitions: 0,
          last_reviewed_at: null, next_review_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' };
        state.words.push(word);
      }
      state.contexts.push({ id: id(100 + state.contexts.length), vocabulary_id: word.id, user_id: uid,
        kind: 'textbook', lang: 'Japanese', chapter_slug: source.chapterSlug, locator, quote: source.quote,
        translation: source.translation, created_at: new Date().toISOString() });
      return send({ contextAdded: true, vocabularyId: word.id });
    }
    if (table === 'user_vocabulary') {
      if (req.method === 'PATCH') {
        const target = url.searchParams.get('id')?.replace(/^eq\./, '');
        state.words = state.words.map(word => word.id === target ? { ...word, ...body } : word); return send([]);
      }
      return send(state.words);
    }
    if (table === 'vocabulary_contexts') {
      assert.equal(url.searchParams.get('user_id'), `eq.${uid}`);
      const scopedBook = url.searchParams.get('locator->>bookId')?.replace(/^eq\./, '');
      if (scopedBook && state.scopeFail) return send({ message: 'Synthetic scope unavailable' }, 503);
      if (scopedBook && state.scopeEmpty) return send([]);
      let rows = state.contexts;
      if (scopedBook) {
        assert.equal(url.searchParams.get('user_vocabulary.user_id'), `eq.${uid}`);
        rows = rows.filter(item => item.locator.bookId === scopedBook);
      }
      const wordId = url.searchParams.get('vocabulary_id')?.replace(/^eq\./, '');
      if (wordId) rows = rows.filter(item => item.vocabulary_id === wordId);
      const start = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 50);
      return send(rows.slice(start, start + limit).map(item => ({ ...item, user_vocabulary: state.words.find(word => word.id === item.vocabulary_id) })));
    }
    if (req.method === 'HEAD') { res.writeHead(200, { ...headers, 'content-range': '*/0' }); return res.end(); }
    return send(req.headers.accept?.includes('vnd.pgrst.object') ? null : []);
  });
  return { server, start: () => new Promise(resolve => server.listen(backendPort, '127.0.0.1', resolve)),
    close: () => new Promise(resolve => server.close(resolve)) };
}

async function runBrowser() {
  const report = { scope: 'Actual local Next browser and application API; synthetic learner + memory backend only',
    hostedAccount: false, hostedPublication: false, realPostgresRls: false, checks: [], layouts: [], errors: [], startedAt: new Date().toISOString() };
  const catalog = await (await fetch(`${backendOrigin}/__qa/catalog`)).json();
  assert(catalog.n4, 'Packaged N4 edition must exist before running browser acceptance');
  report.editions = catalog;
  const n4Bundle = bundles().find(bundle => bundle.editionId === catalog.n4);
  report.n4Artifact = { editionId: n4Bundle.editionId, contentHash: n4Bundle.contentHash, bundleHash: n4Bundle.artifactManifest.bundleHash };
  const control = body => fetch(`${backendOrigin}/__qa/control`, { method: 'POST', body: JSON.stringify(body) });
  const snapshot = async () => (await fetch(`${backendOrigin}/__qa/state`)).json();
  await fetch(`${backendOrigin}/__qa/reset`, { method: 'POST' });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  report.blockedExternalRequests = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['http:', 'https:'].includes(url.protocol) || ['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue();
    report.blockedExternalRequests.push(url.origin + url.pathname); return route.abort('blockedbyclient');
  });
  context.on('page', opened => opened.on('pageerror', error => report.errors.push(error.message)));
  await context.addCookies([{ name: 'sb-127-auth-token', value: fixtureSession('learner'), url: base, sameSite: 'Lax' }]);
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const record = label => { report.checks.push(label); console.log(`N4 QA: ${label}`); };
  async function layout(label) {
    await page.evaluate(() => document.fonts.ready);
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert(dimensions.scroll <= dimensions.width + 1, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
    report.layouts.push({ label, ...dimensions }); await page.screenshot({ path: `${out}/${label}.png` });
  }
  const n4path = anchor => `/books/japanese-n4?edition=${catalog.n4}#${anchor}`;
  try {
    await page.goto(`${base}/lessons?lang=Japanese`);
    const n4entrance = page.getByRole('link', { name: /일본어 N4.*둘러보기/ });
    await n4entrance.waitFor(); await n4entrance.press('Enter');
    await page.getByRole('button', { name: '전체 42과', exact: true }).click();
    for (const details of await page.locator('.manabi-toc-group').all()) await details.evaluate(node => { node.open = true; });
    assert.equal(await page.locator('.manabi-toc-group ol li').count(), 42);
    assert(new URL(page.url()).pathname === '/books/japanese-n4');
    await layout('desktop-n4-toc'); record('Japanese shelf → keyboard N4 entrance → all 42 lesson entries');

    await page.getByRole('link', { name: /단어·문형.*찾/ }).click();
    await page.locator('#reference-start').waitFor();
    const search = page.locator('.manabi-reference-search input'); await search.waitFor();
    const entries = '.lex-card,.grammar-recall,.kanji-card,.n4-reference [data-search]';
    await page.locator(entries).first().waitFor();
    const allEntries = await page.locator(entries).count(); assert(allEntries > 0);
    await search.fill('なくす');
    await page.waitForFunction(selector => { const cards = [...document.querySelectorAll(selector)]; const visible = cards.filter(node => !node.hidden); return visible.length > 0 && visible.length < cards.length; }, entries);
    await search.fill('zzzz-no-N4-match'); await page.getByRole('status').filter({ hasText: '일치하는 항목이 없어요' }).waitFor();
    await page.waitForFunction(selector => [...document.querySelectorAll(selector)].every(node => node.hidden), entries);
    assert.equal(await page.locator(entries).evaluateAll(nodes => nodes.filter(node => !node.hidden).length), 0);
    await search.fill(''); await page.waitForFunction(selector => [...document.querySelectorAll(selector)].every(node => !node.hidden), entries);
    record('reference search waits for loaded body, filters a real Japanese term, shows zero matching entries, then restores all entries');

    await page.goto(`${base}${n4path('u01-start')}`); await page.locator('article[data-unit-page]').first().waitFor();
    await page.locator('.book-example-save button').first().waitFor();
    const answer = page.locator('[data-save]').filter({ visible: true }).first(); await answer.waitFor();
    const key = await answer.getAttribute('data-save'), kind = await answer.getAttribute('type');
    if (kind === 'radio' || kind === 'checkbox') await answer.check(); else await answer.fill('N4 합성 답안 유지');
    const savedValue = kind === 'radio' || kind === 'checkbox' ? await answer.isChecked() : await answer.inputValue();
    await page.waitForFunction(({ edition, userId, key }) => Object.hasOwn(JSON.parse(localStorage.getItem(`manabi-book-answers:${edition}:${userId}`) || '{}'), key), { edition: catalog.n4, userId: uid, key });
    await page.reload(); await page.locator(`[data-save="${key}"]`).first().waitFor();
    await page.locator('.book-example-save button').first().waitFor();
    assert.equal(kind === 'radio' || kind === 'checkbox' ? await page.locator(`[data-save="${key}"]`).first().isChecked() : await page.locator(`[data-save="${key}"]`).first().inputValue(), savedValue);
    record('N4 answer survives actual reload without replacing the edition');

    // Use a genuine DOM selection; do not insert selection state or bypass the application dialog.
    const selected = await page.locator('[data-book-source] .example [lang="ja"],[data-book-source] .example-ja,[data-book-source] .ex-ja').first().evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const clone = node.cloneNode(true); clone.querySelectorAll('rt,.book-example-save').forEach(item => item.remove());
      node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return { quote: clone.textContent.trim(), pageId: node.closest('[data-book-source]').id };
    });
    await page.getByRole('button', { name: '표현 담기', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    await dialog.getByRole('textbox', { name: '기억할 표현', exact: true }).fill(selected.quote.slice(0, 160));
    await dialog.getByRole('textbox', { name: '한국어 뜻', exact: true }).fill('독립 브라우저 검수용 뜻');
    await dialog.getByRole('button', { name: '복습에 담기', exact: true }).press('Enter');
    await dialog.getByRole('status').filter({ hasText: '출처와 함께 담았어요' }).waitFor();
    await dialog.getByRole('button', { name: '복습에 담기', exact: true }).click();
    await dialog.getByRole('status').filter({ hasText: '이미 담아둔 문맥' }).waitFor();
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    let state = await snapshot(); assert.equal(state.contexts.length, 1); assert.equal(state.contexts[0].locator.bookId, 'japanese-n4'); assert.equal(state.contexts[0].locator.editionId, catalog.n4);
    assert.equal(state.contexts[0].chapter_slug, 'n4-book-u01');
    record('DOM text selection → dialog → keyboard save → duplicate detection, with exact N4 source identifiers');

    const returnTo = n4path(selected.pageId), n4review = `/books/japanese-n4/review?edition=${catalog.n4}&returnTo=${encodeURIComponent(returnTo)}`;
    const progressKeys = [`manabi-book-progress:${catalog.n4}:${uid}`, `manabi-book-progress:${catalog.n5}:${uid}`];
    const beforeProgress = await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), progressKeys);
    await page.goto(`${base}${n4review}`); await page.getByRole('heading', { name: state.words[0].word_text, exact: true }).waitFor();
    const source = page.getByRole('link', { name: /이 판본의 원문/ }).first();
    const popupEvent = page.waitForEvent('popup'); await source.click(); const popup = await popupEvent;
    await popup.getByRole('note').filter({ hasText: '복습 원문 참고' }).waitFor(); await popup.locator('#' + selected.pageId).waitFor();
    assert.equal(new URL(popup.url()).pathname, '/books/japanese-n4'); assert.equal(new URL(popup.url()).searchParams.get('edition'), catalog.n4);
    await popup.reload(); await popup.locator('#' + selected.pageId).waitFor();
    assert.deepEqual(await popup.evaluate(keys => keys.map(key => localStorage.getItem(key)), progressKeys), beforeProgress);
    await popup.setViewportSize({ width: 320, height: 900 }); assert(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await popup.screenshot({ path: `${out}/mobile-n4-same-edition-original.png` }); await popup.close();
    record('saved expression list → actual new-tab same-edition original → reload, preserving primary N4/N5 reading positions');

    await page.goto(`${base}${n4path('u01-start')}`); await page.locator('article[data-unit-page]').first().waitFor();
    for (const width of [320, 390, 768]) { await page.setViewportSize({ width, height: 900 }); await layout(`n4-reading-${width}`); }
    await page.setViewportSize({ width: 320, height: 900 });
    const mobileToc = page.locator('.manabi-mobile-toc summary'); await mobileToc.waitFor(); await mobileToc.focus(); await page.keyboard.press('Enter');
    assert(await page.locator('.manabi-mobile-toc').evaluate(node => node.open)); await page.keyboard.press('Enter');
    record('N4 reader at 320/390/768 pixels with keyboard-operated mobile contents and no page overflow');

    // Textbook context saves enter the existing legacy cohort. Exercise that actual
    // production review path; this does not assert full-state FSRS enrollment.
    await page.evaluate(() => localStorage.setItem('vocab_review_sound', 'off'));
    await page.locator('.manabi-reader-toolbar').getByRole('link', { name: '담은 표현', exact: true }).click();
    await page.getByRole('button', { name: '표현 1개 복습 →', exact: true }).waitFor();
    const scopeURL = new URL(page.url()); assert.equal(scopeURL.searchParams.get('src'), 'book:japanese-n4:1-42');
    const reviewReturn = scopeURL.searchParams.get('returnTo'); assert(reviewReturn.includes(catalog.n4));
    await page.getByRole('button', { name: '표현 1개 복습 →', exact: true }).press('Enter');
    await page.getByText('처음 보는 표현', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /알맞음/ }).count(), 0);
    await page.getByRole('button', { name: '다음 →', exact: true }).press('Enter');
    await page.getByRole('button', { name: '정답 확인하기', exact: true }).press('Enter');
    await page.getByRole('link', { name: '이 문장 열기 ↗', exact: true }).waitFor();
    const gradeResponse = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === '/rest/v1/user_vocabulary');
    await page.getByRole('button', { name: /알맞음/ }).click(); assert.equal((await gradeResponse).status(), 200);
    await page.getByRole('heading', { name: '오늘 몫 끝', exact: true }).waitFor();
    const graded = await snapshot(); assert.equal(graded.writes.filter(row => row.table === 'user_vocabulary' && row.method === 'PATCH').length, 1);
    assert(graded.words[0].last_reviewed_at); assert(new Date(graded.words[0].next_review_at) > new Date(graded.words[0].last_reviewed_at));
    assert.deepEqual(graded.admitted, [graded.words[0].id]);
    const finishReturn = page.getByRole('link', { name: /읽던 교재로 돌아가기/ }).last(); assert.equal(await finishReturn.getAttribute('href'), reviewReturn);
    await finishReturn.click(); await page.locator('article[data-unit-page]').first().waitFor(); assert.equal(new URL(page.url()).pathname, '/books/japanese-n4');
    report.reviewCohort = 'Existing legacy vocabulary cohort, graded through production ts-fsrs adapter and synthetic HTTP persistence; no full-state FSRS enrollment claimed';
    record('N4 scoped review → first-question admission → reveal → one persisted SRS grade → original N4 edition return');

    await control({ scopeFail: true }); await page.goto(`${base}${n4review}`); await page.getByRole('alert').waitFor();
    await control({ scopeFail: false, scopeEmpty: true }); await page.reload(); await page.getByRole('heading', { name: '첫 문장을 담아 볼까요?', exact: true }).waitFor();
    await control({ scopeEmpty: false }); record('saved-expression failure and empty response remain visibly distinct');

    await page.goto(`${base}/books/japanese-n5?edition=${catalog.n5}#u03-study1`); await page.locator('#u03-study1').waitFor();
    await page.getByRole('heading', { name: latest('japanese-n5').manuscript.lessons[2].title, exact: true, level: 1 }).waitFor();
    assert((await page.locator('.manabi-reader-toolbar').textContent()).includes('N5'));
    await page.goto(`${base}/books/japanese-n5/review?edition=${catalog.n5}`); await page.getByRole('heading', { name: '첫 문장을 담아 볼까요?', exact: true }).waitFor();
    await page.getByText(state.words[0].word_text, { exact: true }).count().then(count => assert.equal(count, 0));
    assert.equal((await snapshot()).contexts.length, 1); record('N5 published reader remains available and its review excludes N4-only contexts');

    const valid = { word: { word_text: selected.quote.slice(0, 160), meaning: '합성 검수', language: 'Japanese' },
      source: { kind: 'textbook', bookId: 'japanese-n4', editionId: catalog.n4, pageId: selected.pageId, quote: selected.quote } };
    const beforeWrites = (await snapshot()).writes.filter(row => row.table === 'save_vocabulary_context').length;
    const invalid = [
      ['forged quote', { ...valid, source: { ...valid.source, quote: '存在しない独立検査文' } }],
      ['mismatched N5 edition', { ...valid, source: { ...valid.source, editionId: catalog.n5 } }],
      ['unsupported book', { ...valid, source: { ...valid.source, bookId: 'japanese-n3' } }],
      ['invalid page', { ...valid, source: { ...valid.source, pageId: 'javascript:alert(1)' } }],
    ];
    report.rejections = [];
    for (const [label, body] of invalid) {
      const response = await page.request.post(`${base}/api/learning/vocabulary`, { data: body });
      assert(response.status() >= 400 && response.status() < 500, `${label}: HTTP ${response.status()}`); report.rejections.push({ label, status: response.status() });
    }
    assert.equal((await snapshot()).writes.filter(row => row.table === 'save_vocabulary_context').length, beforeWrites);
    record('forged quote / cross-book edition / unsupported book / unsafe page reject before synthetic persistence');

    const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const guestPage = await guest.newPage(); await guestPage.goto(`${base}${n4path(selected.pageId)}`);
    await guestPage.locator('.manabi-example-signin').first().waitFor();
    const signIn = new URL(await guestPage.locator('.manabi-example-signin').first().getAttribute('href'), base);
    assert(new URL(signIn.searchParams.get('from'), base).pathname === '/books/japanese-n4'); assert(signIn.searchParams.get('from').includes(catalog.n4));
    const guestWrite = await guestPage.request.post(`${base}/api/learning/vocabulary`, { data: valid }); assert.equal(guestWrite.status(), 401);
    await guest.close(); record('anonymous N4 save offers exact source login return; unauthenticated API write returns 401');
    assert.deepEqual(report.errors, []); report.passed = true;
  } catch (error) {
    report.passed = false; report.failure = error.message; report.url = page.url();
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error;
  } finally {
    report.finishedAt = new Date().toISOString(); fs.writeFileSync(`${out}/ACCEPTANCE.json`, JSON.stringify(report, null, 2) + '\n');
    await context.close(); await browser.close();
  }
  return report;
}

async function runLayoutMatrix() {
  const catalog = await (await fetch(`${backendOrigin}/__qa/catalog`)).json();
  const bundle = bundles().find(item => item.editionId === catalog.n4);
  assert(bundle, 'A packaged N4 edition is required');
  const report = { scope: 'Actual local Next BookReader geometry only; synthetic learner/backend; functional acceptance is separate',
    editionId: bundle.editionId, contentHash: bundle.contentHash, bundleHash: bundle.artifactManifest.bundleHash,
    widths: [320, 390, 768, 1440], observations: [], failures: [], errors: [], startedAt: new Date().toISOString() };
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await context.addCookies([{ name: 'sb-127-auth-token', value: fixtureSession('learner'), url: base }]);
  const page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', error => report.errors.push(error.message));
  try {
    for (const lesson of bundle.manuscript.lessons) {
      await page.goto(`${base}/books/japanese-n4?edition=${bundle.editionId}#${lesson.id}-start`);
      await page.locator(`#${lesson.id}-start`).waitFor();
      await page.waitForFunction(unit => {
        const articles = [...document.querySelectorAll('.book-reading-content article[data-unit-page]')];
        return articles.length === 4 && articles.every(node => node.dataset.unitPage === unit)
          && !document.querySelector('.book-reading-content .book-example-save:empty');
      }, lesson.id);
      await page.evaluate(() => document.fonts.ready);
      for (const width of report.widths) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          sectionCount: document.querySelectorAll('.book-reading-content article').length,
          questions: document.querySelectorAll('.book-reading-content .check').length,
          studyRows: document.querySelectorAll('.book-reading-content .n4-study-row').length,
          formulas: document.querySelectorAll('.book-reading-content .formula').length }));
        const row = { unit: lesson.id, ...dimensions }; report.observations.push(row);
        if (dimensions.scrollWidth > dimensions.width + 1) {
          const offenders = await page.evaluate(() => [...document.querySelectorAll('.book-reader *')].map(node => ({ tag: node.tagName,
            className: node.className, text: node.textContent.slice(0, 100), left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right }))
            .filter(node => node.right > innerWidth + 1).slice(-10));
          report.failures.push({ ...row, offenders });
          await page.screenshot({ path: `${out}/matrix-${lesson.id}-${width}-overflow.png` });
        }
        if (lesson.id === 'u41' && width === 320) {
          await page.locator(`#${lesson.id}-practice .check`).first().scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${out}/n4-u41-options-320-final.png` });
        }
      }
      console.log(`N4 layout: ${lesson.id} × ${report.widths.join('/')} px`);
    }
    assert.equal(report.observations.length, 168); assert.deepEqual(report.errors, []); assert.deepEqual(report.failures, []);
    report.passed = true;
  } catch (error) { report.passed = false; report.failure = error.message; throw error; }
  finally { report.finishedAt = new Date().toISOString(); fs.writeFileSync(`${out}/APP-MATRIX.json`, JSON.stringify(report, null, 2) + '\n'); await context.close(); await browser.close(); }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--backend-only')) {
    const fixture = createN4Fixture(); await fixture.start(); console.log(`Synthetic N4 backend listening on ${backendOrigin}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await fixture.close(); process.exit(0); });
  } else {
    const fixture = process.argv.includes('--browser-only') ? null : createN4Fixture();
    if (fixture) await fixture.start();
    try {
      const report = process.argv.includes('--matrix-only') ? await runLayoutMatrix() : await runBrowser();
      console.log(JSON.stringify({ passed: report.passed, checks: report.checks?.length, observations: report.observations?.length, editions: report.editions }));
    }
    finally { if (fixture) await fixture.close(); }
  }
}
