// 오프라인 복습(F9) · 채점당 호출(F5) — 무거운 합성 계정(e2e/fixtures/heavy-account.mjs) 위의 격리 production 서버. 실계정 · 운영 DB 무관.
// 오너 승인 2026-10-25 KST 「권장대로」(로그인 감사 ㉡). 켜는 법(리포 루트):
//   node e2e/fixtures/heavy-account.mjs <backendPort>
//   E2E_HEAVY_BACKEND=http://127.0.0.1:<backendPort> SUPABASE_SERVICE_ROLE_KEY=e2e-heavy-service-role \
//     NODE_OPTIONS="--import=$PWD/e2e/server-fetch-mock.mjs" npx next start --port <appPort>      (e2e 빌드)
//   QA_BASE=http://127.0.0.1:<appPort> E2E_HEAVY_BACKEND=http://127.0.0.1:<backendPort> node --test e2e/offline-review.e2e.mjs
// E2E_HEAVY_BACKEND가 없으면 건너뛴다(기본 e2e 무영향). OFFREV_BASELINE=1 — 이전 빌드 측정: 관찰만 적고 단언하지 않는다.
// 브라우저의 Supabase 요청은 Playwright route로 합성 백엔드에 넘긴다(x-heavy-origin: browser — 장부가 브라우저 몫으로 센다).
// QA_BASE는 localhost로 준다 — Next가 루프백 요청 주소를 localhost로 바꿔, 127.0.0.1 출처의 POST는 출처 검사(fsrs_invalid_origin)에 걸린다.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';
import { HEAVY_UID, HEAVY_SERVICE_KEY } from './fixtures/heavy-account.mjs';

const BACKEND = process.env.E2E_HEAVY_BACKEND;
const BASE = process.env.QA_BASE || process.env.COMPOSER_BASE_URL;
const BASELINE = process.env.OFFREV_BASELINE === '1';
const OUT = process.env.QA_OUT || null;
const skip = !BACKEND || !BASE ? 'E2E_HEAVY_BACKEND · QA_BASE가 있어야 한다(무거운 합성 계정 격리 서버)' : false;
const ONLINE_GRADES = Number(process.env.OFFREV_ONLINE_GRADES || 10);
const OFFLINE_TITLE = '이 표현은 연결되면 볼 수 있어요';
const PREP_FAILED = '복습을 준비하지 못했어요';

let browser;
const report = { base: BASE, baseline: BASELINE, online: [], offline: {}, errors: [] };
before(async () => { if (!skip) browser = await chromium.launch(config.use.launchOptions); });
after(async () => {
  await browser?.close();
  if (OUT) { mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/offline-review${BASELINE ? '-baseline' : ''}.json`, JSON.stringify(report, null, 2)); }
  if (!skip) console.log(`[offline-review] ${JSON.stringify({ summary: report.summary, offline: report.offline })}`);
});

const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
function session() {
  const now = Math.floor(Date.now() / 1000), at = s => new Date(s * 1000).toISOString();
  const user = { id: HEAVY_UID, aud: 'authenticated', role: 'authenticated', email: 'e2e-learner@example.com', email_confirmed_at: at(now - 60),
    confirmed_at: at(now - 60), last_sign_in_at: at(now), app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: 'E2E 학습자' }, identities: [], created_at: at(now - 3600), updated_at: at(now) };
  const access_token = [b64({ alg: 'HS256', typ: 'JWT' }), b64({ sub: HEAVY_UID, aud: 'authenticated', role: 'authenticated', e2e_role: 'learner',
    email: user.email, iat: now, exp: now + 3600 }), 'e2e'].join('.');
  return { access_token, refresh_token: 'e2e-refresh-token', expires_in: 3600, expires_at: now + 3600, token_type: 'bearer', user };
}
const heavy = async (path, init) => fetch(new URL(path, BACKEND), init);
const backendLog = async () => (await heavy('/__heavy/log')).json();
const clearLog = () => heavy('/__heavy/clear-log');
const serviceRows = async (table, query) => (await heavy(`/rest/v1/${table}?${query}`, { headers: { apikey: HEAVY_SERVICE_KEY, authorization: `Bearer ${HEAVY_SERVICE_KEY}` } })).json();

async function openReview() {
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 }, locale: 'ko-KR', serviceWorkers: 'block', reducedMotion: 'reduce' });
  context.setDefaultTimeout(60000);
  const net = { offline: false, api: [] };
  await context.addCookies([{ name: 'sb-e2e-auth-token', value: `base64-${Buffer.from(JSON.stringify(session())).toString('base64url')}`, url: BASE, sameSite: 'Lax' }]);
  await context.addInitScript(() => { try { localStorage.setItem('as_sound_on', '0'); } catch { /* 소리 끔 */ } });
  // 끊긴 동안은 Supabase · 앱 API 모두 닿지 않는다(브라우저 오프라인 에뮬레이션과 같은 결과를 route에서도 보장).
  await context.route('https://e2e.supabase.co/**', async route => {
    if (net.offline) return route.abort('internetdisconnected');
    const req = route.request(), url = new URL(req.url());
    const headers = { ...req.headers(), 'x-heavy-origin': 'browser' }; delete headers.host; delete headers['content-length'];
    const res = await fetch(new URL(`${url.pathname}${url.search}`, BACKEND), { method: req.method(), headers,
      body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() ?? undefined });
    const body = Buffer.from(await res.arrayBuffer());
    return route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body });
  });
  await context.route(`${BASE}/api/**`, route => net.offline ? route.abort('internetdisconnected') : route.fallback());
  await context.route('**/api/tts?**', route => route.fulfill({ status: 204, body: '' }));
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(String(e.message).slice(0, 200)));
  page.on('request', r => { const u = new URL(r.url()); if (u.origin === new URL(BASE).origin && u.pathname.startsWith('/api/')) net.api.push(`${r.method()} ${u.pathname}`); });
  await page.goto('/vocab', { waitUntil: 'load', timeout: 120000 });
  const start = page.locator('button.review-room-start');
  await start.waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForFunction(() => { const b = document.querySelector('button.review-room-start'); return b && !b.disabled && !/준비 중/.test(b.textContent); }, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  await start.click();
  return { context, page, net };
}

/** 지금 화면의 복습 상태 — 질문 · 소개 · 끊김 카드 · 준비 실패 · 끝. */
async function screen(page, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await page.evaluate(({ offlineTitle, prepFailed }) => {
      const text = document.querySelector('main')?.innerText || '';
      if (text.includes(offlineTitle)) return 'offline-card';
      if (text.includes(prepFailed)) return 'prep-failed';
      if (document.querySelector('.review-intro__next:not([disabled])')) return 'intro';
      if (document.querySelector('.review-reveal-btn:not([disabled])')) return 'question';
      if (document.querySelector('.review-score-btn--good')) return 'answer'; // 되돌린 카드는 뒷면(채점 막대)으로 돌아온다
      if (/이번 표현 복습을 마쳤어요|오늘 복습을 마쳤어요/.test(text) || document.querySelector('.review-finished, .review-finish')) return 'finished';
      return null;
    }, { offlineTitle: OFFLINE_TITLE, prepFailed: PREP_FAILED });
    if (state) return state;
    await page.waitForTimeout(100);
  }
  return 'stuck';
}
const headword = page => page.evaluate(() => { const h = document.querySelector('.review-card__word');
  return (h?.querySelector('ruby')?.firstChild?.textContent ?? h?.textContent ?? '').trim(); });
async function answer(page, { rating = 'good', revealed = false } = {}) {
  if (!revealed) await page.locator('.review-reveal-btn').first().click();
  const button = page.locator(`.review-score-btn--${rating}`).first();
  await page.waitForFunction(() => { const b = document.querySelector('.review-score-btn--good'); return b && !b.disabled; }, null, { timeout: 10000 });
  await page.waitForTimeout(350); // 펼친 뒤 0.3초 채점 무장(useScoreArmed)
  return button;
}
const tally = (log, origin) => log.filter(row => row.origin === origin && !row.path.startsWith('auth/v1/.well-known'));
const named = rows => rows.map(row => `${row.method} ${row.path.replace(/^rpc\//, 'rpc:')}`);

test('채점당 호출 수 — 이미 입장한 카드는 입장 왕복이 없다(F5)', { skip, timeout: 600000 }, async () => {
  await heavy('/__heavy/reset?admitted=reviewed');
  const { context, page, net } = await openReview();
  try {
    for (let i = 0; report.online.length < ONLINE_GRADES && i < ONLINE_GRADES * 3; i++) {
      const state = await screen(page);
      if (state === 'intro') { await page.locator('.review-intro__next').first().click(); continue; }
      assert.equal(state, 'question', `온라인 질문이 열려야 한다(${state})`);
      const word = await headword(page);
      const button = await answer(page);
      await page.waitForTimeout(400);
      await clearLog(); net.api.length = 0;
      await button.click();
      const next = await screen(page);
      await page.waitForTimeout(900); // 채점 저장 · 다음 카드 입장이 끝날 때까지
      const log = await backendLog();
      const browserCalls = tally(log, 'browser'), serverCalls = tally(log, 'server');
      report.online.push({ word, next, browser: browserCalls.length, server: serverCalls.length, api: [...net.api],
        nextAdmittedOnServer: !serverCalls.some(row => row.path === 'rpc/learning_admit_legacy'),
        calls: [...named(browserCalls).map(c => `B ${c}`), ...named(serverCalls).map(c => `S ${c}`)] });
      if (next === 'finished') break;
    }
    const admittedRows = report.online.filter(row => row.nextAdmittedOnServer);
    const total = row => row.browser + row.server;
    const median = rows => { const v = rows.map(total).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    const boundary = rows => rows.map(row => row.calls.filter(c => c.includes('fsrs_legacy_boundary')).length);
    report.summary = { grades: report.online.length, admittedNext: admittedRows.length, medianCallsAdmittedNext: median(admittedRows),
      medianCallsAll: median(report.online), boundaryPerGrade: boundary(report.online),
      apiPerGrade: report.online.map(row => row.api.length) };
    if (!BASELINE) {
      assert.ok(admittedRows.length >= 3, `이미 입장한 다음 카드가 몇 장은 있어야 한다: ${JSON.stringify(report.summary)}`);
      for (const row of admittedRows) {
        assert.ok(!row.api.some(call => call.includes('/api/learning/admission')), `이미 입장한 카드는 입장 API가 없다: ${JSON.stringify(row)}`);
        assert.ok(!row.api.some(call => call === 'GET /api/learning/fsrs'), `채점 뒤 FSRS 목록을 다시 읽지 않는다: ${JSON.stringify(row)}`);
      }
      assert.ok(report.summary.boundaryPerGrade.every(n => n === 1), `경계 확인은 채점당 1번: ${report.summary.boundaryPerGrade}`);
      assert.ok(report.summary.medianCallsAdmittedNext <= 8, `채점당 호출 ≤ 8: ${JSON.stringify(report.summary)}`);
    }
  } finally { await context.close(); }
});

test('끊긴 채 이어 복습 — 이미 입장한 카드는 열리고 채점은 보낼함에, 연결되면 차례대로 한 번씩(F9)', { skip, timeout: 600000 }, async () => {
  await heavy('/__heavy/reset?admitted=reviewed');
  const startedAt = new Date(Date.now() - 1000).toISOString();
  const { context, page, net } = await openReview();
  const off = report.offline = { graded: [], undone: null, reached: null, pendingNotice: null };
  try {
    // 온라인으로 한 장 — 세션이 제대로 시작했는지
    let state = await screen(page);
    while (state === 'intro') { await page.locator('.review-intro__next').first().click(); state = await screen(page); }
    assert.equal(state, 'question');
    await (await answer(page)).click();
    await page.waitForTimeout(1500);
    // 끊는다
    net.offline = true; await context.setOffline(true);
    await clearLog();
    for (let i = 0; i < 12; i++) {
      state = await screen(page);
      if (state === 'intro' || state !== 'question') { off.reached = state; break; }
      const word = await headword(page);
      await (await answer(page)).click();
      off.graded.push(word);
      await page.waitForTimeout(500);
      // 두 번째 끊긴 채점은 되돌렸다가(↶) 다시 채점한다 — 되돌린 채점은 보내지 않는다.
      if (off.graded.length === 2 && !off.undone) {
        const undo = page.locator('button.review-topbar__undo');
        await page.waitForFunction(() => !document.querySelector('button.review-topbar__undo')?.disabled, null, { timeout: 5000 }).catch(() => {});
        if (await undo.isEnabled().catch(() => false)) {
          await undo.click();
          // 되돌리기는 기기 보낼함 정착(IndexedDB)을 기다린 뒤 카드를 되감는다 — 그 신호(토스트)를 보고 읽는다.
          await page.getByText(/되돌렸어요/).first().waitFor({ timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(300);
          const back = await screen(page);
          off.undone = { word, back, again: ['question', 'answer'].includes(back) ? await headword(page) : null };
          if (off.undone.again) {
            await (await answer(page, { rating: 'hard', revealed: back === 'answer' })).click();
            off.graded.push(`${word}(다시)`); await page.waitForTimeout(500);
          }
        }
      }
    }
    if (!off.reached) off.reached = await screen(page, 3000);
    off.pendingNotice = await page.locator('.offline-notice').filter({ hasText: '기기에 저장돼 있어요' }).first().innerText().catch(() => null);
    off.browserCallsWhileOffline = tally(await backendLog(), 'browser').length;
    if (OUT) await page.screenshot({ path: `${OUT}/offline-review-${BASELINE ? 'baseline-' : ''}offline.png` });
    if (!BASELINE) {
      assert.ok(off.graded.length >= 3, `끊긴 채 세 장 이상 채점해야 한다: ${JSON.stringify(off)}`);
      assert.equal(off.browserCallsWhileOffline, 0, '끊긴 동안 서버에 닿은 요청이 없다');
      assert.ok(off.undone?.again && off.undone.again === off.undone.word, `끊긴 채 되돌리면 같은 카드가 다시 열린다: ${JSON.stringify(off.undone)}`);
      assert.match(off.pendingNotice || '', /복습 \d+개가 기기에 저장돼 있어요/);
      assert.ok(['question', 'offline-card', 'finished'].includes(off.reached) || off.graded.length >= 10, `멈추지 않는다: ${off.reached}`);
      assert.notEqual(off.reached, 'prep-failed', '끊김을 「준비하지 못했어요」로 말하지 않는다');
    }
    // 다시 잇는다 — Layout이 보낼함을 보낸다.
    const queued = off.graded.length - (off.undone?.again ? 1 : 0);
    net.offline = false; await context.setOffline(false);
    const deadline = Date.now() + 30000;
    let events = [];
    while (Date.now() < deadline) {
      events = (await serviceRows('review_events', `user_id=eq.${HEAVY_UID}&source=eq.vocab&created_at=gte.${encodeURIComponent(startedAt)}&order=created_at.asc`));
      if (events.length >= 1 + queued) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);
    events = await serviceRows('review_events', `user_id=eq.${HEAVY_UID}&source=eq.vocab&created_at=gte.${encodeURIComponent(startedAt)}&order=created_at.asc`);
    off.sentEvents = events.map(e => [e.item_key, e.created_at, e.detail?.rating]);
    off.undoMarkers = (await serviceRows('review_events', `user_id=eq.${HEAVY_UID}&source=eq.ui&created_at=gte.${encodeURIComponent(startedAt)}`)).length;
    const log = await backendLog();
    off.patchesAfterReconnect = tally(log, 'browser').filter(row => row.method === 'PATCH' && row.path === 'user_vocabulary').length;
    off.afterReconnect = await screen(page, 20000);
    if (!BASELINE) {
      assert.equal(events.length, 1 + queued, `온라인 1 + 끊긴 채점 ${queued}개가 한 번씩: ${JSON.stringify(off.sentEvents)}`);
      const times = events.map(e => Date.parse(e.created_at));
      assert.deepEqual(times, [...times].sort((a, b) => a - b), '채점 시각 순서');
      assert.equal(new Set(events.map(e => `${e.item_key}|${e.created_at}`)).size, events.length, '중복 없음');
      assert.equal(off.undoMarkers, 0, '보내기 전에 되돌린 채점은 보낸 적이 없어 되돌리기 표식도 없다');
      assert.equal(off.patchesAfterReconnect, queued, '일정 쓰기도 끊긴 채점마다 한 번');
      if (off.reached === 'offline-card') assert.equal(off.afterReconnect, 'question', '연결되면 기다리던 카드가 저절로 열린다');
    }
  } finally { await context.close(); }
});
