import { describe, expect, it } from 'vitest';
import { publishBooksOf, PUBLISH_KINDS } from '../publishBooks';
import { LITERATURE_KEYS, literatureBook } from '../literatureBooks';
import { artBooks } from '../../artBook';
import { sortByPublishRank } from '../../classicsShelf';

// 정본 문학책 원문 읽기(BUILD-OOM-001 근본, 2026-11-01 KST) — 장 원문을 번들 정적 import에서 서버 파일 읽기로 바꿨다.
// 바꾼 뒤에도 게시 목록이 예전 정적 import와 같은 값 · 같은 차례여야 한다. 예전 경로(번들러 JSON import)는 vite glob으로 다시 만든다.
const STATIC = import.meta.glob('../../../content/literature/*/*/chapters.json', { eager: true, import: 'default' });
const byKey = new Map(Object.entries(STATIC).map(([file, book]) => [file.split('/').at(-2), book]));
// 예전 publishBooks.js의 차례 — 青空文庫 · Standard Ebooks · 위키문헌 · 전자책 사이트를 이어 붙인 뒤 공개 차례로.
const SOURCE_ORDER = ['aozora', 'standardebooks', 'wikisource', 'pdsite'];
const dirOf = (file) => file.split('/').at(-3);

describe('publishBooks — 문학책 원문을 파일에서 읽어도 예전 정적 목록과 같다(BUILD-OOM-001)', () => {
  it('key 목록 = 작품 폴더의 chapters.json 전부(빠진 책 · 남는 파일 없음), 출처 차례', () => {
    const fromFolders = Object.keys(STATIC).sort((a, b) => SOURCE_ORDER.indexOf(dirOf(a)) - SOURCE_ORDER.indexOf(dirOf(b)) || a.localeCompare(b))
      .map((file) => file.split('/').at(-2));
    expect(LITERATURE_KEYS).toEqual(fromFolders);
    expect(LITERATURE_KEYS.length).toBeGreaterThanOrEqual(85);
    for (const [key, book] of byKey) expect(book.book.key).toBe(key);
  });

  it('전체 목록은 정적 import 목록을 공개 차례로 세운 것과 깊이 같다', () => {
    const legacy = sortByPublishRank(LITERATURE_KEYS.map((key) => byKey.get(key)));
    const books = publishBooksOf('literature');
    expect(books).toEqual(legacy);
    expect(Object.isFrozen(books)).toBe(true);
    expect(publishBooksOf('literature')).toBe(books); // 한 번만 만든다
  });

  it('keys로 좁히면 그 책만 · 공개 차례 그대로 · 모르는 key는 빠진다 — 같은 객체를 돌려준다', () => {
    const all = publishBooksOf('literature');
    for (const book of all) expect(publishBooksOf('literature', [book.book.key])).toEqual([book]);
    const picked = [all[7].book.key, all[2].book.key, 'aozora-없는-책', '__proto__'];
    expect(publishBooksOf('literature', picked)).toEqual([all[2], all[7]]);
    expect(publishBooksOf('literature', picked)[0]).toBe(all[2]);
    expect(publishBooksOf('literature', [])).toEqual([]);
  });

  it('목록 밖 key는 파일 경로를 만들지 않는다(null) — 경로 조각 · 상위 폴더 같은 값', () => {
    for (const key of ['../catalog', 'aozora/../../x', '', 'constructor', 'toString']) expect(literatureBook(key)).toBeNull();
  });

  it('그림 책은 카탈로그 그대로 — keys로 좁혀도 같은 모양', () => {
    const art = artBooks();
    expect(publishBooksOf('art')).toEqual(art);
    expect(publishBooksOf('art', [art[0].book.key, '없는-책'])).toEqual([art[0]]);
    expect(PUBLISH_KINDS).toEqual(['literature', 'art']);
    expect(() => publishBooksOf('comic')).toThrow('알 수 없는 책 종류');
  });
});
