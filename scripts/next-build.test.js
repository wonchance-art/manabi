import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildEnv, VENDORED_FONT_RESPONSES } from './next-build.mjs';

const require = createRequire(import.meta.url);
const VENDOR = path.resolve('vendor/google-fonts');
const manifest = JSON.parse(fs.readFileSync(path.join(VENDOR, 'manifest.json'), 'utf8'));
const { fontFileName, fontUrlsInCss } = require(path.join(VENDOR, 'paths.cjs'));

// next/font/google이 호출 인자로 만드는 css2 URL — next 내부 함수를 그대로 쓴다(규칙을 다시 쓰지 않는다).
const GOOGLE = 'next/dist/compiled/@next/font/dist/google/';
const { validateGoogleFontFunctionCall } = require(`${GOOGLE}validate-google-font-function-call`);
const { getFontAxes } = require(`${GOOGLE}get-font-axes`);
const { getGoogleFontsUrl } = require(`${GOOGLE}get-google-fonts-url`);

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(jsx?|tsx?|mjs)$/.test(entry.name) ? [full] : [];
  });
}

/** src의 `next/font/google` 호출을 모두 찾아 next가 요청할 URL로 바꾼다. 인자는 정적 객체 리터럴이다. */
function googleFontCalls() {
  const calls = [];
  for (const file of sourceFiles('src')) {
    const code = fs.readFileSync(file, 'utf8');
    const imported = /import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/.exec(code);
    if (!imported) continue;
    for (const name of imported[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const pattern = new RegExp(`\\b${name}\\(\\s*(\\{[^{}]*\\})\\s*\\)`, 'g');
      const found = [...code.matchAll(pattern)];
      expect(found.length, `${file}: ${name} 호출을 찾지 못함`).toBeGreaterThan(0);
      for (const [, literal] of found) {
        const options = new Function(`return (${literal});`)();
        const v = validateGoogleFontFunctionCall(name, options);
        calls.push({ file, name, url: getGoogleFontsUrl(v.fontFamily, getFontAxes(v.fontFamily, v.weights, v.styles, v.selectedVariableAxes), v.display) });
      }
    }
  }
  return calls;
}

describe('next-build: Google Fonts를 저장소 사본에서 읽는다', () => {
  it('배포 빌드는 사본 응답을 넘기고, 이미 지정된 값은 덮지 않는다', () => {
    expect(buildEnv({}).NEXT_FONT_GOOGLE_MOCKED_RESPONSES).toBe(VENDORED_FONT_RESPONSES);
    expect(fs.existsSync(VENDORED_FONT_RESPONSES)).toBe(true);
    expect(buildEnv({ NEXT_FONT_GOOGLE_MOCKED_RESPONSES: '/x.cjs' }).NEXT_FONT_GOOGLE_MOCKED_RESPONSES).toBe('/x.cjs');
    expect(buildEnv({ FOO: '1' }).FOO).toBe('1');
  });

  it('배포 빌드 스크립트가 이 진입점을 쓰고, e2e 빌드는 대역을 유지한다', () => {
    const { scripts } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    expect(scripts.build).toBe('node scripts/next-build.mjs');
    expect(scripts['e2e:build']).toContain('e2e/fixtures/google-fonts-mock.cjs');
  });

  it('src의 모든 next/font/google 호출이 사본에 있다 — 없으면 Vercel 빌드가 멈춘다', () => {
    const calls = googleFontCalls();
    expect(calls.length).toBeGreaterThanOrEqual(10);
    for (const { file, name, url } of calls) {
      expect(manifest.responses[url], `${file} ${name}: node scripts/fonts/vendor-google-fonts.mjs '${url}'`).toBeTruthy();
    }
  });

  it('사본 CSS가 가리키는 글꼴이 모두 있고 해시가 맞으며, 남는 파일이 없다', () => {
    const referenced = new Set();
    for (const name of Object.values(manifest.responses)) {
      const css = fs.readFileSync(path.join(VENDOR, 'css', name), 'utf8');
      const urls = fontUrlsInCss(css);
      expect(urls.length, name).toBeGreaterThan(0);
      for (const url of urls) {
        expect(url, '확장자 없는 주소는 next loader가 실패한다(10-10)').toMatch(/\.(woff|woff2|eot|ttf|otf)$/);
        referenced.add(fontFileName(url));
      }
    }
    expect(Object.keys(manifest.files).sort()).toEqual([...referenced].sort());
    for (const [rel, hash] of Object.entries(manifest.files)) {
      const body = fs.readFileSync(path.join(VENDOR, 'files', rel));
      expect(crypto.createHash('sha256').update(body).digest('hex'), rel).toBe(hash);
    }
    const onDisk = fs.readdirSync(path.join(VENDOR, 'files'), { recursive: true })
      .filter((rel) => fs.statSync(path.join(VENDOR, 'files', rel)).isFile());
    expect(onDisk.sort()).toEqual(Object.keys(manifest.files).sort());
  });

  it('응답 모듈은 Google CSS를 그대로 두고 글꼴 주소만 사본 절대 경로로 바꾼다', () => {
    const responses = require(VENDORED_FONT_RESPONSES);
    const [url, name] = Object.entries(manifest.responses)[0];
    const original = fs.readFileSync(path.join(VENDOR, 'css', name), 'utf8');
    const css = responses[url];
    expect(css).not.toContain('fonts.gstatic.com');
    const local = fontUrlsInCss(css);
    expect(local).toHaveLength(fontUrlsInCss(original).length);
    for (const file of local) {
      expect(path.isAbsolute(file)).toBe(true);
      expect(fs.existsSync(file)).toBe(true);
    }
    const strip = (s) => s.replace(/url\([^)]+\)/g, 'url()');
    expect(strip(css)).toBe(strip(original));
  });

  it('사본에 없는 요청은 갱신 명령과 함께 멈춘다', () => {
    const responses = require(VENDORED_FONT_RESPONSES);
    const url = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400&display=swap';
    expect(() => responses[url]).toThrow(/vendor-google-fonts\.mjs/);
  });
});
