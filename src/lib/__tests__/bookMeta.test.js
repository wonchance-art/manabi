import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeBookKey, getBook, groupByBook, bookGroupKey, analysisStateOf } from '../bookMeta.js';

// 계약: 책 묶음은 스키마 무변경 — processed_json.metadata.book {key,title,order,total}로만
// 식별한다. 챕터=자료 단위 유지, 그룹핑·정렬은 클라이언트 순수 로직.

const mat = (id, book, status = 'pending') => ({
  id,
  processed_json: { status, metadata: book ? { book } : {} },
});

describe('getBook — 메타 검증', () => {
  it('형식이 맞으면 정규화해 반환한다', () => {
    expect(getBook({ book: { key: 'bk_1', title: '삼체', order: '2', total: 12 } }))
      .toEqual({ key: 'bk_1', title: '삼체', order: 2, total: 12 });
  });

  it('키·순번이 없거나 불량이면 null', () => {
    expect(getBook({ book: { title: 'x', order: 1 } })).toBeNull();
    expect(getBook({ book: { key: 'bk', order: 'abc' } })).toBeNull();
    expect(getBook({})).toBeNull();
    expect(getBook(null)).toBeNull();
  });
});

describe('groupByBook — 그룹·정렬', () => {
  it('책은 첫 등장 순, 챕터는 order 오름차순, 나머지는 singles', () => {
    const ms = [
      mat(1, { key: 'bk_a', title: 'A책', order: 2, total: 3 }),
      mat(2, null),
      mat(3, { key: 'bk_a', title: 'A책', order: 1, total: 3 }),
      mat(4, { key: 'bk_b', title: 'B책', order: 1, total: 1 }),
      mat(5, { key: 'bk_a', title: 'A책', order: 3, total: 3 }),
    ];
    const { books, singles } = groupByBook(ms);
    expect(books.map((b) => b.key)).toEqual(['bk_a', 'bk_b']);
    expect(books[0].chapters.map((c) => c.id)).toEqual([3, 1, 5]);
    expect(singles.map((m) => m.id)).toEqual([2]);
  });
});

// 계약: 책 묶음 = (소유자 + 책 key) — 뷰어 형제 장(ViewerPage: key + 같은 owner_id)과 같은 경계.
// 공개 metadata는 누구나 꾸밀 수 있다 — 남의 공개 행이 관리자 책 key를 달아도 그 책에 섞이면 안 된다.
describe('groupByBook — 소유자 경계', () => {
  const owned = (id, owner, book) => ({ ...mat(id, book, 'completed'), owner_id: owner });
  const KEY = 'aozora-000121-000628';

  it('같은 key의 남의 행은 관리자 묶음에 섞이지 않는다(책 2권, groupKey는 다르고 key는 같다)', () => {
    const ms = [
      owned(1, 'admin', { key: KEY, title: '鼻', order: 1, total: 2 }),
      owned(2, 'mallory', { key: KEY, title: '鼻', order: 1, total: 2 }),
      owned(3, 'admin', { key: KEY, title: '鼻', order: 2, total: 2 }),
    ];
    const { books } = groupByBook(ms);
    expect(books).toHaveLength(2);
    expect(books.map((b) => b.key)).toEqual([KEY, KEY]);
    expect(books.map((b) => b.ownerId)).toEqual(['admin', 'mallory']);
    expect(books[0].groupKey).not.toBe(books[1].groupKey);
    expect(books.map((b) => b.groupKey)).toEqual([bookGroupKey('admin', KEY), bookGroupKey('mallory', KEY)]);
    expect(books[0].chapters.map((c) => c.id)).toEqual([1, 3]);
    expect(books[1].chapters.map((c) => c.id)).toEqual([2]);
  });

  it('같은 소유자 행은 기존 결과와 같다(첫 등장 순·order 오름차순·singles)', () => {
    const ms = [
      owned(1, 'u1', { key: 'bk_a', title: 'A책', order: 2, total: 3 }),
      owned(2, 'u1', null),
      owned(3, 'u1', { key: 'bk_a', title: 'A책', order: 1, total: 3 }),
      owned(4, 'u1', { key: 'bk_b', title: 'B책', order: 1, total: 1 }),
      owned(5, 'u1', { key: 'bk_a', title: 'A책', order: 3, total: 3 }),
    ];
    const { books, singles } = groupByBook(ms);
    expect(books.map((b) => [b.key, b.title, b.ownerId, b.chapters.map((c) => c.id)])).toEqual([
      ['bk_a', 'A책', 'u1', [3, 1, 5]],
      ['bk_b', 'B책', 'u1', [4]],
    ]);
    expect(singles.map((m) => m.id)).toEqual([2]);
  });

  it('bookGroupKey는 구분자로 소유자와 key가 섞이지 않는다', () => {
    expect(bookGroupKey('a', 'bc')).not.toBe(bookGroupKey('ab', 'c'));
    expect(bookGroupKey(null, 'k')).toBe(bookGroupKey(undefined, 'k'));
  });
});

describe('makeBookKey · analysisStateOf', () => {
  it('키는 bk_ 접두 유니크, 상태는 processed_json.status(기본 idle)', () => {
    const k1 = makeBookKey();
    expect(k1).toMatch(/^bk_/);
    expect(makeBookKey()).not.toBe(k1);
    expect(analysisStateOf(mat(1, null, 'pending'))).toBe('pending');
    expect(analysisStateOf({})).toBe('idle');
  });
});

// 배선 계약 — 등록(AddPage)·뷰어(pending 배너·챕터 내비)·자료함(그룹)이 실제로 연결돼야 한다.
describe('책 묶음 배선 계약', () => {
  it('자료 추가 페이지가 책 등록(일괄 insert + pending)을 배선한다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/MaterialAddPage.jsx'), 'utf8');
    expect(src).toContain('makeBookKey');
    expect(src).toContain("status: 'pending'");
    expect(src).toContain('splitTextIntoChapters');
  });

  it('뷰어가 pending 배너·챕터 내비를 배선한다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(src).toContain("status === 'pending'");
    expect(src).toContain('이 챕터 분석하기');
    expect(src).toContain('getBook(');
  });

  it('자료함이 책 그룹핑을 배선한다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/MaterialsPage.jsx'), 'utf8');
    expect(src).toContain('groupByBook');
  });

  it('자료함 책 카드는 groupKey를 React key로 쓰고, 정본 표지는 공개 목록 판정 뒤에만 부른다(fail closed)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/MaterialsPage.jsx'), 'utf8');
    expect(src).toContain('key={b.groupKey}');
    expect(src).not.toContain('key={b.key}');
    // 공개 판정(tab 'public' = libraryView 'public')이 정본 표지 함수 호출보다 먼저 서고, 두 호출 모두 그 판정에 걸린다.
    const gate = src.indexOf("const canonicalCovers = tab !== 'public';");
    expect(gate).toBeGreaterThan(-1);
    const calls = [...src.matchAll(/(literatureWorkOfBook|standardEbooksWorkOfBook)\(b\)/g)];
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call.index).toBeGreaterThan(gate);
    expect(src).toContain('const work = canonicalCovers ? literatureWorkOfBook(b) : null;');
    expect(src).toContain('const english = work || !canonicalCovers ? null : standardEbooksWorkOfBook(b);');
    // 「다음 과 적기」는 표지 판정(work · english)에 기대지 않는다 — 공개 목록에서 표지를 닫으면 정본 책 소유자에게 다시 떠서
    // 같은 key로 비공개 장이 끼어 정본 게시가 409로 막혔다(2026-10-17 리뷰). key만으로 막는다(fail closed).
    expect(src).not.toMatch(/footer=\{!work && !english/);
    expect(src).toContain(') : !isCanonicalBookKey(b.key) && b.chapters[0]?.owner_id === user.id ? (');
  });
});
