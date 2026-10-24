import { describe, expect, it, vi } from 'vitest';
import { classicsProgress } from '../classicsProgress';
import { classicsProgressOf } from '../server/classicsReading';

// 고전 명작 카드의 읽은 자리(DISCOVER-CLASSICS-PROGRESS-001, 목업 8차 ② 오너 「2 ㄱㄱ」 2026-10-23 KST).
const OWNER = 'owner-1';
const book = { key: 'aozora-1', chapters: 4, firstMaterialId: 10 };
const one = { key: 'aozora-2', chapters: 1, firstMaterialId: 20 };
const chapter = (id, order, extra = {}) => ({ id, owner_id: OWNER, visibility: 'public', key: book.key, order: String(order), ...extra });
const MATERIALS = [chapter(10, 1), chapter(11, 2), chapter(12, 3), chapter(13, 4), { ...chapter(20, 1), key: one.key }];
const row = (material_id, updated_at, extra = {}) => ({ material_id, is_completed: false, last_token_idx: 0, updated_at, ...extra });

describe('classicsProgress — 장 단위 퍼센트 · 다 읽음 · 이어 열 장', () => {
  it('다 읽은 장 + 읽는 중인 장은 반 장 — 열기는 가장 최근에 손댄 장', () => {
    const progress = [row(10, '2026-10-20T10:00:00+09:00', { is_completed: true }), row(11, '2026-10-21T10:00:00+09:00', { last_token_idx: 120 })];
    expect(classicsProgress({ books: [book], progress, materials: MATERIALS }).resume).toEqual({ [book.key]: { materialId: 11, percent: 38 } });
  });
  it('연 적만 있으면 1%, 마지막 장을 덜 읽었으면 99% — 100%는 ✓가 맡는다', () => {
    expect(classicsProgress({ books: [one], progress: [row(20, '2026-10-21T00:00:00Z')], materials: MATERIALS }).resume[one.key]).toEqual({ materialId: 20, percent: 1 });
    const progress = [10, 11, 12].map((id) => row(id, '2026-10-20T00:00:00Z', { is_completed: true })).concat(row(13, '2026-10-21T00:00:00Z', { last_token_idx: 5 }));
    expect(classicsProgress({ books: [book], progress, materials: MATERIALS }).resume[book.key]).toEqual({ materialId: 13, percent: 88 });
    const many = { ...book, chapters: 200 };
    const nearly = Array.from({ length: 199 }, (_, i) => row(1000 + i, '2026-10-20T00:00:00Z', { is_completed: true })).concat(row(2000, '2026-10-21T00:00:00Z', { last_token_idx: 1 }));
    const chapters = Array.from({ length: 199 }, (_, i) => chapter(1000 + i, i + 1)).concat(chapter(2000, 200), chapter(10, 1));
    expect(classicsProgress({ books: [many], progress: nearly, materials: chapters }).resume[book.key].percent).toBe(99);
  });
  it('공개 장을 다 읽으면 done(퍼센트 없음)', () => {
    const progress = [10, 11, 12, 13].map((id, i) => row(id, `2026-10-2${i}T00:00:00Z`, { is_completed: true }));
    expect(classicsProgress({ books: [book], progress, materials: MATERIALS }).resume[book.key]).toEqual({ materialId: 13, done: true });
  });
  it('남의 공개 글 · 비공개 · 순서 밖 · 다른 책의 장은 세지 않는다(fail closed)', () => {
    const forged = [chapter(30, 2, { owner_id: 'someone' }), chapter(31, 3, { visibility: 'private' }), chapter(32, 9), { ...chapter(33, 2), key: 'aozora-9' }];
    const progress = [30, 31, 32, 33].map((id) => row(id, '2026-10-21T00:00:00Z', { is_completed: true }));
    expect(classicsProgress({ books: [book], progress, materials: [...MATERIALS, ...forged] }).resume).toEqual({});
    // 첫 장 자료를 못 받았으면(소유자를 모르면) 그 책은 상태 없음
    expect(classicsProgress({ books: [book], progress: [row(11, '2026-10-21T00:00:00Z', { is_completed: true })], materials: MATERIALS.slice(1) }).resume).toEqual({});
  });
  it('그림은 그 장을 다 읽었을 때만 ✓', () => {
    const art = [{ key: 'art-a:1', materialId: 50 }, { key: 'art-a:2', materialId: 51 }, { key: 'art-a:3', materialId: 52 }];
    const progress = [row(50, 'x', { is_completed: true }), row(51, 'x', { last_token_idx: 40 })];
    expect([...classicsProgress({ art, progress }).read]).toEqual(['art-a:1']);
  });
});

describe('classicsProgressOf — 로그인 세션으로 자기 줄만 읽고, 실패는 상태 없음', () => {
  const client = ({ progress = [], materials = [], progressError = null } = {}) => {
    const calls = [];
    const query = (table) => {
      const q = { table, filters: [] };
      calls.push(q);
      const chain = new Proxy({}, { get: (_, name) => {
        if (name === 'then') return (resolve) => resolve(table === 'reading_progress' ? { data: progress, error: progressError } : { data: materials, error: null });
        return (...args) => { q.filters.push([name, ...args]); return chain; };
      } });
      return chain;
    };
    return { calls, supabase: { from: vi.fn(query) } };
  };
  it('손님(세션 없음)은 조회 없이 상태 없음', async () => {
    const { supabase } = client();
    expect(await classicsProgressOf(null, { books: [book], art: [] })).toEqual({ resume: {}, read: new Set() });
    expect(await classicsProgressOf({ error: '로그인이 필요해요.' }, { books: [book], art: [] })).toEqual({ resume: {}, read: new Set() });
    expect(supabase.from).not.toHaveBeenCalled();
  });
  it('자기 user_id 줄 · 공개 자료의 book key · 순서 · 소유자만(본문 없이) 받는다', async () => {
    const { supabase, calls } = client({ progress: [row(11, '2026-10-21T00:00:00Z', { is_completed: true })], materials: MATERIALS });
    const result = await classicsProgressOf({ supabase, user: { id: 'me' } }, { books: [book], art: [] });
    expect(result.resume).toEqual({ [book.key]: { materialId: 11, percent: 25 } });
    expect(calls.map((q) => q.table)).toEqual(['reading_progress', 'reading_materials']);
    expect(calls[0].filters).toContainEqual(['eq', 'user_id', 'me']);
    const select = calls[1].filters.find(([name]) => name === 'select')[1];
    expect(select).not.toMatch(/raw_text|processed_json(?!->metadata->book)/);
    expect(calls[1].filters).toContainEqual(['eq', 'visibility', 'public']);
    expect(calls[1].filters.find(([name]) => name === 'in')[2].sort()).toEqual([10, 11]);
  });
  it('그림 구간은 자료 조회 없이 ✓만 · 진행 조회 실패는 상태 없음', async () => {
    const art = [{ key: 'art-a:1', materialId: 50 }];
    const ok = client({ progress: [row(50, 'x', { is_completed: true })] });
    expect([...(await classicsProgressOf({ supabase: ok.supabase, user: { id: 'me' } }, { books: [], art })).read]).toEqual(['art-a:1']);
    expect(ok.calls.map((q) => q.table)).toEqual(['reading_progress']);
    const failed = client({ progressError: { message: 'boom' } });
    expect(await classicsProgressOf({ supabase: failed.supabase, user: { id: 'me' } }, { books: [book], art })).toEqual({ resume: {}, read: new Set() });
  });
});
