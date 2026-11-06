import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// VIEWER-FONT-SPLIT-001 2단계 — 뷰어는 SC · TC 독립 시트를 첫 그림 뒤에 붙인다(렌더 차단 없음, 같은 href는 한 번만).
const SC = '/_fonts/noto-sans-sc/noto-sans-sc.0123456789abcdef.css';
const TC = '/_fonts/noto-sans-tc/noto-sans-tc.fedcba9876543210.css';
async function load(sc = SC, tc = TC) {
  vi.resetModules();
  vi.stubEnv('MANABI_SC_STYLESHEET', sc);
  vi.stubEnv('MANABI_TC_STYLESHEET', tc);
  return import('../fonts/DeferredZhFontSheets');
}
afterEach(() => { vi.unstubAllEnvs(); });

// 붙이기가 쓰는 만큼만 흉내 낸 문서(저장소에 DOM 테스트 환경이 없다) — link 요소 · head.appendChild · querySelectorAll('link[rel="stylesheet"]').
function fakeDocument() {
  const links = [];
  const element = () => {
    const attrs = new Map();
    return {
      set rel(v) { attrs.set('rel', v); }, get rel() { return attrs.get('rel'); },
      set href(v) { attrs.set('href', v); },
      setAttribute: (k, v) => attrs.set(k, v), getAttribute: (k) => attrs.get(k) ?? null, hasAttribute: (k) => attrs.has(k),
    };
  };
  return {
    links,
    createElement: () => element(),
    head: { appendChild: (el) => { links.push(el); return el; } },
    querySelectorAll: (sel) => (sel === 'link[rel="stylesheet"]' ? links.filter((l) => l.getAttribute('rel') === 'stylesheet') : []),
  };
}

describe('zhFontVars.css — next/font 범위가 주던 변수 · 크기 보정 대체 글꼴과 같은 값', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/components/fonts/zhFontVars.css'), 'utf8');
  const { getFallbackFontOverrideMetrics } = createRequire(path.join(process.cwd(), 'package.json'))('next/dist/compiled/@next/font/dist/google/get-fallback-font-override-metrics');
  it.each([['SC', '--font-noto-sc'], ['TC', '--font-noto-tc']])('Noto Sans %s — 대체 글꼴 계측 = next 계산값, 변수 = 「웹폰트, … Fallback」', (k, variable) => {
    const m = getFallbackFontOverrideMetrics(`Noto Sans ${k}`);
    expect(css).toContain(`@font-face{font-family:'Noto Sans ${k} Fallback';src:local("${m.fallbackFont}");ascent-override:${m.ascentOverride};descent-override:${m.descentOverride};line-gap-override:${m.lineGapOverride};size-adjust:${m.sizeAdjust}}`);
    expect(css).toContain(`${variable}:'Noto Sans ${k}','Noto Sans ${k} Fallback'`);
  });
  it('부품이 이 CSS를 싣고, CSS에는 웹폰트 @font-face가 없다(그건 첫 그림 뒤 시트의 몫)', () => {
    expect(fs.readFileSync(path.join(process.cwd(), 'src/components/fonts/DeferredZhFontSheets.jsx'), 'utf8')).toContain("import './zhFontVars.css';");
    expect(css).not.toMatch(/url\(/);
    expect(Buffer.byteLength(css.replace(/\/\*[\s\S]*?\*\//g, ''))).toBeLessThan(1024);
  });
});

describe('DeferredZhFontSheets', () => {
  it('두 시트를 붙이고, 이미 있는 href(React precedence 링크 포함)는 두 번 붙이지 않는다', async () => {
    const { attachZhFontSheets, DEFERRED_ZH_SHEETS } = await load();
    expect(DEFERRED_ZH_SHEETS).toEqual([SC, TC]);
    const doc = fakeDocument();
    const existing = doc.createElement('link');
    existing.setAttribute('rel', 'stylesheet'); existing.setAttribute('href', SC); existing.setAttribute('data-precedence', 'font-sc');
    doc.head.appendChild(existing);
    expect(attachZhFontSheets(doc)).toBe(1);
    expect(attachZhFontSheets(doc)).toBe(0);
    expect(doc.links.map((l) => l.getAttribute('href'))).toEqual([SC, TC]);
    expect(doc.links[1].hasAttribute('data-manabi-zh-font')).toBe(true);
    expect(doc.links[1].getAttribute('rel')).toBe('stylesheet');
  });

  it('주소가 없으면(글꼴 입력 없는 next dev) 아무것도 붙이지 않는다', async () => {
    const { attachZhFontSheets, DEFERRED_ZH_SHEETS } = await load('', '');
    expect(DEFERRED_ZH_SHEETS).toEqual([]);
    const doc = fakeDocument();
    expect(attachZhFontSheets(doc)).toBe(0);
    expect(doc.links).toEqual([]);
  });

  it('서버 그림에는 스타일시트(렌더 차단)가 아니라 낮은 우선순위 미리 받기만 실린다', async () => {
    const { default: DeferredZhFontSheets } = await load();
    const html = renderToString(<html><head /><body><DeferredZhFontSheets /></body></html>);
    expect(html).not.toMatch(/rel="stylesheet"/);
    for (const href of [SC, TC]) expect(html).toMatch(new RegExp(`<link rel="preload" href="${href.replace(/\./g, '\\.')}" as="style" fetchPriority="low"/>`));
  });
});
