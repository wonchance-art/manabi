import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// COLOR-V2-UNIFY-001(오너 「통일」 2026-10-12) + WALL-001(화면 벽 1판 보고 #1337 6118079684).
// 옛 주황(v1 primary)이 셸 밖 화면·파생 토큰·하드코딩으로 남아 있던 것을 v2 로즈로 모으고, 되살아나지 않게 막는다.
const read = (p) => readFileSync(p, 'utf8');
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'world') walk(p, out); }
    else out.push(p);
  }
  return out;
};
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const token = (block, name) => block.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1];

// v1 주황 계열 — 브랜드(#C0522A·#E07848·#8A3818·#B85A30)와 그라데이션(#E8763C·#F5C34A·#D85840) 및 그 rgba.
const OLD_ORANGE = /#(C0522A|E07848|8A3818|B85A30|E8763C|F5C34A|D85840)\b|rgba\(\s*(192,\s*82,\s*42|232,\s*118,\s*60|224,\s*120,\s*72)\s*,/i;
// 콘텐츠 데이터(급수·단원 색 등)는 UI 스타일이 아니라 범위 밖이다 — 화면 코드만 본다.
const UI_FILES = [...walk('src/app'), ...walk('src/components'), ...walk('src/views'), 'src/index.css']
  .filter(p => /\.(css|jsx)$/.test(p) && !p.includes('opengraph-image'));

describe('옛 주황이 화면 코드에 남지 않는다', () => {
  it('CSS·JSX 어디에도 v1 주황 값이 없다(주석 제외)', () => {
    const hits = UI_FILES.filter(p => OLD_ORANGE.test(stripComments(read(p))));
    expect(hits).toEqual([]);
  });

  it('루트 토큰이 v2 로즈이고, 두 테마 모두 대비 AA', () => {
    const css = read('src/index.css');
    const root = css.match(/:root\s*\{[\s\S]*?\n\}/)[0];
    const light = css.match(/\[data-theme="light"\]\s*\{[\s\S]*?\n\}/)[0];
    expect(token(root, '--primary').toUpperCase()).toBe('#994A5A');
    expect(token(root, '--primary-dark').toUpperCase()).toBe('#793B48');
    // --primary는 버튼 바탕 — 흰 글자.
    expect(contrast('#FFFFFF', token(root, '--primary'))).toBeGreaterThanOrEqual(4.5);
    // 글자용 --primary-light / --warning-text: 어두운 바탕(:root)과 라이트 바탕 각각.
    for (const bg of [token(root, '--bg-primary'), token(root, '--bg-card'), token(root, '--bg-elevated')]) {
      expect(contrast(token(root, '--primary-light'), bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(root, '--warning-text'), bg)).toBeGreaterThanOrEqual(4.5);
    }
    for (const bg of [token(light, '--bg-primary'), token(light, '--bg-card'), token(light, '--bg-elevated')]) {
      expect(contrast(token(light, '--primary-light'), bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(light, '--warning-text'), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('늘 밝은 v2 셸은 글자 토큰을 라이트 값으로 고정한다 — html 기본 data-theme(dark)를 물려받지 않게', () => {
    const shell = read('src/components/web/web-shell.css').match(/^\.manabi-app\{[^}]*\}/m)[0];
    const paper = token(shell, '--paper'), sheet = token(shell, '--sheet');
    for (const name of ['--accent-text', '--warning-text', '--muted']) {
      const fg = token(shell, name);
      expect(fg, name).toBeTruthy();
      expect(contrast(fg, paper), name).toBeGreaterThanOrEqual(4.5);
      expect(contrast(fg, sheet), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('뜻이 있는 주황은 경고 토큰으로, 브랜드 강조는 로즈 토큰으로 갔다', () => {
    const css = read('src/index.css');
    expect(css).toMatch(/\.goal-track__verdict\.is-late \{[^}]*var\(--warning-text\)/);
    expect(css).toMatch(/\.fr-callout--pitfall \.fr-callout__label \{[^}]*var\(--warning-text\)/);
    expect(css).toMatch(/\.guide-hero__accent \{\s*color: var\(--primary-light\);\s*\}/);
    expect(css).toMatch(/\.guide-cta__btn \{[^}]*background: var\(--primary\)/);
  });
});

describe('오류 화면', () => {
  const ERROR_FILES = walk('src/app').filter(p => /(^|\/)error\.jsx$/.test(p));

  it('오류 원문(error.message·stack)을 화면에 그리지 않는다 — 판정에만 쓴다', () => {
    expect(ERROR_FILES.length).toBeGreaterThanOrEqual(5);
    for (const file of ERROR_FILES) {
      const src = read(file);
      // JSX 출력({error.message}), 대체 문구(error.message || …), 설정값(desc: error.message), 스택 출력 금지.
      expect(src, file).not.toMatch(/\{\s*error\??\.(message|stack)\s*\}/);
      // `error?.message || ''`(판정용 빈 문자열 대체)만 허용한다.
      expect(src, file).not.toMatch(/error\??\.message\s*\|\|(?!\s*(''|""))/);
      expect(src, file).not.toMatch(/:\s*error\??\.message\b/);
      expect(src, file).toMatch(/console\.error\(/);
    }
  });

  it('루트 오류·404는 (app) 레이아웃 밖이라 v2 셸을 직접 입는다', () => {
    for (const file of ['src/app/error.jsx', 'src/app/not-found.jsx']) {
      expect(read(file), file).toContain('className="manabi-app"');
      // 셸 CSS는 Layout이 불러온다 — 레이아웃 밖 화면은 직접 불러오지 않으면 클래스만 있고 색은 옛 루트 값이다(실측).
      expect(read(file), file).toContain("import '@/components/web/web-shell.css';");
      expect(read(file), file).toContain("import '@/components/books/reading-shell.css';");
    }
  });

  it('최상위 오류(global-error)는 스타일시트 없이도 v2 색이다', () => {
    const src = read('src/app/global-error.jsx');
    expect(src).toContain("background: '#f6f4ee'");
    expect(src).toContain("background: '#994a5a'");
    expect(src).not.toMatch(/#0b0d12|#6366f1/);
  });
});

describe('WALL-001 대비 지적 위치', () => {
  it('교재 목차·읽기 기록 글자는 연분홍 바탕 위에서도 4.5 이상', () => {
    const css = read('src/components/books/reading-shell.css');
    const color = (sel) => css.match(new RegExp(`${sel.replace(/[.>[\]()]/g, m => `\\${m}`)}\\{[^}]*?color:(#[0-9a-f]{6})`))?.[1];
    const pairs = [
      ['.manabi-toc-group>summary>span', '#fffefb'],
      ['.manabi-toc-group li>a>span', '#f8f1f2'],
      ['.manabi-reading-record p', '#f8f2f2'],
    ];
    for (const [sel, bg] of pairs) {
      const fg = color(sel);
      expect(fg, sel).toBeTruthy();
      expect(contrast(fg, bg), sel).toBeGreaterThanOrEqual(4.5);
    }
    expect(css).toMatch(/\.manabi-reading-record p\{font-size:12px/);
  });

  it('지역학 목록은 투명도로 글자를 흐리게 하지 않는다(바탕과 섞여 대비가 떨어진다)', () => {
    expect(read('src/app/(app)/studies/page.jsx')).not.toMatch(/opacity:\s*0?\.\d/);
  });
});
