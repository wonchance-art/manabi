import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { measurePinyinCell, watchPinyinCell } from '../../lib/pinyinLayout';

/**
 * 계약 VIEWER-RENDER-001 — 본문이 처음 그려지는 일(같은 작업 안)에서 본문 낱말 전부의 스타일 · 배치를 되풀이하지 않는다.
 * 실측(2026-11-01 KST, 로컬 production · 390×844 · CPU×4, 중국어 1,280낱말): 본문이 붙는 작업 하나가 약 1.0초였고 그 안에서
 * 낱말 3,300여 개의 스타일 재계산이 두 번 더 돌았다(각 약 0.12초 + 배치). 원인은 둘 다 그린 뒤 바뀌는 상속 사용자 속성이었다.
 *   ⑴ --pinyin-cell(병음 칸, .viewer-layout에서 상속) — 효과에서 재 44px → 실제 값으로 바뀌었다. 본문을 처음 그리는 렌더에서 같은 함수로
 *      미리 잰다(하이드레이션 렌더는 서버 값 그대로 — 서버가 본문을 실은 문서는 지금처럼 효과가 고친다).
 *   ⑵ --reader-page-height(쪽 높이) — 상자 자신만 읽으므로 상속하지 않게 등록한다(@property). 바꿔도 상자만 다시 계산한다(실측 134ms → 25ms).
 */
const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');

function cssFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '__tests__') out.push(...cssFiles(rel)); }
    else if (/\.(css|jsx?|mjs)$/.test(e.name)) out.push(rel);
  }
  return out;
}

describe('⑵ 쪽 높이 변수는 상속하지 않는다', () => {
  it('@property로 등록 — 값이 없으면 var()의 대체값(지금 그대로)', () => {
    const css = read('src/components/viewer/paged-reader.css');
    expect(css).toContain("@property --reader-page-height { syntax: '*'; inherits: false; }");
    expect(css).toContain('height: var(--reader-page-height, calc(100dvh - 180px));');
  });
  it('읽는 곳은 상자 자신 한 곳뿐이다 — 자손이 읽으면 상속하지 않는 변수라 값을 못 받는다', () => {
    const readers = cssFiles('src').flatMap((f) => (read(f).match(/var\(--reader-page-height/g) || []).map(() => f));
    expect(readers).toEqual(['src/components/viewer/paged-reader.css']);
    // 그 한 곳은 상자 규칙(자손 선택자 아님) 안이다.
    expect(read('src/components/viewer/paged-reader.css')).toMatch(/\n\[data-reader-pages="paged"\] \{[^}]*height: var\(--reader-page-height,/);
  });
});

describe('⑴ 병음 칸은 본문을 처음 그리는 렌더에서 잰다', () => {
  it('하이드레이션이 끝난 뒤의 렌더에서만, 글자 · 병음 크기마다 한 번, 같은 measurePinyinCell로', () => {
    expect(viewer).toContain("const pinyinPrimeKey = materialLang === 'Chinese' && hydrated.current ? `${fontSize}|${pinyinSize}` : '';");
    expect(viewer).toContain('useEffect(() => { hydrated.current = true; }, []);');
    expect(viewer).toContain('const cell = measurePinyinCell({win:window,doc:document,root:()=>readerRef.current,pinyinRem:pinyinSize,fontRem:fontSize});');
    expect(viewer).toContain('if (cell != null && cell !== pinyinCell) setPinyinCell(cell);');
    // 다시 재는 때(글꼴 조각 · 창 크기)는 그대로 watchPinyinCell.
    expect(viewer).toContain('watchPinyinCell({win:window,doc:document,root:()=>readerRef.current');
    expect(read('src/lib/pinyinLayout.js')).toContain('const cell = measurePinyinCell({ win, doc, root, pinyinRem, fontRem });');
  });
  it('미리 잰 값 = 효과가 처음 재는 값(같은 계산)', () => {
    const doc = {
      documentElement: { fontSize: '16px' }, body: { vars: { '--font-noto-sans': "'Noto Sans'" } },
      createElement: () => ({ getContext: () => ({ font: '', measureText: (text) => ({ width: text.length * 6.25 }) }) }),
      fonts: { ready: new Promise(() => {}), load: () => new Promise(() => {}) },
    };
    const win = { getComputedStyle: (node) => ({ fontSize: node.fontSize || '16px', getPropertyValue: (name) => node.vars?.[name] ?? '' }), addEventListener() {}, removeEventListener() {} };
    const args = { win, doc, root: () => null, pinyinRem: 0.75, fontRem: 1.6 };
    const cells = [];
    const stop = watchPinyinCell({ ...args, onCell: (cell) => cells.push(cell) });
    stop();
    expect(cells).toEqual([measurePinyinCell(args)]);
    expect(measurePinyinCell({ ...args, doc: { ...doc, createElement: () => ({}) } })).toBeNull();
  });
});
