// 계정 경계 — 계정이 바뀐 뒤 앞 계정(A)의 데이터가 화면 · 뒤로 가기 캐시에 남지 않는다(AUTH-CACHE-CLEAR-001 · AUTH-ROUTER-REFRESH-001).
// 통합 담당이 띄운 격리 production 서버(QA_BASE, NODE_OPTIONS로 e2e/server-fetch-mock.mjs)를 쓴다. 실계정 · 운영 DB에 닿지 않는다.
//
// 표식 계정 A · B(e2e/fixtures/account-boundary-actors.mjs) — 서버 대역은 A에게만 지난 문단(/study/library)과 비공개 자료 제목
// (뷰어 generateMetadata)을, 브라우저 대역은 A에게만 비공개 자료 X(/viewer/X)와 서재 항목(/materials)을 준다. B · 손님은 RLS처럼 빈 결과.
// 각 장면은 먼저 A가 표식을 실제로 보는지 확인한다(양성 대조 — 대역이 깨져 「처음부터 안 보임」으로 통과하지 않게).
//
//  ① 같은 탭: A 로그아웃 → B 로그인 → /viewer/X · /materials · /study/library에서 A 표식 0
//  ② 다른 탭에서 B 로그인(SIGNED_IN B, SIGNED_OUT 없음) → 원래 탭의 지금 화면 · 뒤로 가기 캐시에서 A 표식 0
//  ③ 계정 삭제 뒤(signOut) 지금 화면 · 뒤로 가기에서 A 표식 0
//  ④ 손님 → 로그인 · 첫 복원 · 토큰 갱신에서는 관문 새로고침이 없다(RSC 요청 수)
//
// 「A 표식 0」은 세 겹으로 본다: 그려진 글(innerText) · 문서 제목을 매 변경마다 감시(한 번이라도 보이면 실패),
// 그리고 전환 뒤 B 세션으로 받은 응답 본문에 표식이 없는지.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';
import { legacyLearningSnapshot, inactiveFsrsStatus, inactiveLearningAdmission } from './fixtures/learning-snapshot.mjs';
import { BOUNDARY_ACTORS, BOUNDARY_MARKER, BOUNDARY_MATERIAL_ID } from './fixtures/account-boundary-actors.mjs';

const base = process.env.QA_BASE;
assert.ok(base, 'QA_BASE must identify the integration owner\'s isolated app server');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));

const X = BOUNDARY_MATERIAL_ID;
const EMAIL = { A: 'boundary-a@example.com', B: 'boundary-b@example.com' };
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS,HEAD', 'access-control-expose-headers': 'content-range' };
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');

function sessionFor(actor, { expiresIn = 3600 } = {}) {
  const sub = BOUNDARY_ACTORS[actor], now = Math.floor(Date.now() / 1000);
  const user = { id: sub, aud: 'authenticated', role: 'authenticated', email: EMAIL[actor], email_confirmed_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { display_name: `표식 ${actor}` }, created_at: new Date().toISOString() };
  return { access_token: `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + expiresIn })}.e2e`,
    refresh_token: `boundary-refresh-${actor}`, expires_in: expiresIn, expires_at: now + expiresIn, token_type: 'bearer', user };
}
const bearerSub = request => {
  const token = request.headers().authorization?.replace(/^Bearer\s+/i, '');
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub || null; } catch { return null; }
};
// 앱 API(/api/learning/*)는 Authorization 없이 세션 쿠키로 온다 — 그때는 쿠키의 세션에서 계정을 읽는다(@supabase/ssr base64- 형식).
const cookieSub = request => {
  const raw = /(?:^|;\s*)sb-e2e-auth-token=([^;]+)/.exec(request.headers().cookie || '')?.[1];
  if (!raw) return null;
  try {
    const value = decodeURIComponent(raw);
    const session = JSON.parse(value.startsWith('base64-') ? Buffer.from(value.slice(7), 'base64url').toString('utf8') : value);
    return JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8')).sub || null;
  } catch { return null; }
};
const actorSub = request => bearerSub(request) || cookieSub(request);
const isA = request => bearerSub(request) === BOUNDARY_ACTORS.A;

// A의 비공개 자료 X — 뷰어가 그리는 최소 모양(자료 제목에 표식).
const tokens = [['今日', 'きょう', '오늘'], ['は', '', ''], ['本', 'ほん', '책'], ['を', '', ''], ['読む', 'よむ', '읽다']];
const privateRow = (() => {
  const sequence = [], dictionary = {};
  tokens.forEach(([text, furigana, meaning], i) => { const id = `id_0_${i}`; sequence.push(id); dictionary[id] = { text, base_form: text, furigana, meaning, pos: '명사' }; });
  return { id: X, user_id: BOUNDARY_ACTORS.A, owner_id: BOUNDARY_ACTORS.A, visibility: 'private', title: `${BOUNDARY_MARKER} 제목`,
    raw_text: tokens.map(t => t[0]).join(''), source_type: 'text', created_at: new Date().toISOString(), document_json: null,
    processed_json: { status: 'completed', metadata: { language: 'Japanese' }, sequence, dictionary } };
})();
// personal_library_page_v2 항목(library_private.catalog_sources 열 + 상태 열)
const libraryItem = { target_kind: 'material', target_id: String(X), title: privateRow.title, original_title: privateRow.title, display_title: null,
  language: 'Japanese', level: null, created_at: privateRow.created_at, excerpt: privateRow.raw_text, assets: [], link_count: 0, material_id: String(X),
  child_count: 0, children: [], is_note: false, owned: true, listed: true, completed: false, context: null, opened_at: null,
  favorite: false, state: 'active', revision: 0, unavailable: false };

let browser;
before(async () => { browser = await chromium.launch(config.use.launchOptions); });
after(async () => { await browser?.close(); });

async function boundaryContext({ actor = 'A', width = 390, height = 844, expiresIn, engine = browser } = {}) {
  const context = await engine.newContext({ baseURL: base, viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  // dataOffline: Supabase(REST · Auth)만 끊는다 — 뷰어의 오프라인 폴백(기기 캐시)을 타는 조건. 앱 서버(RSC)는 그대로라 화면 이동은 된다.
  const stats = { refreshGrants: 0, deletes: 0, rsc: [], bodiesAfterWatch: [], reviewInserts: [], dataOffline: false };
  const json = (route, value, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { ...cors, ...headers }, body: JSON.stringify(value) });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await context.route('**/auth/v1/**', async route => {
    if (stats.dataOffline) return route.abort('internetdisconnected');
    const request = route.request(), url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: cors });
    if (url.pathname.endsWith('/token')) {
      const body = request.postDataJSON?.() || {};
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        stats.refreshGrants++;
        const who = body.refresh_token === 'boundary-refresh-B' ? 'B' : 'A';
        return json(route, sessionFor(who));
      }
      const who = body.email === EMAIL.B ? 'B' : body.email === EMAIL.A ? 'A' : null;
      return who ? json(route, sessionFor(who)) : json(route, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
    }
    if (url.pathname.endsWith('/user')) {
      const sub = bearerSub(request);
      const who = Object.entries(BOUNDARY_ACTORS).find(([, id]) => id === sub)?.[0];
      return who ? json(route, sessionFor(who).user) : json(route, { message: 'invalid token' }, 401);
    }
    return json(route, {});
  });
  await context.route('**/rest/v1/**', async route => {
    if (stats.dataOffline) return route.abort('internetdisconnected');
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').pop();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const sub = bearerSub(request);
    if (url.pathname.endsWith('/rpc/fsrs_legacy_boundary')) return sub ? json(route, { version: 1, actorId: sub, enrolled: false }) : json(route, { message: 'missing identity' }, 401);
    if (url.pathname.endsWith('/rpc/personal_library_page_v2')) return json(route, isA(request) ? { items: [libraryItem], total: 1 } : { items: [], total: 0 });
    if (table === 'profiles') return sub ? json(route, { id: sub, display_name: '표식 계정', role: 'learner', onboarded: true, last_login_at: new Date().toISOString(), streak_count: 1 }) : json(route, null);
    if (table === 'review_events' && request.method() === 'POST') {
      // 안 보낸 채점(outbox)의 전송 — 어느 세션(bearer)이 누구 행(user_id)을 실었는지 남긴다.
      stats.reviewInserts.push({ sub, rows: request.postDataJSON() });
      return json(route, null, 201);
    }
    if (table === 'reading_materials' && request.method() === 'GET' && url.searchParams.get('owner_id') === `eq.${BOUNDARY_ACTORS.A}`) {
      // 자료실(?tools=1) 내 자료 목록 — RLS: A 세션에만 A의 행.
      return json(route, isA(request) ? [privateRow] : [], 200, { 'content-range': isA(request) ? '0-0/1' : '*/0' });
    }
    if (table === 'reading_materials' && request.method() === 'GET' && url.searchParams.get('id') === `eq.${X}`) {
      // RLS: 비공개 X는 A에게만. 단일 행 요청(vnd.pgrst.object)은 없으면 406(PGRST116), 목록 요청은 빈 배열.
      const object = (request.headers().accept || '').includes('vnd.pgrst.object');
      if (isA(request)) return json(route, object ? privateRow : [privateRow]);
      return object ? json(route, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406) : json(route, []);
    }
    if (request.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...cors, 'content-range': '*/0' } });
    // 나머지는 빈 결과 — 개수를 세는 조회(readCompleteLegacyRows 등)가 「모름」으로 멈추지 않게 content-range를 함께 준다.
    return json(route, [], 200, { 'content-range': '*/0' });
  });
  await context.route('**/api/learning/vocabulary**', route => {
    const sub = actorSub(route.request());
    return sub ? json(route, legacyLearningSnapshot({ actorId: sub, rows: [], fields: new URL(route.request().url()).searchParams.get('fields') })) : json(route, { ok: false, code: 'fsrs_auth_required' }, 401);
  });
  await context.route('**/api/learning/fsrs', route => { const sub = actorSub(route.request()); return sub ? json(route, inactiveFsrsStatus({ actorId: sub })) : json(route, { ok: false, code: 'fsrs_auth_required' }, 401); });
  await context.route('**/api/learning/admission', route => { const sub = actorSub(route.request()); return sub ? json(route, inactiveLearningAdmission({ actorId: sub })) : json(route, { ok: false, code: 'fsrs_auth_required' }, 401); });
  await context.route('**/api/learning/exclusions', route => json(route, { items: [] }));
  await context.route('**/api/dict?**', route => json(route, null));
  await context.route('**/api/account/delete', route => { stats.deletes++; return json(route, { ok: true }); });
  if (actor) {
    const session = sessionFor(actor, { expiresIn });
    await context.addCookies([{ name: 'sb-e2e-auth-token', value: `base64-${enc(session)}`, url: base, sameSite: 'Lax' }]);
  }
  // 표식 감시 — 전환(watch) 뒤에 그려진 글 · 문서 제목에 한 번이라도 표식이 나오면 기록한다(전체 이동에도 sessionStorage로 이어진다).
  await context.addInitScript(marker => {
    const check = () => {
      try {
        if (sessionStorage.getItem('__boundaryWatch') !== '1') return;
        const seen = (document.body?.innerText || '').includes(marker) || document.title.includes(marker);
        if (seen && !sessionStorage.getItem('__boundaryLeak')) sessionStorage.setItem('__boundaryLeak', `${location.pathname}${location.search}`);
      } catch { /* 저장소 차단 — 검사 생략 */ }
    };
    let queued = false;
    const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; check(); }); } };
    new MutationObserver(schedule).observe(document, { subtree: true, childList: true, characterData: true });
    addEventListener('pageshow', check);
  }, BOUNDARY_MARKER);
  const errors = [];
  const watchPage = page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    page.on('request', request => {
      const headers = request.headers();
      if (headers.rsc === '1' && !headers['next-router-prefetch']) stats.rsc.push({ page, path: new URL(request.url()).pathname, at: Date.now() });
    });
    page.on('response', async response => {
      if (!page.__watching || !response.url().startsWith(base)) return;
      const type = response.headers()['content-type'] || '';
      if (!/text\/(html|x-component|plain)|application\/json/.test(type)) return;
      try { if ((await response.text()).includes(BOUNDARY_MARKER)) stats.bodiesAfterWatch.push(new URL(response.url()).pathname); } catch { /* 본문 없음(리디렉트 등) */ }
    });
    return page;
  };
  const page = watchPage(await context.newPage());
  return { context, page, stats, errors, watchPage };
}

const settle = async page => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(600); };
const markerVisible = page => page.evaluate(marker => (document.body?.innerText || '').includes(marker) || document.title.includes(marker), BOUNDARY_MARKER);
async function startWatch(page) { page.__watching = true; await page.evaluate(() => sessionStorage.setItem('__boundaryWatch', '1')); }
const leak = page => page.evaluate(() => sessionStorage.getItem('__boundaryLeak'));

// 앱 안 이동(클라이언트 라우터) — 전체 문서 로드가 아니라야 라우터 캐시 · 뒤로 가기 캐시(RSC)가 실제로 쓰인다.
// window.next.router는 Next 앱 라우터가 운영 빌드에도 거는 공개 인스턴스(next/dist/client/components/app-router-instance.js).
async function nav(page, path) {
  const target = new URL(path, base);
  await page.evaluate(href => window.next.router.push(href), `${target.pathname}${target.search}`);
  await page.waitForURL(url => new URL(url).pathname === target.pathname);
}

// A로 세 화면을 차례로 연다(첫 화면만 전체 로드, 나머지는 앱 안 이동) — 표식이 실제로 보이는지(양성 대조) 확인하고,
// 라우터 캐시에 A의 서버 렌더(지난 문단 · 뷰어 제목) 페이로드를 남긴다. 기록: 지난 문단 → 뷰어 → 서재 → 지난 문단 → 내 정보.
async function visitAsA(page) {
  await page.goto('/study/library');
  await page.getByRole('heading', { name: '지난 이야기' }).waitFor();
  await page.getByText(`${BOUNDARY_MARKER} 주제`).first().waitFor();
  await nav(page, `/viewer/${X}`);
  await page.locator('[data-source-token="id_0_0"]').waitFor();
  assert.ok(await markerVisible(page), '양성 대조: A는 자기 비공개 자료 제목을 본다');
  await nav(page, '/materials');
  await page.getByText(privateRow.title).first().waitFor();
  await nav(page, '/study/library');
  await page.getByText(`${BOUNDARY_MARKER} 주제`).first().waitFor();
  await nav(page, '/profile');
  await settle(page);
}

async function loginThroughForm(page, who, from = '/home', { inApp = false } = {}) {
  const entry = `/auth?from=${encodeURIComponent(from)}`;
  if (inApp) await nav(page, entry); else await page.goto(entry);
  from = new URL(from, base).pathname;
  await page.getByLabel('이메일', { exact: true }).fill(EMAIL[who]);
  await page.getByLabel('비밀번호', { exact: true }).fill('boundary-password-24');
  await page.locator('form button.auth-submit[type="submit"]').click(); // 머리말 「로그인」 버튼과 겹치지 않게 폼 제출 버튼
  await page.waitForURL(url => new URL(url).pathname === from);
  await settle(page);
}

async function assertNoMarker(page, label) {
  await settle(page);
  assert.equal(await markerVisible(page), false, `${label}: A 표식이 화면에 남았다`);
}

test('① 같은 탭: A 로그아웃 → B 로그인 뒤 /viewer/X · /materials · /study/library에서 A 데이터 0', { timeout: 120000 }, async () => {
  const { context, page, stats, errors } = await boundaryContext({ actor: 'A' });
  try {
    await visitAsA(page);
    await page.getByRole('button', { name: '로그아웃', exact: true }).first().click();
    await startWatch(page);
    await page.waitForFunction(() => !document.cookie.includes('sb-e2e-auth-token'));
    await loginThroughForm(page, 'B', '/home', { inApp: true });
    for (const path of [`/viewer/${X}`, '/materials', '/study/library']) {
      await nav(page, path);
      await assertNoMarker(page, `B ${path}`);
    }
    assert.equal(await leak(page), null, '전환 뒤 한 번이라도 A 표식이 그려졌다');
    assert.deepEqual(stats.bodiesAfterWatch, [], 'B 세션 응답에 A 표식');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('② 다른 탭에서 B 로그인(SIGNED_IN B, SIGNED_OUT 없음) — 원래 탭의 지금 화면 · 뒤로 가기 캐시에서 A 데이터 0', { timeout: 120000 }, async () => {
  const { context, page, stats, errors, watchPage } = await boundaryContext({ actor: 'A' });
  try {
    // 지난 문단(전체 로드) → 뷰어 → 서재(앱 안 이동) — 지난 문단 · 뷰어의 A 페이로드가 라우터 캐시에 남는다.
    await page.goto('/study/library');
    await page.getByText(`${BOUNDARY_MARKER} 주제`).first().waitFor();
    await nav(page, `/viewer/${X}`);
    await page.locator('[data-source-token="id_0_0"]').waitFor();
    await nav(page, '/materials');
    await page.getByText(privateRow.title).first().waitFor();
    const other = watchPage(await context.newPage());
    await loginThroughForm(other, 'B', '/home');
    // 원래 탭은 BroadcastChannel로 SIGNED_IN B만 받는다(SIGNED_OUT 없음) — 캐시 비우기 + 관문(router.refresh)이 B로 다시 그린다.
    // 전환 신호가 오기 전의 지금 화면은 당연히 A였다 — 감시는 그 화면이 B로 바뀐 다음부터 센다.
    await page.bringToFront();
    await page.waitForFunction(marker => !(document.body?.innerText || '').includes(marker) && !document.title.includes(marker), BOUNDARY_MARKER, { timeout: 15000 });
    await startWatch(page);
    await assertNoMarker(page, '원래 탭 지금 화면(/materials)');
    await page.goBack(); await assertNoMarker(page, '원래 탭 뒤로(/viewer/X)');
    await page.goBack(); await assertNoMarker(page, '원래 탭 뒤로(/study/library)');
    assert.equal(await leak(page), null, '뒤로 가기 캐시에서 A 표식이 그려졌다');
    assert.deepEqual(stats.bodiesAfterWatch, [], 'B 세션 응답에 A 표식');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('③ 계정 삭제 뒤(signOut) 지금 화면 · 뒤로 가기에서 A 데이터 0', { timeout: 120000 }, async () => {
  const { context, page, stats, errors } = await boundaryContext({ actor: 'A' });
  try {
    await visitAsA(page);
    await page.getByRole('button', { name: '계정 삭제', exact: true }).click();
    await page.getByPlaceholder('삭제', { exact: true }).fill('삭제');
    await startWatch(page);
    await page.getByRole('button', { name: '영구 삭제', exact: true }).click();
    await page.waitForFunction(() => !document.cookie.includes('sb-e2e-auth-token'));
    assert.equal(stats.deletes, 1);
    await assertNoMarker(page, '삭제 뒤 지금 화면(/profile)');
    for (const label of ['/study/library', '/materials', `/viewer/${X}`]) { await page.goBack(); await assertNoMarker(page, `삭제 뒤 뒤로(${label})`); }
    assert.equal(await leak(page), null, '삭제 뒤 한 번이라도 A 표식이 그려졌다');
    assert.deepEqual(stats.bodiesAfterWatch, [], '손님 응답에 A 표식');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('④ 손님 → 로그인 · 첫 복원 · 토큰 갱신에서는 관문 새로고침이 없다(RSC 요청 수)', { timeout: 120000 }, async () => {
  // 첫 복원 + 토큰 갱신: 곧 만료될 A 세션으로 연다 → SDK가 refresh_token으로 갱신(TOKEN_REFRESHED, 같은 계정).
  {
    const { context, page, stats, errors } = await boundaryContext({ actor: 'A', expiresIn: 40 });
    try {
      await page.goto('/materials');
      await page.getByText(privateRow.title).first().waitFor();
      const loadedAt = Date.now();
      for (let i = 0; i < 60 && stats.refreshGrants === 0; i++) await page.waitForTimeout(250);
      assert.ok(stats.refreshGrants >= 1, '토큰 갱신이 일어났다');
      await page.waitForTimeout(1500);
      const after = stats.rsc.filter(r => r.at >= loadedAt);
      assert.deepEqual(after.map(r => r.path), [], '첫 복원 · 토큰 갱신 뒤 RSC 새로고침이 없어야 한다');
      assert.ok(await markerVisible(page), '같은 계정 — A의 서재는 그대로');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  // 손님 → 로그인: 로그인 화면의 이동(push) + refresh만 — 관문은 손님에서 계정으로 갈 때 부르지 않는다(있으면 1회 더).
  {
    const { context, page, stats, errors } = await boundaryContext({ actor: null });
    try {
      await page.goto('/auth?from=%2Fmaterials');
      await settle(page);
      const before = stats.rsc.length;
      await page.getByLabel('이메일', { exact: true }).fill(EMAIL.A);
      await page.getByLabel('비밀번호', { exact: true }).fill('boundary-password-24');
      await page.locator('form button.auth-submit[type="submit"]').click(); // 머리말 「로그인」 버튼과 겹치지 않게 폼 제출 버튼
      await page.waitForURL(url => new URL(url).pathname === '/materials');
      await page.getByText(privateRow.title).first().waitFor();
      await page.waitForTimeout(1500);
      const toMaterials = stats.rsc.slice(before).filter(r => r.path === '/materials');
      console.log(JSON.stringify({ guestLoginRsc: toMaterials.length }));
      assert.ok(toMaterials.length >= 1 && toMaterials.length <= 2, `손님 → 로그인 RSC 요청 ${toMaterials.length}회(이동 1 + 로그인 화면 refresh 1이 상한)`);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

// ── ⑤ ~ ⑧ (abaa 리뷰 반영, 2026-10-18 KST) ──────────────────────────────────────────────────────────────

async function logoutFromProfile(page) {
  await nav(page, '/profile');
  await page.getByRole('button', { name: '로그아웃', exact: true }).first().click();
  await page.waitForFunction(() => !document.cookie.includes('sb-e2e-auth-token'));
  await settle(page);
}
// 기기 저장소(IndexedDB) 들여다보기 — 앱이 이미 연 DB를 판 지정 없이 연다(판을 올리거나 저장소를 만들지 않는다).
const idbKeys = (page, dbName, store) => page.evaluate(([name, storeName]) => new Promise((resolve) => {
  const req = indexedDB.open(name);
  req.onerror = () => resolve(null);
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve([]); return; }
    const all = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    all.onsuccess = () => { db.close(); resolve(all.result.map(r => ({ key: r.id ?? r.key ?? r.seq, owner: r.owner ?? r.userId ?? null, pinned: !!r.pinned }))); };
    all.onerror = () => { db.close(); resolve(null); };
  };
}), [dbName, store]);
const idbPut = (page, dbName, store, record, { version, keyPath } = {}) => page.evaluate(([name, storeName, value, ver, kp]) => new Promise((resolve, reject) => {
  const req = ver ? indexedDB.open(name, ver) : indexedDB.open(name);
  req.onupgradeneeded = () => { if (kp && !req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName, kp); };
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const db = req.result, t = db.transaction(storeName, 'readwrite');
    t.objectStore(storeName).put(value);
    t.oncomplete = () => { db.close(); resolve(true); };
    t.onerror = () => { db.close(); reject(t.error); };
  };
}), [dbName, store, record, version || null, keyPath || null]);

test('⑤ 로그아웃 → 손님으로 뒤로 가기 두 번 — A 표식 0', { timeout: 120000 }, async () => {
  // 로그아웃 진입점은 내 정보 · 계정 삭제 · 임베드뿐이다(머리말의 죽은 로그아웃 갈래는 지웠다 — accountRouterRefresh.test).
  // 이 장면은 내 정보에서 이동 없이 로그아웃한 뒤 뒤로 가기 캐시를 본다.
  const { context, page, stats, errors } = await boundaryContext({ actor: 'A' });
  try {
    await page.goto('/study/library');
    await page.getByText(`${BOUNDARY_MARKER} 주제`).first().waitFor();
    await nav(page, '/materials');
    await page.getByText(privateRow.title).first().waitFor();
    await nav(page, '/profile');
    await settle(page);
    await page.getByRole('button', { name: '로그아웃', exact: true }).first().click();
    await startWatch(page);
    await page.waitForFunction(() => !document.cookie.includes('sb-e2e-auth-token'));
    await assertNoMarker(page, '로그아웃 뒤 지금 화면(/profile)');
    await page.goBack(); await assertNoMarker(page, '손님 뒤로 1(/materials)');
    await page.goBack(); await assertNoMarker(page, '손님 뒤로 2(/study/library)');
    assert.equal(await leak(page), null, '로그아웃 뒤 한 번이라도 A 표식이 그려졌다');
    assert.deepEqual(stats.bodiesAfterWatch, [], '손님 응답에 A 표식');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('⑥ 오프라인(Supabase 끊김) — A가 받아 둔 뒤 B는 A 제목 없이 오류 · 받아둔 배지 0, A 재로그인 때 배지 · 오프라인 열기 복원', { timeout: 150000 }, async () => {
  // context.setOffline(true)는 앱 서버 RSC까지 끊어(서비스 워커 막음) 뷰어 경로가 라우트 오류 경계로 떨어진다 — 계정 판정까지 가지 못해
  // 「B가 못 엶」이 공허하게 통과했다(첫 실행 실측). 그래서 Supabase만 끊어 뷰어의 오프라인 폴백(기기 캐시 읽기)을 실제로 타게 한다.
  const { context, page, stats, errors } = await boundaryContext({ actor: 'A' });
  const tools = '/materials?tools=1';
  const offlineNotice = p => p.getByText(/연결|오프라인/).first();
  const pinChip = p => p.getByRole('button', { name: /받아둔 것만/ });
  const pinTag = p => p.locator('.tag', { hasText: '받아둠' });
  try {
    // A: 자료실 도구 화면에서 X를 받아 둔다 — 배지(받아둠) · 칩(받아둔 것만)이 생긴다(양성 대조).
    await page.goto(tools);
    await page.getByText(privateRow.title).first().waitFor();
    await page.getByLabel('자료 메뉴').first().click();
    await page.getByRole('menuitemcheckbox', { name: /받아두기/ }).first().click();
    await pinTag(page).first().waitFor();
    assert.ok(await pinChip(page).count() > 0, 'A: 받아둔 것만 칩');
    const keyA = `acct:${BOUNDARY_ACTORS.A}:${X}`;
    assert.ok((await idbKeys(page, 'anatomy-offline-cache', 'materials')).some(r => r.key === keyA && r.pinned), 'A의 계정 키로 받아 둠');
    // A → 손님 → B
    await logoutFromProfile(page);
    await loginThroughForm(page, 'B', tools, { inApp: true });
    await page.getByText('아직 보관된 개인 자료가 없어요.').waitFor(); // B의 내 자료 목록(비어 있음)이 그려진 뒤
    await startWatch(page);
    assert.equal(await pinTag(page).count(), 0, 'B: 받아둠 배지 0');
    assert.equal(await pinChip(page).count(), 0, 'B: 받아둔 것만 칩 0(B가 받아 둔 것 없음)');
    assert.ok((await idbKeys(page, 'anatomy-offline-cache', 'materials')).some(r => r.key === keyA && r.pinned), 'A의 받아 둔 기록은 지우지 않고 숨긴다');
    // B: Supabase가 끊긴 채 뷰어를 연다 — 자료 조회가 실패해 기기 캐시(B 몫)로 가고, 없으니 자료 오류 화면.
    stats.dataOffline = true;
    await nav(page, `/viewer/${X}`);
    await page.getByText('자료를 불러오지 못했어요').first().waitFor({ timeout: 15000 });
    assert.equal(await page.locator('[data-source-token]').count(), 0, 'B 오프라인: A의 본문이 열리지 않는다');
    await assertNoMarker(page, 'B 오프라인 /viewer/X');
    stats.dataOffline = false;
    assert.equal(await leak(page), null, 'B에게 A 표식');
    // B → 손님 → A: 배지 · 칩 복원, 오프라인 열기도 A에게는 된다(같은 기록 — 숨김이었을 뿐).
    page.__watching = false; await page.evaluate(() => sessionStorage.removeItem('__boundaryWatch'));
    await logoutFromProfile(page);
    await loginThroughForm(page, 'A', tools, { inApp: true });
    await pinTag(page).first().waitFor();
    assert.ok(await pinChip(page).count() > 0, 'A 재로그인: 받아둔 것만 칩 복원');
    stats.dataOffline = true;
    await nav(page, `/viewer/${X}`);
    await page.locator('[data-source-token="id_0_0"]').waitFor({ timeout: 15000 });
    assert.ok(await markerVisible(page), 'A 오프라인: 자기 받아 둔 자료를 연다(양성 대조 — 같은 폴백 경로)');
    await offlineNotice(page).waitFor();
    stats.dataOffline = false;
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('⑦ 팀 사본(local:) — A가 받은 사본을 B가 열지 못한다(A 재로그인 때 그대로)', { timeout: 120000 }, async () => {
  const { context, page, errors } = await boundaryContext({ actor: 'A' });
  const copyId = 7701, team = 'boundary-team';
  const localHref = `/viewer/local:${copyId}?team=${team}`;
  try {
    await page.goto('/materials');
    await page.getByText(privateRow.title).first().waitFor();
    // 팀 페이지가 받는 것과 같은 꼴로 A 계정 사본을 넣는다(src/lib/sharedStore.js putSharedCopy — 키 acct:<계정>:<id>, DB 판 1).
    await idbPut(page, 'anatomy-class-shared', 'copies', {
      id: `acct:${BOUNDARY_ACTORS.A}:${copyId}`, copyId, owner: BOUNDARY_ACTORS.A, team, updatedAt: null, contentRevision: null,
      material: { ...privateRow, id: copyId, title: `${BOUNDARY_MARKER} 팀 사본` }, savedAt: Date.now(),
    }, { version: 1, keyPath: { keyPath: 'id' } });
    await nav(page, localHref);
    await page.locator('[data-source-token="id_0_0"]').waitFor();
    assert.ok(await markerVisible(page), '양성 대조: A는 자기 팀 사본을 연다');
    await logoutFromProfile(page);
    await loginThroughForm(page, 'B', '/home', { inApp: true });
    await startWatch(page);
    await nav(page, localHref);
    await page.getByText('사본이 없어요').first().waitFor(); // 팀 사본 경로(LOCAL_MISSING)로 — 서버에 묻지 않고 B 몫 사본이 없다
    assert.equal(await page.locator('[data-source-token]').count(), 0, 'B: A의 팀 사본 본문이 열리지 않는다');
    await assertNoMarker(page, 'B /viewer/local:');
    assert.equal(await leak(page), null);
    assert.ok((await idbKeys(page, 'anatomy-class-shared', 'copies')).some(r => r.key === `acct:${BOUNDARY_ACTORS.A}:${copyId}`), 'A의 사본은 남아 있다');
    page.__watching = false; await page.evaluate(() => sessionStorage.removeItem('__boundaryWatch'));
    await logoutFromProfile(page);
    await loginThroughForm(page, 'A', '/home', { inApp: true });
    await nav(page, localHref);
    await page.locator('[data-source-token="id_0_0"]').waitFor();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('⑧ A의 안 보낸 채점은 B 세션 요청에 실리지 않고, A 재로그인 때 A 세션으로 보낸다', { timeout: 120000 }, async () => {
  const { context, page, stats, errors } = await boundaryContext({ actor: 'A' });
  const reviewedAt = new Date(Date.now() - 60_000).toISOString();
  const itemKey = 'boundary-grammar-item';
  try {
    await page.goto(`/viewer/${X}`);
    await page.locator('[data-source-token="id_0_0"]').waitFor(); // 뷰어가 기기 DB(anatomy-offline-cache, 판 2)를 연다
    // 오프라인 채점이 남기는 꼴(src/lib/reviewOutbox.js enqueueReview) — 문법 출처라 어휘 FSRS 단계 없이 review_events만 싣는다.
    await idbPut(page, 'anatomy-offline-cache', 'outbox', { userId: BOUNDARY_ACTORS.A, itemKey, lang: 'Japanese', source: 'grammar', correct: true, detail: null, reviewedAt });
    assert.ok((await idbKeys(page, 'anatomy-offline-cache', 'outbox')).some(r => r.owner === BOUNDARY_ACTORS.A), 'A의 대기 채점이 있다');
    await logoutFromProfile(page);
    await loginThroughForm(page, 'B', '/home', { inApp: true });
    await page.waitForTimeout(2500); // B로 앱 진입 동기화(Layout flush)가 돈다
    const carried = stats.reviewInserts.filter(r => JSON.stringify(r.rows).includes(itemKey));
    assert.deepEqual(carried, [], 'B 세션 요청에 A의 채점이 실렸다');
    assert.ok((await idbKeys(page, 'anatomy-offline-cache', 'outbox')).some(r => r.owner === BOUNDARY_ACTORS.A), 'A의 대기 채점은 지우지 않는다');
    await logoutFromProfile(page);
    await loginThroughForm(page, 'A', '/home', { inApp: true });
    for (let i = 0; i < 40 && !stats.reviewInserts.some(r => JSON.stringify(r.rows).includes(itemKey)); i++) await page.waitForTimeout(250);
    const sent = stats.reviewInserts.filter(r => JSON.stringify(r.rows).includes(itemKey));
    assert.equal(sent.length, 1, 'A 재로그인 때 한 번 보낸다');
    assert.equal(sent[0].sub, BOUNDARY_ACTORS.A, 'A 세션으로');
    const row = [].concat(sent[0].rows)[0];
    assert.equal(row.user_id, BOUNDARY_ACTORS.A);
    assert.equal(Date.parse(row.created_at), Date.parse(reviewedAt), '채점 시각 그대로');
    await page.waitForTimeout(500);
    assert.equal((await idbKeys(page, 'anatomy-offline-cache', 'outbox')).filter(r => r.owner === BOUNDARY_ACTORS.A).length, 0, '보낸 뒤 대기에서 빠진다');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

// ── ⑨ 문서 bfcache 복원(GUEST-STATIC-001 1단계, 2026-10-23 KST) ─────────────────────────────────────────────
// ②③⑤의 뒤로 가기는 앱 안 이동(RSC 라우터 캐시)이다. 문서 단위 뒤로 가기는 브라우저가 얼려 둔 페이지(bfcache)를 그대로 되살린다.
// Chrome은 no-store 문서만 「쿠키가 바뀌면 퇴출」한다 — 이미 정적인 화면(/profile · /japanese/vocab/n5, `public` 문서)은 그 안전장치가 없다.
// 실측(가드 전 빌드): 다른 탭 로그인 · 앱 화면 이동은 SDK 탭 사이 알림이 얼어 있는 페이지를 퇴출시켰다(notRestoredReasons
// broadcastchannel-message). 알림 없이 쿠키만 바뀌면(서버가 세션 쿠키를 지움 · 만료 등) 복원됐고, 쿠키가 지워진 갈래는 A 화면이 손님에게
// 그대로 남았다(/profile · /japanese/vocab/n5 둘 다). 그래서 이 장면은 알림이 없는 길을 일부러 만든다: 앱이 아닌 문서(/favicon.svg)로 떠나고,
// 쿠키만 바꾼 뒤(cookie = B 세션, clear = 지움) 뒤로 간다. 양성 대조 둘: 떠나기 전 A 표식이 보인다 · 매 갈래가 실제로 bfcache에서 복원됐다.
// Playwright 기본 인자 --disable-back-forward-cache를 빼고 띄운 브라우저로 본다.
const BF_ARGS = ['--disable-back-forward-cache'];
const aFingerprint = page => page.evaluate(([marker, email]) => document.documentElement.outerHTML.includes(marker) || document.documentElement.outerHTML.includes(email), [BOUNDARY_MARKER, EMAIL.A]);

test('⑨ 얼어 있는 동안 쿠키만 바뀐 뒤 문서 뒤로 가기(bfcache 복원) — 정적 화면에서 A 표식 0', { timeout: 240000 }, async () => {
  const bfBrowser = await chromium.launch({ ...config.use.launchOptions, ignoreDefaultArgs: BF_ARGS });
  const results = [];
  try {
    for (const path of ['/profile', '/japanese/vocab/n5']) {
      for (const via of ['cookie', 'clear']) {
        const { context, page, errors } = await boundaryContext({ actor: 'A', engine: bfBrowser });
        try {
          // 프로필 이름에 A 표식 — 내 정보(제목) · 모든 화면 머리말(내 계정 단추 title)에 그려진다. B는 표식 없는 이름.
          await context.route('**/rest/v1/profiles**', route => {
            const request = route.request();
            if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
            const sub = bearerSub(request);
            const display = sub === BOUNDARY_ACTORS.A ? `${BOUNDARY_MARKER} 프로필` : '표식 B 프로필';
            return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(sub ? { id: sub, display_name: display, role: 'learner', onboarded: true, last_login_at: new Date().toISOString(), streak_count: 1 } : null) });
          });
          await context.addInitScript(() => { addEventListener('pageshow', e => { try { const log = JSON.parse(sessionStorage.getItem('__bfShows') || '[]'); log.push({ path: location.pathname, persisted: e.persisted }); sessionStorage.setItem('__bfShows', JSON.stringify(log)); } catch { /* 저장소 차단 */ } }); });
          await page.goto(path);
          await page.waitForFunction(([marker, email]) => document.documentElement.outerHTML.includes(marker) || document.documentElement.outerHTML.includes(email), [BOUNDARY_MARKER, EMAIL.A], { timeout: 20000 });
          await settle(page);
          await page.goto('/favicon.svg'); // 앱이 아닌 문서 — SDK 알림이 없다. 지금 화면은 bfcache로 들어간다.
          if (via === 'clear') await context.clearCookies();
          else await context.addCookies([{ name: 'sb-e2e-auth-token', value: `base64-${enc(sessionFor('B'))}`, url: base, sameSite: 'Lax' }]);
          // bfcache 복원은 load를 다시 내지 않는다 — commit까지만 기다리고 pageshow 기록으로 복원 여부를 본다.
          await page.goBack({ waitUntil: 'commit' });
          await page.waitForFunction(p => JSON.parse(sessionStorage.getItem('__bfShows') || '[]').at(-1)?.path === p && document.readyState !== 'loading', path, { timeout: 20000 });
          const restored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__bfShows') || '[]').at(-1)?.persisted === true);
          const reasons = restored ? null : await page.evaluate(() => JSON.stringify(performance.getEntriesByType('navigation')[0]?.notRestoredReasons || null));
          // 복원 뒤 계정 재확인 → 같은 관문(adoptUser)으로 정리 — 5초 안에 A가 사라지고, 다시 나타나지 않는다.
          let gone = false;
          for (let i = 0; i < 50 && !gone; i++) { gone = !(await aFingerprint(page)); if (!gone) await page.waitForTimeout(100); }
          await settle(page);
          const after = await aFingerprint(page);
          results.push({ path, via, restored, gone, after, reasons });
          assert.equal(restored, true, `양성 대조: ${path} · ${via}가 bfcache에서 복원돼야 장면이 의미가 있다 — ${reasons}`);
          assert.equal(gone && !after, true, `${path} · ${via}: bfcache 복원 뒤 A 표식이 남았다`);
          assert.deepEqual(errors, []);
        } finally { await context.close(); }
      }
    }
    console.log(JSON.stringify({ bfcacheScene: results }));
  } finally { await bfBrowser.close(); }
});

test('⑩ 끊긴 서재(Supabase 끊김) — 「이 기기에 받아 둔 자료」는 지금 계정 것만: A는 자기 사본을 보고 열며, B는 A 제목 없이 빈 안내', { timeout: 150000 }, async () => {
  // OFFLINE-SWEEP-001 P1. 서재 목록이 연결 실패로 끝나면 세 칸 실패 대신 기기 사본 목록(listDeviceMaterials)을 보인다. ⑥과 같은 이유로
  // Supabase만 끊는다(앱 서버 RSC는 그대로 — 서비스 워커 없이도 서재 · 뷰어 화면이 선다). 브라우저 끊김(navigator.onLine)은 단위 계약이 본다.
  const { context, page, stats, errors } = await boundaryContext({ actor: 'A' });
  const shelfHeading = p => p.getByRole('heading', { name: '이 기기에 받아 둔 자료' });
  const threeFailures = p => p.getByText(/^(읽던 곳|폴더|자료 목록) · 불러오지 못했어요/);
  try {
    // A: 자료실 도구 화면에서 X를 받아 둔다(⑥과 같은 길) — 계정이 바뀌어도 지우지 않고 숨기는 기록이라 B 장면이 공허하지 않다.
    const keyA = `acct:${BOUNDARY_ACTORS.A}:${X}`;
    await page.goto('/materials?tools=1');
    await page.getByText(privateRow.title).first().waitFor();
    await page.getByLabel('자료 메뉴').first().click();
    await page.getByRole('menuitemcheckbox', { name: /받아두기/ }).first().click();
    await page.locator('.tag', { hasText: '받아둠' }).first().waitFor();
    assert.ok((await idbKeys(page, 'anatomy-offline-cache', 'materials')).some(r => r.key === keyA && r.pinned), 'A의 계정 키로 받아 둠');
    // A · 끊김: 서재 → 기기 사본 목록에 X(양성 대조 — A는 자기 제목을 본다) · 세 칸 실패 안내 0
    stats.dataOffline = true;
    await nav(page, '/materials');
    await shelfHeading(page).waitFor({ timeout: 20000 });
    const row = page.locator('.shelf-device a[href^="/viewer/"]', { hasText: privateRow.title });
    await row.waitFor();
    assert.ok(await row.getByText('일본어 · 받아둠').isVisible(), 'A: 받아 둔 표시');
    assert.equal(await threeFailures(page).count(), 0, 'A 끊김: 세 칸 실패 안내 대신 기기 사본');
    assert.ok(await page.getByText('서재 목록을 불러오지 못했어요. 연결되면 다시 불러와요.').isVisible());
    // 누르면 같은 여는 길(서재 링크 → 뷰어의 기기 사본 폴백)로 본문이 선다.
    await row.click();
    await page.waitForURL(url => new URL(url).pathname === `/viewer/${X}`);
    await page.locator('[data-source-token="id_0_0"]').waitFor({ timeout: 15000 });
    await nav(page, '/materials');
    await shelfHeading(page).waitFor({ timeout: 20000 });
    // 연결되면 다시 읽기 — 새로 고침 없이 보통 서재(목록의 X 행)로 바뀐다.
    stats.dataOffline = false;
    await page.evaluate(() => dispatchEvent(new Event('online')));
    await page.locator('.shelf-list-section').getByText(privateRow.title).first().waitFor({ timeout: 15000 });
    assert.equal(await shelfHeading(page).count(), 0, '연결 뒤: 기기 사본 칸이 보통 서재로 바뀐다');
    // A → 손님 → B · 끊김: B의 기기 사본 목록은 비어 있고 A 표식이 한 번도 그려지지 않는다.
    await logoutFromProfile(page);
    await loginThroughForm(page, 'B', '/home', { inApp: true });
    await startWatch(page);
    assert.ok((await idbKeys(page, 'anatomy-offline-cache', 'materials')).some(r => r.key === keyA && r.pinned), 'A의 받아 둔 기록은 지우지 않고 숨긴다(양성 조건)');
    stats.dataOffline = true;
    await nav(page, '/materials');
    await shelfHeading(page).waitFor({ timeout: 20000 });
    await page.getByText('아직 이 기기에 받아 둔 자료가 없어요.', { exact: false }).waitFor();
    assert.equal(await page.locator('.shelf-device a[href^="/viewer/"]').count(), 0, 'B 끊김: 기기 사본 0');
    await assertNoMarker(page, 'B 끊김 /materials');
    stats.dataOffline = false;
    assert.equal(await leak(page), null, 'B에게 A 표식');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
