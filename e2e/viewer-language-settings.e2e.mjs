// Synthetic, read-only reader fixtures. This does not establish Korean RPC or live account support.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';
import { VIEWER_LANGUAGE_PREF_KEY } from '../src/lib/viewerLanguage.js';

// The integration owner starts the configured E2E build. This suite never starts a server.
const base = process.env.QA_BASE || config.use.baseURL;
const output = process.env.QA_OUT || '/tmp/manabi-viewer-language-qa';
const labels = {
  ko: { settings: '읽기 설정', close: '읽기 설정 닫기', ui: '화면 언어', explanation: '설명 언어' },
  'zh-CN': { settings: '阅读设置', close: '关闭阅读设置', ui: '界面语言', explanation: '讲解语言' },
  'zh-TW': { settings: '閱讀設定', close: '關閉閱讀設定', ui: '介面語言', explanation: '解說語言' },
};
const options = { ko: '한국어', 'zh-CN': '中文（简体）', 'zh-TW': '繁體中文（台灣）' };
const owner = '00000000-0000-4000-8000-000000000098';
const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'viewer-language-fixture@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, identities: [] };
const now = Math.floor(Date.now() / 1000);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const session = { user, access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 })}.fixture`, refresh_token: 'fixture', expires_at: now + 3600, expires_in: 3600, token_type: 'bearer' };
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' };

function readingMaterial(id, language, words) {
  const sequence = [], dictionary = {}, raw = [];
  let offset = 0;
  for (let line = 0; line < 18; line++) {
    const row = line % 2 ? words[1] : words[0];
    raw.push(row.map(([surface]) => surface).join(''));
    [...row, ['\n', '']].forEach(([text, meaning, lemma = text], index) => {
      const tokenId = `id_${line}_${index}_locale`;
      sequence.push(tokenId);
      dictionary[tokenId] = { text, base_form: lemma, meaning, pos: text === '\n' ? '개행' : '명사', sourceSpan: { start: offset, end: offset + text.length } };
      offset += text.length;
    });
  }
  return { id, owner_id: owner, visibility: 'private', title: `${language} locale fixture`, raw_text: raw.join('\n') + '\n', created_at: new Date().toISOString(), processed_json: { status: 'completed', sequence, dictionary, metadata: { language, explanationLocale: language === 'Korean' ? 'zh-CN' : 'ko', level: language === 'Chinese' ? 'HSK5' : 'beginner' } } };
}

const materials = [
  readingMaterial(94098, 'Korean', [[['학교에', '到学校'], [' ', ''], ['갔어요', '去了', '가다'], ['.', '']], [['학교에', '到学校'], [' ', ''], ['왔어요', '来了', '오다'], ['.', '']]]),
  readingMaterial(94099, 'Chinese', [[['眼前', '눈앞'], ['有山。', '산이 있다']], [['眼前', '눈앞'], ['有海。', '바다가 있다']]]),
];
const saved = { id: '00000000-0000-4000-8000-000000000099', user_id: owner, word_text: '眼前', base_form: '眼前', meaning: '사용자가 남긴 뜻', language: 'Chinese', source_sentence: '眼前有海。', source_material_id: 94099, interval: 7, ease_factor: 2.4, repetitions: 5, next_review_at: '2099-01-01T00:00:00.000Z', last_reviewed_at: '2026-10-01T00:00:00.000Z', is_excluded: true };
let browser;
before(async () => { fs.mkdirSync(output, { recursive: true }); browser = await chromium.launch(config.use.launchOptions); });
after(async () => { await browser?.close(); });

async function fixture(context, { importMode = false } = {}) {
  const writes = [], analysis = [], explanations = [], errors = [];
  const imported = [];
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  // Remove synthetic browser cookies before forwarding a page/RSC request to the local server.
  await context.route(base + '/**', async route => {
    if (new URL(route.request().url()).pathname.startsWith('/_next/static/')) return route.continue();
    const response = await route.fetch({ headers: { ...route.request().headers(), cookie: '' } });
    await route.fulfill({ response });
  });
  await context.route('**/api/**', route => {
    if (route.request().method() !== 'GET') writes.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    return route.fulfill({ json: {} });
  });
  await context.route('**/api/analyze', route => {
    analysis.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { error: 'Fixture analysis must not be requested for a UI setting change' } });
  });
  await context.route('**/api/gemini', route => {
    const prompt = route.request().postDataJSON()?.contents?.[0]?.parts?.[0]?.text || '';
    const locale = prompt.includes('Taiwan Traditional') ? 'zh-TW' : prompt.includes('mainland Simplified') ? 'zh-CN' : 'ko';
    explanations.push({ locale });
    return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify({ meaning: { ko: '학교로', 'zh-CN': '到学校', 'zh-TW': '到學校' }[locale], morphology: [] }) }] } }] } });
  });
  await context.route('**/api/learning/exclusions', route => {
    if (route.request().method() !== 'GET') writes.push({ path: '/api/learning/exclusions', body: route.request().postDataJSON() });
    return route.fulfill({ json: { items: [{ user_id: owner, vocabulary_id: saved.id, language: 'Chinese', word_text: '眼前', reason: 'known' }] } });
  });
  await context.route('**/auth/v1/**', route => route.fulfill({ headers: cors, status: route.request().method() === 'OPTIONS' ? 204 : 200, json: route.request().url().includes('/user') ? user : session }));
  await context.route('**/rest/v1/**', route => {
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').pop();
    const object = request.headers().accept?.includes('vnd.pgrst.object');
    const send = json => route.fulfill({ headers: cors, json });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (request.method() === 'HEAD') return route.fulfill({ headers: { ...cors, 'content-range': '*/0' }, body: '' });
    if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method())) {
      const body = request.postDataJSON();
      writes.push({ table, method: request.method(), body });
      if (importMode && table === 'reading_materials' && request.method() === 'POST') {
        const rows = (Array.isArray(body) ? body : [body]).map((row, index) => ({ ...structuredClone(row), id: 94100 + imported.length + index }));
        imported.push(...rows); return send(rows.map(({ id }) => ({ id })));
      }
      if (importMode && table === 'reading_materials' && request.method() === 'PATCH') {
        const row = imported.find(item => String(item.id) === url.searchParams.get('id')?.replace(/^eq\./, ''));
        if (row) Object.assign(row, structuredClone(body));
        return send(row ? [{ id: row.id }] : []);
      }
      return send([]);
    }
    if (table === 'profiles') return send({ id: owner, role: 'user', display_name: 'Locale fixture', onboarded: true, learning_language: ['Chinese'], last_login_at: new Date().toISOString() });
    if (table === 'reading_materials') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      const rows = [...materials, ...imported].filter(row => !id || String(row.id) === id);
      return send(object ? rows[0] || null : rows);
    }
    if (importMode && table === 'uploaded_pdfs') return send([{ id: 'fixture-pdf-language', owner_id: owner, title: 'English PDF fixture', filename: 'reading.pdf', page_count: 2, language: 'English', storage_path: 'fixture-reading.pdf', created_at: new Date().toISOString() }]);
    if (['user_vocabulary', 'vocabulary_with_exclusions', 'active_vocabulary'].includes(table)) return send([{ ...saved }]);
    if (table === 'user_known_words') return send([{ user_id: owner, lang: 'zh', word_text: '眼前' }]);
    if (table === 'vocabulary_exclusions') return send([{ user_id: owner, vocabulary_id: saved.id, language: 'Chinese', word_text: '眼前', reason: 'known' }]);
    return send(object ? null : []);
  });
  // Cookie naming follows the configured synthetic Supabase project, as in learning-flow.e2e.mjs.
  const project = new URL(config.webServer.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  await context.addCookies([{ name: `sb-${project}-auth-token`, value: `base64-${encode(session)}`, url: base, sameSite: 'Lax' }]);
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  return { writes, analysis, explanations, errors, imported };
}

const preferences = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), VIEWER_LANGUAGE_PREF_KEY);
async function geometry(page, name, locale) {
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: page overflows horizontally`);
  const dialog = page.locator('dialog[open]');
  if (await dialog.count()) {
    const bounds = await dialog.boundingBox();
    const viewport = page.viewportSize();
    assert(bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1, `${name}: settings dialog exceeds viewport`);
    assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${name}: dialog clips a horizontal overflow`);
    for (const groupName of [labels[locale].ui, labels[locale].explanation]) {
      const buttons = dialog.getByRole('group', { name: groupName, exact: true }).getByRole('button');
      for (const button of await buttons.all()) assert((await button.boundingBox()).height >= 44, `${name}: locale target is shorter than 44px`);
    }
  }
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
}

test('shared reader retains independent locale settings, exact source and learning state', { timeout: 180000 }, async () => {
  const context = await browser.newContext({ baseURL: base, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  context.setDefaultTimeout(config.timeout);
  const audit = await fixture(context), page = await context.newPage();
  let ui = 'ko';
  const token = () => page.locator('.reader-area [data-tid="id_1_0_locale"]');
  const launch = () => page.getByRole('button', { name: labels[ui].settings, exact: true });
  const open = async () => { await launch().click(); await page.getByRole('dialog', { name: labels[ui].settings, exact: true }).waitFor(); };
  const close = async () => {
    await page.getByRole('button', { name: labels[ui].close, exact: true }).click();
    assert(await launch().evaluate(el => document.activeElement === el), 'closing settings restores focus to its launcher');
  };
  const select = async (kind, value) => {
    await page.getByRole('group', { name: labels[ui][kind], exact: true }).getByRole('button', { name: options[value], exact: true }).click();
    if (kind === 'ui') ui = value;
    await page.getByRole('dialog', { name: labels[ui].settings, exact: true }).waitFor();
    assert(await page.locator('dialog[open]').evaluate(el => el.contains(document.activeElement)), 'locale switch retains focus inside the settings dialog');
  };
  const source = async () => ({ id: await page.locator('.reader-area [data-selected="true"]').getAttribute('data-tid'), text: (await page.locator('.reader-card-source blockquote').textContent()).trim(), materialLanguage: await page.locator('.viewer-layout').getAttribute('data-language') });
  try {
    for (const material of materials) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/viewer/${material.id}`);
      await token().waitFor(); await token().click();
      await page.locator('.word-detail-card').waitFor();
      if (material.processed_json.metadata.language === 'Korean') await page.waitForFunction(() => document.querySelector('.word-detail-card__meaning')?.textContent.trim() === '학교로');
      const baselineSource = await source(), baselineMaterial = JSON.stringify(material), baselineSaved = JSON.stringify(saved);
      assert.equal(baselineSource.text, material.raw_text.split('\n')[1], 'source must refer to the second occurrence, with its distinct sentence');
      const known = page.locator('.word-detail-card__known');
      if (material.processed_json.metadata.language === 'Chinese') {
        await known.waitFor();
        await page.waitForFunction(() => document.querySelector('.word-detail-card__known')?.getAttribute('aria-pressed') === 'true');
      } else {
        assert.equal(await known.count(), 0, 'Korean fixture must not expose unsupported known-word controls');
        assert.equal(await page.locator('.save-grade .review-score-btn').count(), 0, 'Korean fixture must not expose unverified save/SRS controls');
      }
      await open();
      if (material.processed_json.metadata.language === 'Chinese') await select('explanation', 'ko');
      for (const locale of ['ko', 'zh-CN', 'zh-TW']) {
        const before = await preferences(page);
        const explanationCalls = audit.explanations.length;
        await select('ui', locale);
        assert.equal((await preferences(page)).explanationLocale, before?.explanationLocale || 'ko');
        assert.equal(await page.getByRole('group', { name: labels[ui].ui, exact: true }).getByRole('button', { name: options[locale], exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(audit.explanations.length, explanationCalls, 'UI-only locale change does not regenerate meaning');
        assert.equal(await page.locator('.viewer-layout').getAttribute('data-ui-locale'), locale);
        await geometry(page, `${locale}-width390-${material.id}`, locale);
      }
      const explanation = material.processed_json.metadata.language === 'Korean' ? 'zh-TW' : 'ko';
      if (material.processed_json.metadata.language === 'Korean') {
        for (const locale of ['ko', 'zh-CN', 'zh-TW']) {
          await select('explanation', locale);
          assert.deepEqual(await preferences(page), { version: 1, uiLocale: 'zh-TW', explanationLocale: locale });
          assert.equal(await page.locator('.viewer-layout').getAttribute('data-explanation-locale'), locale);
          await page.waitForFunction(meaning => document.querySelector('.word-detail-card__meaning')?.textContent.trim() === meaning, { ko: '학교로', 'zh-CN': '到学校', 'zh-TW': '到學校' }[locale]);
        }
      }
      await close();
      // A UI switch must preserve the selected occurrence, even when a repeated surface exists.
      await page.locator('.word-detail-card').waitFor();
      assert.deepEqual(await source(), baselineSource);
      if (material.processed_json.metadata.language === 'Chinese') assert.equal(await known.getAttribute('aria-pressed'), 'true');
      assert.equal(JSON.stringify(material), baselineMaterial); assert.equal(JSON.stringify(saved), baselineSaved);
      await geometry(page, `zh-TW-card-width390-${material.id}`, ui);
      await page.reload(); await token().waitFor(); await open();
      assert.deepEqual(await preferences(page), { version: 1, uiLocale: 'zh-TW', explanationLocale: explanation });
      for (const [kind, value] of [['ui', 'zh-TW'], ['explanation', explanation]]) assert.equal(await page.getByRole('group', { name: labels[ui][kind], exact: true }).getByRole('button', { name: options[value], exact: true }).getAttribute('aria-pressed'), 'true');
      for (const width of [320, 768, 1440]) { await page.setViewportSize({ width, height: 844 }); await geometry(page, `zh-TW-width${width}-${material.id}`, ui); }
      await close();
    }
    // Use a same-origin second tab to exercise the browser's real storage event.
    await open();
    const peer = await context.newPage();
    await peer.goto(`${base}/manifest.webmanifest`);
    await peer.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 1, uiLocale: 'ko', explanationLocale: 'zh-TW' })), VIEWER_LANGUAGE_PREF_KEY);
    ui = 'ko';
    await page.getByRole('dialog', { name: labels[ui].settings, exact: true }).waitFor();
    assert.deepEqual(await preferences(page), { version: 1, uiLocale: 'ko', explanationLocale: 'zh-TW' });
    await select('ui', 'zh-CN');
    assert.deepEqual(await preferences(page), { version: 1, uiLocale: 'zh-CN', explanationLocale: 'zh-TW' }, 'local UI change preserves the explanation preference updated by another tab');
    await close(); await peer.close();
    assert.deepEqual(audit.analysis, [], 'changing display settings must not invoke source analysis');
    const protectedWrites = audit.writes.filter(row => !['reading_progress', 'library_reading_activity'].includes(row.table));
    assert.deepEqual(protectedWrites, [], 'locale switches must not create/update vocabulary, known words, review events or SRS');
    assert.deepEqual(audit.errors, []);
  } catch (error) {
    await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
    fs.writeFileSync(`${output}/failure.txt`, await page.locator('body').innerText().catch(() => 'Unavailable'));
    throw error;
  } finally {
    fs.writeFileSync(`${output}/report.json`, JSON.stringify({ base, synthetic: true, writes: audit.writes, analysis: audit.analysis, explanations: audit.explanations, errors: audit.errors }, null, 2));
    await context.close();
  }
});

test('ordinary Korean import preserves real textarea paste/edit source and excludes unsupported note/PDF targets', { timeout: 180000 }, async () => {
  const context = await browser.newContext({ baseURL: base, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  context.setDefaultTimeout(config.timeout);
  const audit = await fixture(context, { importMode: true }), page = await context.newPage();
  await context.addInitScript(key => localStorage.setItem(key, JSON.stringify({ version: 1, uiLocale: 'zh-TW', explanationLocale: 'zh-TW' })), VIEWER_LANGUAGE_PREF_KEY);
  // PDF source is an existing repository fixture served only through intercepted Storage routes.
  const originalPdf = fs.readFileSync(new URL('./fixtures/composer/reading.pdf', import.meta.url), 'latin1');
  // The tiny repository PDF has 29 extracted characters, below the importer's 30-char
  // minimum. Extend its own synthetic sentence in memory, preserving valid PDF offsets.
  const pdfSource = originalPdf.replace('A small beginning', 'A small beginning for the reader')
    .replace(/<< \/Length \d+ >>\nstream\n([\s\S]*?)\nendstream/g, (_match, body) => `<< /Length ${Buffer.byteLength(body + '\n', 'latin1')} >>\nstream\n${body}\nendstream`);
  const objects = pdfSource.slice(0, pdfSource.indexOf('xref\n'));
  const offsets = [...objects.matchAll(/^(\d+) 0 obj/gm)].map(match => String(Buffer.byteLength(objects.slice(0, match.index), 'latin1')).padStart(10, '0') + ' 00000 n ');
  const pdf = Buffer.from(`${objects}xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n${offsets.join('\n')}\ntrailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${Buffer.byteLength(objects, 'latin1')}\n%%EOF`, 'latin1');
  await context.route('**/storage/v1/object/sign/**', route => route.request().method() === 'POST'
    ? route.fulfill({ headers: cors, json: { signedURL: '/object/sign/user-pdfs/fixture-reading.pdf?token=fixture' } })
    : route.fulfill({ headers: cors, contentType: 'application/pdf', body: pdf }));
  await context.route('**/api/analyze/korean', route => {
    const body = route.request().postDataJSON(); audit.analysis.push(body);
    const metadata = { language: 'Korean', targetLanguage: 'ko', explanationLocale: body.explanationLocale, analysisVersion: 'ko-llm-v1', analysisEngine: 'llm', analysisQuality: 'unreviewed' };
    const results = body.lines.map((line, lineIndex) => {
      const sequence = [], dictionary = {};
      for (const [index, match] of [...line.matchAll(/\s+|[\p{P}\p{S}\p{M}\u200D]+|[^\s\p{P}\p{S}]+/gu)].entries()) {
        const id = `fixture_${lineIndex}_${index}`, text = match[0];
        const separator = /^\s+$/u.test(text) || /^[\p{P}\p{S}\p{M}\u200D]+$/u.test(text);
        sequence.push(id); dictionary[id] = { text, surface: text, base_form: separator ? null : text, pos: separator ? '기호' : '명사', meaning: separator ? '' : '合成測試詞義', sourceSpan: { start: match.index, end: match.index + text.length, lineIndex, unit: 'utf16' }, ...metadata };
      }
      return { sequence, dictionary, metadata };
    });
    return route.fulfill({ json: { metadata, results } });
  });
  const korean = () => page.locator('.import-language-options').getByRole('button', { name: '한국어', exact: true });
  try {
    await page.goto('/materials/add?advanced=1&direction=write');
    await page.locator('textarea.form-textarea').waitFor();
    assert.equal(await korean().count(), 0, 'Korean must not appear as a write-note target');
    await page.getByRole('button', { name: '읽기 자료', exact: true }).click();
    await korean().waitFor();

    await page.getByRole('tab', { name: /PDF/ }).click();
    await page.getByRole('button', { name: '범위 선택', exact: true }).click();
    await page.getByRole('button', { name: 'p.1-2 가져오기 →', exact: true }).click();
    await page.getByText('PDF 출처', { exact: true }).waitFor();
    assert.equal(await korean().count(), 0, 'a selected PDF source must not offer Korean target support');
    await page.screenshot({ path: `${output}/import-pdf-legacy-targets.png` });
    assert.equal(audit.imported.length, 0, 'inspecting source availability does not save materials');

    await page.goto('/materials/add');
    const entry = page.locator('a[href="/materials/add?language=ko"]');
    await entry.waitFor(); assert((await entry.innerText()).trim(), 'Korean ordinary text import has a visible entry label');
    await entry.click();
    const textarea = page.locator('textarea.form-textarea');
    await textarea.waitFor();
    assert.equal(await korean().getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.level-group').count(), 0, 'ordinary Korean import does not invent a course level');

    const raw = '학교에 갔어요.\r\n한글 👨‍👩‍👧\r\n\t끝.';
    const pasteCancelled = await textarea.evaluate((input, text) => {
      input.focus(); input.setSelectionRange(0, input.value.length);
      const clipboardData = new DataTransfer(); clipboardData.setData('text/plain', text);
      return !input.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    }, raw);
    assert(pasteCancelled, 'Korean paste intercepts the native LF-only textarea replacement');
    await page.waitForFunction(value => document.querySelector('textarea.form-textarea')?.value === value, raw.replaceAll('\r\n', '\n'));
    await textarea.evaluate(input => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); });
    await page.keyboard.insertText('!');
    assert.equal(await textarea.inputValue(), raw.replaceAll('\r\n', '\n') + '!');
    await page.screenshot({ path: `${output}/import-korean-real-paste.png` });

    const insert = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/rest/v1/reading_materials'));
    await page.getByRole('button', { name: '저장하고 읽기 준비', exact: true }).click();
    const request = await insert, rows = request.postDataJSON();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].raw_text, raw + '!', 'saved source retains original CRLF, decomposed Hangul, emoji and the local edit exactly');
    assert.deepEqual({ language: rows[0].processed_json.metadata.language, level: rows[0].processed_json.metadata.level, explanationLocale: rows[0].processed_json.metadata.explanationLocale }, { language: 'Korean', level: '', explanationLocale: 'zh-TW' });
    await page.getByRole('button', { name: '내 서재 보기', exact: true }).waitFor();
    assert.equal(audit.imported.length, 1); assert.equal(audit.imported[0].raw_text, raw + '!');
    assert.equal(audit.imported[0].processed_json.status, 'completed');
    assert.equal(audit.analysis.map(body => body.lines.join('\n')).join('\n'), raw + '!', 'analysis handoff preserves the original source too');
    assert.deepEqual(audit.writes.filter(row => row.table !== 'reading_materials'), [], 'text import does not enable Korean vocabulary or SRS writes');
    assert.deepEqual(audit.errors, []);
  } catch (error) {
    await page.screenshot({ path: `${output}/import-failure.png` }).catch(() => {});
    fs.writeFileSync(`${output}/import-failure.txt`, await page.locator('body').innerText().catch(() => 'Unavailable'));
    throw error;
  } finally {
    fs.writeFileSync(`${output}/import-report.json`, JSON.stringify({ base, synthetic: true, writes: audit.writes, analysis: audit.analysis, errors: audit.errors }, null, 2));
    await context.close();
  }
});
