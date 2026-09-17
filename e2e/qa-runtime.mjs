// Portable browser lifecycle for synthetic-only QA. No account state is persisted.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright-core';

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

export async function finishQa({ browser, db, server, context, report, out }) {
  const failures = [], resources = [];
  if (context && process.env.QA_TRACE === '1') {
    try { await boundedClose('trace', () => context.tracing.stop(report.failure ? { path: path.join(out, 'failure-trace.zip') } : {})); }
    catch (error) { failures.push(error.message); }
  }
  // Explicit contexts can own downloads and pending page work. Close them before
  // the browser process, especially WebKit's separate Linux web processes.
  for (const [name, resource] of [['context', context], ['browser', browser], ['database', db], ['server', server]]) {
    if (!resource) continue;
    const started = Date.now();
    try { await boundedClose(name, () => resource.close());resources.push({ name, status: 'completed', durationMs: Date.now() - started }); }
    catch (error) { failures.push(error.message);resources.push({ name, status: 'failed', durationMs: Date.now() - started }); }
  }
  report.cleanup = { status: failures.length ? 'failed' : 'completed', resources, ...(failures.length ? { errors: failures } : {}) };
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  if (failures.length) throw Error(failures.join('; '));
}
