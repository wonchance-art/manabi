import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkScStylesheet, faceKeys, normalizeRange } from '../../../scripts/fonts/check-sc-stylesheet.mjs';

/**
 * 계약: 간체 중국어(Noto Sans SC) 독립 스타일시트 — next/font 밖의 고정 주소 CSS(SC-LINK-001 1단계, 2026-10-17 KST).
 * 설계 메모 A안(중국어를 그리는 부품이 `<link rel="stylesheet" precedence>`로 건다)의 재료다. 1단계는 산출만 한다.
 *
 * ① 계산 — 글꼴 입력(배포 사본 · e2e 대역)의 Google CSS를 그대로 두고 글꼴 주소만 내용 해시 이름으로 바꾼다
 * ② 산출 대조 — scripts/fonts/check-sc-stylesheet.mjs(여기서는 합성 public · .next로, CI는 e2e:build 직후 실물로)
 * ③ 배선 — next.config env · public 산출물은 git 밖 · next/font와 독립(모듈이 next를 부르지 않는다)
 */
const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const { SC_STYLESHEET, scStylesheet, writeScStylesheet, scStylesheetEnv } = require('../../../scripts/fonts/sc-stylesheet.cjs');
const VENDORED = path.join(ROOT, 'vendor/google-fonts/responses.cjs');
const E2E_MOCK = path.join(ROOT, 'e2e/fixtures/google-fonts-mock.cjs');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const hash16 = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);

describe('① 계산 — Google CSS 그대로, 주소만 내용 해시', () => {
  const responses = require(VENDORED);
  const result = scStylesheet(responses);
  it('배포 사본: 굵기 3 × 조각 101 = @font-face 303, 글꼴 파일 101(굵기끼리 같은 가변 글꼴)', () => {
    expect((result.css.match(/@font-face/g) || []).length).toBe(303);
    expect(result.files).toHaveLength(101);
    expect(result.href).toMatch(/^\/_fonts\/noto-sans-sc\/noto-sans-sc\.[0-9a-f]{16}\.css$/);
    expect(result.href).toContain(hash16(result.css));
  });
  it('모든 글꼴 주소는 /_fonts/noto-sans-sc/<바이트 해시>.woff2 — 이름이 곧 내용이다', () => {
    const urls = [...result.css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
    expect(urls.length).toBe(303);
    expect(urls.every(u => /^\/_fonts\/noto-sans-sc\/[0-9a-f]{16}\.woff2$/.test(u))).toBe(true);
    for (const { name, from } of result.files) expect(name).toBe(`${hash16(fs.readFileSync(from))}.woff2`);
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
    expect(mock.files).toHaveLength(1);
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
    // next/font가 낸 것과 같은 모양의 @font-face(주소만 next 산출 이름) — 굵기 · 범위가 같으면 통과
    fs.writeFileSync(path.join(nextDir, 'static', 'css', 'a.css'), require(VENDORED)[SC_STYLESHEET.cssUrl].replace(/url\([^)]+\)/g, 'url(/_next/static/media/x-s.woff2)'));
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
    s = setup(); fs.rmSync(path.join(s.publicDir, '_fonts', 'noto-sans-sc', s.result.files[0].name));
    expect(checkScStylesheet({ nextDir: s.nextDir, publicDir: s.publicDir, env }).join()).toMatch(/② 글꼴이 public에 없다/);
    s = setup(); fs.appendFileSync(path.join(s.publicDir, '_fonts', 'noto-sans-sc', s.result.files[1].name), 'x');
    expect(checkScStylesheet({ nextDir: s.nextDir, publicDir: s.publicDir, env }).join()).toMatch(/② 파일 이름이 바이트 해시와 다르다/);
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
  it('산출물은 git 밖 · 모듈은 next/font와 독립 · CI는 e2e:build 뒤 대조', () => {
    expect(read('.gitignore')).toContain('/public/_fonts/');
    expect(read('scripts/fonts/sc-stylesheet.cjs')).not.toMatch(/require\(['"]next/);
    expect(read('.github/workflows/ci.yml')).toContain('node scripts/fonts/check-sc-stylesheet.mjs');
  });
});
