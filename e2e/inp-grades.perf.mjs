// INP-001 — 로그인 상호작용 지연(INP 근사, 2026-11-08 KST): 뷰어 낱말 탭 · 4등급 누름(저장 전 · 복습 차례). 폭 390 · CPU 4×.
// 합성 고정물(material-editing-backend) — 실계정 · 운영 DB 없음, 응답은 바로 돌려준다. CI가 돌리지 않는 측정 도구다(.perf.mjs).
// e2e 빌드 + server-fetch-mock 서버(CI 「서재 과 추가·관리」 단계와 같은 8878)를 띄운 뒤:
//   COMPOSER_BASE_URL=http://127.0.0.1:8878 node --test e2e/inp-grades.perf.mjs
// 기준 수치 · 절차: docs/perf-measurement.md 「상호작용 지연」.
import { test } from 'node:test';
import { fixture } from './fixtures/material-editing-backend.mjs';
import { legacyLearningSnapshot } from './fixtures/learning-snapshot.mjs';
const owner = '00000000-0000-4000-8000-000000000172';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const respond = (r, v, s = 200) => r.fulfill({ status: s, headers: cors, contentType: 'application/json', body: JSON.stringify(v) });
const word = (text, i) => ({ id: 'word-' + i, user_id: owner, word_text: text, base_form: text, meaning: text === '猫' ? '고양이' : '개', language: 'Japanese', interval: 2, ease_factor: 5, repetitions: 1, next_review_at: '2020-01-01T00:00:00Z', last_reviewed_at: '2019-12-31T00:00:00.000Z' });
const INIT = () => { window.__ev = []; window.__loaf = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ id: e.interactionId, name: e.name, t: Math.round(e.startTime), dur: e.duration, delay: Math.round(e.processingStart - e.startTime), proc: Math.round(e.processingEnd - e.processingStart), pres: Math.round(e.startTime + e.duration - e.processingEnd) }); }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  new PerformanceObserver((l) => { for (const f of l.getEntries()) window.__loaf.push({ t: Math.round(f.startTime), dur: Math.round(f.duration), scripts: (f.scripts || []).map((s) => ({ d: Math.round(s.duration), src: (s.sourceURL || '').split('/').pop().slice(0, 40), fn: (s.sourceFunctionName || s.invoker || '').slice(0, 40) })).sort((a, b) => b.d - a.d).slice(0, 3) }); }).observe({ type: 'long-animation-frame', buffered: true }); };
const worst = (p, since) => p.evaluate((since) => { const by = {}; for (const e of window.__ev.filter((x) => x.t >= since)) if (!by[e.id] || e.dur > by[e.id].dur) by[e.id] = e; const top = Object.values(by).sort((a, b) => b.dur - a.dur)[0]; const loaf = top ? window.__loaf.filter((f) => f.t <= top.t + top.dur && f.t + f.dur >= top.t) : []; return top ? `${top.dur}ms (delay ${top.delay} · proc ${top.proc} · pres ${top.pres}) ${top.name} | ${loaf.map((f) => f.dur + ':' + f.scripts.map((s) => s.d + ':' + s.src + ':' + s.fn).join(',')).join(' ; ')}` : 'none'; }, since);
async function setup(due) {
  const f = await fixture({ width: 390, height: 844 }); const rows = due ? [word('猫', 1), word('犬', 2)] : [];
  f.rows.push({ id: 94101, user_id: owner, title: 'INP 측정', raw_text: '猫 犬', source_type: 'text', created_at: new Date().toISOString(), processed_json: { status: 'completed', metadata: { language: 'Japanese' }, sequence: ['id_0_0', 'id_0_1'], dictionary: { id_0_0: { text: '猫', base_form: '猫', furigana: 'ねこ', meaning: '고양이', pos: '명사' }, id_0_1: { text: '犬', base_form: '犬', furigana: 'いぬ', meaning: '개', pos: '명사' } } } });
  await f.context.addInitScript(INIT);
  await f.context.route('**/api/learning/exclusions', (r) => respond(r, { items: [] }));
  await f.context.route('**/api/learning/vocabulary**', (r) => { const u = new URL(r.request().url()); if (u.searchParams.get('view') !== 'learning') return respond(r, { contextAdded: true }); return respond(r, legacyLearningSnapshot({ actorId: owner, rows, known: [], exclusions: [], fields: u.searchParams.get('fields'), ids: u.searchParams.get('ids') })); });
  await f.context.route('**/rest/v1/vocabulary_with_exclusions*', (r) => respond(r, rows.map((w) => ({ ...w, is_excluded: false }))));
  await f.context.route('**/api/tts?**', (r) => respond(r, { error: 'no' }, 500)); await f.context.route('**/api/dict?**', (r) => respond(r, null));
  await f.context.route('**/rest/v1/user_vocabulary*', (r) => { const q = r.request(); if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors }); if (q.method() === 'POST') { const p = q.postDataJSON(); const row = Array.isArray(p) ? p[0] : p; const s = { ...row, id: 'saved-' + rows.length }; rows.push(s); return respond(r, [s]); } return respond(r, rows); });
  await f.context.route('**/rest/v1/review_events*', (r) => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : respond(r, []));
  const cdp = await f.context.newCDPSession(f.page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await f.page.goto('/viewer/94101', { waitUntil: 'domcontentloaded', timeout: 120000 }); await f.page.locator('[data-source-token="id_0_0"]').waitFor(); await f.page.waitForTimeout(4000);
  return f; }
for (const due of [false, true]) test('grades ' + (due ? 'due inline' : 'new save'), async () => {
  for (let r = 0; r < 3; r++) { const f = await setup(due); try {
    for (const i of [0, 1]) {
      let t0 = await f.page.evaluate(() => Math.round(performance.now())); await f.page.locator('[data-source-token="id_0_' + i + '"]').click();
      const actions = f.page.locator('.reader-card-actions').filter({ visible: true }).first(); await actions.locator('.review-score-btn').first().waitFor(); await f.page.waitForTimeout(1200);
      console.log('INP', due ? 'due' : 'new', 'r' + r, 'tap word', i, await worst(f.page, t0));
      t0 = await f.page.evaluate(() => Math.round(performance.now())); await actions.getByRole('button', { name: i ? /^알맞음/ : /^쉬움/ }).click(); await f.page.waitForTimeout(1500);
      console.log('INP', due ? 'due' : 'new', 'r' + r, 'grade', i, await worst(f.page, t0));
    } } finally { await f.context.close(); } } });
