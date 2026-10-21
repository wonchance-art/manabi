// Actual production pages with a local published-book mock, fresh anonymous browser only.
// No authentication fixture, JWT, service key or application write is used here.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';

const baseURL = process.env.COMPOSER_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || config.use.baseURL;
const origin = new URL(baseURL);
assert.equal(origin.protocol, 'http:');
assert.ok(['localhost', '127.0.0.1'].includes(origin.hostname), 'Published N3 smoke is loopback-only');
assert.ok((process.env.E2E_PUBLISHED_BOOKS || '').split(',').map(value => value.trim()).includes('japanese-n3'),
  'Start the local server and this test with E2E_PUBLISHED_BOOKS=japanese-n3; unpublished N3 is a failure');

const editions = new URL('../src/content/textbookEditions/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('japanese-n3/index.json', editions), 'utf8'));
assert.equal(index.bookId, 'japanese-n3');
assert.match(index.current, /^[a-f0-9]{24}$/);
const book = JSON.parse(readFileSync(new URL(`${index.current}/bundle.json`, editions), 'utf8'));
const sourceHtml = readFileSync(new URL(`${index.current}/index.html`, editions), 'utf8');
assert.equal(book.bookId, 'japanese-n3'); assert.equal(book.manuscript.bookId, 'japanese-n3');
assert.equal(book.editionId, index.current); assert.equal(book.qa.passed, true);
assert.equal(book.manuscript.lessons.length, 48);
assert.deepEqual(book.manuscript.lessons.map(lesson => lesson.id), Array.from({ length: 48 }, (_, i) => `u${String(i + 1).padStart(2, '0')}`));
assert.equal(createHash('sha256').update(sourceHtml).digest('hex'), book.assets['index.html'].sha256);
const href = anchor => `/books/japanese-n3?edition=${index.current}#${anchor}`;
let browser;
before(async () => { browser = await chromium.launch(config.use.launchOptions); });
after(async () => { await browser?.close(); });

async function guest() {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const errors = [], writes = [];
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push({ method: request.method(), path: url.pathname });
      return route.abort('blockedbyclient');
    }
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin.origin) return route.abort('blockedbyclient');
    return route.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(config.timeout);
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, errors, writes };
}

test('published N3 appears on the Japanese shelf and reaches all 48 lessons, including exact final-unit text', async () => {
  const f = await guest();
  try {
    await f.page.goto('/lessons?lang=Japanese');
    const entrance = f.page.getByRole('link', { name: '일본어 N3 책 둘러보기', exact: true });
    await entrance.waitFor();
    assert.equal(await entrance.getAttribute('href'), href('cover'));
    await entrance.press('Enter');
    await f.page.getByRole('button', { name: '전체 48과', exact: true }).click();
    await f.page.waitForFunction(() => document.querySelectorAll('.manabi-book-home .manabi-toc-group li a').length === 48);
    const lessons = f.page.locator('.manabi-book-home .manabi-toc-group li a');
    assert.equal(await lessons.count(), 48);
    const destinations = await lessons.evaluateAll(links => links.map(link => ({ path: new URL(link.href).pathname,
      edition: new URL(link.href).searchParams.get('edition'), anchor: new URL(link.href).hash })));
    assert.deepEqual(destinations, book.manuscript.lessons.map(lesson => ({ path: '/books/japanese-n3', edition: index.current, anchor: `#${lesson.id}-start` })));
    const finalLink = f.page.locator('.manabi-book-home a[href$="#u48-start"]');
    await finalLink.evaluate(link => { link.closest('details').open = true; });
    await finalLink.press('Enter');
    await f.page.locator('#u48-start').waitFor();
    await f.page.getByRole('heading', { level: 1, name: book.manuscript.lessons[47].title, exact: true }).waitFor();
    await f.page.waitForFunction(() => {
      const articles = [...document.querySelectorAll('.book-reading-content article[data-unit-page]')];
      return articles.length === 4 && articles.every(article => article.dataset.unitPage === 'u48');
    });
    assert.equal(new URL(f.page.url()).pathname, '/books/japanese-n3');
    assert.equal(new URL(f.page.url()).searchParams.get('edition'), index.current);
    const rendered = await f.page.locator('#u48-practice .reading').evaluate(node => {
      const clone = node.cloneNode(true); clone.querySelectorAll('rt,.reading-note').forEach(item => item.remove());
      return clone.textContent.trim();
    });
    const authored = await f.page.evaluate(html => {
      const node = new DOMParser().parseFromString(html, 'text/html').querySelector('#u48-practice .reading');
      node.querySelectorAll('rt,.reading-note').forEach(item => item.remove()); return node.textContent.trim();
    }, sourceHtml);
    assert.equal(authored, book.manuscript.lessons[47].reading);
    assert.equal(rendered, authored, 'Last-unit text must equal the exact packaged source, excluding ruby readings');
    assert.deepEqual(f.errors, []); assert.deepEqual(f.writes, []);
  } finally { await f.context.close(); }
});

test('N3 reference search shows the actual という matches, distinguishes no match and restores every card when cleared', async () => {
  const f = await guest();
  try {
    await f.page.goto(href('reference-start'));
    await f.page.locator('#reference-start').waitFor();
    const search = f.page.locator('.manabi-reference-search input');
    await search.waitFor();
    await f.page.waitForFunction(() => !document.querySelector('.manabi-reference-search input')?.disabled
      && document.querySelectorAll('#reference-start .n3-reference > [data-search]').length > 0);
    const expected = await f.page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return [...doc.querySelectorAll('#reference-start .n3-reference > [data-search]')].map(node => {
        const clone = node.cloneNode(true); clone.querySelectorAll('rt,.reading-note').forEach(item => item.remove());
        return { search: node.dataset.search, text: clone.textContent.trim(), href: node.querySelector('a')?.getAttribute('href') };
      });
    }, sourceHtml);
    assert.ok(expected.length > 0, 'The packaged N3 reference must contain authored search cards');
    const matched = expected.filter(card => card.search.toLocaleLowerCase().includes('という'));
    assert.ok(matched.length > 0 && matched.length < expected.length, 'The known N3 form must have a proper nonempty result subset');
    const cards = f.page.locator('#reference-start .n3-reference > [data-search]');
    const visible = () => cards.evaluateAll(nodes => nodes.filter(node => !node.hidden && node.getClientRects().length).map(node => {
      const clone = node.cloneNode(true); clone.querySelectorAll('rt,.reading-note').forEach(item => item.remove());
      return { search: node.dataset.search, text: clone.textContent.trim(), href: node.querySelector('a')?.getAttribute('href') };
    }));
    assert.deepEqual(await visible(), expected, 'Initial reference cards must match the packaged source');
    await search.fill('という');
    await f.page.waitForFunction(count => [...document.querySelectorAll('#reference-start .n3-reference > [data-search]')]
      .filter(node => !node.hidden && node.getClientRects().length).length === count, matched.length);
    assert.deepEqual(await visible(), matched, 'Matches must be visible inside a visible article, with exact source text');
    await f.page.getByRole('status').filter({ hasText: `${matched.length}개 항목을 찾았어요.` }).waitFor();
    await search.fill('zzzz-n3-no-match');
    await f.page.getByRole('status').filter({ hasText: '일치하는 항목이 없어요.' }).waitFor();
    assert.deepEqual(await visible(), []);
    await search.fill('');
    await f.page.waitForFunction(count => [...document.querySelectorAll('#reference-start .n3-reference > [data-search]')]
      .filter(node => !node.hidden && node.getClientRects().length).length === count, expected.length);
    assert.deepEqual(await visible(), expected, 'Clearing search must restore all original N3 cards and the reference article');
    assert.equal(new URL(f.page.url()).searchParams.get('edition'), index.current);
    assert.deepEqual(f.errors, []); assert.deepEqual(f.writes, []);
  } finally { await f.context.close(); }
});
