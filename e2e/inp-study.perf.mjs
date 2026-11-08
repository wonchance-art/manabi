// INP-001 · STUDY-FIXTURE-001 — /study 답 제출 상호작용 지연(INP 근사, 2026-11-08 KST). CI가 돌리지 않는 측정 도구다(.perf.mjs).
// 화면 벽 환경(startWallEnv — 합성 무거운 계정 백엔드 + next start)에서 폭 390 · CPU 4×로 보기 누름 · 「계속 →」을 판마다 3문항씩 잰다.
//   npm run e2e:build(또는 wall:build) 뒤  node --test e2e/inp-study.perf.mjs
// 기준 수치 · 절차: docs/perf-measurement.md 「상호작용 지연」.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { startWallEnv } from '../scripts/wall-capture.mjs';

const INIT = () => { window.__ev = []; window.__loaf = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ id: e.interactionId, name: e.name, t: Math.round(e.startTime), dur: e.duration, delay: Math.round(e.processingStart - e.startTime), proc: Math.round(e.processingEnd - e.processingStart), pres: Math.round(e.startTime + e.duration - e.processingEnd) }); }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  new PerformanceObserver((l) => { for (const f of l.getEntries()) window.__loaf.push({ t: Math.round(f.startTime), dur: Math.round(f.duration), scripts: (f.scripts || []).map((s) => ({ d: Math.round(s.duration), src: (s.sourceURL || '').split('/').pop().slice(0, 40), fn: (s.sourceFunctionName || s.invoker || '').slice(0, 40) })).sort((a, b) => b.d - a.d).slice(0, 3) }); }).observe({ type: 'long-animation-frame', buffered: true }); };
const worst = (page, since) => page.evaluate((since) => {
  const by = {}; for (const e of window.__ev.filter((x) => x.t >= since)) if (!by[e.id] || e.dur > by[e.id].dur) by[e.id] = e;
  const top = Object.values(by).sort((a, b) => b.dur - a.dur)[0]; if (!top) return 'none';
  const loaf = window.__loaf.filter((f) => f.t <= top.t + top.dur && f.t + f.dur >= top.t);
  return `${top.dur}ms (delay ${top.delay} · proc ${top.proc} · pres ${top.pres}) ${top.name} | ${loaf.map((f) => `${f.dur}:${f.scripts.map((s) => `${s.d}:${s.src}:${s.fn}`).join(',')}`).join(' ; ')}`;
}, since);
const now = (page) => page.evaluate(() => Math.round(performance.now()));

let env;
before(async () => { env = await startWallEnv({ out: await mkdtemp(join(tmpdir(), 'inp-study-')), port: Number(process.env.STUDY_PERF_PORT || 3173) }); });
after(async () => { await env?.close(); });

test('/study 답 제출 INP', async () => {
  for (let round = 0; round < Number(process.env.ROUNDS || 3); round++) {
    const context = await env.newContext({ persona: 'filled', viewportKey: 'mobile' });
    try {
      await context.addInitScript(INIT);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.goto(`${env.baseURL}/study`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      const options = page.locator('.fr-quiz__opt'); await options.first().waitFor({ timeout: 60000 }); await page.waitForTimeout(4000);
      for (let item = 0; item < 3; item++) {
        // 보기 문항만 잰다 — 몸풀기 뒤에는 쓰기 · 문법 같은 다른 유형이 올 수 있다(그 판은 거기서 끝낸다).
        if (!(await options.first().waitFor({ timeout: 10000 }).then(() => true, () => false))) break;
        let t0 = await now(page); await options.first().click();
        const next = page.getByRole('button', { name: /^(계속|결과 보기) →$/ });
        const graded = await next.waitFor({ timeout: 8000 }).then(() => true, () => false); await page.waitForTimeout(1200);
        console.log('INP study', `r${round}`, `item${item}`, 'answer', await worst(page, t0));
        if (!graded) break; // 보기를 눌러도 채점이 바로 서지 않는 유형(짝 맞추기 등) — 이 판은 여기까지
        t0 = await now(page); await next.click(); await page.waitForTimeout(1500);
        console.log('INP study', `r${round}`, `item${item}`, 'next', await worst(page, t0));
      }
    } finally { await context.close(); }
  }
});
