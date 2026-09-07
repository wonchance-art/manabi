// Actual deployment identity first; a second, explicit fixture checks stale-browser UI.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { releaseVerificationErrors } from '../src/lib/releaseVersion.js';

const base = process.env.QA_BASE;
const commit = process.env.QA_COMMIT;
const out = process.env.QA_OUT || '/private/tmp/manabi-release-version-qa';
const edition = JSON.parse(fs.readFileSync(new URL('../src/content/textbookEditions/index.json', import.meta.url))).current;
assert(base && commit, 'QA_BASE and reviewed QA_COMMIT are required');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.request.get(base + '/api/version');
  assert.equal(response.status(), 200);
  assert(response.headers()['cache-control'].includes('no-store'));
  const version = await response.json();
  assert.deepEqual(releaseVerificationErrors(version, { commit, environment: 'preview', bundledEditionId: edition }), []);
  checks.push('actual-server-exact-identity-and-no-store');

  await page.goto(base + '/home?v=1');
  await page.locator('.version-badge__sha').waitFor();
  assert.equal(await page.locator('.version-badge__sha').innerText(), version.sha);
  assert.equal(await page.locator('.version-badge__btn--stale').count(), 0);
  await page.locator('.version-badge__btn').click();
  assert((await page.locator('.version-badge__panel').innerText()).includes(version.ref));
  checks.push('actual-browser-and-server-commit-match');
  await page.screenshot({ path: out + '/version-desktop.png' });

  await page.goto(base + '/home');
  await page.locator('main h1').waitFor();
  assert.equal(await page.locator('.version-badge').count(), 0);
  checks.push('ordinary-guest-sees-no-internal-identifiers');

  const fake = { ...version, sha: '1234567', commit: '1234567' + '0'.repeat(33) };
  await page.route('**/api/version', route => route.fulfill({ json: fake, headers: { 'cache-control': 'no-store' } }));
  await page.goto(base + '/home?v=1');
  await page.locator('.version-badge__btn--stale').waitFor();
  await page.locator('.version-badge__btn').click();
  assert((await page.locator('.version-badge__warn').innerText()).includes(fake.sha));
  assert.equal(new URL(page.url()).pathname, '/home');
  checks.push('explicit-stale-fixture-warns-without-changing-reading-route');
  assert.deepEqual(errors, []);
  fs.writeFileSync(out + '/report.json', JSON.stringify({ base, version, checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }));
} finally { await browser.close(); }
