import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ profile: { role: 'admin' }, user: null, loading: false }) }));
vi.mock('@tanstack/react-query', () => ({ useInfiniteQuery: () => ({ data: { pages: [] }, isPending: false, error: null }) }));
vi.mock('@/components/books/useReadingProgress', () => ({ default: () => ({ progress: { page: 'u01-start', completed: [] }, hasProgress: false, ready: true }) }));
vi.mock('@/components/library/LibrarySaveButton', () => ({ default: ({ edition, bookTitle }) => <span data-save-edition={edition}>{bookTitle}</span> }));
vi.mock('@/components/web/LibraryReaderLink', () => ({ LibraryReturnLink: () => null }));

import BookHome from '@/components/books/BookHome';
import BookReview from '@/components/books/BookReview';
import { parseReviewScope } from '@/lib/reviewScope';
import BookCover from '@/components/books/BookCover';
import BookEditionFonts from '@/components/books/BookEditionFonts';
import Bookshelf from '@/components/books/Bookshelf';

const edition = '1'.repeat(24);
const n4 = { bookId: 'japanese-n4', level: 'N4', edition, title: '문장을 이어, 내 이야기를 하는 일본어', lessons: [{ id: 'u01', number: 1, part: '설명과 부탁', title: '한마디 덧붙이기' }], cultures: [] };
const n5 = { ...n4, bookId: 'japanese-n5', level: 'N5', edition: '2'.repeat(24), title: '작은 문장으로 시작하는 일본어' };
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));

describe('N4 app entry and edition presentation', () => {
  it('shows each verified book as its own level with canonical edition links', () => {
    const html = render(Bookshelf, { books: [n5, n4], initialLang: 'Japanese' });
    expect(html).toContain(`href="/books/japanese-n4?edition=${edition}#cover"`);
    expect(html).toContain('aria-label="일본어 N4 책 둘러보기"');
    expect(html).toContain(`href="/books/japanese-n5?edition=${n5.edition}#cover"`);
    expect(html).toContain('aria-label="일본어 N5 책 둘러보기"');
    expect(html).toContain('href="/admin/books/japanese-n4"');
  });

  it('N4 cover, tools and library title stay in the N4 book', () => {
    const html = render(BookHome, { book: n4, progress: { completed: [] } });
    expect(html).toContain(n4.title);
    for (const part of ['#u01-start', '#guide-start', '#reference-start']) {
      expect(html).toContain(`/books/japanese-n4?edition=${edition}${part}`);
    }
    expect(html).toContain(`/books/japanese-n4/review?edition=${edition}`);
    expect(html).toContain(`/books/japanese-n4/materials?edition=${edition}`);
    expect(html).toContain('음성과 PDF는 아직 제공하지 않아요.');
    expect(html).toContain('일본어 N4</span>');
    expect(html).not.toContain('/books/japanese-n5');
  });

  it('a preview never offers the whole edition library save', () => {
    const html = render(BookHome, { book: n4, preview: true, progress: { completed: [] } });
    expect(html).not.toContain('data-save-edition');
  });

  it('does not invent an N4 public entry when only N5 is verified', () => {
    const html = render(Bookshelf, { books: [n5], initialLang: 'Japanese' });
    expect(html).not.toContain('aria-label="일본어 N4 책 둘러보기"');
    expect(html).toContain('aria-label="일본어 N5 책 둘러보기"');
  });

  it('keeps the original cover default and allows an actual N4 title', () => {
    expect(render(BookCover, {})).toContain('<b>N5</b>');
    const html = render(BookCover, { level: 'N4', title: n4.title });
    expect(html).toContain('<b>N4</b>');
    expect(html).toContain(n4.title);
  });

  it.each([[n4, n5], [n5, n4]])('a saved-expression page cannot adopt another book as its reading or review return', (current, other) => {
    const returnTo = `/books/${other.bookId}?edition=${other.edition}#u07-patterns`;
    const html = render(BookReview, { book: current, returnTo });
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
    const scope = parseReviewScope(new URL(hrefs.find(href => href.startsWith('/vocab?')), 'https://local.invalid').searchParams);
    const expected = `/books/${current.bookId}?edition=${current.edition}#u01-start`;
    expect(hrefs).toContain(expected);
    expect(scope.scope.source.bookId).toBe(current.bookId);
    expect(scope.returnTo).toBe(expected);
    expect(hrefs).not.toContain(returnTo);
  });

  it.each([n4, n5])('keeps a same-book return to an older exact edition and anchor', current => {
    const returnTo = `/books/${current.bookId}?edition=${'3'.repeat(24)}#u12-patterns`;
    const html = render(BookReview, { book: current, returnTo });
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
    const scope = parseReviewScope(new URL(hrefs.find(href => href.startsWith('/vocab?')), 'https://local.invalid').searchParams);
    expect(hrefs).toContain(returnTo);
    expect(scope.scope.source.bookId).toBe(current.bookId);
    expect(scope.returnTo).toBe(returnTo);
  });

  it('loads all N4 font faces from that exact book and edition only', () => {
    const html = render(BookEditionFonts, { book: n4 });
    for (const face of ['KR', 'KRB', 'KRS', 'JP', 'JPS']) expect(html).toContain(`/api/books/japanese-n4/${edition}/asset?file=fonts/${face}.woff`);
    expect(html).toContain('data-book-id="japanese-n4"');
    expect(html).not.toContain('/api/books/japanese-n5');
    expect(render(BookEditionFonts, { book: n5 })).toBe('');
    expect(render(BookEditionFonts, { book: { ...n4, edition: '\";}</style><script>bad</script>' } })).toBe('');
  });
});
