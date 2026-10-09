// VIEWER-R0-BUGS-001 버그 3b — 복습 카드의 문맥 목록 API가 bookId 없는 옛 교재 문맥에
// 홈으로 튕기는 /<lang>/grammar/<slug> 주소를 붙이던 결함. 행은 읽기만 하고, 링크 대신 보관 표시로 내려준다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { authenticate } = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ requireUser: authenticate }));
import { GET } from '../vocabulary/route';
import { legacyTextbookTarget } from '@/lib/bookNavigation';

const userId = '10000000-0000-4000-8000-000000000001';
const wordId = '30000000-0000-4000-8000-000000000001';
const EDITION = '8a8c1c1fd452773810abaf8c';
const ROWS = [
  { id: 'c-ja', kind: 'textbook', lang: 'Japanese', chapter_slug: 'n5-04-desu-da', material_id: null, pdf_id: null, locator: { revision: 'r1', blockId: 'tb-abc' }, quote: 'わたしは がくせいです。', translation: '나는 학생입니다.' },
  { id: 'c-zh', kind: 'textbook', lang: 'Chinese', chapter_slug: 'h1-01-shi', material_id: null, pdf_id: null, locator: {}, quote: '我是学生。', translation: null },
  { id: 'c-book', kind: 'textbook', lang: 'Japanese', chapter_slug: 'n5-book-u03', material_id: null, pdf_id: null, locator: { bookId: 'japanese-n5', editionId: EDITION, pageId: 'u03-study1' }, quote: 'ちちは せんせいです。', translation: null },
  { id: 'c-read', kind: 'reading', lang: 'Chinese', material_id: 211, pdf_id: null, locator: { surface: '学生' }, quote: '他是学生。', translation: null },
  { id: 'c-bad', kind: 'textbook', lang: 'English', chapter_slug: '//evil.test', material_id: null, pdf_id: null, locator: {}, quote: 'x', translation: null },
];
let calls;
beforeEach(() => {
  calls = [];
  const supabase = { from: vi.fn(table => {
    const call = { table, ops: [] }; calls.push(call);
    const q = {};
    for (const op of ['select', 'eq', 'order', 'limit']) q[op] = (...args) => { call.ops.push([op, ...args]); return q; };
    for (const op of ['insert', 'update', 'upsert', 'delete']) q[op] = () => { throw new Error(`write ${op}`); };
    q.then = done => Promise.resolve({ data: structuredClone(ROWS), error: null }).then(done);
    return q;
  }) };
  authenticate.mockResolvedValue({ user: { id: userId }, supabase });
});

describe('문맥 목록 API: 보관된 옛 교재 문맥', () => {
  it('링크 없이 archived로 남기고, 새 책·자료 문맥의 원문 귀환 주소는 그대로다', async () => {
    const response = await GET(new Request(`https://fixture.test/api/learning/vocabulary?id=${wordId}`));
    expect(response.status).toBe(200);
    const { contexts } = await response.json();
    expect(contexts.map(c => c.id)).toEqual(['c-ja', 'c-zh', 'c-book', 'c-read']); // 잘못된 식별자만 빠진다
    expect(contexts.filter(c => c.href && legacyTextbookTarget(c.href.replace(/[?#].*$/s, '')) !== null)).toEqual([]);
    expect(contexts.find(c => c.id === 'c-ja')).toMatchObject({ href: null, archived: true, quote: 'わたしは がくせいです。', translation: '나는 학생입니다.', chapter_slug: 'n5-04-desu-da' });
    expect(contexts.find(c => c.id === 'c-zh')).toMatchObject({ href: null, archived: true });
    expect(contexts.find(c => c.id === 'c-book')).toMatchObject({ href: `/books/japanese-n5?edition=${EDITION}#u03-study1` });
    expect(contexts.find(c => c.id === 'c-book').archived).toBeUndefined();
    expect(contexts.find(c => c.id === 'c-read')).toMatchObject({ href: '/viewer/211?sourceText=%E5%AD%A6%E7%94%9F' });
    // 읽기만 한다 — 본인 행만, 쓰기 없음.
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('vocabulary_contexts');
    expect(calls[0].ops).toContainEqual(['eq', 'user_id', userId]);
  });
});
