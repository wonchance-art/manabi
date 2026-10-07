// VIEWER-R0-BUGS-001 버그 3a — 문형 카드 「챕터로 →」가 보관된 옛 교재로 가 홈으로 튕기던 결함.
// 실제 인덱스가 만든 항목을 그대로 그려, 링크 대신 보관 안내가 나오고 설명 언어 구조를 따르는지 본다.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PatternCard from '../PatternCard';
import { ViewerUiLocaleProvider } from '../../lib/viewerLocaleContext';
import { loadPatternIndex } from '../../lib/patternIndex';
import { legacyTextbookTarget } from '../../lib/bookNavigation';

const hrefs = markup => [...markup.matchAll(/href="([^"]+)"/g)].map(match => match[1].replace(/&amp;/g, '&'));

async function hitFor(language, kernel) {
  const index = await loadPatternIndex(language);
  const patterns = index.get(kernel);
  expect(patterns?.some(pattern => pattern.ch), `${language} ${kernel}`).toBe(true);
  return { kernel, patterns };
}

describe('문형 카드는 보관된 챕터 대신 이유를 보인다', () => {
  it.each([['Chinese', '比'], ['Chinese', '把'], ['Japanese', 'ながら']])('%s %s: 옛 교재 링크 0, 보관 안내 표시', async (language, kernel) => {
    const markup = renderToStaticMarkup(<PatternCard hit={await hitFor(language, kernel)} />);
    expect(hrefs(markup).filter(href => legacyTextbookTarget(href.replace(/[?#].*$/s, '')) !== null)).toEqual([]);
    expect(markup).not.toContain('챕터로 →');
    expect(markup).toContain('보관된 교재라 열 수 없어요');
  });

  it.each([['zh-CN', '这是已归档的教材，无法打开'], ['zh-TW', '這是已封存的教材，無法開啟']])('%s 화면 언어로 안내한다', async (locale, text) => {
    const markup = renderToStaticMarkup(
      <ViewerUiLocaleProvider value={locale}><PatternCard hit={await hitFor('Chinese', '比')} /></ViewerUiLocaleProvider>,
    );
    expect(markup).toContain(text);
  });

  it('공개 주소가 있는 문형은 기존 「챕터로 →」 링크를 그대로 그린다', () => {
    const hit = { kernel: '把', patterns: [{ id: 'x', level: 'H3', pattern: '把 + O + V', ch: 'h3-01-ba', href: '/books/japanese-n5#u01' }] };
    const markup = renderToStaticMarkup(<PatternCard hit={hit} />);
    expect(markup).toContain('href="/books/japanese-n5#u01"');
    expect(markup).toContain('챕터로 →');
    expect(markup).not.toContain('보관된 교재라 열 수 없어요');
  });

  it('챕터가 없는 문형에는 링크도 안내도 없다', () => {
    const markup = renderToStaticMarkup(<PatternCard hit={{ kernel: '把', patterns: [{ id: 'y', level: 'H3', pattern: '把', ch: null, href: null }] }} />);
    expect(markup).not.toContain('챕터로 →');
    expect(markup).not.toContain('보관된 교재라 열 수 없어요');
  });
});
