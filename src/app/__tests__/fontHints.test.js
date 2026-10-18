import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkFontHints, fontFaceUrls } from '../../../scripts/fonts/check-font-hints.mjs';

/**
 * 계약: 병음 · 라틴 본문 글꼴(Noto Sans)은 루트에 한 벌만 선언하고, 그리는 세그먼트만 그 한 벌의 주소로
 * 미리 받는다 (FONT-HINT-001, 2026-10-17 KST).
 *
 * 루트 preload는 쓰지 않는 화면(배움 · 산책 등)도 라틴 조각 35.9kB를 미리 받았다. 쓰는 구간에서 다시 선언한
 * 시제품은 @font-face가 두 벌(`-s.woff2`/`-s.p.woff2`) 생겨 중국어 뷰어가 같은 바이트를 두 번 받고 교체가
 * 2.0–2.2초로 늦어져 폐기했다. 그래서 주소를 next/font 산출 규칙으로 다시 계산해 ReactDOM.preload로만 단다.
 *
 * ① 단위 계산 — 배포 사본 · e2e 대역 각각에서 실제 산출 파일 이름이 나온다(빌드 없이 고정)
 * ② 산출 대조 — scripts/fonts/check-font-hints.mjs의 판정(여기서는 합성 .next로, CI는 e2e:build 직후 실물로)
 * ③ 이중 선언 금지 — Noto_Sans( 호출은 루트 한 곳, preload: false
 * ④ 범위 — Noto Sans를 그리는 화면의 라우트는 힌트 세그먼트 안에 있다(밖은 이유와 함께)
 */
const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const { FONT_HINTS, fontHintEnv, subsetFontUrls } = require('../../../scripts/fonts/next-font-file-url.cjs');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const VENDORED = path.join(ROOT, 'vendor/google-fonts/responses.cjs');
const E2E_MOCK = path.join(ROOT, 'e2e/fixtures/google-fonts-mock.cjs');
const walk = (dir, out = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|jsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p).replaceAll('\\', '/');

const HINTS = 'src/components/fonts/fontHints.js';
// 힌트를 거는 세그먼트 — Noto Sans(병음 · 라틴 본문)를 그리는 보이는 화면.
const HINT_SEGMENTS = ['src/app/(app)/viewer', 'src/app/(app)/pdf', 'src/app/(app)/suggestions', 'src/app/(app)/chinese', 'src/app/(app)/quick'];
// Noto Sans를 그리는 화면 부품 — readerFontFamily(라틴 본문) · 병음 · lv-py를 쓴다.
const NOTO_SANS_SCREENS = ['@/views/ViewerPage', '@/views/PdfViewerPage', '@/components/materials/SuggestionReader', '@/views/levelListRoute', '@/views/QuickPage'];
// 범위 밖으로 둔 라우트 — 이유와 함께. 여기서는 @font-face대로 그릴 때 받는다(미리 받기만 없다).
const OUTSIDE = Object.freeze({
  'src/app/(app)/japanese': '일본어 레벨 목록 — lv-py 읽기가 가나라 Noto Sans 라틴 조각을 그리지 않는다(빌드 실측 2026-10-17 KST)',
});

describe('글꼴 힌트 — Noto Sans 라틴 조각', () => {
  it('① 배포 사본에서 계산한 주소 = 실제 산출 파일 이름(Preview 빌드와 같은 해시)', () => {
    expect(fontHintEnv({ NEXT_FONT_GOOGLE_MOCKED_RESPONSES: VENDORED })).toEqual({
      MANABI_FONT_HINT_NOTO_SANS: '/_next/static/media/1755441e3a2fa970-s.woff2',
    });
  });

  it('① e2e 대역에서는 대역 글꼴의 파일 이름이 나온다(운영 해시를 박으면 e2e에서 404)', () => {
    expect(fontHintEnv({ NEXT_FONT_GOOGLE_MOCKED_RESPONSES: E2E_MOCK })).toEqual({
      MANABI_FONT_HINT_NOTO_SANS: '/_next/static/media/3b7f680d40bad81e-s.woff2',
    });
  });

  it('① 글꼴 입력이 없는 실행(next dev)은 힌트를 비운다', () => {
    expect(fontHintEnv({})).toEqual({});
  });

  it('① 힌트의 CSS 주소는 루트 Noto_Sans 호출의 weight와 같다(굵기를 바꾸면 힌트도 바뀐다)', () => {
    const root = read('src/app/layout.jsx');
    const call = /Noto_Sans\(\{([\s\S]*?)\}\);/.exec(root)?.[1] || '';
    const weights = [...(/weight:\s*\[([^\]]*)\]/.exec(call)?.[1] || '').matchAll(/'(\d+)'/g)].map((m) => m[1]);
    expect(weights.length).toBeGreaterThan(0);
    expect(FONT_HINTS.notoSans.cssUrl).toBe(`https://fonts.googleapis.com/css2?family=Noto+Sans:wght@${weights.join(';')}&display=swap`);
    expect(call).toMatch(/subsets:\s*\['latin'\]/);
    expect(call).toMatch(/display:\s*'swap'/);
  });

  it('① 라틴 조각은 weight가 달라도 한 파일이다(가변 글꼴)', () => {
    const responses = require(VENDORED);
    expect(subsetFontUrls(responses[FONT_HINTS.notoSans.cssUrl], 'latin')).toHaveLength(1);
  });

  it('next.config가 계산값을 env로 넣는다', () => {
    const config = read('next.config.mjs');
    expect(config).toContain("('./scripts/fonts/next-font-file-url.cjs')");
    expect(config).toMatch(/env:\s*\{[\s\S]*\.\.\.fontHintEnv\(\),[\s\S]*\}/);
  });

  it('② 산출 대조: 파일 · @font-face · 서버 번들이 맞으면 통과, 어긋나면 각각 잡는다', () => {
    const href = '/_next/static/media/1755441e3a2fa970-s.woff2';
    const env = { NEXT_FONT_GOOGLE_MOCKED_RESPONSES: VENDORED };
    const make = ({ media = true, face = href, extraFace = '', server = `preload("${href}")` } = {}) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-hint-'));
      fs.mkdirSync(path.join(dir, 'static/media'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'static/css'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'server/app'), { recursive: true });
      if (media) fs.writeFileSync(path.join(dir, 'static/media/1755441e3a2fa970-s.woff2'), '');
      fs.writeFileSync(path.join(dir, 'static/css/a.css'),
        `@font-face{font-family:Noto Sans KR;src:url(/_next/static/media/aa-s.p.woff2)}@font-face{font-family:'Noto Sans';src:url(${face}) format("woff2")}${extraFace}`);
      fs.writeFileSync(path.join(dir, 'server/app/layout.js'), server);
      return dir;
    };
    expect(checkFontHints({ nextDir: make(), env })).toEqual([]);
    expect(checkFontHints({ nextDir: make({ media: false }), env }).join()).toMatch(/^① notoSans/);
    expect(checkFontHints({ nextDir: make({ face: '/_next/static/media/ffff-s.woff2' }), env }).join()).toMatch(/② notoSans: 'Noto Sans' @font-face가 힌트 주소를/);
    expect(checkFontHints({ nextDir: make({ extraFace: "@font-face{font-family:'Noto Sans';src:url(/_next/static/media/1755441e3a2fa970-s.p.woff2)}" }), env }).join()).toMatch(/미리 받기판/);
    expect(checkFontHints({ nextDir: make({ server: 'nothing' }), env }).join()).toMatch(/^③ notoSans/);
    expect(checkFontHints({ nextDir: make(), env: {} })).toHaveLength(1);
  });

  it('② CI는 e2e:build 직후 같은 글꼴 입력(대역)으로 산출 대조를 돌린다', () => {
    const ci = read('.github/workflows/ci.yml');
    const build = ci.indexOf('run: npm run e2e:build');
    const check = ci.indexOf('NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$PWD/e2e/fixtures/google-fonts-mock.cjs" node scripts/fonts/check-font-hints.mjs');
    expect(build).toBeGreaterThan(0);
    expect(check).toBeGreaterThan(build);
    expect(read('package.json')).toContain('NEXT_FONT_GOOGLE_MOCKED_RESPONSES=\\"$PWD/e2e/fixtures/google-fonts-mock.cjs\\" next build');
  });

  it('② @font-face 파서는 family 이름을 정확히 가른다(Noto Sans ≠ Noto Sans KR)', () => {
    const css = "@font-face{font-family:\"Noto Sans KR\";src:url(/k.woff2)}@font-face{font-family:Noto Sans;src:url('/n.woff2')}";
    expect(fontFaceUrls(css, 'Noto Sans')).toEqual(['/n.woff2']);
  });

  it('③ Noto_Sans( 선언은 루트 한 곳이고 미리 받지 않는다 — 세그먼트는 힌트만 건다', () => {
    const files = walk(path.join(ROOT, 'src'));
    const definers = files.filter((f) => /\bNoto_Sans\(/.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(definers).toEqual(['src/app/layout.jsx']);
    const call = /Noto_Sans\(\{([\s\S]*?)\}\);/.exec(read('src/app/layout.jsx'))?.[1] || '';
    expect(call).toMatch(/preload:\s*false/);
    expect(call).toContain("variable: '--font-noto-sans'");
    const users = files.filter((f) => fs.readFileSync(f, 'utf8').includes('MANABI_FONT_HINT_NOTO_SANS')).map(rel);
    expect(users).toEqual([HINTS]);
    expect(read(HINTS)).toContain("ReactDOM.preload(href, { as: 'font', type: 'font/woff2' })");
  });

  it('④ 힌트 세그먼트 layout은 렌더 중에 힌트를 건다', () => {
    for (const seg of HINT_SEGMENTS) {
      const layout = read(`${seg}/layout.jsx`);
      expect(layout, seg).toContain("import { preloadNotoSansLatin } from '@/components/fonts/fontHints'");
      expect(layout, seg).toMatch(/export default function Layout\(\{ children \}\) \{\n {2}preloadNotoSansLatin\(\);/);
    }
  });

  it('④ Noto Sans를 그리는 화면의 라우트는 힌트 세그먼트 안에 있다', () => {
    const files = walk(path.join(ROOT, 'src'));
    const routes = files.filter((f) => rel(f).startsWith('src/app/') && /\/(page|layout)\.jsx$/.test(f));
    const hits = routes.filter((f) => NOTO_SANS_SCREENS.some((m) => fs.readFileSync(f, 'utf8').includes(`from '${m}'`))).map(rel);
    expect(hits.length).toBeGreaterThanOrEqual(5); // viewer · pdf · suggestions · chinese 레벨 · quick(공허 통과 방지)
    const outside = hits.filter((f) => !HINT_SEGMENTS.some((seg) => f.startsWith(`${seg}/`)) && !Object.keys(OUTSIDE).some((o) => f.startsWith(`${o}/`)));
    expect(outside, 'Noto Sans를 그리는 화면이 힌트 범위 밖에서 열린다 — HINT_SEGMENTS에 넣거나 OUTSIDE에 이유를 적는다').toEqual([]);
    for (const [dir, reason] of Object.entries(OUTSIDE)) {
      expect(fs.existsSync(path.join(ROOT, dir)), dir).toBe(true);
      expect(reason.length, dir).toBeGreaterThan(10);
    }
  });
});
