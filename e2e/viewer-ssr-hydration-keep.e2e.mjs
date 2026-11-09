// 손님 서버 본문이 느린 망에서도 하이드레이션을 그대로 지나간다(VIEWER-MOBILE-PERF-001, 2026-11-09 KST). 실제 뷰어 · 공개 시드 사본만,
// 계정 · 제공자 · 운영 DB 없음(server-fetch-mock의 ZH_SSR_MATERIAL_ID 행 — viewer-zh-ssr와 같은 행).
// 운영 실측: 1.6Mbps · 지연 150ms에서 페이지 조각(약 143KB)이 문서 파싱 · 루트 하이드레이션보다 늦게 온다. 그 사이 AuthProvider가 손님 확정
// (setLoading(false))을 일반 우선순위로 내면 React가 하이드레이션을 기다리던 경계의 서버 본문을 버리고 새로 그렸다 — 본문이 DOM에서
// 빠졌다가 약 0.5초 뒤 다시 들어왔다(JA · ZH 0/5, EN 2/5 유지). 손님 확정을 전환(startTransition)으로 바꾼 판은 15/15 유지.
// 계약: 첫 HTML의 제목 · 본문 낱말이 하이드레이션 · 손님 확정 뒤에도 같은 노드이고, 뷰어 뿌리가 한 번도 빠지지 않는다.
// 같은 망 조건에서 중국어 시트 미리 받기(DeferredZhFontSheets known)도 본다 — 간체만, 번체는 미리 받지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { fixture } from './fixtures/material-editing-backend.mjs';

const row = JSON.parse(fs.readFileSync(new URL('./fixtures/zh-public-viewer.json', import.meta.url), 'utf8'));

test('guest server body survives hydration on a slow network (1.6Mbps · 150ms · CPU 4×)', async () => {
  const f = await fixture({ guest: true, width: 390, height: 844 });
  try {
    f.rows.push(row);
    const html = await (await f.context.request.get(`/viewer/${row.id}`)).text();
    assert.ok(html.includes('<ruby data-pinyin="1">'), 'server HTML carries the Chinese body');
    // 속성 순서는 React가 정한다(셸 미리 받기 rel · href · as, 경계 조각 미리 받기 rel · as · href).
    const preloads = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0])
      .filter((tag) => /\brel="preload"/.test(tag) && /\bas="style"/.test(tag)).map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1]);
    assert.ok(!preloads.some((href) => /noto-sans-tc/.test(href)), `no Traditional sheet preload on a Simplified server body: ${preloads}`);
    if (html.includes('/_fonts/noto-sans-sc/')) assert.ok(preloads.some((href) => /noto-sans-sc/.test(href)), 'Simplified sheet is preloaded (the boundary reveal waits for it)');

    await f.page.addInitScript(() => {
      window.__removed = [];
      document.addEventListener('DOMContentLoaded', () => {
        window.__h1 = document.querySelector('h1.page-header__title');
        window.__token = document.querySelector('.reader-area ruby[data-pinyin]');
      });
      new MutationObserver((records) => {
        for (const r of records) for (const n of r.removedNodes) {
          // 경계 공개($RC · $RV)는 숨긴 상자 → 제자리로 옮긴다 — 숨긴 상자에서 빠지는 것은 옮김이다. 제자리(main)에서 빠지면 버림이다.
          if (n.nodeType === 1 && n.classList?.contains('viewer-workspace-boundary') && r.target.closest?.('main')) window.__removed.push(Math.round(performance.now()));
        }
      }).observe(document, { childList: true, subtree: true });
    });
    const cdp = await f.context.newCDPSession(f.page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await f.page.goto(`/viewer/${row.id}`, { waitUntil: 'load', timeout: 90000 });
    // 하이드레이션 = 제목 요소에 React 표지가 붙은 때. 손님 확정(전환)이 뒤따를 틈을 더 둔다.
    await f.page.waitForFunction(() => {
      const h1 = document.querySelector('h1.page-header__title');
      return !!h1 && Object.keys(h1).some((k) => k.startsWith('__reactFiber'));
    }, null, { timeout: 60000 });
    await f.page.waitForTimeout(2500);
    const after = await f.page.evaluate(() => ({
      hadH1: !!window.__h1, hadToken: !!window.__token,
      h1: !!window.__h1 && document.contains(window.__h1),
      token: !!window.__token && document.contains(window.__token),
      removed: window.__removed,
      hold: document.documentElement.getAttribute('data-viewer-hold'),
    }));
    assert.equal(after.hold, null, 'default settings keep the server body visible');
    assert.ok(after.hadH1 && after.hadToken, 'server title and body were in the first HTML');
    assert.deepEqual(after.removed, [], 'the viewer root never leaves the page during hydration');
    assert.equal(after.h1, true, 'server title node survives hydration');
    assert.equal(after.token, true, 'server body token survives hydration');
  } finally {
    await f.context.close();
  }
});
