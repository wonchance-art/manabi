// Portable browser lifecycle for synthetic-only QA. No account state is persisted.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright-core';
import { writeJson } from '../scripts/qa-state.mjs';

export async function launchQaBrowser(engine) {
  if (!['chromium', 'webkit'].includes(engine)) throw Error('unknown_qa_browser');
  return (engine === 'webkit' ? webkit : chromium).launch({
    headless: true,
    ...(engine === 'chromium' && process.env.QA_CHROME ? { executablePath: process.env.QA_CHROME } : {}),
  });
}

export async function traceQa(context) {
  if (process.env.QA_TRACE === '1') await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
}

// Browser engines may deliver multi-step synthetic moves within a single frame.
// Canvas editors need rendered samples, including a completed pointer-up.
export const paintQa = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
export async function dragQa(page, points, steps = 12) {
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  try {
    await paintQa(page);
    for (let n = 1; n < points.length; n++) {
      const from = points[n - 1], to = points[n];
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
        await paintQa(page);
      }
    }
  } finally { await page.mouse.up();await paintQa(page); }
}

async function boundedClose(name, action) {
  let timer;
  try {
    await Promise.race([action(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(`${name}_cleanup_timeout`)), name === 'browser' ? 30_000 : 15_000);
    })]);
  } finally { clearTimeout(timer); }
}

// Only local counters: never inspect URLs, page text, cookies, storage or argv.
function cleanupSnapshot(browser, stage) {
  const snapshot = { stage, runnerRssBytes: process.memoryUsage().rss };
  if (!browser) return snapshot;
  const unavailable = [];
  try { snapshot.connected = browser.isConnected(); } catch { unavailable.push('connection'); }
  try {
    const contexts = browser.contexts();
    snapshot.contexts = contexts.length;
    snapshot.pages = contexts.map(context => context.pages().length);
  } catch { unavailable.push('contextsAndPages'); }
  if (unavailable.length) snapshot.unavailable = unavailable;
  return snapshot;
}

export async function finishQa({ browser, db, server, context, report, out }) {
  const failures = [], resources = [];
  try { fs.mkdirSync(out, { recursive: true }); } catch { failures.push('cleanup_output_failed'); }
  const tracePath = path.join(out, 'failure-trace.zip');
  const cleanup = { status: 'running', resources, diagnostics: [cleanupSnapshot(browser, 'before')], trace: { status: 'disabled' } };
  report.cleanup = cleanup;
  // Keep the current stage readable even if the QA process is interrupted.
  const persist = () => {
    try {
      writeJson(path.join(out, 'report.json'), report);
    } catch {
      if (!failures.includes('cleanup_report_write_failed')) failures.push('cleanup_report_write_failed');
    }
  };
  persist();
  if (context && process.env.QA_TRACE === '1') {
    cleanup.active = 'trace';cleanup.trace.status = 'exporting';persist();
    try {
      // Export BEFORE closing the context. Retain it if teardown itself fails,
      // even when all screen assertions passed; discard only after full success.
      await boundedClose('trace', () => context.tracing.stop({ path: tracePath }));
      if (!fs.existsSync(tracePath)) throw Error('trace_export_missing');
      cleanup.trace = { status: 'saved', file: 'failure-trace.zip' };
    } catch (error) { failures.push(error.message);cleanup.trace.status = 'failed'; }
    persist();
  }
  // Explicit contexts can own downloads and pending page work. Close them before
  // the browser process, especially WebKit's separate Linux web processes.
  for (const [name, resource] of [['context', context], ['browser', browser], ['database', db], ['server', server]]) {
    if (!resource) continue;
    cleanup.active = name;persist();
    const started = Date.now();
    try { await boundedClose(name, () => resource.close());resources.push({ name, status: 'completed', durationMs: Date.now() - started }); }
    catch (error) { failures.push(error.message);resources.push({ name, status: 'failed', durationMs: Date.now() - started }); }
    cleanup.diagnostics.push(cleanupSnapshot(browser, `after-${name}`));persist();
  }
  if (!report.failure && !failures.length && cleanup.trace.status === 'saved') {
    try { fs.unlinkSync(tracePath);cleanup.trace = { status: 'discarded' }; }
    catch { failures.push('trace_discard_failed'); }
  }
  delete cleanup.active;
  cleanup.status = failures.length ? 'failed' : 'completed';
  if (failures.length) cleanup.errors = failures;
  persist();
  // A final report write can itself fail; cleanup has still attempted every resource.
  if (failures.length) { cleanup.status = 'failed';cleanup.errors = failures; }
  if (failures.length) throw Error(failures.join('; '));
}
