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

async function boundaryContext({ actor = 'A', width = 390, height = 844, expiresIn } = {}) {
  const context = await browser.newContext({ baseURL: base, viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const stats = { refreshGrants: 0, deletes: 0, rsc: [], bodiesAfterWatch: [] };
  const json = (route, value, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { ...cors, ...headers }, body: JSON.stringify(value) });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await context.route('**/auth/v1/**', async route => {
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
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').pop();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const sub = bearerSub(request);
    if (url.pathname.endsWith('/rpc/fsrs_legacy_boundary')) return sub ? json(route, { version: 1, actorId: sub, enrolled: false }) : json(route, { message: 'missing identity' }, 401);
    if (url.pathname.endsWith('/rpc/personal_library_page_v2')) return json(route, isA(request) ? { items: [libraryItem], total: 1 } : { items: [], total: 0 });
    if (table === 'profiles') return sub ? json(route, { id: sub, display_name: '표식 계정', role: 'learner', onboarded: true, last_login_at: new Date().toISOString(), streak_count: 1 }) : json(route, null);
    if (table === 'reading_materials' && request.method() === 'GET' && url.searchParams.get('id') === `eq.${X}`) {
      // RLS: 비공개 X는 A에게만. 단일 행 요청(vnd.pgrst.object)은 없으면 406(PGRST116), 목록 요청은 빈 배열.
      const object = (request.headers().accept || '').includes('vnd.pgrst.object');
      if (isA(request)) return json(route, object ? privateRow : [privateRow]);
      return object ? json(route, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406) : json(route, []);
    }
    if (request.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...cors, 'content-range': '*/0' } });
    return json(route, []);
  });
  await context.route('**/api/learning/vocabulary**', route => {
    const sub = bearerSub(route.request());
    return sub ? json(route, legacyLearningSnapshot({ actorId: sub, rows: [], fields: new URL(route.request().url()).searchParams.get('fields') })) : json(route, { ok: false, code: 'fsrs_auth_required' }, 401);
  });
  await context.route('**/api/learning/fsrs', route => { const sub = bearerSub(route.request()); return sub ? json(route, inactiveFsrsStatus({ actorId: sub })) : json(route, { ok: false, code: 'fsrs_auth_required' }, 401); });
  await context.route('**/api/learning/admission', route => { const sub = bearerSub(route.request()); return sub ? json(route, inactiveLearningAdmission({ actorId: sub })) : json(route, { ok: false, code: 'fsrs_auth_required' }, 401); });
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
  await page.getByLabel('이메일', { exact: true }).fill(EMAIL[who]);
  await page.getByLabel('비밀번호', { exact: true }).fill('boundary-password-24');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
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
      await page.getByRole('button', { name: '로그인', exact: true }).click();
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
