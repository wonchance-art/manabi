#!/usr/bin/env node
// 로그인 화면 UX 점검(/ux-review 0단계 보강) — ux-audit.mjs가 「미검증」으로 남기던 복습 진행 · 끝 화면, 서재 목록, 뷰어를
// e2e 합성 로그인으로 띄워 데스크톱(1280×800)에서 캡처하고, 화면마다 확인한 동작을 PASS/FAIL로 남긴다.
//
//   npm run e2e:build                              # 한 번 — e2e 공개 값으로 production 빌드(NEXT_PUBLIC_*는 빌드에 인라인)
//   node scripts/ux-audit-auth.mjs --start         # next start(+ e2e/server-fetch-mock.mjs)를 직접 띄우고 끝나면 내린다
//   UX_AUDIT_AUTH_BASE_URL=http://127.0.0.1:8878 node scripts/ux-audit-auth.mjs   # e2e 서버가 이미 떠 있을 때
//   --out <dir>   기본 .ux-audit/<KST 날짜>/auth      --only review,library,viewer
//
// 인증 · 데이터는 새로 짓지 않는다: e2e/fixtures/material-editing-backend.mjs(sb-e2e-auth-token 쿠키 + page.route 합성
// 백엔드) · learning-snapshot.mjs(legacyLearningSnapshot) · library-v4-backend.mjs(PGlite 서재)를 그대로 쓴다.
// 운영 계정 · DB · 제공자에는 닿지 않는다(합성 백엔드는 localhost 전용, 서버 쪽 Supabase 호출은 server-fetch-mock이 받는다).
// 실행은 e2e와 같이 node:test 위에서 돈다(합성 백엔드의 브라우저 수명이 node:test 훅에 묶여 있다).
import { test, after } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAIN_NAV } from '../src/lib/webNavigation.js';
import { kstStamp, measure, summarize } from './ux-audit.mjs';
import {
  AUTH_VIEWPORT, OWNER, SCREENS, builtForE2E, createRecorder, libraryRows, markdown, reviewWords, verdictCounts, verdictLines, viewerMaterial,
} from './ux-audit-auth-core.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const baseURL = process.env.UX_AUDIT_AUTH_BASE_URL || 'http://127.0.0.1:8879';
const host = new URL(baseURL).hostname;
if (!['127.0.0.1', 'localhost'].includes(host)) throw new Error(`합성 로그인 점검은 로컬 서버에서만 돈다: ${baseURL}`);
const stamp = kstStamp();
const out = opt('--out') || join('.ux-audit', stamp.slice(0, 10), 'auth');
const only = (opt('--only') || SCREENS.join(',')).split(',').filter(name => SCREENS.includes(name));
const { width, height } = AUTH_VIEWPORT;
const E2E_PUBLIC = { NEXT_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key' };

// 합성 백엔드가 읽는 환경 — import 전에 정한다.
process.env.COMPOSER_BASE_URL = baseURL;
process.env.COMPOSER_TEST_MODULES ||= join(root, 'node_modules');

async function reachable(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return true; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

await mkdir(out, { recursive: true });
let server = null;
if (args.includes('--start')) {
  if (!await builtForE2E(join(root, '.next'), E2E_PUBLIC.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error('.next가 e2e 공개 값으로 빌드되지 않았어요 — 먼저 `npm run e2e:build`(e2e/README.md).');
  }
  const port = new URL(baseURL).port || '8879';
  const log = openSync(join(out, 'server.log'), 'w');
  const nodeOptions = [process.env.NODE_OPTIONS, `--import=${join(root, 'e2e', 'server-fetch-mock.mjs')}`].filter(Boolean).join(' ');
  server = spawn(process.execPath, [join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '--hostname', host, '--port', port], {
    cwd: root, detached: true, stdio: ['ignore', log, log],
    env: { ...process.env, ...E2E_PUBLIC, NEXT_PUBLIC_SITE_URL: baseURL, NODE_OPTIONS: nodeOptions },
  });
  process.on('exit', () => { try { process.kill(-server.pid); } catch { /* already gone */ } });
  if (!await reachable(`${baseURL}/manifest.webmanifest`, 90000)) {
    try { process.kill(-server.pid); } catch { /* gone */ }
    throw new Error(`서버가 뜨지 않았어요: ${baseURL} (로그 ${join(out, 'server.log')})`);
  }
} else if (!await reachable(`${baseURL}/manifest.webmanifest`, 5000)) {
  throw new Error(`서버 응답 없음: ${baseURL} — --start를 붙이거나 e2e 서버(next start + server-fetch-mock)를 먼저 띄우세요.`);
}

const { fixture } = await import('../e2e/fixtures/material-editing-backend.mjs');
const { legacyLearningSnapshot } = await import('../e2e/fixtures/learning-snapshot.mjs');

const rec = createRecorder();
const rows = [];
const shots = [];
const json = (route, value, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(value) });

/** 캡처 + ux-audit과 같은 기계 측정(넘침 · 빈 화면 · 대기 표시 · 콘솔 오류). */
async function shot(f, screen, name, note) {
  await f.page.evaluate(() => document.fonts.ready).catch(() => {});
  const path = join(out, `${name}.png`);
  await f.page.screenshot({ path });
  shots.push({ name: `${name}.png`, note });
  const m = await f.page.evaluate(measure, MAIN_NAV.map(item => item.label)).catch(e => ({ measureError: e.message }));
  // 직전 캡처 뒤에 새로 난 콘솔 오류만 이 캡처에 붙인다(누적하면 같은 오류가 캡처마다 되풀이된다).
  const consoleErrors = f.consoleErrors.splice(0), failedResponses = f.failedResponses.splice(0);
  rows.push({ viewport: 'desktop', route: `${screen}:${name}`, finalPath: new URL(f.page.url()).pathname, loadMs: 0, error: null,
    consoleErrors, failedResponses, screenshot: path, ...m });
  rec.check(screen, `${name}: 가로 넘침 없음`, m.overflowX === false, m.measureError || `scrollWidth ≤ ${width}`);
}

async function open(options = {}, make = fixture) {
  const f = await make({ width, height, ...options });
  f.consoleErrors = []; f.failedResponses = [];
  f.page.on('console', m => { if (m.type() === 'error') f.consoleErrors.push(m.text().slice(0, 200)); });
  // 콘솔의 「status of 500」에는 주소가 없다 — 어떤 요청이었는지 보고서에 남긴다.
  f.page.on('response', r => { if (r.status() >= 500) f.failedResponses.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}${new URL(r.url()).search.slice(0, 80)}`); });
  return f;
}

const stateOf = page => page.evaluate(() => {
  const card = document.querySelector('.review-card');
  const body = card?.querySelector('.review-card__body');
  return {
    word: card?.querySelector('.review-card__word')?.textContent.trim() || null,
    front: !!body?.classList.contains('review-card__body--front'),
    cursor: body ? getComputedStyle(body).cursor : null,
    answer: !!card?.querySelector('.review-card__answer'),
    meaning: card?.querySelector('.review-card__meaning')?.textContent.trim() || null,
    gradeDisabled: document.querySelector('.review-score-btn--good')?.disabled ?? null,
    count: document.querySelector('.review-topbar__count')?.textContent.trim() || null,
  };
});

/** 다음 카드의 넘김 효과를 잡는다 — animationstart에서 잠시 멈춰 중간 프레임을 재고, 다시 돌려 끝(animationend)까지 잰다. */
const armTurnProbe = (page, pauseAt) => page.evaluate(pauseAt => {
  const old = document.querySelector('.review-card');
  if (old) old.dataset.uxAuditOld = '1';
  const probe = window.__uxTurn = { starts: [], ends: [], paused: null };
  const onStart = event => {
    if (event.animationName !== 'reviewCardTurn') return;
    const card = event.target;
    probe.starts.push({ word: card.querySelector('.review-card__word')?.textContent.trim() || null, newNode: !card.dataset.uxAuditOld,
      className: card.className, at: performance.now() });
    if (pauseAt != null && !probe.paused) {
      const animation = card.getAnimations().find(a => a.animationName === 'reviewCardTurn');
      if (animation) {
        animation.pause(); animation.currentTime = pauseAt;
        const style = getComputedStyle(card);
        probe.paused = { at: pauseAt, opacity: Number(style.opacity), transform: style.transform,
          duration: animation.effect.getComputedTiming().duration, easing: style.animationTimingFunction };
        probe.resume = () => animation.play();
      }
    }
  };
  const onEnd = event => { if (event.animationName === 'reviewCardTurn') probe.ends.push({ at: performance.now() }); };
  document.addEventListener('animationstart', onStart, true);
  document.addEventListener('animationend', onEnd, true);
}, pauseAt);

async function waitWordChange(page, from) {
  await page.waitForFunction(from => {
    const word = document.querySelector('.review-card__word')?.textContent.trim();
    return (word && word !== from) || document.querySelector('.review-done');
  }, from, { timeout: 15000 });
}

const until = async (cond, ms = 10000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return cond(); };

if (only.includes('review')) test('review: 앞면 → 클릭 펼치기 → 채점 → 넘김 → 끝 화면', { timeout: 240000 }, async () => {
  const S = 'review';
  // 넘김 효과를 재야 하므로 동작 줄이기를 끈다(합성 백엔드 기본값은 reduce).
  const f = await open({ reducedMotion: 'no-preference' });
  try {
    const words = reviewWords(), patches = [];
    await f.context.route('**/rest/v1/user_vocabulary*', r => { if (r.request().method() !== 'GET') patches.push(r.request().postDataJSON()); return json(r, r.request().method() === 'GET' ? words : []); });
    await f.context.route('**/rest/v1/vocabulary_with_exclusions*', r => json(r, words.map(word => ({ ...word, is_excluded: false }))));
    await f.context.route('**/rest/v1/review_events*', r => json(r, [], 201));
    await f.context.route('**/api/learning/vocabulary**', r => {
      const url = new URL(r.request().url());
      if (url.searchParams.get('view') !== 'learning') return r.fallback();
      return json(r, legacyLearningSnapshot({ actorId: OWNER, rows: words, known: [], exclusions: [], fields: url.searchParams.get('fields') }));
    });
    await f.page.goto('/vocab?lang=Japanese', { waitUntil: 'domcontentloaded', timeout: 120000 });
    const start = f.page.getByRole('button', { name: `표현 ${words.length}개 복습 →`, exact: true });
    await start.waitFor({ timeout: 60000 });
    rec.check(S, `복습방 입구에 합성 단어 ${words.length}개가 복습 대상으로 잡힘`, true, `「표현 ${words.length}개 복습 →」`);
    await f.page.waitForLoadState('networkidle').catch(() => {});
    await shot(f, S, 'review-1-room', '복습방 입구(합성 단어 3개, 기한 지남)');

    await start.click();
    await f.page.locator('.review-card__body--front').waitFor();
    await f.page.waitForTimeout(400); // 첫 카드의 넘김 효과(0.24초)가 끝난 뒤 앞면을 찍는다
    const front = await stateOf(f.page);
    rec.check(S, '앞면: 뜻 · 정답 칸(.review-card__answer) 없음', !front.answer && !front.meaning, JSON.stringify({ word: front.word, answer: front.answer }));
    rec.check(S, '앞면: 채점 막대 잠김', front.gradeDisabled === true, `알맞음 disabled=${front.gradeDisabled}`);
    rec.check(S, '앞면 몸통: 눌러 펼칠 수 있음 표시(cursor: pointer)', front.cursor === 'pointer', `cursor=${front.cursor}`);
    await shot(f, S, 'review-2-front', `앞면(${front.word}) — 글자만, 채점 잠김`);
    const hint = f.page.getByRole('button', { name: '힌트', exact: true });
    if (await hint.count()) {
      await hint.click();
      await f.page.locator('.review-card__hint').waitFor();
      const afterHint = await stateOf(f.page);
      rec.check(S, '카드 안 다른 조작(힌트 단추)은 펼치지 않음', !afterHint.answer && afterHint.front, `answer=${afterHint.answer}`);
      await shot(f, S, 'review-2-front-hint', `앞면 + 힌트(${front.word})`);
      await f.page.getByRole('button', { name: '힌트 숨기기', exact: true }).click();
    }

    // 앞면 몸통(표제어 글자)을 마우스로 누른다 — 「정답 확인하기」 단추가 아니다.
    await f.page.locator('.review-card__word').click();
    await f.page.locator('.review-card__answer').waitFor({ timeout: 3000 }).catch(() => {});
    const back = await stateOf(f.page);
    const expected = words.find(w => w.word_text === front.word)?.meaning;
    rec.check(S, '앞면 클릭(표제어 글자) → .review-card__answer 나타남', back.answer && !back.front, JSON.stringify({ answer: back.answer, front: back.front }));
    rec.check(S, '뒷면 뜻이 그 카드의 뜻', back.meaning === expected, `${back.meaning} (기대 ${expected})`);
    await f.page.waitForFunction(() => document.querySelector('.review-score-btn--good')?.disabled === false, null, { timeout: 3000 }).catch(() => {});
    rec.check(S, '펼친 뒤 채점 막대 열림(0.3초 입력 무시 뒤)', (await stateOf(f.page)).gradeDisabled === false);
    await f.page.locator('.review-card__body').click({ position: { x: 8, y: 8 } });
    rec.check(S, '뒷면 몸통을 다시 눌러도 접히지 않음', (await stateOf(f.page)).answer === true);
    await f.page.waitForLoadState('networkidle').catch(() => {});
    await shot(f, S, 'review-3-back', `뒷면(${front.word}) — 앞면 클릭으로 펼침`);

    // 채점 → 다음 카드: 새 노드(key) + review-card--turn 애니메이션. 중간 프레임(60ms)에서 멈춰 찍는다.
    await armTurnProbe(f.page, 60);
    await f.page.locator('.review-score-btn--good').click();
    await waitWordChange(f.page, front.word);
    await until(() => patches.length >= 1);
    rec.check(S, '채점 1회 → 일정 저장 1건(합성 백엔드 PATCH)', patches.length === 1, `PATCH ${patches.length}건`);
    await f.page.waitForFunction(() => window.__uxTurn?.paused, null, { timeout: 3000 }).catch(() => {});
    const mid = await f.page.evaluate(() => ({ starts: window.__uxTurn.starts, paused: window.__uxTurn.paused }));
    const second = await stateOf(f.page);
    rec.check(S, '다음 카드 = 새 카드 노드에 review-card--turn 애니메이션 시작', mid.starts.length === 1 && mid.starts[0].newNode && /review-card--turn/.test(mid.starts[0].className),
      JSON.stringify(mid.starts.map(s => ({ word: s.word, newNode: s.newNode }))));
    rec.check(S, '다음 카드는 앞면으로 시작(답 숨김)', second.front && !second.answer, `${second.word} · count ${second.count}`);
    const p = mid.paused;
    rec.check(S, '넘김 중간 프레임: 오른쪽에서 들어오며 흐림 → 선명', !!p && p.opacity > 0.35 && p.opacity < 1 && /matrix/.test(p.transform) && Number(p.transform.split(',')[4]) > 0,
      p ? `t=${p.at}ms opacity=${p.opacity.toFixed(2)} transform=${p.transform}` : '멈춤 실패');
    rec.check(S, '넘김 길이 0.3초 이하', !!p && p.duration > 0 && p.duration <= 300, p ? `${p.duration}ms · ${p.easing}` : '');
    if (p) await shot(f, S, 'review-4-turn-mid', `넘김 중간 프레임(60ms에서 멈춤, ${second.word})`);
    await f.page.evaluate(() => window.__uxTurn.resume?.());
    await f.page.waitForFunction(() => window.__uxTurn.ends.length >= 1, null, { timeout: 3000 }).catch(() => {});
    const settled = await f.page.evaluate(() => { const card = document.querySelector('.review-card'); const s = getComputedStyle(card); return { ends: window.__uxTurn.ends.length, opacity: Number(s.opacity), transform: s.transform }; });
    rec.check(S, '넘김이 끝나면 제자리(opacity 1, transform 없음)', settled.ends === 1 && settled.opacity === 1 && settled.transform === 'none', JSON.stringify(settled));
    await shot(f, S, 'review-5-next-front', `다음 카드 앞면(${second.word}, ${second.count})`);

    // 둘째 카드: Space로 펼치고 채점. 넘김 효과가 카드마다 한 번씩 도는지(멈추지 않고 시작 · 끝 시각만) 잰다.
    await f.page.keyboard.press('Space');
    await f.page.locator('.review-card__answer').waitFor();
    rec.check(S, 'Space로도 펼침(정본 키보드 입력 유지)', (await stateOf(f.page)).answer);
    await armTurnProbe(f.page, null);
    await f.page.locator('.review-score-btn--good').click();
    await waitWordChange(f.page, second.word);
    await f.page.waitForFunction(() => window.__uxTurn.ends.length >= 1, null, { timeout: 3000 }).catch(() => {});
    const turn2 = await f.page.evaluate(() => window.__uxTurn);
    const ms = turn2.starts[0] && turn2.ends[0] ? Math.round(turn2.ends[0].at - turn2.starts[0].at) : null;
    rec.check(S, '셋째 카드에도 넘김 효과가 한 번 돎(시작 → 끝 실측)', turn2.starts.length === 1 && turn2.starts[0].newNode && turn2.ends.length === 1, `실측 ${ms}ms`);
    const third = await stateOf(f.page);

    // 동작 줄이기 설정이면 넘김 효과가 꺼진다.
    await f.page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await f.page.evaluate(() => getComputedStyle(document.querySelector('.review-card')).animationName);
    rec.check(S, '동작 줄이기(prefers-reduced-motion) → 넘김 효과 없음', reduced === 'none', `animation-name=${reduced}`);
    await f.page.emulateMedia({ reducedMotion: 'no-preference' });

    // 셋째 카드: 「정답 확인하기」 단추로 펼치고 채점 → 끝 화면.
    await f.page.getByRole('button', { name: /정답 확인하기/ }).click();
    await f.page.locator('.review-card__answer').waitFor();
    await f.page.locator('.review-score-btn--hard').click();
    await waitWordChange(f.page, third.word);
    const done = f.page.getByRole('heading', { name: '오늘 몫 끝', exact: true });
    await done.waitFor({ timeout: 15000 });
    await until(() => patches.length >= 3);
    rec.check(S, '끝 화면(ReviewFinished) 「오늘 몫 끝」 표시', true);
    const finish = await f.page.evaluate(() => ({
      summary: document.querySelector('.review-done__summary')?.textContent.trim(),
      calendar: !!document.querySelector('.review-done__calendar'), bars: document.querySelectorAll('.review-done__bar-col').length,
      stats: [...document.querySelectorAll('.review-done__stat')].map(n => n.innerText.replace(/\s+/g, ' ').trim()),
      actions: [...document.querySelectorAll('.review-done__actions a strong, .review-done__actions button')].map(n => n.textContent.trim()),
    }));
    rec.check(S, `끝 화면 요약 = ${words.length}개`, finish.summary === `${words.length}개`, finish.summary);
    rec.check(S, '끝 화면: 7일 일정 막대 · 통계 · 다음 행동', finish.calendar && finish.bars === 7 && finish.stats.length === 2 && finish.actions.length > 0,
      `막대 ${finish.bars} · 통계 ${finish.stats.join(' / ')} · 행동 ${finish.actions.join(' / ')}`);
    rec.check(S, `채점 ${words.length}회 → 일정 저장 ${words.length}건`, patches.length === words.length, `PATCH ${patches.length}건`);
    await f.page.waitForLoadState('networkidle').catch(() => {});
    await shot(f, S, 'review-6-finished', '복습 끝 화면(ReviewFinished)');
    rec.check(S, '페이지 오류(pageerror) 없음', f.errors.length === 0, f.errors.slice(0, 2).join(' | '));
  } catch (error) { rec.error(S, '복습 흐름', error); await f.page.screenshot({ path: join(out, 'review-error.png') }).catch(() => {}); throw error; } finally { await f.context.close(); }
});

if (only.includes('library')) test('library: 서재 목록(자료 5개)', { timeout: 180000 }, async () => {
  const S = 'library';
  const { fixture: libraryFixture } = await import('../e2e/fixtures/library-v4-backend.mjs');
  const f = await open({ management: true }, libraryFixture);
  try {
    const items = libraryRows();
    f.rows.push(...items);
    await f.page.goto('/materials', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await f.page.locator('.shelf-row').first().waitFor({ timeout: 60000 });
    await f.page.waitForLoadState('networkidle').catch(() => {});
    const listed = await f.page.locator('.shelf-row').allInnerTexts();
    rec.check(S, `자료 ${items.length}개가 목록 줄(.shelf-row)로 나옴`, listed.length === items.length, `${listed.length}줄`);
    const missing = items.filter(item => !listed.some(text => text.includes(item.title))).map(item => item.title);
    rec.check(S, '제목이 모두 보임', missing.length === 0, missing.length ? `없음: ${missing.join(', ')}` : '');
    await shot(f, S, 'library-1-list', `서재 목록(합성 자료 ${items.length}개)`);
    await f.page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await shot(f, S, 'library-2-list-bottom', '서재 목록 아래 끝');
    rec.check(S, '페이지 오류(pageerror) 없음', f.errors.length === 0, f.errors.slice(0, 2).join(' | '));
  } catch (error) { rec.error(S, '서재 목록', error); await f.page.screenshot({ path: join(out, 'library-error.png') }).catch(() => {}); throw error; } finally { await f.close(); }
});

if (only.includes('viewer')) test('viewer: 읽기 화면 + 단어 카드', { timeout: 180000 }, async () => {
  const S = 'viewer';
  const f = await open();
  try {
    const { headwords, ...material } = viewerMaterial();
    f.rows.push(material);
    await f.context.addInitScript(() => {
      if (!localStorage.getItem('viewer_preferences_v2')) localStorage.setItem('viewer_preferences_v2', JSON.stringify({ version: 2, languages: { Japanese: { focusMode: false, autoSpeakOnClick: false } } }));
    });
    await f.context.route('**/api/dict?**', r => json(r, null));
    await f.context.route('**/api/gemini', r => json(r, { text: '합성 번역' }));
    await f.context.route(/\/api\/analyze(\/korean)?$/, r => json(r, { results: [] }));
    await f.context.route('**/api/tts?**', r => json(r, { error: 'no fixture speech' }, 500));
    await f.page.goto(`/viewer/${material.id}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await f.page.locator('[data-source-token="id_0_0"]').waitFor({ timeout: 60000 });
    await f.page.waitForLoadState('networkidle').catch(() => {});
    const tokens = await f.page.locator('[data-source-token]').count();
    const expected = material.processed_json.sequence.filter(id => material.processed_json.dictionary[id].pos !== '개행').length;
    rec.check(S, '본문 토큰이 모두 그려짐', tokens >= expected, `${tokens}개(분석 토큰 ${expected}, 표제어 ${headwords.length})`);
    await shot(f, S, 'viewer-1-reading', `뷰어 첫 화면(「${material.title}」)`);
    await f.page.locator('[data-source-token="id_0_2"]').click();
    const meaning = f.page.locator('.word-detail-card__meaning').getByText('역', { exact: true });
    await meaning.waitFor({ timeout: 10000 });
    rec.check(S, '단어(駅)를 누르면 단어 카드에 뜻이 나옴', true, '.word-detail-card__meaning = 역');
    await f.page.waitForTimeout(400);
    await shot(f, S, 'viewer-2-word-card', '뷰어 단어 카드(駅)');
    rec.check(S, '페이지 오류(pageerror) 없음', f.errors.length === 0, f.errors.slice(0, 2).join(' | '));
  } catch (error) { rec.error(S, '뷰어', error); await f.page.screenshot({ path: join(out, 'viewer-error.png') }).catch(() => {}); throw error; } finally { await f.context.close(); }
});

after(async () => {
  if (server) try { process.kill(-server.pid); } catch { /* already gone */ }
  const flags = summarize(rows);
  await writeFile(join(out, 'report.json'), JSON.stringify({ stamp, baseURL, viewport: AUTH_VIEWPORT, results: rec.results, shots, rows, flags }, null, 2));
  await writeFile(join(out, 'report.md'), markdown({ stamp, baseURL, results: rec.results, shots, flags, rows }));
  const { pass, fail } = verdictCounts(rec.results);
  console.log(['', `로그인 화면 UX 점검: PASS ${pass} · FAIL ${fail} · 캡처 ${shots.length}장 · 플래그 ${flags.length}개 → ${join(out, 'report.md')}`,
    ...verdictLines(rec.results), ''].join('\n'));
  if (fail) process.exitCode = 1;
});
