import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeBookKey, getBook, groupByBook, analysisStateOf } from '../bookMeta.js';

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
});
