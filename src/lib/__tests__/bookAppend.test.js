import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween';
import {
  nextChapterOrder, chapterTitle, renumberChapters, bookKeyForDraft, appendPlanOf,
  listAppendableBooks, countContentLines,
} from '../bookAppend';

// 📚 책에 이어 적기 계약 (#1077 5520128974 — 오너 ㄱㄱㄱ 2026-09-03).
// 하루 한두 과씩 적어 완성한다: 기존 책의 key에 다음 순번으로 이어 붙이고, 새 key를 만들지 않는다.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('순번·제목·키 — 순수', () => {
  it('다음 과 순번 = 형제 order 최댓값 + 1, 비어 있으면 1, 숫자 아닌 order 무시', () => {
    expect(nextChapterOrder([])).toBe(1);
    expect(nextChapterOrder([{ order: 3 }, { order: 1 }, { order: 'x' }])).toBe(4);
    expect(nextChapterOrder([{ _bookOrder: 7 }])).toBe(8);
  });

  it('분할 결과(1과부터)를 다음 순번부터 다시 매긴다 — 본문 불변', () => {
    const split = [{ title: '1과', text: 'a\nb' }, { title: '2과', text: 'c' }];
    expect(renumberChapters(split, 4)).toEqual([{ title: '4과', text: 'a\nb' }, { title: '5과', text: 'c' }]);
    expect(renumberChapters(split, 0)[0].title).toBe('1과');
    expect(chapterTitle(12)).toBe('12과');
  });

  it('이어 적기면 책의 key를 그대로 쓰고 새 key를 만들지 않는다 — 같은 책이 둘로 갈라지지 않는다', () => {
    const makeKey = vi.fn(() => 'bk_new');
    expect(bookKeyForDraft({ append: { key: 'bk_old' } }, makeKey)).toBe('bk_old');
    expect(makeKey).not.toHaveBeenCalled();
    expect(bookKeyForDraft({ append: { key: '' } }, makeKey)).toBe('bk_new');
    expect(bookKeyForDraft({}, makeKey)).toBe('bk_new');
  });

  it('등록 계획 — 새 책은 1부터·챕터 수, 이어 적기는 다음 순번부터·기존+새', () => {
    expect(appendPlanOf({ chapters: [{}, {}] })).toEqual({ startOrder: 1, existingCount: 0, total: 2, lastOrder: 2 });
    expect(appendPlanOf({ chapters: [{}, {}], append: { key: 'k', startOrder: 4, existingCount: 3 } }))
      .toEqual({ startOrder: 4, existingCount: 3, total: 5, lastOrder: 5 });
  });
});

describe('내 책 목록 — 이어 적을 수 있는 책', () => {
  const row = (key, order, created_at, extra = {}) => ({
    id: `${key}-${order}`, created_at,
    processed_json: { metadata: { language: 'Chinese', level: 'H5 고급', book: { key, title: `책 ${key}`, order, total: 3 }, ...extra } },
  });

  it('같은 key끼리 묶고 count·lastOrder·언어·난이도를 채우며 최근 등록 책이 먼저다', () => {
    const rows = [
      row('b', 1, '2026-08-20'), // 입력 순서로는 b가 먼저 — 최근 등록(latest) 순으로 a가 앞서야 한다
      row('a', 1, '2026-09-01'), row('a', 2, '2026-09-02'), row('a', 3, '2026-09-03'),
      { id: 'single', created_at: '2026-09-04', processed_json: { metadata: { language: 'Japanese' } } },
    ];
    const books = listAppendableBooks(rows);
    expect(books.map((b) => b.key)).toEqual(['a', 'b']);
    expect(books[0]).toMatchObject({ title: '책 a', language: 'Chinese', level: 'H5 고급', count: 3, lastOrder: 3, latest: '2026-09-03' });
    expect(nextChapterOrder([{ order: books[0].lastOrder }])).toBe(4);
  });

  it('빈 입력·책 아닌 행만이면 빈 목록', () => {
    expect(listAppendableBooks([])).toEqual([]);
    expect(listAppendableBooks([{ processed_json: { metadata: {} } }])).toEqual([]);
  });

  it('내용 줄 수 — 빈 줄 제외(과당 문장 수 상속의 근거)', () => {
    expect(countContentLines('a\n\nb\n  \nc\n')).toBe(3);
    expect(countContentLines('')).toBe(0);
  });
});

describe('배선 계약 — 입구·등록·진입·완료', () => {
  const page = read('src/views/MaterialAddPage.jsx');
  const section = read('src/components/MaterialAddSentenceSection.jsx');

  it('입구: 「기존 교재에 이어서」 갈래 — 책을 고르면 제목·언어·난이도를 물려받고 다음 순번부터 매긴다', () => {
    expect(section).toContain('기존 교재에 이어서');
    expect(section).toContain("import { renumberChapters } from '../lib/bookAppend';");
    expect(section).toContain('const startOrder = book ? book.lastOrder + 1 : 1;');
    expect(section).toContain('const chapters = book ? renumberChapters(split, startOrder) : split;');
    expect(section).toContain('append: book ? { key: book.key, startOrder, existingCount: book.count } : null,');
    expect(section).toContain('language: book?.language || language,');
    // 책이 없으면 갈래가 보이지 않는다 — 새 교재 흐름은 그대로
    expect(section).toContain('{books.length > 0 && (');
  });

  it('등록: 이어 적기는 책의 key·다음 순번·기존+새 총수로 같은 insert 흐름을 탄다 — 새 key 없음', () => {
    expect(page).toContain('const key = bookKeyForDraft(bookDraft, makeBookKey);');
    expect(page).toContain('const { startOrder, existingCount, total, lastOrder } = appendPlanOf(bookDraft);');
    expect(page).toContain('order: startOrder + i, total');
    expect(page).not.toMatch(/const key = makeBookKey\(\);/);
    const ready = sliceBetween(page, 'const handleSentenceBookReady = (', '\n  };');
    expect(ready).toContain("origin: 'sentences', language: lang, level: lvl, append,");
  });

  it('진입: 딥링크 ?book= · 자료실 책 카드 footer · 뷰어 마지막 과(내 책만)', () => {
    expect(page).toContain("const appendBookKey = searchParams.get('book') || '';");
    expect(page).toContain('initialBookKey={appendBookKey}');
    const materials = read('src/views/MaterialsPage.jsx');
    expect(materials).toContain('href={`/materials/add?book=${encodeURIComponent(b.key)}`}');
    expect(materials).toContain("footer={b.chapters[0]?.owner_id === user?.id ? (");
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain('canAppend: !!user?.id && material?.owner_id === user.id,');
    expect(viewer).toContain('href={`/materials/add?book=${encodeURIComponent(bookNav.key)}`}');
  });

  it('내 책 목록은 메타 경로만(processed_json 통짜 금지) · 과 크기는 최근 챕터 한 행의 raw_text에서만', () => {
    expect(page).toContain(".select('id, created_at, processed_json->metadata->>language, processed_json->metadata->>level, processed_json->metadata->book')");
    expect(page).toContain(".not('processed_json->metadata->book', 'is', null)");
    expect(page).toMatch(/inferPerChapter = async[\s\S]{0,300}?\.select\('raw_text'\)[\s\S]{0,300}?\.limit\(1\)/);
  });

  it('완료 화면에 [바로 읽기] — 오늘 적은 과를 바로 연다(열 때 분석 원칙 그대로)', () => {
    const panel = read('src/components/BookDraftPanel.jsx');
    expect(panel).toContain('바로 읽기');
    expect(panel).toContain("{append ? `책에 이어 등록 — 지금 ${append.existingCount}과까지` : '책으로 등록'}");
    expect(panel).toContain('{startOrder + i}');
    expect(page).toContain(".insert(rows).select('id')");
    expect(page).toContain('setBookFirstNewId(inserted?.[0]?.id ?? null);');
    expect(page).not.toContain('runBackgroundAnalysis(inserted'); // 등록 즉시 분석 부활 금지
  });
});
