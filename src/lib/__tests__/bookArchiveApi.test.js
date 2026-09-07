import { beforeEach, describe, expect, it, vi } from 'vitest';
const { auth, base } = vi.hoisted(() => ({ auth: vi.fn(), base: { slug: 'first', title: '기존 교재', sections: [{ heading: '읽어요', examples: [{ en: 'I read a book.', ko: '책을 읽어요.' }] }, { type: 'vocabPreview', vocabs: [{ word: 'book', meanings: ['책'], exampleSentence: 'Read this book.' }] }] } }));
vi.mock('@/lib/supabaseServer', () => ({ requireUser: auth }));
vi.mock('@/content/refGrammarLoaders', () => ({ getGrammarManifest: () => ({ levels: [{ key: 'A1', chapters: [base] }] }), loadChapter: async () => ({ registry: { base: '/english', getChapter: () => ({ chapter: base }) }, data: { chapter: base } }) }));
vi.mock('@/lib/contentOverrides', async actual => ({ ...await actual(), getOverridesForLang: async () => new Map() }));
import * as vocabulary from '@/app/api/learning/vocabulary/route';
import * as links from '@/app/api/learning/material-links/route';
let role, db, saved;
const user = '10000000-0000-0000-0000-000000000001';
const word = { word_text: 'book', meaning: '책', language: 'English' };
const request = body => new Request('https://manabi.test/api/learning', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
 role = 'admin'; saved = [];
 db = { rpc: vi.fn(async () => ({ data: { contextAdded: true }, error: null })), from: vi.fn(table => {
  const data = () => table === 'profiles' ? { role } : table === 'reading_materials' ? { id: 1, owner_id: user, title: '내 자료', visibility: 'private' } : [];
  const result = () => ({ data: data(), error: null });
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => result(), upsert: value => { saved.push(value); return q; }, then: done => Promise.resolve(result()).then(done) }; return q;
 }) };
 auth.mockResolvedValue({ user: { id: user }, supabase: db });
});
describe('old learning contracts remain available to administrators', () => {
 it('admin examples retain verified source text and vocabulary still ignores forged meanings', async () => {
  const response = await vocabulary.POST(request({ word, source: { kind: 'textbook', chapterSlug: 'first', sectionIndex: 0, exampleIndex: 0 } }));
  expect(response.status).toBe(200); expect(db.rpc.mock.calls[0][1].p_source).toMatchObject({ quote: 'I read a book.', translation: '책을 읽어요.' });
  await vocabulary.POST(request({ word: { ...word, meaning: 'forged' }, source: { kind: 'textbook', chapterSlug: 'first', sectionIndex: 1, vocabIndex: 0 } }));
  expect(db.rpc.mock.calls[1][1].p_word.meaning).toBe('책');
 });
 it('admin requests still reject unknown source locations and words outside the example', async () => {
  expect((await vocabulary.POST(request({ word, source: { kind: 'textbook', chapterSlug: 'missing', sectionIndex: 0, exampleIndex: 0 } }))).status).toBe(404);
  expect((await vocabulary.POST(request({ word: { ...word, word_text: 'forged' }, source: { kind: 'textbook', chapterSlug: 'first', sectionIndex: 0, exampleIndex: 0 } }))).status).toBe(400);
 });
 it('admin can connect an owned material and the catalog points inside the archive', async () => {
  expect((await links.POST(request({ lang: 'English', slug: 'first', kind: 'reading', materialId: 1 }))).status).toBe(200);
  expect(saved[0]).toMatchObject({ user_id: user, chapter_slug: 'first', material_id: 1 });
  const response = await links.GET(new Request('https://manabi.test/?lang=English&kind=reading&id=1'));
  expect((await response.json()).catalog[0].chapters[0].href).toBe('/admin/legacy-textbooks/english/grammar/first');
 });
 it('members can keep their material but cannot browse, save, or newly link archived chapters', async () => {
  role = 'member';
  const response = await links.GET(new Request('https://manabi.test/?lang=English&kind=reading&id=1'));
  expect(response.status).toBe(200); expect((await response.json()).catalog).toEqual([]);
  expect((await links.GET(new Request('https://manabi.test/?lang=English&slug=first'))).status).toBe(403);
  expect((await links.POST(request({ lang: 'English', slug: 'first', kind: 'reading', materialId: 1 }))).status).toBe(403);
  expect((await vocabulary.POST(request({ word, source: { kind: 'textbook', chapterSlug: 'first', sectionIndex: 0, exampleIndex: 0 } }))).status).toBe(403);
  expect(db.rpc).not.toHaveBeenCalled(); expect(saved).toEqual([]);
 });
});
