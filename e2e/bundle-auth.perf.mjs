// BUNDLE-AUTH-001 로그인 경로 첫 화면 JS 측정(2026-11-08 KST) — CI가 돌리지 않는 측정 도구다(.perf.mjs).
// 화면 벽 환경(startWallEnv — 합성 무거운 계정 백엔드 + next start)에서 경로마다 빈 캐시로 한 번 연다.
//   npm run wall:build(또는 e2e:build) 뒤  node e2e/bundle-auth.perf.mjs   (ROUTES=/home,/vocab  VPS=mobile,desktop  OUT=결과.json  PORT=3190)
// 나누는 법: [문서 스크립트] = HTML이 싣는 <script>(첫 화면이 기다리는 몫 — 결정적) · [뒤에 받음] = 그 뒤 동적 import(유휴 미리 받기 · 로그인 뒤 동기화 ·
// Supabase 클라이언트 등) · review = /vocab에서 「복습 시작」 뒤 더 받은 몫. brotli는 .next 파일을 품질 11로 다시 눌러 잰다(운영 전송 근사),
// 전송(gzip)은 next start가 실제로 보낸 바이트. 사용 비율 = Coverage(같은 주소가 두 번 컴파일되면 합집합). 기준 · 결과: docs/perf-measurement.md 「첫 화면 JS」.
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, constants as zc } from 'node:zlib';
import { startWallEnv } from '../scripts/wall-capture.mjs';

const ROUTES = (process.env.ROUTES || '/home,/study,/vocab,review,/profile,/progress,/viewer/50000').split(',');
const VPS = (process.env.VPS || 'mobile').split(',');
const env = await startWallEnv({ out: await mkdtemp(join(tmpdir(), 'bundle-')), port: Number(process.env.PORT || 3190) });
const brCache = new Map();
async function br(path) { if (brCache.has(path)) return brCache.get(path); const buf = await readFile(join('.next', path)).catch(() => null); const v = buf ? { raw: buf.length, br: brotliCompressSync(buf, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } }).length } : null; brCache.set(path, v); return v; }
const out = [];
try {
  for (const vp of VPS) for (const route of ROUTES) {
    const context = await env.newContext({ persona: 'filled', viewportKey: vp });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Page.enable');
    const reqs = new Map(); const sentAt = new Map(); let loadTs = Infinity;
    cdp.on('Network.requestWillBeSent', (e) => { if (!sentAt.has(e.requestId)) sentAt.set(e.requestId, e.timestamp); });
    cdp.on('Page.loadEventFired', (e) => { if (loadTs === Infinity) loadTs = e.timestamp; });
    cdp.on('Network.responseReceived', (e) => { if (e.type === 'Script') reqs.set(e.requestId, { url: e.response.url, enc: 0, ts: sentAt.get(e.requestId) }); });
    cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.enc = e.encodedDataLength; });
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    const path = route === 'review' ? '/vocab' : route;
    const docRes = await page.goto(`${env.baseURL}${path}`, { waitUntil: 'load', timeout: 120000 });
    const html = await docRes.text();
    const inDoc = new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]));
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    let firstScreenUrls = null;
    if (route === 'review') { // 첫 화면 = 복습 시작 뒤 첫 카드(시작 전까지 받은 것과 시작 뒤 더 받은 것을 나눈다)
      firstScreenUrls = new Set([...reqs.values()].map((r) => r.url));
      await page.locator('button.review-room-start:not([disabled])').first().click();
      await page.locator('.review-card, .review-intro__next').first().waitFor({ timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500);
    }
    const cov = await page.coverage.stopJSCoverage();
    // 같은 주소가 두 번 컴파일되는 일이 있다(앱 라우터가 페이지 조각을 다시 넣음 — 두 번째는 모듈 등록만) — 주소별로 합집합.
    const covBy = new Map();
    for (const c of cov) { const n = c.source?.length || 0; const prev = covBy.get(c.url); const mark = prev?.mark || new Uint8Array(n);
      const m2 = new Uint8Array(n); for (const fn of c.functions) for (const r of fn.ranges) m2.fill(r.count > 0 ? 1 : 0, r.startOffset, Math.min(r.endOffset, n));
      for (let i = 0; i < n; i++) mark[i] |= m2[i]; covBy.set(c.url, { mark, total: n }); }
    for (const [u, v] of covBy) { let used = 0; for (const b of v.mark) used += b; covBy.set(u, { total: v.total, used }); }
    const chunks = [];
    for (const r of reqs.values()) {
      const u = new URL(r.url); if (u.origin !== new URL(env.baseURL).origin) continue;
      const file = u.pathname.replace(/^\/_next\//, '');
      const sz = await br(file);
      const c = covBy.get(r.url) || { total: 0, used: 0 };
      chunks.push({ file, enc: r.enc, raw: sz?.raw ?? c.total, br: sz?.br ?? null, used: c.used, total: c.total, afterStart: firstScreenUrls ? !firstScreenUrls.has(r.url) : false, beforeLoad: (r.ts ?? 0) <= loadTs, inDoc: inDoc.has(u.pathname) });
    }
    chunks.sort((a, b) => b.raw - a.raw);
    const sum = (k, f = () => true) => chunks.filter(f).reduce((s, c) => s + (c[k] || 0), 0);
    const pre = (c) => c.inDoc;
    const row = { vp, route, n: chunks.length, enc: sum('enc'), br: sum('br'), raw: sum('raw'), used: sum('used'), total: sum('total'), afterStartBr: sum('br', (c) => c.afterStart),
      preN: chunks.filter(pre).length, preBr: sum('br', pre), preEnc: sum('enc', pre), preRaw: sum('raw', pre), preUsed: sum('used', pre), preTotal: sum('total', pre), chunks };
    out.push(row);
    console.log(vp, route, `[문서 스크립트] ${row.preN}개 · brotli ${(row.preBr / 1024).toFixed(0)}KB · 원본 ${(row.preRaw / 1024).toFixed(0)}KB · 사용 ${(100 * row.preUsed / Math.max(1, row.preTotal)).toFixed(0)}% ‖ [뒤에 받음] brotli ${((row.br - row.preBr - row.afterStartBr) / 1024).toFixed(0)}KB ‖ [전체]`, `JS ${row.n}개 · 전송(gzip) ${(row.enc / 1024).toFixed(0)}KB · brotli ${(row.br / 1024).toFixed(0)}KB · 원본 ${(row.raw / 1024).toFixed(0)}KB · 사용 ${(100 * row.used / Math.max(1, row.total)).toFixed(0)}%${route === 'review' ? ` · 시작 뒤 brotli ${(row.afterStartBr / 1024).toFixed(0)}KB` : ''}`);
    await context.close();
  }
} finally { await env.close(); }
const outFile = process.env.OUT || join(await mkdtemp(join(tmpdir(), 'bundle-auth-')), 'bundle.json');
await writeFile(outFile, JSON.stringify(out, null, 1));
console.log('결과', outFile);
