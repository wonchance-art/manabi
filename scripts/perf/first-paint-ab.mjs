#!/usr/bin/env node
// 첫 그림 교대 A/B — 같은 출처 앞단(same-origin-proxy.mjs)을 거쳐 팔마다 FCP−TTFB · LCP−TTFB · CLS(출처 포함)를 잰다(PERF-AB-001).
// 규칙(docs/perf-measurement.md): ⑴ 바이트를 바꾸는 팔은 앞단에서만 — 이 스크립트는 page.route / route.fulfill을 쓰지 않는다(계약이 막는다).
// ⑵ TTFB 편차(±0.3s)를 빼려고 FCP−TTFB로 비교한다. ⑶ 팔 순서를 판마다 뒤집어 교대로 잰다. ⑷ 절대값보다 팔 사이 차이를 본다.
//
//   NODE_USE_ENV_PROXY=1 node scripts/perf/first-paint-ab.mjs --arms ./my-arms.mjs --path /vocab --rounds 5
//   (팔 파일 형식은 same-origin-proxy.mjs 머리말. 앞단을 이 프로세스 안에서 함께 띄운다.)
// 조건: iPhone 13 · 지연 150ms · 내려받기 1.6Mbps · 올리기 750kbps · CPU 4배 — 이 저장소 첫 그림 실측의 공통 조건.
import { existsSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startProxy } from './same-origin-proxy.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
export const CONDITIONS = Object.freeze({ device: 'iPhone 13', latency: 150, download: 1.6 * 1024 * 1024 / 8, upload: 750 * 1024 / 8, cpu: 4 });

/** scripts/wall-capture.mjs와 같은 브라우저 고르기 — 클라우드 컨테이너의 /opt/pw-browsers/chromium, 없으면 설치된 Chrome. */
function chromiumLaunch() {
  const executablePath = process.env.PERF_CHROMIUM || '/opt/pw-browsers/chromium';
  return existsSync(executablePath) ? { executablePath } : { channel: 'chrome' };
}

async function measure(chromium, devices, { origin, port, pathname }) {
  const host = new URL(origin).host;
  const browser = await chromium.launch({
    ...chromiumLaunch(),
    args: ['--no-proxy-server', `--host-resolver-rules=MAP ${host}:443 127.0.0.1:${port}`, '--ignore-certificate-errors'],
  });
  try {
    const context = await browser.newContext({ ...devices[CONDITIONS.device], ignoreHTTPSErrors: true });
    await context.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.hadRecentInput) continue;
          const src = (e.sources || []).map((s) => {
            const n = s.node;
            const name = !n ? '?' : n.nodeType === 1 ? `${n.nodeName}.${String(n.className || '').slice(0, 40)}` : `#text:${String(n.textContent || '').slice(0, 16)}`;
            return `${name} y${Math.round(s.previousRect.y)}>${Math.round(s.currentRect.y)} w${Math.round(s.previousRect.width)}>${Math.round(s.currentRect.width)}`;
          }).join(' | ');
          window.__shifts.push({ t: Math.round(e.startTime), v: e.value, src });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: CONDITIONS.latency, downloadThroughput: CONDITIONS.download, uploadThroughput: CONDITIONS.upload });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CONDITIONS.cpu });
    const response = await page.goto(origin + pathname, { waitUntil: 'load', timeout: 60000 });
    // 가드: 문서가 정말 앞단에서 왔는가(앞단을 거치지 않은 측정은 팔 사이 비교가 아니다).
    const addr = await response.serverAddr();
    if (!addr || addr.ipAddress !== '127.0.0.1' || addr.port !== port) throw new Error(`문서가 앞단(127.0.0.1:${port})이 아닌 곳에서 왔다: ${JSON.stringify(addr)}`);
    await page.waitForTimeout(4500);
    return await page.evaluate(() => new Promise((resolve) => {
      new PerformanceObserver((list) => {
        const nav = performance.getEntriesByType('navigation')[0];
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;
        const lcp = list.getEntries().at(-1).startTime;
        const fonts = performance.getEntriesByType('resource').filter((e) => /\.woff2(\?|$)/.test(e.name) && e.responseStatus !== 404);
        resolve({
          ttfb: Math.round(nav.responseStart), fcp: Math.round(fcp), lcp: Math.round(lcp),
          fcpMinusTtfb: Math.round(fcp - nav.responseStart), lcpMinusTtfb: Math.round(lcp - nav.responseStart),
          cls: +window.__shifts.reduce((a, s) => a + s.v, 0).toFixed(4), shifts: window.__shifts.map((s) => `${s.t} ${s.v.toFixed(4)} ${s.src}`),
          woff2: fonts.length, woff2KB: Math.round(fonts.reduce((a, e) => a + (e.encodedBodySize || e.transferSize || 0), 0) / 1024),
        });
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    }));
  } finally {
    await browser.close();
  }
}

/** 앞단의 팔을 바꾼다(자체 서명 인증서라 검증을 끈 https 요청). */
function switchArm(port, arm) {
  return new Promise((ok, no) => {
    https.get({ host: '127.0.0.1', port, path: `/__arm/${encodeURIComponent(arm)}`, rejectUnauthorized: false }, (r) => {
      r.resume();
      r.on('end', () => (r.statusCode === 200 ? ok() : no(new Error(`팔 ${arm} 바꾸기 실패: ${r.statusCode}`))));
    }).on('error', no);
  });
}

const median = (xs) => { const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };

export async function runAb({ arms, pathname = '/', rounds = 5, origin = 'https://www.manabi.co.kr', port = 18443 }) {
  const { chromium, devices } = await import('playwright-core');
  const proxy = await startProxy({ origin, port, arms });
  const names = Object.keys(arms);
  const all = [];
  try {
    for (let i = 0; i < rounds; i += 1) {
      for (const arm of i % 2 ? [...names].reverse() : names) {
        await switchArm(port, arm);
        const r = { arm, ...(await measure(chromium, devices, { origin, port, pathname })) };
        all.push(r);
        process.stdout.write(`${JSON.stringify(r)}\n`);
      }
    }
  } finally {
    proxy.server.close();
  }
  const summary = Object.fromEntries(names.map((arm) => {
    const rs = all.filter((r) => r.arm === arm);
    return [arm, { fcpMinusTtfb: median(rs.map((r) => r.fcpMinusTtfb)), lcpMinusTtfb: median(rs.map((r) => r.lcpMinusTtfb)), cls: median(rs.map((r) => r.cls)), maxCls: Math.max(...rs.map((r) => r.cls)), woff2: median(rs.map((r) => r.woff2)), woff2KB: median(rs.map((r) => r.woff2KB)), n: rs.length }];
  }));
  return { conditions: CONDITIONS, pathname, rounds, summary, runs: all };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const armsFile = arg('arms');
  if (!armsFile) { process.stderr.write('--arms <팔 파일> 이 필요하다(형식: scripts/perf/same-origin-proxy.mjs 머리말)\n'); process.exit(2); }
  const arms = (await import(pathToFileURL(path.resolve(armsFile)).href)).default;
  const result = await runAb({ arms, pathname: arg('path', '/'), rounds: Number(arg('rounds', 5)), origin: arg('origin', 'https://www.manabi.co.kr'), port: Number(arg('port', 18443)) });
  process.stdout.write(`요약(중앙값 · ms): ${JSON.stringify(result.summary)}\n`);
}
