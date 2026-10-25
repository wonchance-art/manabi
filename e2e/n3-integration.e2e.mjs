// Actual local Next UI and route handlers with synthetic identity + in-memory database.
// This fixture does not prove hosted authentication, PostgreSQL RLS, or deployed publication.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { fixtureSession } from './fixtures/n5-revision-backend.mjs';
import { learningDay } from '../src/lib/fsrsScheduler.js';
import { compactVocabularySnapshot } from '../src/lib/vocabularySnapshotLight.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const base = process.env.QA_BASE || 'http://localhost:49121';
const backendPort = Number(process.env.QA_BACKEND_PORT || 49122);
const backendOrigin = `http://127.0.0.1:${backendPort}`;
const out = process.env.QA_OUT || '/workspace/scratch/n3-integration/team/browser';
const uid = '00000000-0000-4000-8000-000000000042';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const foreignUid = id(9999), foreignWordId = id(9001);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
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
  return all.find(bundle => bundle.editionId === index?.current);
}
function exactN3Candidate() {
  const edition = process.env.QA_N3_EDITION, contentHash = process.env.QA_N3_CONTENT_HASH, bundleHash = process.env.QA_N3_BUNDLE_HASH;
  assert(/^[a-f0-9]{24}$/.test(edition || '') && /^[a-f0-9]{64}$/.test(contentHash || '') && /^[a-f0-9]{64}$/.test(bundleHash || ''),
    'Pin QA_N3_EDITION, QA_N3_CONTENT_HASH and QA_N3_BUNDLE_HASH to the M00 accepted packaged candidate');
  const bundle = latest('japanese-n3');
  assert(bundle && bundle.editionId === edition && bundle.contentHash === contentHash && bundle.artifactManifest.bundleHash === bundleHash,
    'N3 index/current artifact differs from the explicitly pinned candidate');
  assert.equal(bookOf(bundle), 'japanese-n3'); assert.equal(bundle.qa?.passed, true);
  assert.equal(bundle.manuscript.lessons.length, 48);
  assert.deepEqual(bundle.manuscript.lessons.map(lesson => lesson.id), Array.from({length:48}, (_,i) => `u${String(i+1).padStart(2,'0')}`));
  assert.deepEqual(bundle.manuscript.syllabus.reviewAfterLessons, [8,16,24,32,40,48]);
  for (const [file, asset] of Object.entries(bundle.assets)) assert.equal(sha256(fs.readFileSync(path.join(repo,'src/content/textbookEditions',edition,file))), asset.sha256, `Pinned asset bytes: ${file}`);
  return bundle;
}
function publishedRow(bundle) {
  return bundle && { book_id: bookOf(bundle), edition_id: bundle.editionId, content_hash: bundle.contentHash,
    manuscript: bundle.manuscript, artifact_manifest: bundle.artifactManifest, published_at: '2026-10-17T00:00:00Z' };
}

export function createN3Fixture() {
  const candidate = exactN3Candidate();
  const foreignWord = { id: foreignWordId, user_id: foreignUid, word_text: '合成別所有者', meaning: '다른 합성 소유자 전용', language: 'Japanese' };
  const foreignContext = { id: id(9002), vocabulary_id: foreignWordId, user_id: foreignUid, kind: 'textbook',
    lang: 'Japanese', chapter_slug: 'n3-book-u48', locator: { bookId: 'japanese-n3', editionId: candidate.editionId, pageId: 'u48-start' }, quote: '合成別所有者', created_at: '2026-01-01T00:00:00Z' };
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
    if (url.pathname === '/__qa/state') return send({ ...state, foreignFixtures: { word: foreignWord, context: foreignContext } });
    if (url.pathname === '/__qa/catalog') return send({ n3: latest('japanese-n3')?.editionId, n4: latest('japanese-n4')?.editionId, n5: latest('japanese-n5')?.editionId });
    let claims = null;
    try { claims = JSON.parse(Buffer.from((req.headers.authorization || '').split('.')[1], 'base64url')); } catch { /* anonymous */ }
    if (url.pathname.startsWith('/auth/v1/')) {
      if (claims?.sub !== uid) return send({ message: 'No recognized synthetic session' }, 401);
      return send({ id: uid, email: 'n3-fixture@example.invalid', email_confirmed_at: '2026-10-17T00:00:00Z',
        aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { name: '합성 N3 학습자' } });
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
      display_name: '합성 N3 학습자', onboarded: true, streak_count: 1, learning_language: ['Japanese'], last_login_at: new Date().toISOString() });
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
      assert(['japanese-n3', 'japanese-n4', 'japanese-n5'].includes(locator.bookId));
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
        assert.equal(claims?.sub, uid);
        const target = url.searchParams.get('id')?.replace(/^eq\./, '');
        assert.equal(state.words.find(word => word.id === target)?.user_id, uid, 'Synthetic legacy grade may only update its owned card');
        state.words = state.words.map(word => word.id === target ? { ...word, ...body } : word); return send([]);
      }
      assert.equal(url.searchParams.get('user_id'), `eq.${uid}`);
      return send([...state.words, foreignWord].filter(word => word.user_id === uid));
    }
    if (table === 'vocabulary_contexts') {
      assert.equal(url.searchParams.get('user_id'), `eq.${uid}`);
      const scopedBook = url.searchParams.get('locator->>bookId')?.replace(/^eq\./, '');
      if (scopedBook && state.scopeFail) return send({ message: 'Synthetic scope unavailable' }, 503);
      if (scopedBook && state.scopeEmpty) return send([]);
      let rows = [...state.contexts, foreignContext].filter(item => item.user_id === uid);
      if (scopedBook) {
        assert.equal(url.searchParams.get('user_vocabulary.user_id'), `eq.${uid}`);
        rows = rows.filter(item => item.locator.bookId === scopedBook);
      }
      const wordId = url.searchParams.get('vocabulary_id')?.replace(/^eq\./, '');
      if (wordId) rows = rows.filter(item => item.vocabulary_id === wordId);
      const chapters = url.searchParams.get('chapter_slug');
      if (chapters) {
        assert(/^in\.\([a-z0-9",-]+\)$/.test(chapters), 'Explicit chapter range required');
        const values = chapters.slice(4,-1).replaceAll('"','').split(',');
        rows = rows.filter(item => values.includes(item.chapter_slug));
      }
      const start = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 50);
      return send(rows.slice(start, start + limit).map(item => ({ ...item, user_vocabulary: state.words.find(word => word.id === item.vocabulary_id) })));
    }
    if (req.method === 'HEAD') { res.writeHead(200, { ...headers, 'content-range': '*/0' }); return res.end(); }
    return send(req.headers.accept?.includes('vnd.pgrst.object') ? null : []);
  });
  return { server, start: () => new Promise(resolve => server.listen(backendPort, '127.0.0.1', resolve)),
    close: () => new Promise(resolve => server.close(resolve)) };
}

async function checkActualApis(page, catalog, bundle) {
  const report = { scope: 'Actual local application HTTP routes against explicitly pinned packaged bytes; synthetic backend only',
    editionId: bundle.editionId, contentHash: bundle.contentHash, bundleHash: bundle.artifactManifest.bundleHash,
    reading: [], assets: [], boundaries: [], passed: false };
  const rawHtml = fs.readFileSync(path.join(repo,'src/content/textbookEditions',bundle.editionId,'index.html'),'utf8');
  try {
    for (let number=1;number<=48;number++) {
      const unit=`u${String(number).padStart(2,'0')}`;
      const response=await page.request.get(`${base}/api/books/japanese-n3/${catalog.n3}/reading?unit=${unit}`);
      assert.equal(response.status(),200,unit); const data=await response.json();
      assert.equal(data.edition,catalog.n3); assert.equal(data.unit,unit); assert.equal(data.sections.length,4);
      const comparison=await page.evaluate(({rawHtml,sections,unit}) => {
        const expected=new DOMParser().parseFromString(rawHtml,'text/html');
        return sections.map(section => {
          const original=expected.getElementById(section.id);
          const delivered=new DOMParser().parseFromString(section.html,'text/html').querySelector('article');
          if(!original||!delivered||original.dataset.unitPage!==unit) return false;
          original.removeAttribute('hidden');
          return original.outerHTML===delivered.outerHTML;
        });
      },{rawHtml,sections:data.sections,unit});
      assert(comparison.every(Boolean),`${unit}: exact packaged article mismatch`);
      assert.equal(response.headers()['cache-control'],'private, no-cache');
      const etag=response.headers().etag; assert.equal(etag,`"${bundle.contentHash}.${bundle.artifactManifest.bundleHash}.${unit}"`);
      const cached=await page.request.get(`${base}/api/books/japanese-n3/${catalog.n3}/reading?unit=${unit}`,{headers:{'If-None-Match':etag}});
      assert.equal(cached.status(),304); assert.equal((await cached.body()).length,0);
      report.reading.push({unit,status:200,sections:4,exactPackagedDom:true,cache304:true});
    }
    for(const [file,asset] of Object.entries(bundle.assets)) {
      const url=`${base}/api/books/japanese-n3/${catalog.n3}/asset?file=${encodeURIComponent(file)}`;
      const response=await fetch(url); assert.equal(response.status,200,file);
      const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha256(bytes),asset.sha256,file);
      assert.equal(response.headers.get('cache-control'),'public, max-age=31536000, immutable');assert.equal(response.headers.get('set-cookie'),null);
      const authenticated=await page.request.get(url);assert.equal(authenticated.status(),200);assert.equal(authenticated.headers()['set-cookie'],undefined);
      assert.equal(sha256(await authenticated.body()),asset.sha256);
      report.assets.push({file,status:200,sha256:asset.sha256,anonymousAndSyntheticLearnerSame:true,immutable:true,cookieFree:true});
    }
    for(const [label,url,expectedStatus] of [
      ['N3 u49',`/api/books/japanese-n3/${catalog.n3}/reading?unit=u49`,400],
      ['N4 u43',`/api/books/japanese-n4/${catalog.n4}/reading?unit=u43`,400],
      ['N5 u43',`/api/books/japanese-n5/${catalog.n5}/reading?unit=u43`,400],
      ['N3 range49','/api/learning/book-review?book=japanese-n3&scope=1&from=43&to=49',400],
      ['N4 range43','/api/learning/book-review?book=japanese-n4&scope=1&from=1&to=43',400],
      ['unknown N2','/api/learning/book-review?book=japanese-n2',400],
      ['duplicate book','/api/learning/book-review?book=japanese-n3&book=japanese-n4',400],
    ]) {
      const response=await page.request.get(base+url);assert.equal(response.status(),expectedStatus,label);
      report.boundaries.push({label,status:response.status()});
    }
    for(const level of ['n4','n5']) {
      const response=await page.request.get(`${base}/api/books/japanese-n3/${catalog[level]}/reading?unit=u01`);
      assert(response.status()>=400&&response.status()<500,`Other book ${level} edition exposed through N3`);
      report.boundaries.push({label:`${level} edition through N3`,status:response.status()});
    }
    assert.equal(report.reading.length,48); report.passed=true;
  } catch(error) { report.failure=error.message;throw error; }
  finally { fs.writeFileSync(`${out}/API-ALL48-ASSETS.json`,JSON.stringify(report,null,2)+'\n'); }
}

async function runBrowser() {
  const report = { scope: 'Actual local Next browser and application API; synthetic learner + memory backend only',
    hostedAccount: false, hostedPublication: false, realPostgresRls: false, checks: [], layouts: [], errors: [], startedAt: new Date().toISOString() };
  const catalog = await (await fetch(`${backendOrigin}/__qa/catalog`)).json();
  assert(catalog.n3, 'Packaged N3 edition must exist before running browser acceptance');
  report.editions = catalog;
  const n3Bundle = exactN3Candidate(); assert.equal(catalog.n3,n3Bundle.editionId);
  report.n3Artifact = { editionId: n3Bundle.editionId, contentHash: n3Bundle.contentHash, bundleHash: n3Bundle.artifactManifest.bundleHash };
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
  const record = label => { report.checks.push(label); console.log(`N3 QA: ${label}`); };
  async function layout(label) {
    await page.evaluate(() => document.fonts.ready);
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert(dimensions.scroll <= dimensions.width + 1, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
    report.layouts.push({ label, ...dimensions }); await page.screenshot({ path: `${out}/${label}.png` });
  }
  const n3path = anchor => `/books/japanese-n3?edition=${catalog.n3}#${anchor}`;
  try {
    await checkActualApis(page,catalog,n3Bundle); record('all 48 actual reading routes + exact packaged DOM/ETag/304 + every immutable cookie-free asset and course/edition boundaries');
    await page.goto(`${base}/lessons?lang=Japanese`);
    const n3entrance = page.getByRole('link', { name: /일본어 N3.*둘러보기/ });
    await n3entrance.waitFor(); await n3entrance.press('Enter');
    await page.getByRole('button', { name: '전체 48과', exact: true }).click();
    for (const details of await page.locator('.manabi-toc-group').all()) await details.evaluate(node => { node.open = true; });
    assert.equal(await page.locator('.manabi-toc-group ol li').count(), 48);
    assert(new URL(page.url()).pathname === '/books/japanese-n3');
    await layout('desktop-n3-toc'); record('Japanese shelf → keyboard N3 entrance → all 48 lesson entries');

    await page.getByRole('link', { name: /단어·문형.*찾/ }).click();
    await page.locator('#reference-start').waitFor();
    const search = page.locator('.manabi-reference-search input'); await search.waitFor();
    const entries = '.lex-card,.grammar-recall,.kanji-card,.n3-reference [data-search]';
    await page.locator(entries).first().waitFor();
    const allEntries = await page.locator(entries).count(); assert(allEntries > 0);
    await search.fill('という');
    await page.waitForFunction(selector => { const cards = [...document.querySelectorAll(selector)]; const visible = cards.filter(node => !node.hidden); return visible.length > 0 && visible.length < cards.length; }, entries);
    await search.fill('zzzz-no-N3-match'); await page.getByRole('status').filter({ hasText: '일치하는 항목이 없어요' }).waitFor();
    await page.waitForFunction(selector => [...document.querySelectorAll(selector)].every(node => node.hidden), entries);
    assert.equal(await page.locator(entries).evaluateAll(nodes => nodes.filter(node => !node.hidden).length), 0);
    await search.fill(''); await page.waitForFunction(selector => [...document.querySelectorAll(selector)].every(node => !node.hidden), entries);
    record('reference search waits for loaded body, filters a real Japanese term, shows zero matching entries, then restores all entries');

    await page.goto(`${base}${n3path('u01-start')}`); await page.locator('article[data-unit-page]').first().waitFor();
    await page.locator('.book-example-save button').first().waitFor();
    const answer = page.locator('[data-save]').filter({ visible: true }).first(); await answer.waitFor();
    const key = await answer.getAttribute('data-save'), kind = await answer.getAttribute('type');
    if (kind === 'radio' || kind === 'checkbox') await answer.check(); else await answer.fill('N3 합성 답안 유지');
    const savedValue = kind === 'radio' || kind === 'checkbox' ? await answer.isChecked() : await answer.inputValue();
    await page.waitForFunction(({ edition, userId, key }) => Object.hasOwn(JSON.parse(localStorage.getItem(`manabi-book-answers:${edition}:${userId}`) || '{}'), key), { edition: catalog.n3, userId: uid, key });
    await page.reload(); await page.locator(`[data-save="${key}"]`).first().waitFor();
    await page.locator('.book-example-save button').first().waitFor();
    assert.equal(kind === 'radio' || kind === 'checkbox' ? await page.locator(`[data-save="${key}"]`).first().isChecked() : await page.locator(`[data-save="${key}"]`).first().inputValue(), savedValue);
    record('N3 answer survives actual reload without replacing the edition');

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
    let state = await snapshot(); assert.equal(state.contexts.length, 1); assert.equal(state.contexts[0].locator.bookId, 'japanese-n3'); assert.equal(state.contexts[0].locator.editionId, catalog.n3);
    assert.equal(state.contexts[0].chapter_slug, 'n3-book-u01');
    record('DOM text selection → dialog → keyboard save → duplicate detection, with exact N3 source identifiers');

    const returnTo = n3path(selected.pageId), n3review = `/books/japanese-n3/review?edition=${catalog.n3}&returnTo=${encodeURIComponent(returnTo)}`;
    const progressKeys = ['n3','n4','n5'].map(level => `manabi-book-progress:${catalog[level]}:${uid}`);
    const beforeProgress = await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), progressKeys);
    await page.goto(`${base}${n3review}`); await page.getByRole('heading', { name: state.words[0].word_text, exact: true }).waitFor();
    const source = page.getByRole('link', { name: /이 판본의 원문/ }).first();
    const popupEvent = page.waitForEvent('popup'); await source.click(); const popup = await popupEvent;
    await popup.getByRole('note').filter({ hasText: '복습 원문 참고' }).waitFor(); await popup.locator('#' + selected.pageId).waitFor();
    assert.equal(new URL(popup.url()).pathname, '/books/japanese-n3'); assert.equal(new URL(popup.url()).searchParams.get('edition'), catalog.n3);
    await popup.reload(); await popup.locator('#' + selected.pageId).waitFor();
    assert.deepEqual(await popup.evaluate(keys => keys.map(key => localStorage.getItem(key)), progressKeys), beforeProgress);
    await popup.setViewportSize({ width: 320, height: 900 }); assert(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await popup.screenshot({ path: `${out}/mobile-n3-same-edition-original.png` }); await popup.close();
    record('saved expression list → actual new-tab same-edition original → reload, preserving primary N3/N4/N5 reading positions');

    await page.goto(`${base}${n3path('u01-start')}`); await page.locator('article[data-unit-page]').first().waitFor();
    for (const width of [320, 390, 768]) { await page.setViewportSize({ width, height: 900 }); await layout(`n3-reading-${width}`); }
    await page.setViewportSize({ width: 320, height: 900 });
    const mobileToc = page.locator('.manabi-mobile-toc summary'); await mobileToc.waitFor(); await mobileToc.focus(); await page.keyboard.press('Enter');
    assert(await page.locator('.manabi-mobile-toc').evaluate(node => node.open)); await page.keyboard.press('Enter');
    record('N3 reader at 320/390/768 pixels with keyboard-operated mobile contents and no page overflow');

    // Textbook context saves enter the existing legacy cohort. Exercise that actual
    // production review path; this does not assert full-state FSRS enrollment.
    await page.evaluate(() => localStorage.setItem('vocab_review_sound', 'off'));
    await page.locator('.manabi-reader-toolbar').getByRole('link', { name: '담은 표현', exact: true }).click();
    await page.getByRole('button', { name: '표현 1개 복습 →', exact: true }).waitFor();
    const scopeURL = new URL(page.url()); assert.equal(scopeURL.searchParams.get('src'), 'book:japanese-n3:1-48');
    const reviewReturn = scopeURL.searchParams.get('returnTo'); assert(reviewReturn.includes(catalog.n3));
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
    await finishReturn.click(); await page.locator('article[data-unit-page]').first().waitFor(); assert.equal(new URL(page.url()).pathname, '/books/japanese-n3');
    report.reviewCohort = 'Existing legacy vocabulary cohort, graded through production ts-fsrs adapter and synthetic HTTP persistence; no full-state FSRS enrollment claimed';
    record('N3 scoped review → first-question admission → reveal → one persisted SRS grade → original N3 edition return');

    await control({ scopeFail: true }); await page.goto(`${base}${n3review}`); await page.getByRole('alert').waitFor();
    await control({ scopeFail: false, scopeEmpty: true }); await page.reload(); await page.getByRole('heading', { name: '첫 문장을 담아 볼까요?', exact: true }).waitFor();
    await control({ scopeEmpty: false }); record('saved-expression failure and empty response remain visibly distinct');

    for(const [level,anchor] of [['n5','u03-study1'],['n4','u03-start']]) {
      await page.goto(`${base}/books/japanese-${level}?edition=${catalog[level]}#${anchor}`); await page.locator('#'+anchor).waitFor();
      await page.getByRole('heading', { name: latest(`japanese-${level}`).manuscript.lessons[2].title, exact: true, level: 1 }).waitFor();
      assert((await page.locator('.manabi-reader-toolbar').textContent()).includes(level.toUpperCase()));
      await page.goto(`${base}/books/japanese-${level}/review?edition=${catalog[level]}`); await page.getByRole('heading', { name: '첫 문장을 담아 볼까요?', exact: true }).waitFor();
      assert.equal(await page.getByText(state.words[0].word_text, { exact: true }).count(),0);
    }
    assert.equal((await snapshot()).contexts.length, 1); record('N5 and N4 published readers remain available and their review lists exclude N3-only contexts');

    const wrongReturn=`/books/japanese-n4?edition=${catalog.n4}#u03-start`;
    await page.goto(`${base}/books/japanese-n3/review?edition=${catalog.n3}&returnTo=${encodeURIComponent(wrongReturn)}`);
    await page.getByRole('link',{name:'이 교재 표현 복습 →',exact:true}).waitFor();
    const safeReview=new URL(await page.getByRole('link',{name:'이 교재 표현 복습 →',exact:true}).getAttribute('href'),base);
    assert.equal(safeReview.searchParams.get('src'),'book:japanese-n3:1-48');
    assert.equal(new URL(safeReview.searchParams.get('returnTo'),base).pathname,'/books/japanese-n3');
    assert.equal(new URL(safeReview.searchParams.get('returnTo'),base).searchParams.get('edition'),catalog.n3);
    record('N3 expression-list return parameter for N4 cannot change review scope or original-book return');

    const valid = { word: { word_text: selected.quote.slice(0, 160), meaning: '합성 검수', language: 'Japanese' },
      source: { kind: 'textbook', bookId: 'japanese-n3', editionId: catalog.n3, pageId: selected.pageId, quote: selected.quote } };
    const beforeWrites = (await snapshot()).writes.filter(row => row.table === 'save_vocabulary_context').length;
    const invalid = [
      ['forged quote', { ...valid, source: { ...valid.source, quote: '存在しない独立検査文' } }],
      ['mismatched N5 edition', { ...valid, source: { ...valid.source, editionId: catalog.n5 } }],
      ['mismatched N4 edition', { ...valid, source: { ...valid.source, editionId: catalog.n4 } }],
      ['unsupported book', { ...valid, source: { ...valid.source, bookId: 'japanese-n2' } }],
      ['invalid page', { ...valid, source: { ...valid.source, pageId: 'javascript:alert(1)' } }],
    ];
    report.rejections = [];
    for (const [label, body] of invalid) {
      const response = await page.request.post(`${base}/api/learning/vocabulary`, { data: body });
      assert(response.status() >= 400 && response.status() < 500, `${label}: HTTP ${response.status()}`); report.rejections.push({ label, status: response.status() });
    }
    assert.equal((await snapshot()).writes.filter(row => row.table === 'save_vocabulary_context').length, beforeWrites);
    record('forged quote / cross-book edition / unsupported book / unsafe page reject before synthetic persistence');

    const foreign=await page.request.get(`${base}/api/learning/vocabulary?id=${foreignWordId}`);
    assert.equal(foreign.status(),200);assert.deepEqual((await foreign.json()).contexts,[]);
    const late=[];
    for(let number=43;number<=48;number++) {
      const lesson=n3Bundle.manuscript.lessons[number-1],pattern=(lesson.patterns?.length?lesson.patterns:lesson.reviewPatterns)[0];
      const quote=pattern.examples[0].ja,pageId=`${lesson.id}-patterns`;
      const response=await page.request.post(`${base}/api/learning/vocabulary`,{data:{
        word:{word_text:quote.slice(0,160),meaning:'N3 후반 실제 원문 경계 합성 검수',language:'Japanese'},
        source:{kind:'textbook',bookId:'japanese-n3',editionId:catalog.n3,pageId,quote}}});
      assert.equal(response.status(),200,`${lesson.id}: actual source save`); const saved=await response.json();assert(saved.contextAdded);
      const scoped=await page.request.get(`${base}/api/learning/book-review?book=japanese-n3&scope=1&from=${number}&to=${number}`);
      assert.equal(scoped.status(),200);const subset=await scoped.json();assert.deepEqual(subset.wordIds,[saved.vocabularyId]);
      assert.equal(subset.chapters[saved.vocabularyId],`n3-book-${lesson.id}`);
      late.push({unit:lesson.id,pageId,vocabularyId:saved.vocabularyId,quote,exactSingleLessonScope:true});
    }
    const lateScope=await page.request.get(`${base}/api/learning/book-review?book=japanese-n3&scope=1&from=43&to=48`);
    assert.equal(lateScope.status(),200); const lateResult=await lateScope.json();
    assert.deepEqual([...lateResult.wordIds].sort(),[...new Set(late.map(row=>row.vocabularyId))].sort());
    assert(!lateResult.wordIds.includes(foreignWordId));
    for(const level of ['n4','n5']) {
      const response=await page.request.get(`${base}/api/learning/book-review?book=japanese-${level}&scope=1`);
      assert.equal(response.status(),200);assert.deepEqual((await response.json()).wordIds,[]);
    }
    const persisted=await snapshot();assert.equal(persisted.contexts.length,7);
    assert(persisted.contexts.every(row=>row.user_id===uid&&row.locator.bookId==='japanese-n3'&&row.locator.editionId===catalog.n3));
    assert(persisted.reads.filter(row=>row.table==='vocabulary_contexts'&&row.params['locator->>bookId']).every(row=>row.params.user_id===`eq.${uid}`&&row.params['user_vocabulary.user_id']===`eq.${uid}`));
    assert.equal(persisted.foreignFixtures.word.user_id,foreignUid);
    fs.writeFileSync(`${out}/HTTP-PERSISTENCE-EVIDENCE.json`,JSON.stringify({scope:'Synthetic HTTP memory state only; not PostgreSQL/RLS or operating-account persistence',passed:true,editionId:catalog.n3,lateUnits:late,foreignContextHidden:true,state:persisted},null,2)+'\n');
    record('actual u43–u48 source saves → exact per-lesson/range scope; both owner predicates present, foreign source hidden, N5/N4 scopes empty');

    const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const guestPage = await guest.newPage(); await guestPage.goto(`${base}${n3path(selected.pageId)}`);
    await guestPage.locator('.manabi-example-signin').first().waitFor();
    const signIn = new URL(await guestPage.locator('.manabi-example-signin').first().getAttribute('href'), base);
    assert(new URL(signIn.searchParams.get('from'), base).pathname === '/books/japanese-n3'); assert(signIn.searchParams.get('from').includes(catalog.n3));
    const guestWrite = await guestPage.request.post(`${base}/api/learning/vocabulary`, { data: valid }); assert.equal(guestWrite.status(), 401);
    await guest.close(); record('anonymous N3 save offers exact source login return; unauthenticated API write returns 401');
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
  const bundle = exactN3Candidate(); assert.equal(bundle.editionId,catalog.n3);
  assert(bundle, 'A packaged N3 edition is required');
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
      await page.goto(`${base}/books/japanese-n3?edition=${bundle.editionId}#${lesson.id}-start`);
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
          studyRows: document.querySelectorAll('.book-reading-content .n3-study-row').length,
          formulas: document.querySelectorAll('.book-reading-content .formula').length }));
        const row = { unit: lesson.id, ...dimensions }; report.observations.push(row);
        if (dimensions.scrollWidth > dimensions.width + 1) {
          const offenders = await page.evaluate(() => [...document.querySelectorAll('.book-reader *')].map(node => ({ tag: node.tagName,
            className: node.className, text: node.textContent.slice(0, 100), left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right }))
            .filter(node => node.right > innerWidth + 1).slice(-10));
          report.failures.push({ ...row, offenders });
          await page.screenshot({ path: `${out}/matrix-${lesson.id}-${width}-overflow.png` });
        }
        if (['u01','u43','u44','u45','u46','u47','u48'].includes(lesson.id) && width === 320) {
          await page.locator(`#${lesson.id}-practice .check`).first().scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${out}/n3-${lesson.id}-options-320.png` });
        }
      }
      console.log(`N3 layout: ${lesson.id} × ${report.widths.join('/')} px`);
    }
    assert.equal(report.observations.length, 192); assert.deepEqual(report.errors, []); assert.deepEqual(report.failures, []);
    report.passed = true;
  } catch (error) { report.passed = false; report.failure = error.message; throw error; }
  finally { report.finishedAt = new Date().toISOString(); fs.writeFileSync(`${out}/APP-MATRIX.json`, JSON.stringify(report, null, 2) + '\n'); await context.close(); await browser.close(); }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--preflight')) {
    const bundle=exactN3Candidate(); console.log(JSON.stringify({passed:true,mode:'local-candidate-preflight-only',bookId:'japanese-n3',editionId:bundle.editionId,contentHash:bundle.contentHash,bundleHash:bundle.artifactManifest.bundleHash,lessons:48,noNetwork:true}));
  } else if (process.argv.includes('--backend-only')) {
    const fixture = createN3Fixture(); await fixture.start(); console.log(`Synthetic N3 backend listening on ${backendOrigin}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await fixture.close(); process.exit(0); });
  } else {
    const fixture = process.argv.includes('--browser-only') ? null : createN3Fixture();
    if (fixture) await fixture.start();
    try {
      const report = process.argv.includes('--matrix-only') ? await runLayoutMatrix() : await runBrowser();
      console.log(JSON.stringify({ passed: report.passed, checks: report.checks?.length, observations: report.observations?.length, editions: report.editions }));
    }
    finally { if (fixture) await fixture.close(); }
  }
}
