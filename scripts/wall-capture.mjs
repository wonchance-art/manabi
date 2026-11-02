#!/usr/bin/env node
// 화면 벽 캡처(2판 1단계) — docs/design/scenes.json의 장면(경로 × 사람)을 휴대폰 390 · 데스크톱 1280으로 찍고,
// docs/design/wall-rules.md §3 객관 검사를 재서 wall-out/<sha 8자>/manifest.json + shots/*.jpg로 낸다. 판단 · 승인은 화면 벽이 한다.
//
//   npm run wall:build                      # 한 번 — e2e 공개 값 + 운영과 같은 글꼴 사본(vendor/google-fonts)으로 production 빌드
//   npm run wall:capture                    # next start + 합성 백엔드를 직접 띄우고 끝나면 내린다
//   npm run wall:capture -- --scenes home.guest,vocab.filled   # 장면 몇 개만(PR 판정 재현)
//   npm run wall:capture -- --persona filled --viewport mobile # 사람 · 화면 크기 거르기
//
// 왜 e2e:build가 아니라 wall:build인가: e2e 빌드는 글꼴을 대역(e2e/fixtures/google-fonts-mock.cjs — 가나 획순 글꼴 하나)으로
// 넣는다. 선택자 검사에는 충분하지만 디자인 벽에는 실제 글꼴이 필요하다(§1 「원본 글꼴이 로드되지 않은 장면은 판정하지 않는다」).
//
// 사람(합성 학습자 — 운영 계정 · DB와 무관):
//   guest  — 로그아웃 손님
//   empty  — 가입 · 온보딩을 마쳤고 기록이 하나도 없는 계정(진짜 빈 상태 — 1판의 「불러오지 못했어요」는 대역이 없어서였다)
//   filled — e2e/fixtures/heavy-account.mjs의 무거운 합성 계정(단어 3,000 · 자료 200 · 60일 review_events)
// 데이터는 새로 짓지 않는다: 무거운 합성 백엔드(createHeavyBackend) 위에 빈 계정 프로필 한 줄과 추천 읽을거리 한 편만 더한다.
// 서버 쪽 Supabase 요청은 e2e/server-fetch-mock.mjs가 E2E_HEAVY_BACKEND로 넘기고, 브라우저 쪽은 Playwright route가 넘긴다.
import http from 'node:http';
import { execSync, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, openSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { VIEWPORTS, kstStamp } from './ux-audit.mjs';
import { builtForE2E } from './ux-audit-auth-core.mjs';
import {
  AXE_RULE_IDS, DATA_GAP, PERSONAS, RAW_ERROR, VIEWPORT_KEYS, coverage, discoverRoutes, expandScenes, hash, judgeShot, loadRegistry,
  mergeVerdicts, missingValueLines, summaryLine, validateRegistry,
} from './wall-core.mjs';
import { createHeavyBackend, HEAVY_UID, HEAVY_SERVICE_KEY } from '../e2e/fixtures/heavy-account.mjs';
import { SUGGESTION_FIXTURE } from '../e2e/fixtures/suggestion-fixture.mjs';
import { compactVocabularySnapshot } from '../src/lib/vocabularySnapshotLight.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const list = name => (opt(name) || '').split(',').map(s => s.trim()).filter(Boolean);

export const EMPTY_UID = '00000000-0000-4000-8000-000000000302';
const E2E_PUBLIC = { NEXT_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key' };
const PUBLISHED_BOOKS = 'japanese-n4,japanese-n3'; // N5는 기본 발행, N4 · N3 표지도 발행 상태로 비춘다.
const SHOT_SCREENS = 4; // 긴 화면은 창 높이 4배까지만 찍는다(벽은 첫인상 · 위계를 본다 — 끝없는 목록 전체가 아니다).

// ── 합성 백엔드(서버 · 브라우저 공용 HTTP 귀) ──
// heavy-account의 startHeavyBackend와 같지만, /auth/v1/user를 토큰의 계정으로 답한다(그쪽은 늘 무거운 계정을 돌려준다 —
// 빈 계정이 서버 렌더에서 무거운 계정으로 보이면 빈 상태를 찍을 수 없다).
function userFor(sub) {
  const now = new Date().toISOString();
  const empty = sub === EMPTY_UID;
  return { id: sub, aud: 'authenticated', role: 'authenticated', email: empty ? 'wall-empty@example.com' : 'e2e-learner@example.com',
    email_confirmed_at: now, confirmed_at: now, app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: empty ? '새 학습자' : 'E2E 학습자' }, identities: [], created_at: now, updated_at: now };
}
const claimsOf = headers => { try { return JSON.parse(Buffer.from((headers.get('authorization') || '').split('.')[1], 'base64url').toString('utf8')); } catch { return null; } };

// 빈 계정의 학습 RPC — 무거운 백엔드의 RPC는 늘 무거운 계정(actorId)으로 답해, 빈 계정이 부르면 앱이 계정 불일치로 503을 낸다.
// 운영 RPC가 기록 없는 계정에 돌려주는 모양(행 0 · 오늘 몫 그대로)으로 답한다. 모양은 heavy-account.mjs의 같은 RPC를 따른다.
function emptySnapshot() {
  return { version: 1, actorId: EMPTY_UID, enabled: true, complete: true, registryAvailable: true, rows: [], registry: [], now: new Date().toISOString() };
}
function emptyQuota() {
  const now = new Date().toISOString(), day = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
  return { version: 1, actorId: EMPTY_UID, installed: true, enabled: true, active: true, fsrsEnabled: true, startsAt: '2026-01-01T19:00:00.000Z', now,
    learningDay: day, timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 1, used: 0, remaining: 15, fsrsUsed: 0, legacyUsed: 0, admittedLegacyCardIds: [] };
}
const EMPTY_RPC = {
  fsrs_vocabulary_snapshot: () => emptySnapshot(),
  fsrs_vocabulary_snapshot_cards: () => emptySnapshot(),
  fsrs_vocabulary_snapshot_light: body => compactVocabularySnapshot(emptySnapshot(), { language: body?.p_language ?? null, summary: body?.p_summary === true }),
  fsrs_legacy_boundary: () => ({ version: 1, actorId: EMPTY_UID, enrolled: false }),
  learning_admission_status: () => emptyQuota(),
  update_streak: () => ({ streak_count: 1 }),
  personal_library_page_v2: () => ({ total: 0, unavailable: 0, items: [] }),
};

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD', 'access-control-expose-headers': 'content-range' };

async function startBackend() {
  const backend = createHeavyBackend();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://e2e.supabase.co');
    const cors = { ...CORS, 'access-control-allow-headers': req.headers['access-control-request-headers'] || '*' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    let raw = ''; for await (const chunk of req) raw += chunk;
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    if (url.pathname.endsWith('/auth/v1/user')) {
      const sub = claimsOf(headers)?.sub || null;
      res.writeHead(sub ? 200 : 401, { ...cors, 'content-type': 'application/json' });
      res.end(JSON.stringify(sub ? userFor(sub) : { message: 'invalid e2e token' }));
      return;
    }
    const rpc = url.pathname.includes('/rest/v1/rpc/') ? url.pathname.split('/').pop() : null;
    // 계정은 토큰(사용자 클라이언트) 또는 p_actor · p_user_id(서비스 클라이언트 — 토큰이 서비스 키다)로 온다.
    const actor = claimsOf(headers)?.sub || body?.p_actor || body?.p_user_id || null;
    if (rpc && actor === EMPTY_UID && EMPTY_RPC[rpc]) {
      res.writeHead(200, { ...cors, 'content-type': 'application/json' });
      res.end(JSON.stringify(EMPTY_RPC[rpc](body || Object.fromEntries(url.searchParams))));
      return;
    }
    const out = await backend.handle({ method: req.method, url, headers, body, origin: req.headers['x-heavy-origin'] || 'server' });
    res.writeHead(out.status, { ...cors, ...out.headers });
    res.end(req.method === 'HEAD' ? undefined : out.payload);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { backend, port: server.address().port, close: () => new Promise(r => server.close(r)) };
}

/** 사람마다 깨끗한 계정 — 무거운 계정을 다시 짓고, 빈 계정 프로필과 추천 읽을거리 한 편을 더한다. */
function seed(backend) {
  backend.reset();
  const t = backend.state.account.tables;
  const created = new Date(Date.now() - 2 * 86400000).toISOString();
  t.profiles.push({ id: EMPTY_UID, role: 'learner', display_name: '새 학습자', onboarded: true, streak_count: 0, learning_language: ['Japanese'],
    last_login_at: created, daily_goal: 20, created_at: created });
  (t.daily_suggestions ??= []).push({ ...SUGGESTION_FIXTURE });
}

const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
function sessionCookie(sub, baseURL) {
  const now = Math.floor(Date.now() / 1000);
  const user = userFor(sub);
  const access_token = [b64({ alg: 'HS256', typ: 'JWT' }), b64({ sub, aud: 'authenticated', role: 'authenticated', e2e_role: 'learner', email: user.email, iat: now, exp: now + 6 * 3600 }), 'e2e'].join('.');
  const session = { access_token, refresh_token: 'e2e-refresh-token', expires_in: 6 * 3600, expires_at: now + 6 * 3600, token_type: 'bearer', user };
  return { name: 'sb-e2e-auth-token', value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`, url: baseURL, sameSite: 'Lax' };
}

// ── 페이지 안 측정(순수 DOM — 판단 없음) ──
function wallProbe({ rawError, dataGap }) {
  const hidden = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return true; } return false; };
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !hidden(el); };
  const doc = document.documentElement;
  const bodyText = document.body?.innerText || '';
  const mainText = document.querySelector('main')?.innerText || bodyText;
  const small = [];
  for (const el of document.querySelectorAll('a[href], button, [role="button"]')) {
    if (!shown(el) || (el.innerText || '').trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= 44 && r.height >= 44) continue;
    const name = el.getAttribute('aria-label') || el.getAttribute('title') || (typeof el.className === 'string' ? el.className.split(' ')[0] : '') || el.tagName;
    small.push(`${el.tagName.toLowerCase()} 「${String(name).slice(0, 28)}」 ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const broken = [...document.images].filter(img => img.complete && img.naturalWidth === 0 && shown(img)).map(img => (img.getAttribute('src') || '').slice(0, 80));
  const boxes = [...document.querySelectorAll('header, nav, main, footer, h1, h2, h3, button, a[href], img, input, textarea, [role="tab"]')]
    .filter(shown).slice(0, 80).map(el => { const r = el.getBoundingClientRect(); return `${el.tagName}:${Math.round(r.x / 8)},${Math.round((r.y + scrollY) / 8)},${Math.round(r.width / 8)},${Math.round(r.height / 8)}`; });
  const fonts = [...document.fonts];
  return {
    url: location.pathname + location.search,
    title: document.title,
    h1: document.querySelector('h1')?.innerText.trim() || null,
    innerWidth, scrollWidth: doc.scrollWidth, scrollHeight: doc.scrollHeight,
    overflowX: doc.scrollWidth > innerWidth + 1,
    fontKR: fonts.some(f => /Noto.?Sans.?KR/i.test(f.family) && f.status === 'loaded'),
    rawError: new RegExp(rawError).exec(bodyText)?.[0] || null,
    dataGap: new RegExp(dataGap).exec(mainText.slice(0, 4000))?.[0] || null,
    smallTargets: small.slice(0, 12), smallTargetCount: small.length,
    brokenImages: broken,
    text: mainText.slice(0, 6000),
    boxes: boxes.join('|'),
  };
}

async function runAxe(page) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const violations = await page.evaluate(async rules => {
    const res = await window.axe.run(document, { runOnly: { type: 'rule', values: rules }, resultTypes: ['violations'] });
    return res.violations.map(v => ({ id: v.id, n: v.nodes.length, samples: v.nodes.slice(0, 3).map(node => {
      const d = node.any?.[0]?.data || {};
      const text = (node.html || '').replace(/<[^>]+>/g, '').trim().slice(0, 24);
      const summary = v.id === 'color-contrast' && d.contrastRatio ? `「${text}」 ${d.fgColor}/${d.bgColor} ${d.contrastRatio}:1 (${d.fontSize}${d.fontWeight === 'bold' ? ' 굵게' : ''})` : `${node.target.join(' ').slice(0, 60)}${text ? ` 「${text}」` : ''}`;
      return { target: node.target.join(' ').slice(0, 120), summary };
    }) }));
  }, AXE_RULE_IDS);
  return violations;
}

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return true; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function captureScene(context, scene, viewportKey, out) {
  const vp = VIEWPORTS[viewportKey];
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 160)}`));
  const failed = [];
  page.on('response', r => { if (r.status() >= 500) { const u = new URL(r.url()); failed.push(`${r.status()} ${r.request().method()} ${u.host === 'e2e.supabase.co' ? 'supabase:' : ''}${u.pathname}${u.search.slice(0, 60)}`); } });
  const t0 = Date.now();
  const file = `shots/${scene.id}.${viewportKey}.jpg`;
  try {
    const response = await page.goto(scene.path, { waitUntil: 'load', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(scene.wait || 700);
    const m = await page.evaluate(wallProbe, { rawError: RAW_ERROR.source, dataGap: DATA_GAP.source });
    m.status = response?.status() ?? null;
    m.axe = await runAxe(page).catch(e => [{ id: 'axe-error', n: 0, samples: [{ summary: String(e.message).slice(0, 80) }] }]);
    m.missing = missingValueLines(m.text);
    const height = Math.min(m.scrollHeight, vp.height * SHOT_SCREENS);
    await page.screenshot({ path: join(out, file), type: 'jpeg', quality: 72, fullPage: true, clip: { x: 0, y: 0, width: vp.width, height } });
    const { text, boxes, ...rest } = m;
    return { ...rest, ms: Date.now() - t0, consoleErrors: consoleErrors.slice(0, 5), failedResponses: [...new Set(failed)].slice(0, 6), textHash: hash(text), lmHash: hash(boxes), text, shot: file, shotHeight: height };
  } catch (error) {
    return { error: String(error.message).split('\n')[0].slice(0, 200), ms: Date.now() - t0, consoleErrors: consoleErrors.slice(0, 5) };
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const registryPath = join(root, 'docs', 'design', 'scenes.json');
  const reg = loadRegistry(registryPath);
  const errors = validateRegistry(reg);
  if (errors.length) throw new Error(`장면 등록부 오류:\n${errors.join('\n')}`);
  const only = new Set(list('--scenes'));
  const personas = list('--persona').length ? list('--persona') : PERSONAS;
  const viewports = list('--viewport').length ? list('--viewport') : VIEWPORT_KEYS;
  const scenes = expandScenes(reg).filter(s => (!only.size || only.has(s.id)) && personas.includes(s.persona));
  const sha = execSync('git rev-parse HEAD', { cwd: root }).toString().trim();
  const out = opt('--out') || join(root, 'wall-out', sha.slice(0, 8));
  await mkdir(join(out, 'shots'), { recursive: true });

  if (!await builtForE2E(join(root, '.next'), E2E_PUBLIC.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error('.next가 e2e 공개 값으로 빌드되지 않았어요 — 먼저 `npm run wall:build`.');
  }
  const back = await startBackend();
  // server-fetch-mock은 불러올 때 환경을 읽는다 — 값을 먼저 정하고 불러온다(Next 서버에 주는 값과 같다).
  Object.assign(process.env, E2E_PUBLIC, { E2E_HEAVY_BACKEND: `http://127.0.0.1:${back.port}`, E2E_PUBLISHED_BOOKS: PUBLISHED_BOOKS });
  await import('../e2e/server-fetch-mock.mjs');
  const port = Number(opt('--port') || process.env.WALL_PORT || 3170);
  const baseURL = `http://localhost:${port}`;
  const log = openSync(join(out, 'server.log'), 'w');
  const nodeOptions = [process.env.NODE_OPTIONS, `--import=${join(root, 'e2e', 'server-fetch-mock.mjs')}`].filter(Boolean).join(' ');
  const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root, detached: true, stdio: ['ignore', log, log],
    env: { ...process.env, ...E2E_PUBLIC, NEXT_PUBLIC_SITE_URL: baseURL, NODE_OPTIONS: nodeOptions,
      E2E_HEAVY_BACKEND: `http://127.0.0.1:${back.port}`, SUPABASE_SERVICE_ROLE_KEY: HEAVY_SERVICE_KEY, E2E_PUBLISHED_BOOKS: PUBLISHED_BOOKS },
  });
  const stop = () => { try { process.kill(-server.pid); } catch { /* gone */ } };
  process.on('exit', stop);
  if (!await waitFor(`${baseURL}/manifest.webmanifest`, 90000)) { stop(); throw new Error(`서버가 뜨지 않았어요 (로그 ${join(out, 'server.log')})`); }

  const executablePath = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : { channel: 'chrome' });
  const results = new Map(scenes.map(s => [s.id, { ...s, shots: {}, checks: {} }]));
  const started = Date.now();
  try {
    for (const persona of personas) {
      const todo = scenes.filter(s => s.persona === persona);
      if (!todo.length) continue;
      seed(back.backend);
      await Promise.all(viewports.map(async viewportKey => {
        const vp = VIEWPORTS[viewportKey];
        const context = await browser.newContext({ baseURL, viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch,
          deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block' });
        context.setDefaultTimeout(30000);
        if (persona !== 'guest') await context.addCookies([sessionCookie(persona === 'empty' ? EMPTY_UID : HEAVY_UID, baseURL)]);
        await context.addInitScript(() => { try { localStorage.setItem('as_sound_on', '0'); } catch { /* 소리 끔 */ } });
        // 브라우저의 Supabase 요청도 서버와 같은 길로 — 이 프로세스에 불러 둔 server-fetch-mock이 교재 판본 · 덮어쓰기는 저장소 판본으로,
        // 나머지(계정 행)는 합성 백엔드로 보낸다. 브라우저만 합성 백엔드로 직행시키면 교재 행이 비어 「교재 정보를 불러오지 못했어요」가 찍힌다.
        await context.route('https://e2e.supabase.co/**', async route => {
          const req = route.request();
          const cors = { ...CORS, 'access-control-allow-headers': req.headers()['access-control-request-headers'] || '*' };
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
          const headers = { ...req.headers(), 'x-heavy-origin': 'browser' }; delete headers.host; delete headers['content-length'];
          try {
            const res = await fetch(req.url(), { method: req.method(), headers,
              body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() ?? undefined });
            return route.fulfill({ status: res.status, headers: { ...Object.fromEntries(res.headers), ...cors }, body: Buffer.from(await res.arrayBuffer()) });
          } catch { return route.abort('failed'); }
        });
        await context.route('**/api/tts?**', route => route.fulfill({ status: 204, body: '' }));
        for (const scene of todo) {
          const m = await captureScene(context, scene, viewportKey, out);
          const row = results.get(scene.id);
          row.checks[viewportKey] = m;
          if (m.shot) row.shots[viewportKey] = m.shot;
          console.log(summaryLine(scene, viewportKey, judgeShot(m)));
        }
        await context.close();
      }));
    }
  } finally {
    await browser.close();
    stop();
    await back.close();
  }

  const sceneRows = [...results.values()].map(row => {
    const judged = mergeVerdicts(Object.fromEntries(Object.entries(row.checks).map(([vp, m]) => [vp, judgeShot(m)])));
    const text = row.checks.desktop?.text ?? row.checks.mobile?.text ?? '';
    const checks = Object.fromEntries(Object.entries(row.checks).map(([vp, { text: _t, ...m }]) => [vp, m]));
    return { ...row, checks, text: text.slice(0, 4000), verdict: judged.verdict, reasons: judged.reasons };
  });
  const routes = discoverRoutes(join(root, 'src', 'app'));
  const manifest = {
    version: 1, sha, short: sha.slice(0, 8), capturedAt: `${kstStamp()} KST`, capturedIso: new Date().toISOString(), baseURL, build: 'wall:build (e2e 공개 값 · vendor/google-fonts 운영 글꼴)',
    viewports: Object.fromEntries(viewports.map(k => [k, { width: VIEWPORTS[k].width, height: VIEWPORTS[k].height }])),
    personas: reg.personas, lanes: reg.lanes, captureSec: Math.round((Date.now() - started) / 1000),
    counts: sceneRows.reduce((acc, s) => ({ ...acc, [s.verdict]: (acc[s.verdict] || 0) + 1 }), {}),
    scenes: sceneRows, coverage: coverage(reg, routes), routesTotal: routes.length,
  };
  await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`화면 벽 캡처: 장면 ${sceneRows.length} · 캡처 ${sceneRows.reduce((n, s) => n + Object.keys(s.shots).length, 0)}장 · ${manifest.captureSec}초 · ${JSON.stringify(manifest.counts)} → ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
