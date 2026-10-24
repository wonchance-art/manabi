import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { client, publicClient, admin, user } = vi.hoisted(() => ({ client: vi.fn(), publicClient: vi.fn(), admin: vi.fn(), user: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ createSupabaseServerClient: client, createSupabasePublicClient: publicClient, requireAdmin: admin, requireUser: user }));
// 발행 성공 뒤 책장 ISR 무효화(GUEST-STATIC-001 3단계) — 라우트 밖에서는 Next 저장소가 없어 실제 revalidatePath가 던진다.
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

import { readFile } from 'node:fs/promises';
import { candidate, checkedAsset, currentCandidate } from '@/lib/textbook/server';
import { verifiedAsset } from '@/lib/textbook/assetFile';
import { resolveBookSelection, bookSourceHref } from '@/lib/textbook/sources';
import { sourceHref } from '@/lib/learningSources';
import { resolveSave } from '@/lib/server/learningContext';
import { publishedReading } from '@/lib/server/bookReading';
import { GET as n4Asset } from '@/app/api/books/japanese-n4/[edition]/asset/route';
import { GET as bookReview } from '@/app/api/learning/book-review/route';
import { POST as n4Publish } from '@/app/api/admin/books/japanese-n4/route';
import { parseReviewScope, safeBookReturn, serializeReviewScope } from '@/lib/reviewScopeUrl';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const N4 = 'japanese-n4', N5 = 'japanese-n5';
let n4, n5, db, queries, state;

function query(table) {
  const record = { table, filters: [], range: null };
  queries.push(record);
  const result = () => {
    if (state.error) return { data: null, error: state.error };
    if (table === 'textbook_book_editions') {
      const matches = !record.filters.some(([key, value]) => key === 'book_id' && value !== N4)
        && !record.filters.some(([key, value]) => key === 'edition_id' && value !== n4.editionId);
      return { data: matches ? state.edition : null, error: null };
    }
    if (table === 'textbook_book_releases') return { data: state.release, error: null };
    if (table === 'vocabulary_contexts') return { data: state.contexts, error: null };
    return { data: null, error: null };
  };
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((key, value) => { record.filters.push([key, value]); return chain; }),
    in: vi.fn((key, values) => { record.filters.push([key, values]); return chain; }),
    order: vi.fn(() => chain),
    range: vi.fn((from, to) => { record.range = [from, to]; return Promise.resolve(result()); }),
    maybeSingle: vi.fn(async () => result()),
  };
  return chain;
}

function payload(change = {}) {
  return {
    word: { word_text: 'なくす', meaning: '잃어버리다', language: 'Japanese' },
    source: { kind: 'textbook', bookId: N4, editionId: n4.editionId, pageId: 'u01-start', quote: 'なくす', ...change },
  };
}

beforeAll(async () => { n4 = await currentCandidate(N4); n5 = await currentCandidate(); });
beforeEach(() => {
  vi.clearAllMocks();
  queries = [];
  state = {
    edition: { book_id: N4, edition_id: n4.editionId, content_hash: n4.contentHash, artifact_manifest: n4.artifactManifest },
    release: { book_id: N4, edition_id: n4.editionId }, contexts: [], error: null,
  };
  db = { from: vi.fn(query), rpc: vi.fn() };
  client.mockResolvedValue(db);
  publicClient.mockReturnValue(db);
  admin.mockResolvedValue({ error: '관리자 권한이 필요해요.', status: 403 });
  user.mockResolvedValue({ user: { id: ACTOR }, supabase: db });
});

const asset = file => n4Asset(new Request(`https://fixture.invalid/api/books/japanese-n4/${n4.editionId}/asset?${new URLSearchParams({ file })}`), { params: Promise.resolve({ edition: n4.editionId }) });

describe('N4 immutable publication and cross-book boundaries', () => {
  it('uses the actual N4 artifact and rejects valid editions borrowed from the other book', async () => {
    expect(n4.bookId).toBe(N4); expect(n4.manuscript.lessons).toHaveLength(42);
    expect(n5.bookId).toBe(N5);
    await expect(candidate(n5.editionId, N4)).rejects.toMatchObject({ status: 404 });
    await expect(candidate(n4.editionId, N5)).rejects.toMatchObject({ status: 404 });
    for (const id of ['../japanese-n5', 'https://evil.invalid', '__proto__']) {
      await expect(candidate(n4.editionId, id)).rejects.toMatchObject({ status: 404 });
    }
    await expect(candidate('../bundle.json', N4)).rejects.toMatchObject({ status: 404 });
  });

  it('never exposes unpublished candidate assets or manuscript to an ordinary account', async () => {
    state.edition = null;
    expect((await asset('index.html')).status).toBe(404);
    await expect(publishedReading(n4.editionId, true, N4)).rejects.toMatchObject({ status: 403 });
    await expect(publishedReading(n4.editionId, false, N4)).rejects.toMatchObject({ status: 404 });
    admin.mockResolvedValue({ user: { id: ACTOR }, supabase: db });
    const preview = await asset('index.html');
    expect(preview.status).toBe(200);
    expect(preview.headers.get('cache-control')).toBe('private, no-store');
    expect(await publishedReading(n4.editionId, true, N4)).toMatchObject({ book: { bookId: N4 }, preview: true });
  });

  it('rejects a published content or asset stamp mismatch for reading and saving alike', async () => {
    for (const change of [{ content_hash: '0'.repeat(64) }, { artifact_manifest: { ...n4.artifactManifest, bundleHash: '0'.repeat(64) } }]) {
      const correct = state.edition;
      state.edition = { ...correct, ...change };
      expect((await asset('index.html')).status).toBe(503);
      await expect(publishedReading(n4.editionId, false, N4)).rejects.toMatchObject({ status: 503 });
      await expect(resolveSave(db, ACTOR, payload())).rejects.toMatchObject({ status: 503 });
      state.edition = correct;
    }
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('rejects inherited manifest names in the shared verifiers before attempting a disk read', async () => {
    const elsewhere = { ...n4, editionId: 'no-such-edition-folder' };
    for (const file of ['__proto__', 'constructor', 'toString']) {
      expect(() => checkedAsset(elsewhere, file, Buffer.from('unused'))).toThrow(expect.objectContaining({ status: 404 }));
      await expect(verifiedAsset(elsewhere, file)).rejects.toMatchObject({ status: 404 });
    }
    expect(readFile).not.toHaveBeenCalled();
  });

  it('serves public immutable files without cookies and denies unlisted or unsafe file paths', async () => {
    const response = await asset('index.html');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(client).not.toHaveBeenCalled();
    expect(publicClient).toHaveBeenCalledOnce();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toContain('일본어 N4');
    for (const file of ['bundle.json', '../bundle.json', '%2e%2e/bundle.json', '..\\bundle.json', 'https://evil.invalid/a', '/etc/passwd', 'missing.js', '__proto__', 'constructor', 'toString']) {
      expect((await asset(file)).status, file).toBe(404);
    }
    expect(queries.filter(item => item.table === 'textbook_book_editions').every(item => item.filters.some(([key, value]) => key === 'book_id' && value === N4))).toBe(true);
  });
});

describe('N4 administrative and return-navigation boundaries', () => {
  const publish = body => n4Publish(new Request('https://fixture.invalid/api/admin/books/japanese-n4', { method: 'POST', body: JSON.stringify(body) }));
  it('requires an administrator and expected versions, and fixes the publish target from the route rather than JSON', async () => {
    const body = { action: 'publish', bookId: N5, editionId: n4.editionId, expectedDraftVersion: null, expectedReleaseVersion: null };
    expect((await publish(body)).status).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
    admin.mockResolvedValue({ user: { id: ACTOR }, supabase: db });
    expect((await publish({ ...body, expectedReleaseVersion: undefined })).status).toBe(428);
    expect((await publish({ ...body, editionId: n5.editionId })).status).toBe(404);
    expect(db.rpc).not.toHaveBeenCalled();
    db.rpc.mockResolvedValue({ data: { book_id: N4, edition_id: n4.editionId }, error: null });
    expect((await publish(body)).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith('publish_textbook_book', expect.objectContaining({ p_book_id: N4, p_edition_id: n4.editionId, p_expected_release_version: null }));
  });

  it('keeps a review return inside its selected book and rejects open redirects and ambiguous editions', () => {
    const n4Return = `/books/${N4}?edition=${n4.editionId}#u01-start`;
    const n5Return = `/books/${N5}?edition=${n5.editionId}#u01-start`;
    expect(safeBookReturn(n4Return, N4)).toBe(n4Return);
    for (const value of [n5Return, `https://evil.invalid${n4Return}`, `//evil.invalid${n4Return}`, n4Return.replace('#', '&edition=' + n4.editionId + '#'), n4Return.replace('#u01-start', '#javascript:alert(1)')]) {
      expect(safeBookReturn(value, N4)).toBeNull();
    }
    const scope = { lang: 'Japanese', source: { kind: 'book', bookId: N4, from: 1, to: 42 }, state: 'due' };
    const url = new URL(serializeReviewScope(scope, { returnTo: n5Return }), 'https://fixture.invalid');
    expect(url.searchParams.has('returnTo')).toBe(false);
    expect(parseReviewScope(url.searchParams).returnTo).toBe(`/books/${N4}`);
  });
});

describe('N4 exact source and authenticated review ownership', () => {
  it('binds a real source quote to the server-resolved book, immutable edition, page and lesson', async () => {
    const input = payload({ lesson: 42, href: 'javascript:alert(1)', locator: { bookId: N5 } });
    const saved = await resolveSave(db, ACTOR, input);
    expect(saved.source.chapterSlug).toBe('n4-book-u01');
    expect(saved.source.locator).toMatchObject({ bookId: N4, editionId: n4.editionId, revision: n4.editionId, pageId: 'u01-start' });
    expect(saved.source).not.toHaveProperty('href');
    expect(sourceHref({ ...saved.source, lang: 'Japanese', chapter_slug: saved.source.chapterSlug })).toBe(`/books/${N4}?edition=${n4.editionId}#u01-start`);
    const reads = queries.filter(item => item.table === 'textbook_book_editions');
    expect(reads).toHaveLength(1);
    expect(reads[0].filters).toEqual(expect.arrayContaining([['book_id', N4], ['edition_id', n4.editionId]]));
  });

  it('rejects forged source text, selections, language and cross-book edition substitutions', async () => {
    for (const change of [{ quote: '原文にない偽の文' }, { pageId: '__proto__' }, { pageId: 'missing' }]) {
      await expect(resolveSave(db, ACTOR, payload(change))).rejects.toMatchObject({ status: 400 });
    }
    const absent = payload(); absent.word.word_text = '原文にない単語';
    await expect(resolveSave(db, ACTOR, absent)).rejects.toMatchObject({ status: 400 });
    const wrongLanguage = payload(); wrongLanguage.word.language = 'English';
    await expect(resolveSave(db, ACTOR, wrongLanguage)).rejects.toMatchObject({ status: 400 });
    await expect(resolveSave(db, ACTOR, payload({ editionId: n5.editionId }))).rejects.toMatchObject({ status: 404 });
    await expect(resolveSave(db, ACTOR, payload({ bookId: N5 }))).rejects.toMatchObject({ status: 404 });
    state.edition = null;
    await expect(resolveSave(db, ACTOR, payload())).rejects.toMatchObject({ status: 404 });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('rebuilds links from validated identifiers rather than any client-supplied destination', () => {
    const locator = { bookId: N4, editionId: n4.editionId, pageId: 'u01-start' };
    expect(bookSourceHref({ locator, href: 'https://evil.invalid' })).toBe(`/books/${N4}?edition=${n4.editionId}#u01-start`);
    for (const change of [{ bookId: '__proto__' }, { editionId: '../../secret' }, { pageId: 'javascript:alert(1)' }, { pageId: '../index.html' }]) {
      expect(bookSourceHref({ locator: { ...locator, ...change } })).toBeNull();
    }
    expect(() => resolveBookSelection(n5, payload().source, payload().word)).toThrow();
  });

  it('limits an N4 review scope by both owner columns, the requested book and N4 chapter range', async () => {
    const response = await bookReview(new Request('https://fixture.invalid/api/learning/book-review?scope=1&book=japanese-n4&from=5&to=7'));
    expect(response.status).toBe(200);
    const scope = queries.find(item => item.table === 'vocabulary_contexts');
    expect(scope.filters).toEqual(expect.arrayContaining([
      ['user_id', ACTOR], ['user_vocabulary.user_id', ACTOR], ['kind', 'textbook'], ['locator->>bookId', N4],
      ['chapter_slug', ['n4-book-u05', 'n4-book-u06', 'n4-book-u07']],
    ]));
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('keeps N5 as the existing default, and rejects an unsupported book before any review query', async () => {
    expect((await bookReview(new Request('https://fixture.invalid/api/learning/book-review?scope=1'))).status).toBe(200);
    expect(queries.at(-1).filters).toContainEqual(['locator->>bookId', N5]);
    queries.length = 0;
    expect((await bookReview(new Request('https://fixture.invalid/api/learning/book-review?scope=1&book=japanese-n4&book=japanese-n5'))).status).toBe(400);
    expect(queries).toEqual([]);
    expect((await bookReview(new Request('https://fixture.invalid/api/learning/book-review?scope=1&book=__proto__'))).status).toBe(400);
    expect(queries).toEqual([]);
    user.mockResolvedValue({ error: '로그인이 필요해요.', status: 401 });
    expect((await bookReview(new Request('https://fixture.invalid/api/learning/book-review?scope=1&book=japanese-n4'))).status).toBe(401);
    expect(queries).toEqual([]);
  });
});
