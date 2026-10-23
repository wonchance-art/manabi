import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { READER_DARK_PAPER, applyThemeColor, readerThemeColor } from '../themeColor';

// PWA-SHELL-001 ⑩ — 어두운 읽기 테마에서 휴대폰 표시줄 · 주소창 색 = 어두운 머리(GNB)와 같은 --reader-paper.
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

function fakeDoc(content) {
  const attrs = { content };
  const meta = { getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
  return { doc: { querySelector: (sel) => (sel === 'meta[name="theme-color"]' && content !== undefined ? meta : null) }, attrs };
}

describe('applyThemeColor', () => {
  it('바꾸고, 되돌리면 원래 값(셸 종이)으로', () => {
    const { doc, attrs } = fakeDoc('#F6F4EE');
    const restore = applyThemeColor(doc, READER_DARK_PAPER);
    expect(attrs.content).toBe('#202625');
    restore();
    expect(attrs.content).toBe('#F6F4EE');
  });

  it('색이 없으면(종이 · 밝게) 손대지 않는다 · meta가 없어도 깨지지 않는다', () => {
    const { doc, attrs } = fakeDoc('#F6F4EE');
    applyThemeColor(doc, readerThemeColor('paper'))();
    applyThemeColor(doc, readerThemeColor('light'))();
    expect(attrs.content).toBe('#F6F4EE');
    expect(() => applyThemeColor(fakeDoc(undefined).doc, READER_DARK_PAPER)()).not.toThrow();
  });

  it('그사이 다른 화면이 색을 바꿨으면 되돌리기가 덮어쓰지 않는다', () => {
    const { doc, attrs } = fakeDoc('#F6F4EE');
    const restore = applyThemeColor(doc, READER_DARK_PAPER);
    attrs.content = '#123456';
    restore();
    expect(attrs.content).toBe('#123456');
  });
});

describe('값 · 배선', () => {
  it('READER_DARK_PAPER = 어두운 읽기 테마의 --reader-paper(CSS 정본)', () => {
    const css = read('src/components/viewer/reader-controls.css');
    const m = css.match(/\.viewer-layout\[data-reader-theme="dark"\],[^{]*\{\s*--reader-paper:(#[0-9a-fA-F]{6})/);
    expect(m, '어두운 읽기 테마 --reader-paper를 찾지 못했다').not.toBeNull();
    expect(READER_DARK_PAPER.toLowerCase()).toBe(m[1].toLowerCase());
  });

  it('어두운 테마는 머리(GNB)도 같은 색으로 칠한다 — 그래서 표시줄도 맞춘다', () => {
    expect(read('src/components/viewer/reader-controls.css')).toMatch(/\.manabi-app:has\(\.viewer-layout\[data-reader-theme="dark"\]\) > \.gnb \{[^}]*--gnb-bg:var\(--reader-paper\)/);
  });

  it('뷰어가 읽기 테마마다 적용하고 떠날 때 되돌린다(effect 정리 함수)', () => {
    expect(read('src/views/ViewerPage.jsx')).toContain('useEffect(() => applyThemeColor(document, readerThemeColor(theme)), [theme]);');
  });
});
