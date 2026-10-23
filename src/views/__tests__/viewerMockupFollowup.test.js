import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { longHeadSplitAt } from '../../lib/fitWord';

/**
 * 계약: 뷰어 점검 이미지 목업 E · F 승인분(오너 「권장안대로」 2026-10-23 KST).
 *   E1 본문 병음 글자마다 · E2 긴 표제어 줄이기/반씩 나누기 · E3 훈 칸 상한 · F1/F3 글자 rem 6단계 · 모서리 4/8/12 · F4 최소 크기.
 */
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const VIEWER_CSS = ['reader-controls.css', 'art-card.css', 'paged-reader.css', 'sentence-move-bar.css'].map((f) => [f, read(`src/components/viewer/${f}`)]);

describe('뷰어 목업 E · F 후속', () => {
  it('E1 본문 낱말도 붙여 쓴 병음을 글자마다 나눈다(카드와 같은 pinyinPerChar)', () => {
    expect(read('src/components/viewer/ReaderToken.jsx')).toContain('pinyinPerChar(token.text, token.furigana) ?? token.furigana');
    expect(read('src/views/ViewerPage.jsx')).toContain('const perCharPy = headReading ? pinyinPerChar(headText, headReading) : null;');
  });
  it('E2 6자 이상만 맞춤 대상 — 앞줄이 한 글자 더 긴 반 나눔(中华人民 / 共和国)', () => {
    expect(longHeadSplitAt(5)).toBe(-1);
    expect(longHeadSplitAt(6)).toBe(3);
    expect(longHeadSplitAt(7)).toBe(4);
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("ref={splitAt > 0 ? setLongHead : undefined}");
    expect(viewer).toContain('useLayoutEffect(() => { fitLongHeadword(longHeadRef.current); });');
    expect(read('src/lib/fitWord.js')).toContain('export const LONG_HEAD_MIN_PX = 22;');
  });
  it('E3 뷰어 카드 훈 칸은 표제어 글자의 2배(64px)까지 · 이웃 훈 사이 8px', () => {
    expect(read('src/views/ViewerPage.jsx')).toContain('const HUN_RUBY_CELL = Object.freeze({ glyphPx: 49.6, maxSpreadRatio: 64 / 49.6 });');
    const css = read('src/components/viewer/reader-controls.css');
    expect(css).toMatch(/\.word-fit__hun \{[^}]*padding:0 \.25rem;/);
    expect(css).toMatch(/\.word-fit__hunrow \{[^}]*gap:\.5rem;/);
  });
  it('F1 뷰어 글자 크기는 rem — px 고정은 고정 높이 한자 창(.hanja-pop)만', () => {
    for (const [file, css] of VIEWER_CSS) {
      const px = css.split('\n').filter((l) => /font-size:\s*[0-9.]+px/.test(l) && !l.includes('.hanja-pop'));
      expect(px, file).toEqual([]);
    }
  });
  it('F3 모서리는 4 · 8 · 12px(+ 알약 999px)', () => {
    for (const [file, css] of VIEWER_CSS) {
      const odd = [...css.matchAll(/border-radius:\s*([^;}]+)/g)].flatMap((m) => m[1].match(/[0-9.]+px/g) || []).filter((v) => !['4px', '8px', '12px', '999px', '0px'].includes(v));
      expect(odd, file).toEqual([]);
    }
  });
  it('F4 후리가나 10px 하한 · 병음은 본문 0.6배 이하', () => {
    const css = read('src/components/viewer/reader-controls.css');
    expect(css).toContain('ruby[data-yomi] > .rt-an {font-size:max(.5em,.625rem);}');
    expect(css).toContain('ruby[data-pinyin] > .rt-an {font-size:min(var(--pinyin-size),.6em);}');
  });
});

describe('E5 글자 카드 자형 칩', () => {
  it('가로 한 줄 · 높이 28px · 폭 44px 이상', () => {
    const css = read('src/components/viewer/reader-controls.css');
    expect(css).toContain('.viewer-layout .viewer-inspector .char-inspect__ja {display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}');
    expect(css).toMatch(/\.viewer-layout \.viewer-inspector \.char-inspect__form \{[^}]*min-height:28px;height:28px;min-width:44px;/);
  });
});
