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
  AXE_RULE_IDS, DATA_GAP, PERSONAS, aggregateParts, offTokenColors, RAW_ERROR, VIEWPORT_KEYS, coverage, discoverRoutes, expandScenes, hash, judgeShot, loadRegistry,
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
export function wallProbe({ rawError, dataGap }) {
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

/**
 * 부품 · 색 측정(2판 2단계 — 부품 대조). 순수 DOM — 판단 없음.
 * parts: 화면에 보이는 제목(h1~h3) · 채운 버튼 · 테두리 버튼 · 입력칸 · 카드의 계산된 스타일(같은 모양은 한 번만, 종류마다 최대 12).
 * colors: 보이는 글자의 색 · 칠한 배경색 사용 횟수. palette: 스타일시트의 CSS 변수(--*) 중 색인 값 전부 — 「토큰 밖 색」 판정의 기준.
 */
export function partsProbe() {
  const hidden = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return true; } return false; };
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !hidden(el); };
  const clear = c => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  const px = v => Math.round(parseFloat(v) || 0);
  const family = f => (f || '').split(',')[0].replace(/["']/g, '').replace(/^__|_[0-9a-f]{6,}$|_Fallback_[0-9a-f]+$/gi, '').replace(/_/g, ' ').trim();
  const label = el => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 28);
  const cls = el => (typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '') || el.tagName.toLowerCase();
  const rectOf = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
  const text = s => ({ font: family(s.fontFamily), size: px(s.fontSize), weight: Number(s.fontWeight), line: s.lineHeight === 'normal' ? 'normal' : px(s.lineHeight), track: s.letterSpacing === 'normal' ? 0 : Math.round(parseFloat(s.letterSpacing) * 100) / 100, color: s.color });
  const box = (s, r) => ({ bg: clear(s.backgroundColor) ? 'none' : s.backgroundColor, radius: px(s.borderTopLeftRadius), border: px(s.borderTopWidth) && !clear(s.borderTopColor) ? `${px(s.borderTopWidth)}px ${s.borderTopColor}` : 'none',
    height: Math.round(r.height), padX: px(s.paddingLeft), shadow: s.boxShadow === 'none' ? 'none' : 'yes' });
  const parts = [], seen = new Set();
  const add = (type, el, style) => { const key = `${type}|${JSON.stringify(style)}`; if (seen.has(key)) return; if (parts.filter(p => p.type === type).length >= 12) return; seen.add(key); parts.push({ type, style, label: label(el), cls: cls(el), rect: rectOf(el) }); };
  for (const el of document.querySelectorAll('main h1, main h2, main h3')) if (shown(el)) add(el.tagName.toLowerCase(), el, text(getComputedStyle(el)));
  for (const el of document.querySelectorAll('button, a[href], [role="button"], input[type="submit"]')) {
    if (!shown(el) || !(el.innerText || '').trim()) continue;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.height < 24 || r.height > 72 || r.width > 520) continue;
    const b = box(s, r);
    if (b.bg !== 'none') add('button-filled', el, { ...text(s), ...b });
    else if (b.border !== 'none' && b.radius > 0) add('button-outline', el, { ...text(s), ...b });
  }
  for (const el of document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]), textarea, select')) {
    if (!shown(el)) continue;
    const s = getComputedStyle(el); add('field', el, { ...text(s), ...box(s, el.getBoundingClientRect()) });
  }
  const pageBg = getComputedStyle(document.querySelector('.manabi-app') || document.body).backgroundColor;
  const cards = [];
  for (const el of document.querySelectorAll('main article, main section, main li, main div, main a')) {
    if (cards.length >= 40) break;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.width < 160 || r.height < 56 || px(s.borderTopLeftRadius) < 4) continue;
    const framed = (px(s.borderTopWidth) && !clear(s.borderTopColor)) || s.boxShadow !== 'none' || (!clear(s.backgroundColor) && s.backgroundColor !== pageBg);
    if (!framed || !shown(el) || cards.some(c => c.contains(el))) continue;
    cards.push(el);
    const b = box(s, r); delete b.height; delete b.padX;
    add('card', el, { ...b, pad: px(s.paddingTop) });
  }
  const colors = { text: {}, bg: {} };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const counted = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement; if (!el || counted.has(el) || !n.textContent.trim() || !shown(el)) continue;
    counted.add(el); const c = getComputedStyle(el).color; colors.text[c] = (colors.text[c] || 0) + 1;
  }
  for (const el of document.querySelectorAll('body *')) {
    const c = getComputedStyle(el).backgroundColor;
    if (clear(c)) continue;
    const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || hidden(el)) continue;
    colors.bg[c] = (colors.bg[c] || 0) + 1;
  }
  // 토큰 = 스타일시트의 --* 선언 중 색으로 풀리는 값(var() 꼬리는 그 자리에서 계산된 값으로).
  const probe = document.createElement('span'); (document.querySelector('.manabi-app') || document.body).append(probe);
  const palette = new Set();
  const visit = rules => { for (const rule of rules) {
    if (rule.cssRules) visit(rule.cssRules);
    if (!rule.style) continue;
    for (const prop of rule.style) { if (!prop.startsWith('--')) continue;
      const raw = rule.style.getPropertyValue(prop).trim();
      if (!/^(#|rgb|hsl|color-mix|oklch|var\()/i.test(raw)) continue;
      probe.style.color = ''; probe.style.color = raw.startsWith('var(') ? `var(${prop})` : raw;
      if (probe.style.color) palette.add(getComputedStyle(probe).color);
    } } };
  for (const sheet of document.styleSheets) { try { visit(sheet.cssRules); } catch { /* 다른 출처 */ } }
  probe.remove();
  return { parts, colors, palette: [...palette] };
}

export async function runAxe(page) {
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

/**
 * 캡처 환경 — 합성 백엔드 + next start(+ server-fetch-mock) + Chromium. 화면 벽 캡처와 개선 목업(전후 비교)이 같이 쓴다.
 * newContext({ persona, viewportKey, theme })는 그 사람으로 로그인한(손님은 쿠키 없음) 브라우저 맥락을 돌려준다.
 * theme 'dark'는 OS 설정(prefers-color-scheme)만 바꾼다 — 앱은 저장값이 없으면 OS를 따른다(ui-conventions §4).
 */
export async function startWallEnv({ out, port = 3170 }) {
  if (!await builtForE2E(join(root, '.next'), E2E_PUBLIC.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error('.next가 e2e 공개 값으로 빌드되지 않았어요 — 먼저 `npm run wall:build`.');
  }
  await mkdir(out, { recursive: true });
  const back = await startBackend();
  // server-fetch-mock은 불러올 때 환경을 읽는다 — 값을 먼저 정하고 불러온다(Next 서버에 주는 값과 같다).
  Object.assign(process.env, E2E_PUBLIC, { E2E_HEAVY_BACKEND: `http://127.0.0.1:${back.port}`, E2E_PUBLISHED_BOOKS: PUBLISHED_BOOKS });
  await import('../e2e/server-fetch-mock.mjs');
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
  if (!await waitFor(`${baseURL}/manifest.webmanifest`, 90000)) { stop(); await back.close(); throw new Error(`서버가 뜨지 않았어요 (로그 ${join(out, 'server.log')})`); }
  const executablePath = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : { channel: 'chrome' });

  async function newContext({ persona, viewportKey, theme = 'light' }) {
    const vp = VIEWPORTS[viewportKey];
    const context = await browser.newContext({ baseURL, viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch,
      deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce', serviceWorkers: 'block' });
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
    return context;
  }
  return { baseURL, backend: back.backend, browser, newContext, seed: () => seed(back.backend),
    close: async () => { await browser.close().catch(() => {}); stop(); await back.close(); } };
}

async function captureScene(context, scene, viewportKey, out, partSeen = new Map()) {
  const vp = VIEWPORTS[viewportKey];
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 160)}`));
  const failed = [];
  page.on('response', r => { if (r.status() >= 500) { const u = new URL(r.url()); failed.push(`${r.status()} ${r.request().method()} ${u.host === 'e2e.supabase.co' ? 'supabase:' : ''}${u.pathname}${u.search.slice(0, 60)}`); } });
  const t0 = Date.now();
  const file = `shots/${scene.id}.${viewportKey}.jpg`;
  // 장면이 정한 브라우저 저장값(예: 뷰어 읽기 테마) — 페이지 스크립트보다 먼저 넣는다.
  if (scene.storage) await page.addInitScript(entries => { try { for (const [k, v] of entries) localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 */ } }, Object.entries(scene.storage));
  try {
    const response = await page.goto(scene.path, { waitUntil: 'load', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(scene.wait || 700);
    const m = await page.evaluate(wallProbe, { rawError: RAW_ERROR.source, dataGap: DATA_GAP.source });
    m.status = response?.status() ?? null;
    m.axe = await runAxe(page).catch(e => [{ id: 'axe-error', n: 0, samples: [{ summary: String(e.message).slice(0, 80) }] }]);
    m.missing = missingValueLines(m.text);
    const pp = await page.evaluate(partsProbe).catch(() => ({ parts: [], colors: { text: {}, bg: {} }, palette: [] }));
    // 처음 보는 모양만 잘라 둔다 — 부품 대조 보기의 견본(같은 모양은 첫 장면의 것 하나).
    for (const part of pp.parts) {
      const key = `${viewportKey}|${part.type}|${JSON.stringify(part.style)}`;
      part.sig = hash(key, 10);
      if (partSeen.has(part.sig)) continue;
      const pad = 6, r = part.rect;
      const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.min(r.w + pad * 2, vp.width - Math.max(0, r.x - pad), 640), height: Math.min(r.h + pad * 2, 220) };
      const crop = `parts/${part.sig}.png`;
      if (clip.width > 4 && clip.height > 4 && await page.screenshot({ path: join(out, crop), fullPage: true, clip }).then(() => true, () => false)) partSeen.set(part.sig, crop);
    }
    m.parts = pp.parts.map(({ rect: _r, ...p }) => p); m.colors = pp.colors; m.palette = pp.palette;
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
  await mkdir(join(out, 'parts'), { recursive: true });
  const partSeen = new Map();

  const env = await startWallEnv({ out, port: Number(opt('--port') || process.env.WALL_PORT || 3170) });
  const theme = opt('--theme') === 'dark' ? 'dark' : 'light';
  const results = new Map(scenes.map(s => [s.id, { ...s, shots: {}, checks: {} }]));
  const started = Date.now();
  try {
    for (const persona of personas) {
      const todo = scenes.filter(s => s.persona === persona);
      if (!todo.length) continue;
      env.seed();
      await Promise.all(viewports.map(async viewportKey => {
        const context = await env.newContext({ persona, viewportKey, theme });
        for (const scene of todo) {
          const m = await captureScene(context, scene, viewportKey, out, partSeen);
          const row = results.get(scene.id);
          row.checks[viewportKey] = m;
          if (m.shot) row.shots[viewportKey] = m.shot;
          console.log(summaryLine(scene, viewportKey, judgeShot(m)));
        }
        await context.close();
      }));
    }
  } finally {
    await env.close();
  }

  const sceneRows = [...results.values()].map(row => {
    const judged = mergeVerdicts(Object.fromEntries(Object.entries(row.checks).map(([vp, m]) => [vp, judgeShot(m)])));
    const text = row.checks.desktop?.text ?? row.checks.mobile?.text ?? '';
    const checks = Object.fromEntries(Object.entries(row.checks).map(([vp, { text: _t, colors: _c, palette: _p, ...m }]) => [vp, m]));
    return { ...row, checks, text: text.slice(0, 4000), verdict: judged.verdict, reasons: judged.reasons };
  });
  const allChecks = [...results.values()];
  const components = aggregateParts(allChecks);
  const offToken = offTokenColors(allChecks);
  for (const row of Object.values(components)) for (const list of Object.values(row)) for (const part of list) part.crop = partSeen.get(part.sig) || null;
  const routes = discoverRoutes(join(root, 'src', 'app'));
  const manifest = {
    version: 1, sha, short: sha.slice(0, 8), theme, capturedAt: `${kstStamp()} KST`, capturedIso: new Date().toISOString(), baseURL: env.baseURL, build: 'wall:build (e2e 공개 값 · vendor/google-fonts 운영 글꼴)',
    viewports: Object.fromEntries(viewports.map(k => [k, { width: VIEWPORTS[k].width, height: VIEWPORTS[k].height }])),
    personas: reg.personas, lanes: reg.lanes, captureSec: Math.round((Date.now() - started) / 1000),
    counts: sceneRows.reduce((acc, s) => ({ ...acc, [s.verdict]: (acc[s.verdict] || 0) + 1 }), {}),
    scenes: sceneRows, coverage: coverage(reg, routes), routesTotal: routes.length, components, offToken,
  };
  await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`화면 벽 캡처: 장면 ${sceneRows.length} · 캡처 ${sceneRows.reduce((n, s) => n + Object.keys(s.shots).length, 0)}장 · ${manifest.captureSec}초 · ${JSON.stringify(manifest.counts)} → ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
