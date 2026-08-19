import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// 계약: e2e 빌드는 Google Fonts를 실제로 받지 않는다.
// 빌드 1회가 fonts.gstatic에 383 요청을 던지고(실측), 그중 하나만 죽어도 빌드가 통째로
// 실패한다 — CI 플레이크 4회의 원인. 대역(google-fonts-mock.cjs)이 그 경로를 끊는데,
// 끊긴 상태가 조용히 풀리면 플레이크가 그대로 돌아오므로 배선을 계약으로 못 박는다.

const ROOT = process.cwd();
const MOCK_REL = 'e2e/fixtures/google-fonts-mock.cjs';
const require = createRequire(import.meta.url);
const mock = require(path.join(ROOT, MOCK_REL));

/** layout 소스에서 `Noto_Sans_KR({ weight: ['400', ...] })` 선언을 뽑는다. */
function declaredFonts(relPath) {
  const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const fonts = [];
  for (const match of src.matchAll(/=\s*([A-Z][A-Za-z_]*)\(\{([\s\S]*?)\n\}\);/g)) {
    const weightBlock = /weight:\s*\[([^\]]*)\]/.exec(match[2]);
    fonts.push({
      family: match[1].replace(/_/g, ' '),
      weights: weightBlock ? [...weightBlock[1].matchAll(/'(\d+)'/g)].map((w) => w[1]) : [],
    });
  }
  return fonts;
}

function googleUrl({ family, weights }) {
  const base = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}`;
  return `${weights.length ? `${base}:wght@${weights.join(';')}` : base}&display=swap`;
}

const LAYOUTS = ['src/app/layout.jsx', 'src/app/(app)/layout.jsx'];
const DECLARED = LAYOUTS.flatMap(declaredFonts);

describe('e2e 빌드의 Google Fonts 대역', () => {
  it('e2e:build가 대역을 물린다 — 이 배선이 빠지면 빌드가 다시 383 요청을 던진다', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['e2e:build']).toContain(`NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$PWD/${MOCK_REL}"`);
    expect(pkg.scripts['e2e:build']).toContain('next build');
  });

  it('배포 빌드는 그대로 — 제품 글꼴은 실제 Google Fonts를 쓴다', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.build).not.toContain('NEXT_FONT_GOOGLE_MOCKED_RESPONSES');
  });

  it('대역이 물리는 woff2가 실재한다 — 없으면 크롬 디코드 실패가 console.error로 새어 e2e가 깨진다', () => {
    const src = fs.readFileSync(path.join(ROOT, MOCK_REL), 'utf8');
    const stub = /path\.resolve\(__dirname, '([^']+)'\)/.exec(src);
    expect(stub).not.toBeNull();
    expect(fs.existsSync(path.join(ROOT, 'e2e/fixtures', stub[1]))).toBe(true);
  });

  it('layout이 선언한 글꼴 전부에 CSS를 돌려준다', () => {
    expect(DECLARED.length).toBeGreaterThan(0);
    for (const font of DECLARED) {
      const css = mock[googleUrl(font)];
      expect(css, `${font.family} 응답 없음`).toBeTruthy();
      expect(css).toContain(`font-family: '${font.family}';`);
      for (const weight of font.weights) {
        expect(css, `${font.family} ${weight} 없음`).toContain(`font-weight: ${weight};`);
      }
      // @font-face 개수 = 요청 weight 개수 (Next는 variant마다 한 벌을 기대한다)
      expect(css.match(/@font-face/g)).toHaveLength(font.weights.length || 1);
    }
  });

  it('find-font-files-in-css 계약 — 서브셋 주석이 각 @font-face 바로 위에 온다', () => {
    const css = mock[googleUrl(DECLARED[0])];
    for (const block of css.split('@font-face').slice(0, -1)) {
      expect(block.trimEnd().endsWith('/* latin */')).toBe(true);
    }
  });

  it('fetch-font-file 계약 — src는 fs로 읽히는 절대 경로다', () => {
    const css = mock[googleUrl(DECLARED[0])];
    const src = /src: url\((.+?)\)/.exec(css);
    expect(src[1].startsWith('/')).toBe(true);
    expect(src[1]).toMatch(/\.woff2$/);
  });

  it('가변 축 범위 요청도 유효한 CSS로 옮긴다', () => {
    const css = mock['https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap'];
    expect(css).toContain("font-family: 'Inter';");
    expect(css).toContain('font-weight: 100 900;');
  });

  it('이탤릭 축을 style로 옮긴다', () => {
    const css = mock['https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;1,400&display=swap'];
    expect(css).toContain('font-style: normal;');
    expect(css).toContain('font-style: italic;');
  });

  it('Google CSS 요청이 아니면 응답하지 않는다', () => {
    expect(mock['https://example.com/whatever']).toBeUndefined();
    expect(mock['https://fonts.gstatic.com/s/x/y.woff2']).toBeUndefined();
  });
});
