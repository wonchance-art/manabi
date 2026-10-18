import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkScStylesheet, faceKeys, normalizeRange } from '../../../scripts/fonts/check-sc-stylesheet.mjs';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

/**
 * 계약: 간체 중국어(Noto Sans SC) 독립 스타일시트 — next/font 밖의 고정 주소 CSS(SC-LINK-001 1단계, 2026-10-17 KST).
 * 설계 메모 A안(중국어를 그리는 부품이 `<link rel="stylesheet" precedence>`로 건다)의 재료다. 1단계는 산출만 한다.
 *
 * ① 계산 — 글꼴 입력(배포 사본 · e2e 대역)의 Google CSS를 그대로 두고 글꼴 주소만 next/font(ScFontScope)가 낼 주소로 바꾼다
 *   (리뷰 B1 — 독립 스타일시트와 next/font @font-face가 한 문서에 두 벌 있어도 같은 바이트를 한 번만 받는다)
 * ② 산출 대조 — scripts/fonts/check-sc-stylesheet.mjs(여기서는 합성 public · .next로, CI는 e2e:build 직후 실물로)
 * ③ 배선 — next.config env · CSS만 public(git 밖) · 1년 immutable 캐시(리뷰 B2 — 이름이 CSS 본문 해시)
 */
const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const { SC_STYLESHEET, scStylesheet, writeScStylesheet, scStylesheetEnv } = require('../../../scripts/fonts/sc-stylesheet.cjs');
const { nextFontEmittedName } = require('../../../scripts/fonts/next-font-file-url.cjs');
const VENDORED = path.join(ROOT, 'vendor/google-fonts/responses.cjs');
const E2E_MOCK = path.join(ROOT, 'e2e/fixtures/google-fonts-mock.cjs');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const hash16 = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);

describe('① 계산 — Google CSS 그대로, 주소만 내용 해시', () => {
  const responses = require(VENDORED);
  const result = scStylesheet(responses);
  it('배포 사본: 굵기 3 × 조각 101 = @font-face 303, 글꼴 101(굵기끼리 같은 가변 글꼴) · CSS 주소는 본문 해시', () => {
    expect((result.css.match(/@font-face/g) || []).length).toBe(303);
    expect(result.fonts).toHaveLength(101);
    expect(result.href).toMatch(/^\/_fonts\/noto-sans-sc\/noto-sans-sc\.[0-9a-f]{16}\.css$/);
    expect(result.href).toContain(hash16(result.css));
  });
  it('모든 글꼴 주소는 next/font가 같은 바이트로 낼 /_next/static/media 이름 — latin 조각만 .p(preload), 모두 -s(크기 보정)', () => {
    const source = responses[SC_STYLESHEET.cssUrl];
    const pairs = [...source.matchAll(/(?:\/\*\s*([^*]+?)\s*\*\/\s*)?@font-face\s*\{[^}]*url\(([^)]+)\)/g)];
    const ours = [...result.css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
    expect(ours).toHaveLength(303);
    // next loader 규칙: 주석(/* subset */)은 다음 주석까지 이어지고, 같은 파일은 처음 나온 자리의 subset으로 preload를 정한다.
    let subset = '';
    const firstSubset = new Map();
    pairs.forEach((m, i) => {
      if (m[1]) subset = m[1];
      if (!firstSubset.has(m[2])) firstSubset.set(m[2], subset);
      const expected = `/_next/${nextFontEmittedName(fs.readFileSync(m[2]), { sizeAdjust: true, preload: firstSubset.get(m[2]) === 'latin' })}`;
      expect(ours[i]).toBe(expected);
    });
    expect(ours.every((u) => /^\/_next\/static\/media\/[0-9a-f]+-s(\.p)?\.woff2$/.test(u))).toBe(true);
    expect(new Set(ours.filter((u) => u.endsWith('.p.woff2'))).size).toBe(1);
  });
  it('이름 규칙은 next 15.5 loader의 emitFontFile 틀 그대로(파일 이름 = 바이트 해시 · -s · .p)', () => {
    const loader = fs.readFileSync(require.resolve('next/dist/build/webpack/loaders/next-font-loader/index.js'), 'utf8');
    expect(loader).toContain("`static/media/[hash]${isUsingSizeAdjust ? '-s' : ''}${preload ? '.p' : ''}.${ext}`");
    const google = fs.readFileSync(require.resolve('next/dist/compiled/@next/font/dist/google/loader.js'), 'utf8');
    expect(google).toContain('emitFontFile(fontFileBuffer, ext, preloadFontFile, !!adjustFontFallbackMetrics)');
  });
  it('가리키는 next/font 선언과 인자가 같다 — ScFontScope의 Noto_Sans_SC(subsets latin · preload · 크기 보정 기본값)', () => {
    const call = sliceBetween(read('src/components/fonts/ScFontScope.jsx'), 'Noto_Sans_SC({', '});');
    expect(call).toContain(`subsets: ['${SC_STYLESHEET.nextFont.subsets.join("', '")}']`);
    expect(call).toContain("weight: ['400', '500', '700']");
    expect(call).not.toMatch(/preload:\s*false/);
    expect(call).not.toMatch(/adjustFontFallback:\s*false/);
    expect(SC_STYLESHEET.nextFont).toEqual({ subsets: ['latin'], preload: true, adjustFontFallback: true });
  });
  it('굵기 · unicode-range · font-display는 Google CSS 그대로(덮는 글자가 next/font와 같다)', () => {
    const source = responses[SC_STYLESHEET.cssUrl];
    expect(faceKeys(result.css, 'Noto Sans SC')).toEqual(faceKeys(source, 'Noto Sans SC'));
    expect((result.css.match(/font-display: swap;/g) || []).length).toBe(303);
  });
  it('결정적 — 같은 입력이면 같은 CSS · 주소', () => {
    expect(scStylesheet(responses)).toEqual(result);
  });
  it('e2e 대역도 같은 길로 만들어진다(대역 글꼴 1개)', () => {
    const mock = scStylesheet(require(E2E_MOCK));
    expect(mock.fonts).toHaveLength(1);
    expect((mock.css.match(/@font-face/g) || []).length).toBe(3);
  });
  it('입력에 없는 요청 · 로컬 파일이 아닌 주소는 멈춘다(조용히 빈 CSS를 내지 않는다)', () => {
    expect(() => scStylesheet({})).toThrow(/CSS가 없다/);
    expect(() => scStylesheet({ [SC_STYLESHEET.cssUrl]: "@font-face{font-family:'Noto Sans SC';src:url(https://x/y.woff2)}" })).toThrow(/로컬 파일이 아니다/);
  });
});

describe('② 산출 대조 — public 산출물 · next/font 덮는 범위', () => {
  const env = { NEXT_FONT_GOOGLE_MOCKED_RESPONSES: VENDORED };
  const setup = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-link-'));
    const publicDir = path.join(dir, 'public'), nextDir = path.join(dir, '.next');
    const result = scStylesheet(require(VENDORED));
    writeScStylesheet(result, publicDir);
    fs.mkdirSync(path.join(nextDir, 'static', 'css'), { recursive: true });
    fs.mkdirSync(path.join(nextDir, 'static', 'media'), { recursive: true });
    for (const url of result.fonts) fs.writeFileSync(path.join(nextDir, 'static', 'media', url.split('/').pop()), 'woff2');
    // next/font가 낸 것과 같은 모양의 @font-face — 같은 빌드면 주소까지 같다(독립 CSS 본문 그대로 = next 산출 꼴)
    fs.writeFileSync(path.join(nextDir, 'static', 'css', 'a.css'), result.css);
    return { dir, publicDir, nextDir, result };
  };
  it('맞으면 통과', () => {
    const { publicDir, nextDir } = setup();
    expect(checkScStylesheet({ nextDir, publicDir, env })).toEqual([]);
  });
  it('빌드 CSS가 압축기 꼴(소문자 · 공백 없음 · xx00-xxff → xx??)이어도 같은 범위로 통과한다', () => {
    const { publicDir, nextDir } = setup();
    const file = path.join(nextDir, 'static', 'css', 'a.css');
    const min = fs.readFileSync(file, 'utf8').replace(/unicode-range:([^;}]+)/g, (_, r) => `unicode-range:${r.replace(/\s+/g, '').toLowerCase().replace(/u\+([0-9a-f]*)00-\1ff/g, 'u+$1??')}`);
    expect(min).toMatch(/u\+[0-9a-f]*\?\?/);
    fs.writeFileSync(file, min);
    expect(checkScStylesheet({ nextDir, publicDir, env })).toEqual([]);
  });
  it('CSS 없음 · 본문 바뀜 · 글꼴 없음 · 글꼴 바이트 바뀜 · next/font 없음 · 범위 다름을 각각 잡는다', () => {
    let s = setup(); fs.rmSync(path.join(s.publicDir, ...s.result.href.slice(1).split('/')));
    expect(checkScStylesheet({ nextDir: s.nextDir, publicDir: s.publicDir, env }).join()).toMatch(/① CSS가 public에 없다/);
    s = setup(); fs.appendFileSync(path.join(s.publicDir, ...s.result.href.slice(1).split('/')), '/* x */');
    expect(checkScStylesheet({ nextDir: s.nextDir, publicDir: s.publicDir, env }).join()).toMatch(/① public CSS 본문이/);
    s = setup(); fs.rmSync(path.join(s.nextDir, 'static', 'media', s.result.fonts[0].split('/').pop()));
    expect(checkScStylesheet({ nextDir: s.nextDir, publicDir: s.publicDir, env }).join()).toMatch(/② next\/font 산출에 글꼴이 없다/);
    s = setup(); fs.writeFileSync(path.join(s.nextDir, 'static', 'css', 'a.css'), s.result.css.replace(s.result.fonts[3], '/_next/static/media/other-s.woff2'));
    expect(checkScStylesheet({ nextDir: s.nextDir, publicDir: s.publicDir, env }).join()).toMatch(/③ 글꼴 주소가 next\/font와 다르다/);
    s = setup(); fs.writeFileSync(path.join(s.nextDir, 'static', 'css', 'a.css'), '');
    expect(checkScStylesheet({ nextDir: s.nextDir, publicDir: s.publicDir, env }).join()).toMatch(/③ 빌드 CSS에 next\/font/);
    s = setup(); fs.writeFileSync(path.join(s.nextDir, 'static', 'css', 'a.css'), "@font-face{font-family:'Noto Sans SC';font-weight:400;src:url(/x.woff2);unicode-range:U+4e00}");
    expect(checkScStylesheet({ nextDir: s.nextDir, publicDir: s.publicDir, env }).join()).toMatch(/③ next\/font와 굵기 · unicode-range가 다르다/);
  });
  it('unicode-range는 값으로 비교한다 — 압축기의 와일드카드 · 대소문자 · 순서 · 겹침에 흔들리지 않는다(e2e:build 실측 u+00??)', () => {
    expect(normalizeRange('U+0000-00FF, U+0131')).toBe(normalizeRange('u+00??,u+0131'));
    expect(normalizeRange('U+4E00-4E7F, U+4E80-4EFF')).toBe(normalizeRange('u+4e??'));
    expect(normalizeRange('U+0131, U+0000-00FF')).toBe(normalizeRange('U+0000-00FF,U+0131'));
    expect(normalizeRange('U+0000-00FF')).not.toBe(normalizeRange('U+0000-00FE'));
  });
  it('글꼴 입력 없이 돌리면 통과로 치지 않는다', () => {
    expect(checkScStylesheet({ env: {} })).toEqual(['NEXT_FONT_GOOGLE_MOCKED_RESPONSES가 없다 — 빌드와 같은 글꼴 입력으로 실행한다']);
  });
});

describe('③ 배선', () => {
  it('next.config가 env로 주소를 넣고, 글꼴 입력이 없으면 아무것도 쓰지 않는다', () => {
    expect(read('next.config.mjs')).toContain('...scStylesheetEnv(),');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-link-env-'));
    expect(scStylesheetEnv({}, dir)).toEqual({});
    expect(fs.readdirSync(dir)).toEqual([]);
    const env = scStylesheetEnv({ NEXT_FONT_GOOGLE_MOCKED_RESPONSES: E2E_MOCK }, dir);
    expect(env[SC_STYLESHEET.env]).toMatch(/^\/_fonts\/noto-sans-sc\/noto-sans-sc\.[0-9a-f]{16}\.css$/);
    expect(fs.existsSync(path.join(dir, ...env[SC_STYLESHEET.env].slice(1).split('/')))).toBe(true);
  });
  it('산출물은 git 밖 · public에는 CSS 하나만(글꼴은 next/font 산출) · CI는 e2e:build 뒤 대조', () => {
    expect(read('.gitignore')).toContain('/public/_fonts/');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-link-only-css-'));
    const result = scStylesheet(require(VENDORED));
    writeScStylesheet(result, dir);
    expect(fs.readdirSync(path.join(dir, '_fonts', 'noto-sans-sc'))).toEqual([result.href.split('/').pop()]);
    expect(read('.github/workflows/ci.yml')).toContain('node scripts/fonts/check-sc-stylesheet.mjs');
  });
  it('B2 — /_fonts는 1년 immutable(이름이 CSS 본문 해시라 내용이 바뀌면 이름이 바뀐다)', async () => {
    const { default: config } = await import('../../../next.config.mjs');
    const rules = await config.headers();
    const rule = rules.find((r) => r.source === '/_fonts/:path*');
    expect(rule?.headers).toEqual([{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]);
    const { href, css } = scStylesheet(require(VENDORED));
    expect(href.endsWith(`.${hash16(css)}.css`)).toBe(true); // immutable의 근거 — 같은 이름이면 같은 바이트
    expect(href.startsWith('/_fonts/')).toBe(true);
  });
});
