// A11Y-AUTH-001 로그인 화면 접근성 훑기(2026-11-08 KST) — 화면 벽 환경(합성 무거운 계정 백엔드 + next start)에서 폰 390 · PC 1280.
// CI가 돌리지 않는 점검 도구다.  npm run e2e:build(또는 wall:build) 뒤  node e2e/a11y-auth.audit.mjs
//   ONLY=study,vocab  VPS=mobile  CONTRAST=1(axe가 판정 못 한 대비 칸 실측)  A11Y_PORT=3184  결과 JSON: A11Y_OUT(기본 임시 폴더)
// 화면: /study(몸풀기 · 채점 · 문단 · 어순 · 결과 — 문단은 /api/study-paragraph를 고정 문단으로 채운다) · /vocab(단어 상세 · 범위 창) · 복습 카드 ·
// /review/grammar · /materials · /progress(창 넷) · /profile(창 여섯) · /viewer/50000(낱말 카드 열고 닫기).
// 기준 · 결과: docs/accessibility-audit.md 「로그인 화면 훑기」.
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startWallEnv } from '../scripts/wall-capture.mjs';
import { targets, measureIncomplete, axe, dialogCheck, focusInfo, liveLog, PARAGRAPH, tabProblems, tabWalk, watchLive } from './a11y-auth.lib.mjs';
const VIEWPORTS = (process.env.VPS || 'mobile,desktop').split(',');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const env = await startWallEnv({ out: await mkdtemp(join(tmpdir(), 'a11y-')), port: Number(process.env.A11Y_PORT || 3184) });
const report = [];
const CONTRAST = process.env.CONTRAST === '1';
const rec0 = (vp, scene, data) => { report.push({ vp, scene, ...data }); const ax = data.axe; console.log(vp, scene, ax ? `wcag ${ax.wcag.map((v) => `${v.id}×${v.n}`).join(',') || 0} · bp ${ax.bp.map((v) => `${v.id}×${v.n}`).join(',') || 0} · ?contrast ${ax.incompleteContrast}` : '', data.tabBad ? `tabBad ${data.tabBad.length}` : '', data.note || ''); };
const rec = (vp, scene, data) => { rec0(vp, scene, data); };
async function measure(page, vp, scene, ax) { if (!CONTRAST || !ax?.incTargets?.length) return; const rows = await measureIncomplete(page, ax.incTargets); const fails = rows.filter((r) => !r.hidden && r.ratio < r.need); console.log('  contrast', vp, scene, 'measured', rows.length, 'hidden', rows.filter((r) => r.hidden).length, 'FAIL', fails.length, JSON.stringify(fails).slice(0, 300), 'min ok', Math.min(...rows.filter((r) => !r.hidden && r.ratio >= r.need).map((r) => r.ratio))); report.push({ vp, scene: `${scene} 대비 실측`, contrast: rows }); }
const axeM = async (page, vp) => { const a = await axe(page); if (vp === 'mobile') { const t = await targets(page); report.push({ vp, scene: '(터치 영역)', targets: t }); console.log('  targets', t.total, 'under44', t.under44, 'under24', t.under24.length, JSON.stringify(t.under24.slice(0, 8))); } await measure(page, vp, '(다음 줄)', a); return a; };
const settle = (page, ms = 1200) => page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}).then(() => page.waitForTimeout(ms));
async function dialogs(page, vp, scene) {
  const openers = page.locator('[aria-haspopup="dialog"]:visible');
  const n = await openers.count();
  for (let i = 0; i < n; i++) {
    const op = openers.nth(i);
    const name = ((await op.getAttribute('aria-label')) || (await op.innerText())).replace(/\s+/g, ' ').trim().slice(0, 30);
    if (/삭제|탈퇴|로그아웃/.test(name) || await op.isDisabled()) continue;
    rec(vp, `${scene} · 대화상자 「${name}」`, { dialog: await dialogCheck(page, op) });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
}
async function scene(name, fn) { if (ONLY && !ONLY.some((o) => name.startsWith(o))) return; for (const vp of VIEWPORTS) {
  const context = await env.newContext({ persona: 'filled', viewportKey: vp });
  await context.route('**/api/study-paragraph', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ paragraph: PARAGRAPH }) }));
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
  try { await fn(page, vp); } catch (e) { rec(vp, name, { note: `ERROR ${e.message.slice(0, 200)}` }); }
  if (errors.length) rec(vp, name, { note: `pageerror ${errors.join(' | ')}` });
  await context.close();
} }
const page0 = async (page, vp, name, path, ready, extra) => {
  await page.goto(`${env.baseURL}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator(ready).first().waitFor({ timeout: 60000 }); await settle(page);
  const walk = await tabWalk(page, 25);
  rec(vp, name, { axe: await axeM(page, vp), tab: walk, tabBad: tabProblems(walk) });
  if (extra) await extra(page);
  await dialogs(page, vp, name);
};

await scene('study', async (page, vp) => {
  await page.goto(`${env.baseURL}/study`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const opts = page.locator('.fr-quiz__opt'); await opts.first().waitFor({ timeout: 60000 }); await settle(page);
  const walk = await tabWalk(page, 15);
  rec(vp, 'study 몸풀기', { axe: await axeM(page, vp), tab: walk, tabBad: tabProblems(walk) });
  // 키보드로 답: 첫 보기에 초점 · Enter → 낭독 · 초점 이동
  await watchLive(page);
  await opts.first().focus(); await page.keyboard.press('Enter');
  const next = page.getByRole('button', { name: /^(계속|결과 보기) →$/ }); await next.waitFor(); await page.waitForTimeout(800);
  rec(vp, 'study 채점', { axe: await axeM(page, vp), live: await liveLog(page), focus: await focusInfo(page) });
  await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  rec(vp, 'study 다음 문항', { focus: await focusInfo(page), note: `head=${await page.locator('[data-item-head]').first().innerText().catch(() => '?')}` });
  // 문단 · 어순 · 결과까지
  const seen = new Set();
  for (let step = 0; step < 40; step++) {
    await page.waitForTimeout(500);
    const head = (await page.locator('[data-item-head]').first().innerText().catch(() => '')).trim();
    if (head === '오늘의 문단' && !seen.has('para')) { seen.add('para'); await settle(page, 500); const w = await tabWalk(page, 15); rec(vp, 'study 문단', { axe: await axeM(page, vp), tab: w, tabBad: tabProblems(w) });
      const tr = page.getByRole('button', { name: /번역 보기/ }); if (await tr.count()) { await tr.first().focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(400); rec(vp, 'study 문단 번역 펼침', { focus: await focusInfo(page), note: `expanded=${await page.locator('[aria-expanded]').filter({ hasText: /번역/ }).first().getAttribute('aria-expanded').catch(() => '?')}` }); } }
    const next2 = page.getByRole('button', { name: /^(계속|결과 보기) →$/ });
    if (await next2.count()) { await next2.first().click(); continue; }
    const opt = page.locator('.fr-quiz__opt:not([disabled])');
    if (await opt.count()) { await opt.first().click(); continue; }
    const toks = page.locator('.fr-quiz__tokens button:not([disabled])');
    if (await toks.count()) {
      if (!seen.has('order')) { seen.add('order'); rec(vp, 'study 어순', { axe: await axeM(page, vp) }); await watchLive(page); }
      for (const t of PARAGRAPH.sentences[0].tokens) await page.locator('.fr-quiz__tokens button', { hasText: t }).first().click().catch(() => {});
      await page.waitForTimeout(600); if (seen.has('order') && !seen.has('orderlive')) { seen.add('orderlive'); rec(vp, 'study 어순 채점', { live: await liveLog(page), focus: await focusInfo(page) }); }
      continue;
    }
    const other = page.getByRole('button', { name: /문제 풀기/ });
    if (await other.count()) { await other.first().click(); continue; }
    break;
  }
  await settle(page, 800);
  const w = await tabWalk(page, 15);
  rec(vp, 'study 결과', { axe: await axeM(page, vp), tab: w, tabBad: tabProblems(w), focus: await focusInfo(page), note: `h1=${await page.locator('h1,h2').first().innerText().catch(() => '?')}` });
});

await scene('vocab', (page, vp) => page0(page, vp, 'vocab 단어장', '/vocab', '.review-room-start, .vocab-row', async (page) => {
  const detail = page.locator('button[aria-label$="상세 열기"]:visible').first();
  if (await detail.count()) rec(vp, 'vocab 대화상자 「단어 상세」', { dialog: await dialogCheck(page, detail) });
  const del = page.locator('button[aria-label$=" 삭제"]:visible').first();
  if (await del.count()) rec(vp, 'vocab 대화상자 「삭제 확인」', { dialog: await dialogCheck(page, del) });
}));

await scene('review', async (page, vp) => {
  await page.goto(`${env.baseURL}/vocab`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const start = page.locator('button.review-room-start:not([disabled])'); await start.first().waitFor({ timeout: 60000 }); await settle(page);
  await start.first().focus(); await page.keyboard.press('Enter');
  await page.locator('.review-card, .review-intro__next').first().waitFor({ timeout: 20000 }); await page.waitForTimeout(800);
  const intro = page.locator('.review-intro__next'); if (await intro.count()) { await intro.first().click(); await page.waitForTimeout(600); }
  rec(vp, 'review 복습 시작 직후', { focus: await focusInfo(page) });
  const w = await tabWalk(page, 15);
  rec(vp, 'review 복습 카드', { axe: await axeM(page, vp), tab: w, tabBad: tabProblems(w) });
  await watchLive(page);
  const reveal = page.getByRole('button', { name: /뒤집기|정답 보기|답 보기|확인/ });
  if (await reveal.count()) { await reveal.first().focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(700); rec(vp, 'review 뒤집음', { axe: await axeM(page, vp), focus: await focusInfo(page), live: await liveLog(page) }); }
  const grade = page.locator('.review-score-btn').first();
  if (await grade.count()) { await grade.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(900); rec(vp, 'review 채점 뒤', { focus: await focusInfo(page), live: await liveLog(page) }); }
});

await scene('grammar', (page, vp) => page0(page, vp, 'grammar 문법 복습', '/review/grammar', 'main h1, main h2'));
await scene('materials', (page, vp) => page0(page, vp, 'materials 서재', '/materials', 'main h1, main h2'));
await scene('progress', (page, vp) => page0(page, vp, 'progress 현황', '/progress', 'main h1, main h2', async (page) => {
  const wk = page.locator('button.learn-stat--btn:has-text("이번 주")').first();
  if (await wk.count()) rec(vp, 'progress 대화상자 「이번 주」', { dialog: await dialogCheck(page, wk, { dialog: '.tile-modal__overlay' }) });
}));
await scene('profile', (page, vp) => page0(page, vp, 'profile 내 정보 · 설정', '/profile', 'main h1, main h2', async (page) => {
  const nick = page.getByRole('button', { name: '바꾸기' }).first();
  if (await nick.count()) rec(vp, 'profile 대화상자 「닉네임 바꾸기」', { dialog: await dialogCheck(page, nick) });
}));
await scene('viewer', async (page, vp) => {
  await page.goto(`${env.baseURL}/viewer/50000`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const tok = page.locator('[data-source-token="id_0_0"]'); await tok.waitFor({ timeout: 60000 }); await settle(page);
  const w = await tabWalk(page, 25);
  rec(vp, 'viewer 본문', { axe: await axeM(page, vp), tab: w, tabBad: tabProblems(w) });
  await watchLive(page);
  await tok.evaluate((el) => el.setAttribute('data-a11y-opener', '1'));
  await tok.focus(); await page.keyboard.press('Enter');
  await page.locator('#inspector-word').waitFor({ timeout: 15000 }); await page.waitForTimeout(900);
  const card = await page.evaluate(() => { const c = document.querySelector('#inspector-word')?.closest('[role="dialog"],aside,section,[aria-label]'); return { inCard: !!c && c.contains(document.activeElement), role: c?.getAttribute('role'), label: c?.getAttribute('aria-label') || c?.getAttribute('aria-labelledby') }; });
  rec(vp, 'viewer 카드 열림', { axe: await axeM(page, vp), focus: await focusInfo(page), card, live: await liveLog(page) });
  const cw = []; for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(50); cw.push(await focusInfo(page)); }
  rec(vp, 'viewer 카드 탭', { tab: cw, tabBad: tabProblems(cw) });
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  rec(vp, 'viewer 카드 닫음', { focus: await focusInfo(page), note: `back=${await page.evaluate(() => document.activeElement?.getAttribute('data-a11y-opener') === '1')}` });
});
const outFile = process.env.A11Y_OUT || join(await mkdtemp(join(tmpdir(), 'a11y-auth-')), 'report.json');
await writeFile(outFile, JSON.stringify(report, null, 1));
console.log('report', outFile);
await env.close();
