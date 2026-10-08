// VIEWER-R0-BUGS-001 버그 3 — 학습자 링크가 보관된 옛 교재 주소로 가서 홈으로 튕기던 결함.
// 실제 앱(e2e 빌드) + 합성 자료. 서버 목의 계정은 비관리자(learner)라 옛 주소를 치면 middleware가
// /admin/legacy-textbooks → / 로 보낸다. 학습자 화면(문형 카드)은 그 주소를 링크로 내면 안 된다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './fixtures/material-editing-backend.mjs';

const owner = '00000000-0000-4000-8000-000000000172';
const LEGACY = /^\/(japanese|chinese|english|french)(?:\/(grammar|vocab|bunkei)\/[^/]+)?\/?$/;
const MATERIALS = {
  Chinese: { id: 94131, kernel: '比', notice: '보관된 교재라 열 수 없어요', words: [['眼前', '눈앞'], ['的', '의'], ['体育场', '경기장'], ['比', '~보다'], ['照片', '사진'], ['上', '위'], ['更', '더'], ['壮观', '장관이다'], ['。', '']] },
  Japanese: { id: 94132, kernel: 'ながら', notice: '보관된 교재라 열 수 없어요', words: [['音楽', '음악'], ['を', '을'], ['聞き', '듣고'], ['ながら', '~하면서'], ['勉強', '공부'], ['し', '하다'], ['ます', '습니다'], ['。', '']] },
};

async function open(language, width, uiLocale) {
  const f = await fixture({ width });
  const m = MATERIALS[language];
  f.rows.push({ id: m.id, user_id: owner, title: `${language} 문형 링크 검수`, raw_text: m.words.map(([text]) => text).join(''), source_type: 'text', created_at: new Date().toISOString(),
    processed_json: { status: 'completed', metadata: { language }, sequence: m.words.map((_, i) => `id_0_${i}`),
      dictionary: Object.fromEntries(m.words.map(([text, meaning], i) => [`id_0_${i}`, { text, base_form: text, meaning, pos: '명사' }])) } });
  await f.context.addInitScript(({ language, uiLocale }) => {
    localStorage.setItem('viewer_preferences_v2', JSON.stringify({ version: 2, languages: { [language]: { showPatterns: true, patternFilter: 'all', autoSpeakOnClick: false } } }));
    if (uiLocale) localStorage.setItem('viewer_language:v1', JSON.stringify({ version: 1, uiLocale, explanationLocale: 'ko' }));
  }, { language, uiLocale });
  await f.context.route('**/api/dict?**', r => r.fulfill({ contentType: 'application/json', body: 'null' }));
  await f.page.goto(`/viewer/${m.id}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const token = f.page.locator(`[data-source-token="id_0_${m.words.findIndex(([text]) => text === m.kernel)}"]`);
  await token.waitFor();
  return { ...f, m, token };
}

async function legacyLinks(page) {
  return page.locator('a[href]').evaluateAll((anchors, source) => {
    const legacy = new RegExp(source);
    return anchors.map(a => new URL(a.getAttribute('href'), location.href)).filter(url => url.origin === location.origin && legacy.test(url.pathname)).map(url => url.pathname);
  }, LEGACY.source);
}

for (const [language, width] of [['Chinese', 1440], ['Chinese', 390], ['Japanese', 1440]]) {
  test(`문형 카드: ${language} ${width}px — 보관된 챕터는 링크 대신 안내, 비관리자가 따라갈 옛 주소 0`, { timeout: 240000 }, async () => {
    const f = await open(language, width);
    try {
      await f.token.click();
      // AE-R1(VIEWER-V2-ROUNDS-001 §2.1 문형 한 줄, Q6): 문형 카드는 「문형 · … ›」 줄을 누르면 그 자리 팝오버로 열린다.
      await f.page.locator('.reader-card-pattern__line').filter({ visible: true }).first().click();
      const card = f.page.locator('.pattern-card').filter({ visible: true }).first();
      await card.waitFor({ timeout: 30000 });
      await card.locator('.pattern-card__archived').first().waitFor();
      assert.equal(await card.locator('.pattern-card__archived').first().innerText(), f.m.notice);
      assert.equal(await card.getByText('챕터로 →', { exact: true }).count(), 0);
      assert.deepEqual(await legacyLinks(f.page), [], '화면 어디에도 보관된 옛 교재로 가는 링크가 없다');
      // 카드에 남은 링크(공개 주소)는 비관리자가 따라가도 홈으로 튕기지 않는다.
      for (const href of await card.locator('a[href]').evaluateAll(anchors => anchors.map(a => a.getAttribute('href')))) {
        const response = await f.page.goto(href, { waitUntil: 'domcontentloaded', timeout: 120000 });
        assert.notEqual(new URL(f.page.url()).pathname, '/', href);
        assert.ok(response.ok(), href);
      }
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}

test('문형 카드 보관 안내는 화면 언어(zh-TW)를 따른다', { timeout: 240000 }, async () => {
  const f = await open('Chinese', 1440, 'zh-TW');
  try {
    await f.token.click();
    await f.page.locator('.reader-card-pattern__line').filter({ visible: true }).first().click();
    const notice = f.page.locator('.pattern-card__archived').filter({ visible: true }).first();
    await notice.waitFor({ timeout: 30000 });
    assert.equal(await notice.innerText(), '這是已封存的教材，無法開啟');
  } finally { await f.context.close(); }
});

test('직접 친 옛 교재 주소의 보관 리다이렉트는 그대로다(비관리자는 홈으로)', { timeout: 240000 }, async () => {
  const f = await open('Chinese', 1440);
  try {
    // middleware: 옛 주소 → /admin/legacy-textbooks/… → 비관리자는 / (로그인 상태의 /는 다시 /home으로 보낸다).
    // 이 튕김이 바로 학습자 링크가 옛 주소를 내면 안 되는 이유다 — 관리자 보관 경로 자체는 바꾸지 않았다.
    // Next는 루프백 리다이렉트를 localhost로 정규화한다 — 127.0.0.1 기준 실행(CI)에서도 같은 계정으로 따라가게 쿠키를 복제한다.
    const { port } = new URL(f.page.url());
    const auth = (await f.context.cookies()).filter(cookie => cookie.name.startsWith('sb-'));
    await f.context.addCookies(auth.map(({ name, value }) => ({ name, value, url: `http://localhost:${port}`, sameSite: 'Lax' })));
    await f.page.goto('/chinese/grammar/h2-05-comparison-bi', { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert.ok(['/', '/home'].includes(new URL(f.page.url()).pathname), f.page.url());
  } finally { await f.context.close(); }
});
