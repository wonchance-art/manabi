import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// PERF-AB-001 — 첫 그림 A/B 도구의 함정을 계약으로 막는다(docs/perf-measurement.md 규칙 ①).
// route.fulfill로 채운 응답은 DevTools 대역 제한을 타지 않아 미리 받기 비용이 사라진다(#1725 병합 전 FCP 열이 그렇게 틀렸다).
const DIR = path.join(process.cwd(), 'scripts/perf');
const files = () => {
  const out = [];
  const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.m?js$/.test(n) && !/\.test\./.test(n)) out.push(p); } };
  walk(DIR);
  return out;
};
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

describe('첫 그림 A/B 도구 — 같은 출처 앞단만', () => {
  it('scripts/perf 코드는 Playwright 요청 가로채기(route · fulfill · fetch 뒤 채우기)를 쓰지 않는다', () => {
    const found = files().length;
    expect(found).toBeGreaterThanOrEqual(3); // 공허 통과 방지
    for (const file of files()) {
      const code = strip(fs.readFileSync(file, 'utf8'));
      expect(code, path.relative(process.cwd(), file)).not.toMatch(/\.route\s*\(|\.fulfill\s*\(|routeFromHAR|\.unroute\s*\(/);
    }
  });

  it('측정은 운영 주소를 앞단으로 돌려 열고, 문서가 앞단에서 왔는지 확인한다 · FCP−TTFB로 · 교대로', () => {
    const ab = fs.readFileSync(path.join(DIR, 'first-paint-ab.mjs'), 'utf8');
    expect(ab).toContain('--host-resolver-rules=MAP ${host}:443 127.0.0.1:${port}');
    expect(ab).toContain("addr.ipAddress !== '127.0.0.1'");
    expect(ab).toContain('fcpMinusTtfb: Math.round(fcp - nav.responseStart)');
    expect(ab).toContain('i % 2 ? [...names].reverse() : names');
    expect(ab).toContain("Network.emulateNetworkConditions");
  });

  it('앞단은 운영처럼 HTTP/2 · 압축 · 자산 캐시 머리글로 보낸다 — 문서만 no-store', () => {
    const proxy = fs.readFileSync(path.join(DIR, 'same-origin-proxy.mjs'), 'utf8');
    expect(proxy).toContain("headers['content-encoding'] = 'br'"); // 압축 없이 보내면 CSS · JS가 커져 FCP가 7초대로 밀린다
    expect(proxy).toContain('if (!isDocument && r.status === 200) cache.set(req.url, hit);');
    // HTTP/1.1 앞단은 연결 6개 제한으로 Manrope가 늦게 와 운영에 없는 이동을 만들었다
    expect(proxy).toContain('http2.createSecureServer({ ...certificate(), allowHTTP1: true }');
    // 정적 자산까지 no-store면 미리 받은 글꼴을 다시 받아 늦게 온다 — 문서에만 건다
    expect(proxy).toContain("const headers = isDocument ? { ...hit.headers, 'cache-control': 'no-store' } : { ...hit.headers };");
    expect(proxy).not.toMatch(/'cache-control': 'no-store'[^\n]*font\/woff2|font\/woff2[^\n]*'cache-control': 'no-store'/);
  });

  it('규칙 문서가 있고 route.fulfill 함정 · FCP−TTFB · 교대 · 실험실 대체 글꼴 차이를 적는다', () => {
    const doc = fs.readFileSync(path.join(process.cwd(), 'docs/perf-measurement.md'), 'utf8');
    for (const phrase of ['route.fulfill', 'FCP−TTFB', '교대로', 'WenQuanYi', 'scripts/perf/same-origin-proxy.mjs']) expect(doc).toContain(phrase);
  });
});
