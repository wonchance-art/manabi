#!/usr/bin/env node
// UX 점검 자동화(/ux-review 0단계) — 화면을 띄워 기계로 잴 수 있는 것만 잰다. 판단 · 제안은 /ux-review가 한다.
//
//   node scripts/ux-audit.mjs                     # 이미 떠 있는 서버(UX_AUDIT_BASE_URL, 기본 http://127.0.0.1:3005)
//   node scripts/ux-audit.mjs --start             # next dev를 직접 띄우고 끝나면 내린다
//   node scripts/ux-audit.mjs --mobile            # 휴대폰 폭(390)도 함께 — 기본은 웹(데스크톱)만(오너 2026-10-16)
//   node scripts/ux-audit.mjs --out <dir>         # 기본 .ux-audit/<KST 날짜>
//
// 산출: <out>/<viewport>/<route>.png + report.json + report.md. 비로그인 화면만 잰다 — 로그인 화면 중 복습 진행 · 끝 화면 ·
// 서재 목록 · 뷰어는 scripts/ux-audit-auth.mjs(e2e 합성 로그인)가 따로 잰다. 나머지 로그인 화면은 보고서가 「미검증」으로
// 표시하고, /ux-review가 코드 대조로만 다룬다(2026-10-16 오판 선례).
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { MAIN_NAV } from '../src/lib/webNavigation.js';

export const VIEWPORTS = Object.freeze({
  desktop: { width: 1280, height: 800, isMobile: false, hasTouch: false },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
});
// 메뉴 넷 + 메뉴 밖 입구 · 오류 화면. 로그인 전용 화면은 넣지 않는다(게스트로는 다른 화면이 보인다).
export const MISSING_ROUTE = '/__ux-audit-missing__';
export const ROUTES = Object.freeze([...MAIN_NAV.map(item => item.href), '/vocab', '/auth', '/offline', MISSING_ROUTE]);
// 앞의 넷은 ux-audit-auth.mjs가 합성 로그인으로 잰다(AUTH_COVERED) — 이 스크립트 보고서에서는 그쪽 보고서를 가리킨다.
export const AUTH_COVERED = Object.freeze(['복습 진행 · 끝 화면', '뷰어(읽기)', '서재 목록(자료 있음)']);
const LOGIN_ONLY = Object.freeze(['학습 세션(/study)', '대화 진행']);

export function kstStamp(date = new Date()) {
  return new Date(date.getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
}
export const routeSlug = route => route.replace(/^\/$/, 'root').replace(/^\//, '').replace(/[^\w가-힣-]+/g, '_') || 'root';

/** 페이지 안에서 재는 값 — 넘침 · 빈 화면 비율 · 남은 스피너 · 메뉴 이름. 순수 DOM 측정(판단 없음). 로그인 점검(ux-audit-auth)도 쓴다. */
export function measure(navLabels) {
  const doc = document.documentElement;
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const fixed = el => { for (let n = el; n && n !== document.body; n = n.parentElement) if (['fixed', 'sticky'].includes(getComputedStyle(n).position)) return true; return false; };
  let contentBottom = 0;
  for (const el of document.body.querySelectorAll('h1,h2,h3,p,li,a,button,img,svg,input,textarea,article,section>*')) {
    if (!visible(el) || fixed(el)) continue;
    contentBottom = Math.max(contentBottom, el.getBoundingClientRect().bottom + scrollY);
  }
  const viewport = innerHeight;
  const texts = [...document.querySelectorAll('nav a, nav button')].filter(visible).map(el => el.textContent.trim()).filter(Boolean);
  return {
    overflowX: doc.scrollWidth > innerWidth + 1,
    scrollHeight: doc.scrollHeight,
    emptyBelowRatio: contentBottom < viewport ? Math.round((1 - contentBottom / viewport) * 100) / 100 : 0,
    spinnerVisible: [...document.querySelectorAll('[class*="spinner" i], [aria-busy="true"]')].some(visible),
    loadingText: /불러오는 중|준비 중/.test(document.body.innerText.slice(0, 2000)),
    navLabels: [...new Set(texts)],
    missingMainNav: navLabels.filter(label => !texts.includes(label)),
    h1: document.querySelector('h1')?.textContent.trim() || null,
  };
}

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(2000) }); if (res.status < 500) return true; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

export function summarize(rows) {
  const flags = [];
  for (const r of rows) {
    const at = `${r.viewport} ${r.route}`;
    if (r.error) flags.push({ at, kind: 'load-error', detail: r.error });
    // 일부러 없는 경로는 404 응답 로그가 정상이다.
    const consoleErrors = r.route === MISSING_ROUTE ? r.consoleErrors.filter(text => !/status of 404/.test(text)) : r.consoleErrors;
    if (consoleErrors.length) flags.push({ at, kind: 'console-error', detail: consoleErrors.slice(0, 3).join(' | ') });
    if (r.overflowX) flags.push({ at, kind: 'horizontal-overflow', detail: '가로 스크롤 발생' });
    if (r.emptyBelowRatio >= 0.45) flags.push({ at, kind: 'empty-area', detail: `첫 화면 아래 ${Math.round(r.emptyBelowRatio * 100)}% 비어 있음` });
    if (r.spinnerVisible || r.loadingText) flags.push({ at, kind: 'still-loading', detail: '대기 표시가 남아 있음(네트워크 idle 뒤)' });
    // 로드 시간은 표에만 남긴다 — dev 서버는 첫 방문에 컴파일하므로 플래그로 쓰면 잡음이다(성능은 docs/bench-*).
    if (r.missingMainNav?.length && r.missingMainNav.length < MAIN_NAV.length) flags.push({ at, kind: 'nav-partial', detail: `메뉴 일부 없음: ${r.missingMainNav.join(', ')}` });
  }
  return flags;
}

function markdown({ stamp, baseURL, rows, flags }) {
  const lines = [`# UX 점검 기계 측정 — ${stamp} KST`, '', `서버 ${baseURL} · 비로그인 · 화면 ${rows.length}개`, '',
    '| 폭 | 경로 | 로드(ms) | 넘침 | 빈 아래 | 대기표시 | 콘솔 오류 | 메뉴 |', '|---|---|---:|:-:|---:|:-:|---:|---|'];
  for (const r of rows) lines.push(`| ${r.viewport} | \`${r.route}\`${r.finalPath !== r.route ? ` → \`${r.finalPath}\`` : ''} | ${r.loadMs} | ${r.overflowX ? '⚠' : '·'} | ${Math.round((r.emptyBelowRatio || 0) * 100)}% | ${r.spinnerVisible || r.loadingText ? '⚠' : '·'} | ${r.consoleErrors.length} | ${(r.navLabels || []).slice(0, 6).join(' · ')} |`);
  lines.push('', '## 기계 플래그(판단 전 후보)', '', ...(flags.length ? flags.map(f => `- **${f.kind}** ${f.at} — ${f.detail}`) : ['- 없음']));
  lines.push('', '## 로그인 화면 — `node scripts/ux-audit-auth.mjs --start`(합성 로그인) 보고서에서 볼 것', '', ...AUTH_COVERED.map(s => `- ${s}`));
  lines.push('', '## 미검증(로그인 필요 — 코드 대조로만 다룰 것)', '', ...LOGIN_ONLY.map(s => `- ${s}`), '');
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const baseURL = process.env.UX_AUDIT_BASE_URL || 'http://127.0.0.1:3005';
  const stamp = kstStamp();
  const out = opt('--out') || join('.ux-audit', stamp.slice(0, 10));
  const viewports = args.includes('--mobile') ? ['desktop', 'mobile'] : ['desktop'];
  let server = null;
  if (args.includes('--start')) {
    const port = new URL(baseURL).port || '3005';
    server = spawn('npx', ['next', 'dev', '-p', port], { stdio: 'ignore', detached: true });
    if (!await waitFor(baseURL, 180000)) { process.kill(-server.pid); throw new Error(`서버가 뜨지 않았어요: ${baseURL}`); }
  } else if (!await waitFor(baseURL, 5000)) {
    throw new Error(`서버 응답 없음: ${baseURL} — 먼저 \`npx next dev -p 3005\`를 띄우거나 --start를 붙이세요.`);
  }
  const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : { channel: 'chrome' });
  const rows = [];
  try {
    for (const viewport of viewports) {
      const { width, height, isMobile, hasTouch } = VIEWPORTS[viewport];
      await mkdir(join(out, viewport), { recursive: true });
      const context = await browser.newContext({ viewport: { width, height }, isMobile, hasTouch, locale: 'ko-KR', serviceWorkers: 'block' });
      for (const route of ROUTES) {
        const page = await context.newPage();
        const consoleErrors = [];
        page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
        page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`));
        const t0 = Date.now(); let error = null;
        try { await page.goto(baseURL + route, { waitUntil: 'networkidle', timeout: 90000 }); } catch (e) { error = e.message.split('\n')[0]; }
        const loadMs = Date.now() - t0;
        await page.waitForTimeout(800);
        const shot = join(out, viewport, `${routeSlug(route)}.png`);
        await page.screenshot({ path: shot }).catch(() => {});
        const m = await page.evaluate(measure, MAIN_NAV.map(item => item.label)).catch(e => ({ measureError: e.message }));
        rows.push({ viewport, route, finalPath: new URL(page.url()).pathname, loadMs, error, consoleErrors, screenshot: shot, ...m });
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
    if (server) try { process.kill(-server.pid); } catch { /* already gone */ }
  }
  const flags = summarize(rows);
  await writeFile(join(out, 'report.json'), JSON.stringify({ stamp, baseURL, rows, flags }, null, 2));
  await writeFile(join(out, 'report.md'), markdown({ stamp, baseURL, rows, flags }));
  console.log(`UX 점검: 화면 ${rows.length}개 · 플래그 ${flags.length}개 → ${join(out, 'report.md')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
