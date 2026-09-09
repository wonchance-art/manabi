import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
const { client, auth } = vi.hoisted(() => ({ client: vi.fn(), auth: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: client }));
vi.mock('@/lib/supabaseServer', () => ({ requireUser: auth }));
import { middleware } from '../../middleware';
import { canReadLegacyTextbook, resolveSave } from '../server/learningContext';
import * as review from '@/app/api/learning/book-review/route';
function database(role = 'member') {
  const calls = [];
  const db = { from: vi.fn(table => {
    const call = { table, filters: [] }; calls.push(call);
    const result = { data: table === 'profiles' ? { role } : [], error: null };
    const q = { select: () => q, eq: (key, value) => { call.filters.push([key, value]); return q; }, order: () => q, range: () => q, maybeSingle: async () => result, single: async () => result, then: done => Promise.resolve(result).then(done) };
    return q;
  }), auth: { getUser: async () => ({ data: { user: { id: 'alice' } } }) } };
  return { db, calls };
}
beforeEach(() => { vi.clearAllMocks(); });
describe('archive and personal review authorization', () => {
  it('redirects legacy URLs with their query intact and checks admin role at the destination', async () => {
    const first = await middleware(new NextRequest('https://manabi.test/japanese/grammar/n5-04-desu-da?sourceRevision=one'));
    expect(first.headers.get('location')).toBe('https://manabi.test/admin/legacy-textbooks/japanese/grammar/n5-04-desu-da?sourceRevision=one');
    expect(client).not.toHaveBeenCalled();
    const { db } = database(); client.mockReturnValue(db);
    expect((await middleware(new NextRequest(first.headers.get('location')))).headers.get('location')).toBe('https://manabi.test/');
    client.mockReturnValue(database('admin').db);
    expect((await middleware(new NextRequest(first.headers.get('location')))).headers.get('x-middleware-next')).toBe('1');
  });
  it('ignores claimed metadata roles and verifies the server-side profile for legacy saves', async () => {
    const { db, calls } = database('member');
    expect(await canReadLegacyTextbook(db, 'alice')).toBe(false);
    await expect(resolveSave(db, 'alice', { word: { language: 'Japanese', word_text: 'わたし', meaning: '나' }, source: { kind: 'textbook', chapterSlug: 'n5-04-desu-da', sectionIndex: 0, exampleIndex: 0 } })).rejects.toMatchObject({ status: 403 });
    expect(calls.every(call => call.table === 'profiles' && call.filters.some(([key, value]) => key === 'id' && value === 'alice'))).toBe(true);
    expect(await canReadLegacyTextbook(database('admin').db, 'alice')).toBe(true);
  });
  it('never queries personal review without authentication and applies ownership filters on both tables', async () => {
    auth.mockResolvedValue({ error: '로그인 필요', status: 401 });
    expect((await review.GET(new Request('https://manabi.test/api/learning/book-review'))).status).toBe(401);
    const { db, calls } = database(); auth.mockResolvedValue({ user: { id: 'alice' }, supabase: db });
    const response = await review.GET(new Request('https://manabi.test/api/learning/book-review'));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(calls[0].filters).toEqual(expect.arrayContaining([['user_id', 'alice'], ['user_vocabulary.user_id', 'alice'], ['kind', 'textbook'], ['locator->>bookId', 'japanese-n5']]));
    expect(await response.json()).toEqual({ items: [], nextOffset: null });
    expect((await review.GET(new Request('https://manabi.test/api/learning/book-review?offset=-1'))).status).toBe(400);
  });
});
