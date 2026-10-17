import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약: 번체 글꼴(Noto Sans TC)은 번체를 그리는 화면에만 싣는다 (FONT-TC-SCOPE-001, 2026-10-17 KST).
 *
 * 루트 레이아웃이 CJK 4종을 걸어 모든 페이지 head CSS에 TC @font-face 325개(운영 gz 36KB, 렌더 차단)가 실렸다.
 * 번체(zh-TW · zh-Hant-TW)를 그리는 곳은 뷰어(UI · 해설 언어 zh-TW, 자형 열 正, 한자 창)와 중국어 레벨 목록(正 표기)이다.
 * 지역 없는 zh-Hant(HanziBoard · refShared)는 index.css 규칙상 :lang(zh) = SC로 그린다 — TC 대상이 아니다.
 *
 * 지키는 것: ① 루트는 TC를 걸지 않는다 ② 번체 화면의 라우트는 TC를 거는 세그먼트 안에 있다
 * ③ --font-noto-tc를 쓰는 곳은 모두 폴백을 둔다 — 범위 밖(숨긴 수업 화면 등)에서도 선언이 통째로 무효가 되지 않는다.
 */
const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const walk = (dir, out = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|jsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
};

const SCOPE = 'src/components/fonts/TcFontScope.jsx';
// TC를 거는 세그먼트 — 번체를 그리는 보이는 화면.
const TC_SEGMENTS = ['src/app/(app)/viewer', 'src/app/(app)/pdf', 'src/app/(app)/suggestions', 'src/app/(app)/chinese'];
// 번체를 그리는 화면 부품 — 이것을 여는 라우트는 TC 세그먼트 안에 있어야 한다.
const TC_SCREENS = ['@/views/ViewerPage', '@/views/PdfViewerPage', '@/components/materials/SuggestionReader', '@/views/levelListRoute'];
// 범위 밖으로 둔 라우트 — 이유와 함께. 여기서는 CSS 폴백(③)으로 시스템 TC · KR 글꼴에 떨어진다.
const OUTSIDE = Object.freeze({
  'src/app/(app)/japanese': '일본어 레벨 목록 — LevelListPage의 正(zh-TW) 줄은 중국어 자료에만 나온다',
});

describe('번체 글꼴 범위 — Noto Sans TC', () => {
  const files = walk(path.join(ROOT, 'src'));
  const rel = (p) => path.relative(ROOT, p).replaceAll('\\', '/');

  it('① 루트 레이아웃은 Noto Sans TC를 걸지 않는다', () => {
    const root = read('src/app/layout.jsx');
    expect(root).not.toMatch(/Noto_Sans_TC|notoTc|--font-noto-tc/);
    expect(root).toContain('Noto_Sans_SC'); // SC는 이번 범위가 아니다 — 그대로 루트.
  });

  it('TC는 범위 부품 한 곳에서 정의하고, 번체 세그먼트 레이아웃이 그것으로 감싼다', () => {
    const scope = read(SCOPE);
    expect(scope).toContain('Noto_Sans_TC(');
    expect(scope).toContain("variable: '--font-noto-tc'");
    expect(scope).toContain("style={{ display: 'contents' }}");
    const definers = files.filter(f => /Noto_Sans_TC\(/.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(definers).toEqual([SCOPE]);
    for (const seg of TC_SEGMENTS) {
      const layout = read(`${seg}/layout.jsx`);
      expect(layout, seg).toContain("import TcFontScope from '@/components/fonts/TcFontScope'");
      expect(layout, seg).toContain('<TcFontScope>{children}</TcFontScope>');
    }
  });

  it('② 번체 화면을 여는 라우트는 TC 세그먼트 안에 있다', () => {
    const routes = files.filter(f => rel(f).startsWith('src/app/') && /\/(page|layout)\.jsx$/.test(f));
    const hits = routes.filter(f => TC_SCREENS.some(m => fs.readFileSync(f, 'utf8').includes(`from '${m}'`))).map(rel);
    expect(hits.length).toBeGreaterThanOrEqual(4); // viewer · pdf · suggestions · chinese 레벨(공허 통과 방지)
    const outside = hits.filter(f => !TC_SEGMENTS.some(seg => f.startsWith(`${seg}/`)) && !Object.keys(OUTSIDE).some(o => f.startsWith(`${o}/`)));
    expect(outside, '번체 화면이 TC 범위 밖 라우트에서 열린다 — TC_SEGMENTS에 넣거나 OUTSIDE에 이유를 적는다').toEqual([]);
  });

  it('③ --font-noto-tc를 쓰는 곳은 모두 폴백이 있다(범위 밖에서 font-family가 무효가 되지 않게)', () => {
    const uses = files.flatMap(f => (fs.readFileSync(f, 'utf8').match(/var\(--font-noto-tc[^)]*\)/g) || []).map(u => `${rel(f)}: ${u}`));
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter(u => !/var\(--font-noto-tc,\s*'Noto Sans TC'\)/.test(u))).toEqual([]);
  });

  it('범위 밖 목록의 경로는 실제로 있고 이유가 있다', () => {
    for (const [dir, reason] of Object.entries(OUTSIDE)) {
      expect(fs.existsSync(path.join(ROOT, dir)), dir).toBe(true);
      expect(reason.length, dir).toBeGreaterThan(10);
    }
  });
});
