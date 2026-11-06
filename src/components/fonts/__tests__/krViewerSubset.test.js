import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { extractViewerHangul, sourceFiles } from '../../../../scripts/fonts/kr-viewer-chars.mjs';

// KR-VIEWER-SUBSET-001 — 뷰어 UI 한글 하위 집합(next/font Noto Sans KR과 같은 판 · 윤곽선). CI는 원본 글꼴 없이 커밋된 산출물만 본다.
// 실패하면: python3 -m pip install fonttools brotli && python3 scripts/fonts/kr-viewer-subset.py (원본은 저장소 밖 캐시로 받아 sha256 확인).
const ROOT = process.cwd();
const DIR = path.join(ROOT, 'src/components/fonts/kr-viewer');
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'subset.json'), 'utf8'));
const css = fs.readFileSync(path.join(DIR, 'krViewerSubset.css'), 'utf8');
const REGEN = 'python3 scripts/fonts/kr-viewer-subset.py 로 다시 만든다(fonttools · brotli 필요)';

const expandRange = (text) => text.split(',').flatMap((part) => {
  const [a, b] = part.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16));
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
});

describe('뷰어 한글 하위 집합 — 목록 · 산출물 · 배선', () => {
  it('뷰어 · 셸 UI 문자열의 한글은 모두 커밋된 목록 안에 있다(문구가 바뀌면 재생성)', () => {
    expect(sourceFiles().length).toBeGreaterThan(10); // 공허 통과 방지
    const extracted = extractViewerHangul();
    expect(extracted.length).toBeGreaterThan(300);
    const outside = extracted.filter((ch) => !meta.chars.includes(ch));
    expect(outside, `목록 밖 글자 ${outside.join('')} — ${REGEN}`).toEqual([]);
  });

  it('woff2는 목록과 함께 만든 그 파일이다(sha256 · 크기 · 이름 = 내용 해시 앞 16자) · 50KB대로 작다', () => {
    expect(meta.woff2.href).toBe(`/fonts/kr-viewer/noto-sans-kr-viewer.${meta.woff2.sha256.slice(0, 16)}.woff2`);
    const buf = fs.readFileSync(path.join(ROOT, 'public', meta.woff2.href));
    expect(crypto.createHash('sha256').update(buf).digest('hex'), REGEN).toBe(meta.woff2.sha256);
    expect(fs.readdirSync(path.join(ROOT, 'public/fonts/kr-viewer')).filter((f) => f.endsWith('.woff2')), '옛 판이 남지 않는다').toEqual([path.basename(meta.woff2.href)]);
    expect(buf.length).toBe(meta.woff2.bytes);
    expect(buf.subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(buf.length).toBeLessThan(80 * 1024);
  });

  it('CSS unicode-range = 목록의 글자 정확히 · family · 굵기 범위 · swap이 next/font Noto Sans KR과 맞물린다', () => {
    const faces = [...css.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]);
    expect(faces.map((f) => /font-weight:(\d+);/.exec(f)?.[1])).toEqual(['400', '500', '700']); // next/font와 같은 굵기 선언 — 범위 선언은 중간 굵기를 다르게 그린다
    for (const face of faces) {
      const range = /unicode-range:(.+)$/.exec(face)[1];
      expect(new Set(expandRange(range))).toEqual(new Set([...meta.chars].map((c) => c.codePointAt(0))));
    }
    expect(meta.count).toBe([...meta.chars].length);
    expect(css).toContain("@font-face{font-family:'Noto Sans KR';font-style:normal;font-weight:400;font-display:swap;");
    expect(css).toContain(`src:url(${meta.woff2.href}) format('woff2')`);
    const root = fs.readFileSync(path.join(ROOT, 'src/app/layout.jsx'), 'utf8');
    expect(root).toMatch(/Noto_Sans_KR\(\{[\s\S]*?weight: \['400', '500', '700'\][\s\S]*?\}\)/); // 같은 family · 굵기를 묶음이 덮는다
  });

  it('원본은 판 고정(sha256 · 판 이름) — 저장소에는 원본 TTF를 두지 않는다', () => {
    expect(meta.source.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(meta.source.version).toBe('Version 2.004-H2;hotconv 1.0.118;makeotfexe 2.5.65603');
    const script = fs.readFileSync(path.join(ROOT, 'scripts/fonts/kr-viewer-subset.py'), 'utf8');
    expect(script).toContain(`SOURCE_SHA256 = '${meta.source.sha256}'`);
    expect(script).toContain("options.drop_tables += ['GDEF', 'prep']"); // Google 조각과 같은 표 구성(힌팅 없음)
    expect(script).toContain('font.recalcTimestamp = False'); // 결정적 산출 — 같은 입력이면 같은 해시 이름
    expect(fs.readdirSync(DIR).filter((f) => /\.(ttf|otf)$/i.test(f))).toEqual([]);
    expect(fs.existsSync(path.join(DIR, 'OFL.txt'))).toBe(true);
  });

  it('뷰어 레이아웃이 첫 그림 전에 미리 받는다(늦게 오면 상단 막대가 밀린다 — CLS) · 1년 immutable · SW가 배포 사이에 옮긴다', async () => {
    const layout = fs.readFileSync(path.join(ROOT, 'src/app/(app)/viewer/layout.jsx'), 'utf8');
    expect(layout).toContain("preload(krViewerSubset.woff2.href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });");
    const { default: config } = await import('../../../../next.config.mjs');
    const rule = (await config.headers()).find((r) => r.source === '/fonts/kr-viewer/:path*');
    expect(rule?.headers).toEqual([{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]);
    expect(fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8')).toMatch(/const FONT_ASSET = [^\n]*fonts\\\/kr-viewer/);
  });

  it('뷰어 세그먼트에만 싣는다(다른 화면은 지금처럼 원래 조각)', () => {
    const importers = [];
    const walk = (dir) => { for (const n of fs.readdirSync(dir)) { const p = path.join(dir, n); if (fs.statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '__tests__') walk(p); } else if (/\.(jsx?|mjs|css)$/.test(n) && fs.readFileSync(p, 'utf8').includes('krViewerSubset.css')) importers.push(path.relative(ROOT, p)); } };
    walk(path.join(ROOT, 'src'));
    expect(importers.filter((f) => !f.startsWith('src/components/fonts/kr-viewer/'))).toEqual(['src/app/(app)/viewer/layout.jsx']);
  });
});
