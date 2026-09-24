// Synthetic fixtures only. Missing/replaced baselines fail; tests never approve them.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const root = new URL('./visual-baselines/', import.meta.url);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function compareImages(expected, actual) {
  const a = PNG.sync.read(expected), b = PNG.sync.read(actual);
  if (a.width !== b.width || a.height !== b.height) return { passed: false, reason: 'dimensions', expected: [a.width, a.height], actual: [b.width, b.height] };
  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.12, includeAA: false });
  return { passed: pixels <= 20, pixels, allowance: 20, diff: PNG.sync.write(diff) };
}

export async function accessibility(page, selector) {
  if (!await page.evaluate(() => !!window.axe)) await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  return page.evaluate(async selector => {
    const result = await window.axe.run({ include: [selector] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    const concise = rows => rows.map(row => ({ id: row.id, impact: row.impact, help: row.help, nodes: row.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
    return { violations: concise(result.violations), incomplete: concise(result.incomplete), passes: result.passes.length };
  }, selector);
}

export async function captureQuality({ page, report, out, name, selector, audit = selector, viewport = false }) {
  if (!/^[a-z0-9-]+$/.test(name)) throw Error('invalid_visual_case');
  report.visual ||= [];
  await page.evaluate(() => document.fonts.ready);
  const target = page.locator(selector);
  await target.waitFor({ state: 'visible' });
  // Freeze transitions and caret only while capturing. No content is masked.
  const shot = () => (viewport ? page : target).screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
  let previous = await shot(), actual, stable = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.waitForTimeout(120);actual = await shot();
    if (compareImages(previous, actual).passed) { stable = true;break; }
    previous = actual;
  }
  const version = page.context().browser().version();
  const key = `${process.platform}-${process.arch}-${report.engine}-${version}`;
  const dir = path.join(out, 'visual', key);fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.png`), actual);
  const a11y = await accessibility(page, audit);
  const baseline = new URL(`${key}/${name}.png`, root), receipt = new URL(`${key}/${name}.json`, root);
  let comparison = { passed: false, reason: 'missing_reviewed_baseline' };
  if (fs.existsSync(baseline) && fs.existsSync(receipt)) {
    const bytes = fs.readFileSync(baseline), reviewed = JSON.parse(fs.readFileSync(receipt));
    if (reviewed.sha256 !== sha256(bytes) || !reviewed.review || reviewed.name !== name || reviewed.key !== key) comparison = { passed: false, reason: 'invalid_baseline_receipt' };
    else {
      const { diff, ...result } = compareImages(bytes, actual);comparison = result;
      if (diff && !result.passed) fs.writeFileSync(path.join(dir, `${name}-diff.png`), diff);
    }
  }
  const result = { name, key, selector, audit, capture: viewport ? 'viewport' : 'element', viewport: page.viewportSize(), osRelease: os.release(), sha256: sha256(actual), stable, comparison, a11y };
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(result, null, 2));
  report.visual.push(result);
}

export function assertQuality(report, names) {
  const rows = report.visual || [];
  const failures = names.flatMap(name => {
    const row = rows.find(item => item.name === name);
    return !row ? [`${name}: missing`] : [!row.stable && `${name}: unstable`, !row.comparison.passed && `${name}: ${row.comparison.reason || `${row.comparison.pixels} changed pixels`}`, row.a11y.violations.length > 0 && `${name}: ${row.a11y.violations.map(v => v.id).join(', ')}`].filter(Boolean);
  });
  if (failures.length) throw Error(`visual_quality_failed\n${failures.join('\n')}`);
}

export async function qualityCanary(browser) {
  const page = await browser.newPage({ viewport: { width: 240, height: 100 } });
  try {
    await page.setContent('<html lang="ko"><title>검출 검증</title><main><button aria-label="설명 열기" style="width:80px;height:44px;background:#222;color:white">+</button></main></html>');
    const before = await page.screenshot();
    if ((await accessibility(page, 'main')).violations.length) throw Error('canary_control_failed');
    await page.locator('button').evaluate(el => { el.style.marginLeft='2px'; });
    if (compareImages(before, await page.screenshot()).passed) throw Error('layout_regression_not_detected');
    await page.locator('button').evaluate(el => { el.removeAttribute('aria-label');el.textContent=''; });
    const broken = await accessibility(page, 'main');
    if (!broken.violations.some(row => row.id === 'button-name')) throw Error('unnamed_button_not_detected');
    return ['unnamed-button-rejected', 'two-pixel-layout-change-rejected'];
  } finally { await page.context().close(); }
}
