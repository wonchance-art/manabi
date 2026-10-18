import { EDITION_ID } from '@/lib/textbook/contract';

// N4 uses its own verified subsets. N5's immutable fonts do not contain every N4 character.
export default function BookEditionFonts({ book }) {
  if (book.bookId !== 'japanese-n4' || !EDITION_ID.test(book.edition || '')) return null;
  const prefix = `/api/books/japanese-n4/${book.edition}/asset?file=fonts/`;
  const faces = ['KR', 'KRB', 'KRS', 'JP', 'JPS'].map(face =>
    `@font-face{font-family:ManabiN4${face};src:url("${prefix}${face}.woff") format("woff");font-weight:${face === 'KRB' ? 700 : 400};font-display:swap}`,
  ).join('');
  const scope = '.book-reader[data-book-id="japanese-n4"] .book-reading-content';
  const css = `${faces}
${scope}{font-family:ManabiN4KR,sans-serif}
${scope} :is(h1,h2,h3,h4,b,strong,.goal,.listen-question){font-family:ManabiN4KRB,ManabiN4KR,sans-serif}
${scope} :is(.explanation,.scene>p:first-child){font-family:ManabiN4KRS,ManabiN4KR,sans-serif}
${scope} .example>p{font-family:ManabiN4KR,sans-serif}
${scope} [lang=ja]{font-family:ManabiN4JP,serif}
${scope} :is(rt,.formula [lang=ja]){font-family:ManabiN4JPS,serif}`;
  return <style>{css}</style>;
}
