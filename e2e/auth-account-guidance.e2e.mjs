// 가입·로그인 안내 — 브라우저 합성 검사. Supabase Auth 응답만 바꿔 끼우고 실제 AuthPage를 돌린다.
// 통합 담당이 띄운 격리 production 서버(QA_BASE)를 쓰며, 서버를 직접 띄우거나 실계정·운영 DB에 닿지 않는다.
//
// 지키는 계약(AUTH-GUIDE-001, 2026-10-11):
//  A 이미 가입된 이메일 — 이메일 인증을 켠 Supabase는 오류 대신 identities=[]인 성공을 돌려준다(메일 미발송).
//    「인증 메일 발송」이 아니라 「이미 가입된 이메일」 안내가 나와야 한다.
//  B 비밀번호 불일치 — Google 가입자를 위한 「Google로 계속하기」 안내가 함께 나온다.
//  C 이메일 미인증 — 「인증 메일 다시 보내기」가 /auth/v1/resend(type=signup)를 부르고 결과를 알린다.
//  D 메일 링크 교환 실패 — 일반 링크와 재설정 링크가 각각 다음 행동을 알려 준다.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';

const base = process.env.QA_BASE;
assert.ok(base, 'QA_BASE must identify the integration owner\'s isolated app server');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
let browser;
before(async () => { browser = await chromium.launch(config.use.launchOptions); });
after(async () => { await browser?.close(); });

async function authPage(path, auth) {
  const context = await browser.newContext({ baseURL: base, viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const calls = [], errors = [];
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await context.route('**/auth/v1/**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = route.request().postDataJSON?.() ?? null;
    calls.push({ path: url.pathname, grant: url.searchParams.get('grant_type'), body });
    const { status = 200, json = {} } = auth(url.pathname, url.searchParams, body) || {};
    return route.fulfill({ status, headers: cors, json });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(path);
  return { context, page, calls, errors };
}

// Next 경로 안내(next-route-announcer)도 role=alert라, 오류 칸은 클래스로 좁혀 센다.
const authError = page => page.locator('.auth-alert--error');
const alertText = page => authError(page).innerText();

test('A 이미 가입된 이메일로 가입하면 메일 발송 대신 가입됨 안내를 보여 준다', async () => {
  const { context, page, calls, errors } = await authPage('/auth', pathname => pathname.endsWith('/signup')
    ? { json: { id: '00000000-0000-4000-8000-0000000000a1', aud: 'authenticated', role: '', email: 'owner@example.com', identities: [], user_metadata: {}, app_metadata: {} } }
    : { status: 404, json: {} });
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await page.getByLabel('닉네임', { exact: true }).fill('학습자');
  await page.getByLabel('이메일', { exact: true }).fill('owner@example.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password-24');
  await page.locator('form').getByRole('button', { name: '회원가입', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '이미 가입된 이메일입니다.' }).waitFor();
  assert.match(await alertText(page), /로그인하거나 Google로 계속하세요/);
  assert.equal(await page.getByRole('status').filter({ hasText: '인증 이메일을 발송했습니다' }).count(), 0);
  assert.equal(calls.filter(call => call.path.endsWith('/signup')).length, 1);
  await page.getByRole('button', { name: '로그인하러 가기 →' }).click();
  await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

test('A 새 이메일 가입은 지금처럼 인증 메일 발송을 알린다', async () => {
  const { context, page, errors } = await authPage('/auth', pathname => pathname.endsWith('/signup')
    ? { json: { id: '00000000-0000-4000-8000-0000000000a2', aud: 'authenticated', role: '', email: 'new@example.com',
      identities: [{ id: '00000000-0000-4000-8000-0000000000a2', provider: 'email', identity_data: { email: 'new@example.com' } }], user_metadata: {}, app_metadata: {} } }
    : { status: 404, json: {} });
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await page.getByLabel('닉네임', { exact: true }).fill('학습자');
  await page.getByLabel('이메일', { exact: true }).fill('new@example.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password-24');
  await page.locator('form').getByRole('button', { name: '회원가입', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '인증 이메일을 발송했습니다' }).waitFor();
  assert.equal(await authError(page).count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('B 비밀번호가 틀리면 Google 가입자 안내가 함께 나온다', async () => {
  const { context, page, errors } = await authPage('/auth', (pathname, params) => pathname.endsWith('/token') && params.get('grant_type') === 'password'
    ? { status: 400, json: { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }
    : { status: 404, json: {} });
  await page.getByLabel('이메일', { exact: true }).fill('google-user@example.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('wrong-password');
  await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '이메일 또는 비밀번호가 올바르지 않습니다.' }).waitFor();
  assert.match(await alertText(page), /Google로 가입하셨다면 위의 「Google로 계속하기」를 눌러 주세요/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('C 미인증 로그인은 인증 메일을 다시 보낼 수 있다', async () => {
  const { context, page, calls, errors } = await authPage('/auth', (pathname, params) => {
    if (pathname.endsWith('/token') && params.get('grant_type') === 'password')
      return { status: 400, json: { code: 'email_not_confirmed', error_code: 'email_not_confirmed', msg: 'Email not confirmed' } };
    if (pathname.endsWith('/resend')) return { json: {} };
    return { status: 404, json: {} };
  });
  await page.getByLabel('이메일', { exact: true }).fill('pending@example.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password-24');
  await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '이메일 인증이 필요합니다.' }).waitFor();
  await page.getByRole('button', { name: '인증 메일 다시 보내기' }).click();
  await page.getByRole('status').filter({ hasText: '인증 메일을 다시 보냈습니다.' }).waitFor();
  const resend = calls.filter(call => call.path.endsWith('/resend'));
  assert.equal(resend.length, 1);
  assert.equal(resend[0].body.type, 'signup');
  assert.equal(resend[0].body.email, 'pending@example.com');
  assert.equal(await authError(page).count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('D 메일 링크 교환 실패는 일반 링크와 재설정 링크의 다음 행동을 각각 알린다', async () => {
  const general = await authPage('/auth?error=auth_callback_failed&from=%2Fmaterials', () => ({ status: 404, json: {} }));
  await general.page.getByRole('alert').filter({ hasText: '로그인을 완료하지 못했어요.' }).waitFor();
  assert.match(await alertText(general.page), /다른 기기나 브라우저에서 열었다면 인증은 이미 끝났을 수 있으니 여기서 로그인해 보세요/);
  await general.page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
  await general.context.close();

  const reset = await authPage('/auth?error=auth_callback_failed&from=%2Fauth%3Fmode%3Dreset', () => ({ status: 404, json: {} }));
  await reset.page.getByRole('alert').filter({ hasText: '재설정 링크를 열지 못했어요.' }).waitFor();
  await reset.page.getByRole('heading', { name: '비밀번호 찾기', exact: true }).waitFor();
  await reset.page.getByRole('button', { name: '재설정 링크 보내기' }).waitFor();
  assert.deepEqual([...general.errors, ...reset.errors], []);
  await reset.context.close();
});
