// 로그인 화면 누르는 범위 · 카드 제목 단계(A11Y-AUTH-001 디자인 넘김, 2026-11-08 KST) — 실제 빌드 · 합성 학습자(화면 벽 환경 startWallEnv).
// 보이는 글자는 그대로 두고 ::before로만 넓힌 범위를 손가락이 실제로 잡는지(elementFromPoint로 1px씩 훑기), 넓힌 띠가 이웃 조작을 덮지 않는지 잰다.
// 운영 DB · 실계정 · LLM과 무관하다(/api/study-paragraph는 키가 없어 실패하고 조립 세션으로 이어진다 — 몸풀기만 쓴다).
// CSS 모양 계약은 src/lib/__tests__/a11yAuthTargets.test.js.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { startWallEnv } from '../scripts/wall-capture.mjs';

let env;
before(async () => { env = await startWallEnv({ out: await mkdtemp(join(tmpdir(), 'touch-auth-')), port: Number(process.env.TOUCH_AUTH_E2E_PORT || 3173) }); });
after(async () => { await env?.close(); });

/** 요소 가운데 줄을 1px씩 훑어 그 요소가 잡히는 가로 · 세로 길이와, 넓힌 띠 안에서 다른 조작을 대신 잡는 곳을 잰다. */
const reach = (page, selector, text) => page.evaluate(([selector, text]) => {
  const el = [...document.querySelectorAll(selector)].find(e => e.getClientRects().length && e.textContent.includes(text));
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect(); const cx = r.x + r.width / 2; const cy = r.y + r.height / 2;
  const mine = h => h && (h === el || el.contains(h));
  let top = null, bottom = null, left = null, right = null;
  for (let y = Math.floor(r.top) - 30; y <= r.bottom + 30; y++) if (mine(document.elementFromPoint(cx, y))) { top ??= y; bottom = y; }
  for (let x = Math.floor(r.left) - 30; x <= r.right + 30; x++) if (mine(document.elementFromPoint(x, cy))) { left ??= x; right = x; }
  const band = { top: Math.min(r.top, top), bottom: Math.max(r.bottom, bottom + 1), left: Math.min(r.left, left), right: Math.max(r.right, right + 1) };
  const others = [...document.querySelectorAll('a,button,input,select,summary,[role=button]')]
    .filter(o => o !== el && !el.contains(o) && !o.contains(el) && o.getClientRects().length && o.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
  const stolen = others.filter(o => {
    const q = o.getBoundingClientRect();
    if (q.right < band.left || q.left > band.right || q.bottom < band.top || q.top > band.bottom) return false;
    for (let y = Math.max(q.top, band.top) + 1; y < Math.min(q.bottom, band.bottom); y += 2) {
      for (let x = Math.max(q.left, band.left) + 1; x < Math.min(q.right, band.right); x += 3) {
        const h = document.elementFromPoint(x, y); if (mine(h) && !(h === o || o.contains(h))) return true;
      }
    }
    return false;
  }).map(o => (o.textContent.trim() || o.getAttribute('aria-label') || o.tagName).slice(0, 16));
  return { box: [Math.round(r.width), Math.round(r.height)], reach: [Math.round(band.right - band.left), Math.round(band.bottom - band.top)], stolen };
}, [selector, text]);

for (const viewportKey of ['mobile', 'desktop']) {
  test(`/study 「왜 이게 답이에요?」 — 글자 그대로, 누르는 범위 세로 44 이상 · 이웃 침범 0 (${viewportKey})`, async () => {
    const context = await env.newContext({ persona: 'filled', viewportKey });
    try {
      const page = await context.newPage();
      await page.goto(`${env.baseURL}/study`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      // 첫 몸풀기 문항에서 틀린 보기를 고른다 — 정답은 합성 계정의 단어 행 뜻(item.word.meaning)이다.
      // 예전에는 아무 보기나 누르고 맞으면 다음 문항으로 넘어갔는데, 두 가지로 깨졌다(로컬 반복 50회 중 5회 실측, Data #1782 CI 1회):
      //  ① 보기 수를 센 순간 하이드레이션이 보기를 다시 그리는 중이라 0개 → nth(i % 0) = nth(NaN)이 되어 모든 누름이 빗나갔다.
      //  ② 몸풀기 둘을 다 맞히면 셋째 문항은 보기가 없는 유형이라 기다림이 끝나지 않았다.
      // 그래서 한 문항 · 보기는 글자로 찾는다(누를 때마다 새로 찾는다).
      const head = page.locator('.study-item [data-item-head]').first();
      await head.waitFor({ timeout: 60000 });
      const word = (await head.textContent()).trim();
      const answer = env.backend.state.account.tables.user_vocabulary.find((row) => row.word_text === word)?.meaning;
      assert.ok(answer, `첫 몸풀기 단어(${word})의 뜻이 합성 계정에 있다`);
      const wrong = page.locator('.study-item .fr-quiz__opt:enabled').filter({ hasNotText: answer }).first();
      await wrong.waitFor({ timeout: 60000 });
      // 첫 화면은 서버가 그린 보기라 하이드레이션 전에 누르면 아무 일도 없다(3번 중 1번 실측) — 채점 표시가 뜰 때까지 다시 누른다.
      const graded = page.locator('.study-item .fr-quiz__opt.is-correct');
      for (let tries = 0; tries < 10; tries++) {
        if (await graded.count()) break; // 앞 누름이 하이드레이션 뒤에 처리됐다 — 잠긴 보기를 다시 누르지 않는다
        await wrong.click().catch(() => {});
        if (await graded.first().waitFor({ timeout: 1500 }).then(() => true, () => false)) break;
      }
      await page.getByRole('button', { name: /^(계속|결과 보기) →$/ }).waitFor();
      const why = await page.locator('.study-textlink', { hasText: '왜 이게 답이에요?' }).count() ? await reach(page, '.study-textlink', '왜 이게 답이에요?') : null;
      assert.ok(why, '오답 뒤 「왜 이게 답이에요?」가 보인다');
      assert.ok(why.box[1] < 24, `보이는 글자 상자는 그대로 작다(${why.box})`);
      assert.ok(why.reach[1] >= 44, `누르는 범위 세로 ${why.reach[1]}px ≥ 44`);
      assert.deepEqual(why.stolen, [], '넓힌 띠가 이웃 조작을 덮지 않는다');
    } finally { await context.close(); }
  });

  test(`서재 바닥 줄 「복습」 — 누르는 범위 가로 44 이상 · 이웃 침범 0 (${viewportKey})`, async () => {
    const context = await env.newContext({ persona: 'filled', viewportKey });
    try {
      const page = await context.newPage();
      await page.goto(`${env.baseURL}/materials`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.locator('.shelf-footer a', { hasText: '복습' }).first().waitFor({ timeout: 60000 });
      const shelf = await reach(page, '.shelf-footer a', '복습');
      assert.ok(shelf.box[0] < 24, `보이는 글자 폭은 그대로 좁다(${shelf.box})`);
      assert.ok(shelf.reach[0] >= 44 && shelf.reach[1] >= 44, `누르는 범위 ${shelf.reach} ≥ 44×44`);
      assert.deepEqual(shelf.stolen, [], '넓힌 띠가 옆 링크를 덮지 않는다');
    } finally { await context.close(); }
  });

  test(`뷰어 단어 카드 — 칸 제목은 h1 다음 단계 h2 (${viewportKey})`, async () => {
    const context = await env.newContext({ persona: 'filled', viewportKey });
    try {
      const page = await context.newPage();
      await page.goto(`${env.baseURL}/viewer/50000`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.locator('[data-source-token="id_0_0"]').click({ timeout: 60000 });
      await page.locator('#inspector-word').first().waitFor();
      const more = page.locator('#inspector-word h2.reader-card-section__label', { hasText: '더 알아보기' }).first();
      await more.waitFor();
      const levels = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => h.getClientRects().length).map(h => Number(h.tagName[1])));
      for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `제목 단계가 건너뛰지 않는다: ${levels.join(' → ')}`);
      const look = await more.evaluate(h => { const s = getComputedStyle(h); return [s.fontSize, s.fontWeight, s.lineHeight]; });
      assert.deepEqual(look, ['12px', '500', '18px'], '글자 모양은 클래스가 정한 그대로(전역 h2 규칙이 덮지 않는다)');
    } finally { await context.close(); }
  });
}
