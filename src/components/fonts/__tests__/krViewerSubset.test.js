import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SUBSETS, extractSubsetHangul, sliceBlock, sourceFiles } from '../../../../scripts/fonts/kr-viewer-chars.mjs';

// KR-VIEWER-SUBSET-001 · VOCAB-SUBSET-SMALL-001 — 첫 화면 UI 한글 하위 집합(next/font Noto Sans KR과 같은 판 · 윤곽선). 화면마다 따로다:
// 뷰어(뷰어 UI 전부) · 복습실(셸 + 손님 블록). CI는 원본 글꼴 없이 커밋된 산출물만 본다.
// 실패하면: python3 -m pip install fonttools brotli && python3 scripts/fonts/kr-viewer-subset.py (원본은 저장소 밖 캐시로 받아 sha256 확인).
const ROOT = process.cwd();
const DIR = path.join(ROOT, 'src/components/fonts/kr-viewer');
const PUBLIC = path.join(ROOT, 'public/fonts/kr-viewer');
const REGEN = 'python3 scripts/fonts/kr-viewer-subset.py 로 다시 만든다(fonttools · brotli 필요)';
// 하위 집합 → 싣는 모듈(미리 받기 함수) — 세그먼트 레이아웃이 부른다.
const HELPERS = {
  viewer: { module: 'KrUiSubset', fn: 'preloadKrUiSubset' },
  vocab: { module: 'KrVocabSubset', fn: 'preloadKrVocabSubset' },
};
// 미리 받는 바이트는 첫 그림 전 대역을 렌더 차단 CSS와 나눈다(1.6Mbps에서 52KB ≈ FCP +0.26s) — 크기 상한으로 묶는다.
const MAX_BYTES = { viewer: 80 * 1024, vocab: 24 * 1024 };
const NAMES = Object.keys(SUBSETS);
const metaOf = (name) => JSON.parse(fs.readFileSync(path.join(DIR, SUBSETS[name].json), 'utf8'));
const cssOf = (name) => fs.readFileSync(path.join(DIR, SUBSETS[name].css), 'utf8');

const expandRange = (text) => text.split(',').flatMap((part) => {
  const [a, b] = part.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16));
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
});

describe('첫 화면 한글 하위 집합 — 목록 · 산출물 · 배선', () => {
  it('하위 집합은 뷰어 · 복습실 둘이고, 싣는 모듈이 하나씩 있다', () => {
    expect(NAMES.sort()).toEqual(Object.keys(HELPERS).sort());
  });

  it.each(NAMES)('%s: 출처 UI 문자열의 한글은 모두 커밋된 목록 안에 있다(문구가 바뀌면 재생성)', (name) => {
    const meta = metaOf(name);
    const extracted = extractSubsetHangul(name);
    expect(extracted.length).toBeGreaterThan(name === 'viewer' ? 300 : 80); // 공허 통과 방지
    const outside = extracted.filter((ch) => !meta.chars.includes(ch));
    expect(outside, `목록 밖 글자 ${outside.join('')} — ${REGEN}`).toEqual([]);
  });

  it('뷰어 출처는 뷰어 화면 · 부품 · 문구표 · 셸, 복습실 출처는 셸 + VocabPage 손님 블록(로그인 화면 글자는 넣지 않는다)', () => {
    const viewer = sourceFiles(ROOT, 'viewer');
    expect(viewer.length).toBeGreaterThan(10);
    expect(viewer).toContain('src/views/ViewerPage.jsx');
    expect(viewer).toContain('src/components/Layout.jsx');
    expect(viewer).not.toContain('src/views/VocabPage.jsx'); // 복습실은 제 하위 집합 — 뷰어 파일을 키우지 않는다
    expect(sourceFiles(ROOT, 'vocab')).toEqual(['src/components/Layout.jsx', 'src/lib/webNavigation.js', 'src/views/VocabPage.jsx']);
    const page = fs.readFileSync(path.join(ROOT, 'src/views/VocabPage.jsx'), 'utf8');
    const block = sliceBlock(page, 'vocab-guest', 'VocabPage.jsx');
    expect(block).toContain('review-guest'); // 손님 첫 화면 마크업이 표식 안에 있다
    expect(block).toContain('로그인하고 단어장 쓰기');
    expect(block).not.toContain('<VocabList'); // 로그인 복습실(클라이언트 그림)은 밖
    expect(() => sliceBlock(`${page}\n// kr-subset:vocab-guest:begin`, 'vocab-guest')).toThrow(); // 표식은 정확히 한 쌍
  });

  it.each(NAMES)('%s: woff2는 목록과 함께 만든 그 파일이다(sha256 · 크기 · 이름 = 내용 해시 앞 16자) · 작다', (name) => {
    const meta = metaOf(name);
    const { stem } = SUBSETS[name];
    expect(meta.woff2.href).toBe(`/fonts/kr-viewer/${stem}.${meta.woff2.sha256.slice(0, 16)}.woff2`);
    const buf = fs.readFileSync(path.join(ROOT, 'public', meta.woff2.href));
    expect(crypto.createHash('sha256').update(buf).digest('hex'), REGEN).toBe(meta.woff2.sha256);
    expect(buf.length).toBe(meta.woff2.bytes);
    expect(buf.subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(buf.length).toBeLessThan(MAX_BYTES[name]);
  });

  it('public/fonts/kr-viewer에는 하위 집합마다 지금 판 하나씩만 있다(옛 판이 남지 않는다)', () => {
    const files = fs.readdirSync(PUBLIC).filter((f) => f.endsWith('.woff2')).sort();
    expect(files).toEqual(NAMES.map((n) => path.basename(metaOf(n).woff2.href)).sort());
  });

  it.each(NAMES)('%s: CSS unicode-range = 목록의 글자 정확히 · family · 굵기 셋 · swap이 next/font Noto Sans KR과 맞물린다', (name) => {
    const meta = metaOf(name);
    const css = cssOf(name);
    const faces = [...css.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]);
    expect(faces.map((f) => /font-weight:(\d+);/.exec(f)?.[1])).toEqual(['400', '500', '700']); // next/font와 같은 굵기 선언 — 범위 선언은 중간 굵기를 다르게 그린다
    for (const face of faces) {
      const range = /unicode-range:(.+)$/.exec(face)[1];
      expect(new Set(expandRange(range))).toEqual(new Set([...meta.chars].map((c) => c.codePointAt(0))));
    }
    expect(meta.count).toBe([...meta.chars].length);
    expect(css).toContain("@font-face{font-family:'Noto Sans KR';font-style:normal;font-weight:400;font-display:swap;");
    expect(css).toContain(`src:url(${meta.woff2.href}) format('woff2')`);
  });

  it('같은 family · 굵기를 묶음이 덮는다 — 루트 next/font 선언 · 원본은 판 고정(sha256 · 판 이름) · 저장소에는 원본 TTF를 두지 않는다', () => {
    const root = fs.readFileSync(path.join(ROOT, 'src/app/layout.jsx'), 'utf8');
    expect(root).toMatch(/Noto_Sans_KR\(\{[\s\S]*?weight: \['400', '500', '700'\][\s\S]*?\}\)/);
    const script = fs.readFileSync(path.join(ROOT, 'scripts/fonts/kr-viewer-subset.py'), 'utf8');
    for (const name of NAMES) {
      const meta = metaOf(name);
      expect(meta.source.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(meta.source.version).toBe('Version 2.004-H2;hotconv 1.0.118;makeotfexe 2.5.65603');
      expect(script).toContain(`SOURCE_SHA256 = '${meta.source.sha256}'`);
    }
    expect(script).toContain("options.drop_tables += ['GDEF', 'prep']"); // Google 조각과 같은 표 구성(힌팅 없음)
    expect(script).toContain('font.recalcTimestamp = False'); // 결정적 산출 — 같은 입력이면 같은 해시 이름
    expect(script).toContain("'kr-viewer-chars.mjs'), '--json'"); // 하위 집합 전부를 한 번에 다시 만든다
    expect(fs.readdirSync(DIR).filter((f) => /\.(ttf|otf)$/i.test(f))).toEqual([]);
    expect(fs.existsSync(path.join(DIR, 'OFL.txt'))).toBe(true);
  });

  it('싣는 레이아웃이 첫 그림 전에 미리 받는다(늦게 오면 줄이 다시 흐른다 — CLS) · 1년 immutable · SW가 배포 사이에 옮긴다', async () => {
    for (const name of NAMES) {
      const { module, fn } = HELPERS[name];
      const helper = fs.readFileSync(path.join(DIR, `${module}.js`), 'utf8');
      expect(helper, module).toContain(`import './${SUBSETS[name].css}';`);
      expect(helper, module).toContain(`import subset from './${SUBSETS[name].json}';`);
      expect(helper, module).toContain(`export function ${fn}() {\n  preload(subset.woff2.href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });`);
      const layout = fs.readFileSync(path.join(ROOT, `src/app/(app)/${SUBSETS[name].segment}/layout.jsx`), 'utf8');
      expect(layout, name).toContain(`import { ${fn} } from '@/components/fonts/kr-viewer/${module}';`);
      expect(layout, name).toMatch(new RegExp(`export default function Layout\\(\\{ children \\}\\) \\{[\\s\\S]*?${fn}\\(\\);`));
    }
    const { default: config } = await import('../../../../next.config.mjs');
    const rule = (await config.headers()).find((r) => r.source === '/fonts/kr-viewer/:path*');
    expect(rule?.headers).toEqual([{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]);
    expect(fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8')).toMatch(/const FONT_ASSET = [^\n]*fonts\\\/kr-viewer/);
  });

  it('하위 집합을 싣는 곳은 그 세그먼트 레이아웃뿐이다(글자 목록 출처와 짝 — 다른 화면은 지금처럼 원래 조각)', () => {
    const users = {};
    const pattern = new RegExp(NAMES.map((n) => `${SUBSETS[n].css.replace('.', '\\.')}|kr-viewer/${HELPERS[n].module}\\b`).join('|'), 'g');
    const walk = (dir) => {
      for (const n of fs.readdirSync(dir)) {
        const p = path.join(dir, n);
        if (fs.statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '__tests__') walk(p); continue; }
        if (!/\.(jsx?|mjs|css)$/.test(n)) continue;
        const rel = path.relative(ROOT, p);
        if (rel.startsWith('src/components/fonts/kr-viewer/')) continue;
        for (const m of fs.readFileSync(p, 'utf8').match(pattern) || []) (users[rel] ||= new Set()).add(m.replace(/^kr-viewer\//, ''));
      }
    };
    walk(path.join(ROOT, 'src'));
    const seen = Object.fromEntries(Object.entries(users).map(([f, s]) => [f, [...s].sort()]));
    expect(seen).toEqual(Object.fromEntries(NAMES.map((n) => [`src/app/(app)/${SUBSETS[n].segment}/layout.jsx`, [HELPERS[n].module]])));
  });
});
