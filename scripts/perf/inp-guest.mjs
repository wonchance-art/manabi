#!/usr/bin/env node
// INP-001 — 손님 상호작용 지연(INP 근사, 2026-11-08 KST). 뷰어 낱말 탭 → 카드 · 「함께 읽는 글」 칩 · 정렬(키보드).
// iPhone 13 · CPU 4× · Event Timing(상호작용 id별 최대 duration) + Long Animation Frame 스크립트 출처. 운영을 그대로 연다(요청 가로채기 없음).
//   node scripts/perf/inp-guest.mjs            (BASE=https://www.manabi.co.kr ROUNDS=3)
// 로그인 몫(4등급)은 e2e/inp-grades.perf.mjs. 기준 수치 · 절차: docs/perf-measurement.md 「상호작용 지연」.
import { chromium, devices } from 'playwright-core';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/opt/pw-browsers/chromium';
const BASE = process.env.BASE || 'https://www.manabi.co.kr'; const ROUNDS = +(process.env.ROUNDS || 3);
const init = () => { window.__ev = []; window.__loaf = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ id: e.interactionId, name: e.name, t: Math.round(e.startTime), dur: e.duration, delay: Math.round(e.processingStart - e.startTime), proc: Math.round(e.processingEnd - e.processingStart), pres: Math.round(e.startTime + e.duration - e.processingEnd), target: (e.target?.className || e.target?.tagName || '').toString().slice(0, 40) }); }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  try { new PerformanceObserver((l) => { for (const f of l.getEntries()) window.__loaf.push({ t: Math.round(f.startTime), dur: Math.round(f.duration), block: Math.round(f.blockingDuration), scripts: (f.scripts || []).map((s) => ({ d: Math.round(s.duration), inv: (s.invoker || '').slice(0, 60), src: (s.sourceURL || '').split('/').pop().slice(0, 40), fn: (s.sourceFunctionName || '').slice(0, 30), st: Math.round(s.startTime) })).sort((a, b) => b.d - a.d).slice(0, 3) }); }).observe({ type: 'long-animation-frame', buffered: true }); } catch {} };
const worst = async (p, since) => p.evaluate((since) => { const by = {}; for (const e of window.__ev.filter((x) => x.t >= since)) if (!by[e.id] || e.dur > by[e.id].dur) by[e.id] = e; const list = Object.values(by).sort((a, b) => b.dur - a.dur); const top = list[0]; const loaf = top ? window.__loaf.filter((f) => f.t <= top.t + top.dur && f.t + f.dur >= top.t) : []; return { n: list.length, top, loaf }; }, since);
async function session(scn) {
  const b = await chromium.launch({ executablePath });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'ko-KR', serviceWorkers: 'block' }); await ctx.addInitScript(init);
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const out = await scn(p); await b.close(); return out; }
const now = (p) => p.evaluate(() => Math.round(performance.now()));
const viewer = (id, idxs) => async (p) => { await p.goto(BASE + '/viewer/' + id, { waitUntil: 'load', timeout: 90000 }); await p.waitForTimeout(6000); const res = [];
  for (const i of idxs) { const tok = p.locator('.surface[role="button"]').nth(i); if (!(await tok.count())) { res.push({ i, missing: true }); continue; }
    await p.keyboard.press('Escape'); await p.waitForTimeout(800); await tok.scrollIntoViewIfNeeded().catch(() => {});
    const t0 = await now(p); const ok = await tok.tap({ timeout: 8000 }).then(() => true, () => false); if (!ok) { res.push({ i, blocked: true }); continue; } await p.locator('.word-detail-card').filter({ visible: true }).first().waitFor({ timeout: 15000 }).catch(() => {}); await p.waitForTimeout(1500); res.push({ i, ...(await worst(p, t0)) }); }
  return res; };
const reading = async (p) => { await p.goto(BASE + '/discover?view=reading', { waitUntil: 'load', timeout: 90000 }); await p.waitForTimeout(6000); const res = [];
  for (const name of ['일본어', '영어', '중국어', '전체']) { const t0 = await now(p); await p.getByRole('button', { name, exact: true }).first().tap(); await p.waitForTimeout(1500); res.push({ act: 'chip ' + name, ...(await worst(p, t0)) }); }
  const sel = p.locator('select.materials-sort'); await sel.focus();
  for (const v of ['ArrowDown', 'ArrowDown', 'ArrowUp']) { const t0 = await now(p); await p.keyboard.press(v); await p.waitForTimeout(1500); res.push({ act: 'sort key ' + v + ' → ' + (await sel.inputValue()), ...(await worst(p, t0)) }); }
  return res; };
(async () => { const SC = { 'viewer-en': viewer(120, [0, 3, 8]), 'viewer-ja': viewer(45, [0, 3, 8]), 'viewer-zh': viewer(371, [0, 3, 8]), reading };
  for (const [name, scn] of Object.entries(SC)) for (let r = 0; r < ROUNDS; r++) { const res = await session(scn); for (const x of res) console.log(JSON.stringify({ name, r, ...x, top: x.top && `${x.top.dur}ms (delay ${x.top.delay} · proc ${x.top.proc} · pres ${x.top.pres}) ${x.top.name} ${x.top.target}`, loaf: (x.loaf || []).map((f) => `${f.dur}/${f.block} ${f.scripts.map((s) => `${s.d}:${s.src}:${s.fn || s.inv}`).join(' , ')}`) })); } })();
