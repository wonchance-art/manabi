import { BOOKS, EDITION_ID } from '@/lib/textbook/contract';

// Each intermediate book uses verified subsets. N5's immutable fonts lack their new characters.
export default function BookEditionFonts({ book }) {
  if (!['japanese-n4', 'japanese-n3'].includes(book.bookId) || !EDITION_ID.test(book.edition || '')) return null;
  const family = `Manabi${BOOKS[book.bookId].level}`;
  const prefix = `/api/books/${book.bookId}/${book.edition}/asset?file=fonts/`;
  const faces = ['KR', 'KRB', 'KRS', 'JP', 'JPS'].map(face =>
    `@font-face{font-family:${family}${face};src:url("${prefix}${face}.woff") format("woff");font-weight:${face === 'KRB' ? 700 : 400};font-display:swap}`,
  ).join('');
  const scope = `.book-reader[data-book-id="${book.bookId}"] .book-reading-content`;
  const css = `${faces}
${scope}{font-family:${family}KR,sans-serif}
${scope} :is(h1,h2,h3,h4,b,strong,.goal,.listen-question){font-family:${family}KRB,${family}KR,sans-serif}
${scope} :is(.explanation,.scene>p:first-child){font-family:${family}KRS,${family}KR,sans-serif}
${scope} .example>p{font-family:${family}KR,sans-serif}
${scope} [lang=ja]{font-family:${family}JP,serif}
${scope} :is(rt,.formula [lang=ja]){font-family:${family}JPS,serif}`;
  return <style>{css}</style>;
}
