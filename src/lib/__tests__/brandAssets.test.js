import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약: BRAND-APPLY-001 — 앱 아이콘·이름 「Anatomy Studio·보라 🧬」 → 「manabi·m. 로즈」
 * (#1337 인계 6055913357 §3, 개정 1 점 색 해바라기 #FFD04D — 6056214600).
 * 규약 정본: docs/ui-conventions.md 「6. 브랜드」. 문서는 낡지만 이 계약은 CI에서 잡는다.
 * 실기기(안드로이드 설치·iOS 홈 화면·링크 미리보기) 확인은 계약 범위 밖이다.
 */

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const manifest = () => JSON.parse(read('public/manifest.webmanifest'));

const ROSE = '#994A5A';
const DOT = '#FFD04D';
const PAPER = '#FFFDF9';

/** PNG IHDR(시그니처 8 + 길이 4 + 'IHDR' 4 다음)에서 크기·비트 깊이·색 형식을 읽는다. */
function ihdr(file) {
  const buf = fs.readFileSync(path.join(ROOT, file));
  expect(buf.subarray(0, 8).toString('hex'), `${file}은 PNG여야 한다`).toBe('89504e470d0a1a0a');
  expect(buf.subarray(12, 16).toString('latin1')).toBe('IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bitDepth: buf[24], colorType: buf[25] };
}

/** `.manabi-app{…}` 첫 규칙의 --primary 값(현행 화면 대표색). */
function shellPrimary() {
  const m = read('src/components/books/reading-shell.css').match(/^\.manabi-app\{[^}]*?--primary:(#[0-9a-fA-F]{6})/m);
  expect(m, '.manabi-app --primary를 찾지 못했다').not.toBeNull();
  return m[1].toUpperCase();
}

const EMOJI = /\p{Extended_Pictographic}/u;
const REGIONAL_INDICATOR = /[\u{1F1E6}-\u{1F1FF}]/u;

describe('BRAND-APPLY-001 ① manifest', () => {
  it('이름은 manabi이고 어디에도 Anatomy가 없다', () => {
    const m = manifest();
    expect(m.name).toBe('manabi');
    expect(m.short_name).toBe('manabi');
    expect(read('public/manifest.webmanifest')).not.toMatch(/anatomy/i);
  });

  it('theme_color = layout theme-color meta = 화면 대표색 로즈, background_color = 종이색', () => {
    const m = manifest();
    const meta = read('src/app/layout.jsx').match(/<meta name="theme-color" content="(#[0-9a-fA-F]{6})"/);
    expect(meta).not.toBeNull();
    expect(m.theme_color.toUpperCase()).toBe(meta[1].toUpperCase());
    expect(m.theme_color.toUpperCase()).toBe(ROSE);
    expect(shellPrimary()).toBe(ROSE);
    expect(m.background_color.toUpperCase()).toBe(PAPER);
  });

  it('maskable PNG 하나와 any PNG 192·512가 있고 "any maskable" 겸용이 없다', () => {
    const icons = manifest().icons;
    expect(icons.filter((i) => /\bany\b/.test(i.purpose) && /\bmaskable\b/.test(i.purpose))).toEqual([]);
    const maskable = icons.filter((i) => i.purpose === 'maskable');
    expect(maskable).toEqual([{ src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]);
    const anyPng = icons.filter((i) => i.purpose === 'any' && i.type === 'image/png').map((i) => i.sizes).sort();
    expect(anyPng).toEqual(['192x192', '512x512']);
    for (const icon of icons) expect(fs.existsSync(path.join(ROOT, 'public', icon.src)), icon.src).toBe(true);
  });
});

describe('BRAND-APPLY-001 ② 아이콘 파일', () => {
  const OPAQUE_RGB = 2;
  const RGBA = 6;
  const TABLE = [
    ['public/icon-192.png', 192, OPAQUE_RGB],
    ['public/icon-512.png', 512, OPAQUE_RGB],
    ['public/icon-maskable-512.png', 512, OPAQUE_RGB],
    ['public/apple-touch-icon.png', 180, OPAQUE_RGB], // iOS는 알파가 있으면 검게 채운다 — 알파 없는 RGB
    ['public/badge-96.png', 96, RGBA],                // 안드로이드 배지 = 투명 바탕 흰 실루엣
  ];
  it.each(TABLE)('%s — %ipx, 색 형식 %i', (file, px, colorType) => {
    const h = ihdr(file);
    expect([h.width, h.height]).toEqual([px, px]);
    expect(h.bitDepth).toBe(8);
    expect(h.colorType).toBe(colorType);
  });

  it.each(['public/icon.svg', 'public/favicon.svg'])('%s — 로즈 바탕·해바라기 점, 글자·이모지 없음', (file) => {
    const svg = read(file);
    expect(svg).toContain(`fill="${ROSE}"`);
    expect(svg).toContain(`fill="${DOT}"`);
    expect(svg).toContain('stroke="#FFF4E6"');
    expect(svg).not.toMatch(/<text/i);
    expect(svg).not.toMatch(EMOJI);
  });

  it('icon.svg는 사각 꽉 채움(모서리는 OS가 자른다), favicon.svg만 둥근 모서리', () => {
    expect(read('public/icon.svg')).not.toMatch(/\brx=/);
    expect(read('public/favicon.svg')).toContain('rx="112"');
  });
});

describe('BRAND-APPLY-001 ③ 배선', () => {
  it('layout — 탭은 favicon.svg, iOS 홈 화면은 PNG', () => {
    const layout = read('src/app/layout.jsx');
    expect(layout).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
    const apple = layout.match(/<link rel="apple-touch-icon" href="([^"]+)"/);
    expect(apple).not.toBeNull();
    expect(apple[1]).toMatch(/\.png$/);
    expect(fs.existsSync(path.join(ROOT, 'public', apple[1]))).toBe(true);
  });

  it('푸시 알림 — 아이콘은 PNG, 배지는 단색 실루엣 PNG(안드로이드는 SVG를 못 쓴다)', () => {
    const sw = read('public/sw.js');
    expect(sw).toContain("icon: '/icon-192.png'");
    expect(sw).toContain("badge: '/badge-96.png'");
    expect(sw).not.toMatch(/(icon|badge): '\/icon\.svg'/);
  });

  it('글자 로고 점 — 로즈(var(--primary)), 마침표 자리(기준선)', () => {
    const rule = read('src/components/books/reading-shell.css').match(/^\.manabi-brand-dot\{[^}]*\}/m);
    expect(rule).not.toBeNull();
    expect(rule[0]).toContain('background:var(--primary)');
    expect(rule[0]).toContain('margin:0 0 0 2px');
    expect(rule[0]).not.toContain('currentColor');
  });
});

describe('BRAND-APPLY-001 ④ 화면 문구·공유 미리보기', () => {
  it.each([
    'src/app/opengraph-image.jsx',
    'src/components/OnboardingModal.jsx',
    'src/app/privacy/page.jsx',
    'src/app/terms/page.jsx',
  ])('%s에 Anatomy가 없다', (file) => {
    expect(read(file)).not.toMatch(/anatomy/i);
  });

  it('계정 내보내기 파일 이름은 manabi_로 시작한다', () => {
    const src = read('src/components/AccountSettings.jsx');
    expect(src).toMatch(/a\.download = `manabi_\$\{/);
    expect(src).not.toMatch(/anatomy/i);
  });

  it('OG 이미지 — 이모지·국기 없음, alt·문구, 아이콘은 public/icon.svg와 같은 원본', () => {
    const og = read('src/app/opengraph-image.jsx');
    expect(og).not.toMatch(REGIONAL_INDICATOR);
    expect(og).not.toMatch(EMOJI);
    expect(og).toContain("export const alt = 'manabi — 읽고, 담고, 제때 다시 만나는 외국어 서재';");
    expect(og).toContain('日本語 · 中文 · Français · English');
    expect(og).toContain(read('public/icon.svg').trim());
  });
});

describe('BRAND-APPLY-001 ⑤ 바꾸면 안 되는 내부 이름(데이터·캐시 연속성)', () => {
  it.each([
    ['src/lib/offlineCache.js', "const DB_NAME = 'anatomy-offline-cache';"],
    ['src/lib/pdfCache.js', "const DB_NAME = 'anatomy-pdf-cache';"],
    ['src/lib/sharedStore.js', "const DB_NAME = 'anatomy-class-shared';"],
    ['scripts/update-sw-version.mjs', "const CACHE_PREFIX = 'anatomy-studio-v';"],
    ['src/lib/reportError.js', 'window.__anatomyErrorHooked'],
    ['src/lib/content-sources.js', "'AnatomyStudio/1.0 (language-learning)'"],
    ['src/app/api/import/link/route.js', "'AnatomyStudio/1.0 (language-learning)'"],
    ['src/app/robots.js', "'https://anatomy-studio.vercel.app'"],
    ['src/app/sitemap.js', "'https://anatomy-studio.vercel.app'"],
  ])('%s — %s 유지', (file, needle) => {
    expect(read(file)).toContain(needle);
  });

  it('sw.js CACHE_NAME 접두사 anatomy-studio-v 유지', () => {
    expect(read('public/sw.js')).toMatch(/^const CACHE_NAME = 'anatomy-studio-v[0-9a-f]+';/m);
  });
});

describe('BRAND-APPLY-001 ⑥ 규약 문서', () => {
  it('ui-conventions.md에 「브랜드」 절이 있고 로즈 값이 화면 --primary와 같다', () => {
    const doc = read('docs/ui-conventions.md');
    const start = doc.indexOf('## 6. 브랜드');
    expect(start).toBeGreaterThan(-1);
    const section = doc.slice(start);
    expect(section).toContain(ROSE);
    expect(section).toContain(DOT);
    expect(section).toContain('#FFF4E6');
    expect(section).toContain(PAPER);
    expect(section).toContain('brandAssets.test.js');
    expect(shellPrimary()).toBe(ROSE);
  });
});
