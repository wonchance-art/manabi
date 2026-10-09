// VIEWER-R0-BUGS-001 버그 3b — 복습 카드 「원문 열기」가 보관된 옛 교재로 가 홈으로 튕기던 결함의 화면 계약.
// API가 내려주는 보관 문맥(archived, href 없음)은 문장을 지우지 않고 링크 대신 이유를 보이며,
// 새 책·자료 문맥의 원문 귀환 링크는 그대로 남는다.
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member-1' } }) }));
import VocabularyContexts from '../learning/VocabularyContexts';
import { legacyTextbookTarget } from '../../lib/bookNavigation';

const EDITION = '8a8c1c1fd452773810abaf8c';
const VOCAB = '30000000-0000-4000-8000-000000000001';
const archived = { id: 'c-ja', kind: 'textbook', lang: 'Japanese', chapter_slug: 'n5-04-desu-da', quote: 'わたしは がくせいです。', translation: '나는 학생입니다.', locator: {}, href: null, archived: true };
const book = { id: 'c-book', kind: 'textbook', lang: 'Japanese', chapter_slug: 'n5-book-u03', quote: 'ちちは がくせいです。', locator: { bookId: 'japanese-n5', editionId: EDITION, pageId: 'u03-study1' }, href: `/books/japanese-n5?edition=${EDITION}#u03-study1` };

function render(contexts, word) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['vocabulary-contexts', 'member-1', VOCAB], contexts);
  return renderToStaticMarkup(<QueryClientProvider client={client}><VocabularyContexts vocabularyId={VOCAB} word={word} readOnly /></QueryClientProvider>);
}
const hrefs = markup => [...markup.matchAll(/href="([^"]+)"/g)].map(match => match[1].replace(/&amp;/g, '&'));
const legacy = markup => hrefs(markup).filter(href => legacyTextbookTarget(href.replace(/[?#].*$/s, '')) !== null);
const word = { word_text: 'がくせい', source_material_id: null, source_sentence: null };

describe('복습 카드의 보관된 교재 문맥', () => {
  it('보관 문맥만 있으면 문장은 보이고 링크 대신 보관 안내를 보인다', () => {
    const markup = render([archived], word);
    expect(markup).toContain('がくせい');
    expect(markup).toContain('보관된 교재라 열 수 없어요');
    expect(markup).not.toContain('원문 열기');
    expect(markup).not.toContain('이 문장 열기');
    expect(legacy(markup)).toEqual([]);
  });

  it('새 책 문맥이 대표로 열리고, 보관 문맥은 다른 문맥에서 링크 없이 남는다', () => {
    const markup = render([archived, book], word);
    expect(hrefs(markup)).toContain(`/books/japanese-n5?edition=${EDITION}&reference=1#u03-study1`);
    expect(markup).toContain('이 문장 열기 ↗');
    expect(markup).toContain('다른 문맥 1개');
    expect(markup).toContain('교재 예문 · 보관된 교재라 열 수 없어요');
    expect(legacy(markup)).toEqual([]);
  });

  it('단어 없이 문맥 목록만 볼 때도 보관 문맥은 링크 없이 표시된다', () => {
    const markup = render([archived, book], null);
    expect(markup).toContain('이 표현을 만난 문맥 2개');
    expect(markup).toContain('교재 예문 · 보관된 교재라 열 수 없어요');
    expect(markup).toContain('교재 예문 열기 ↗');
    expect(legacy(markup)).toEqual([]);
  });
});
