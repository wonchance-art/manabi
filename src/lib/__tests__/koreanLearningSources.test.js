import {describe, expect, it, vi} from 'vitest';
import {createHash, webcrypto} from 'node:crypto';
vi.stubGlobal('crypto', webcrypto);
vi.mock('@/content/refGrammarLoaders', () => ({loadChapter: vi.fn(), getGrammarManifest: vi.fn()}));
vi.mock('@/lib/publishedChapter', () => ({loadPublishedRegistry: vi.fn()}));
import {koreanReadingSource, learningSourceRevision, readingSourceTarget, sourceHref, tokenContext, LEARNING_LANGUAGES} from '../learningSources';
import {resolveSave, chapterMeta} from '../server/learningContext';
import {VIEWER_LANGUAGES} from '../viewerLanguage';
import {runPreservedReanalysis} from '../reanalysisPreservation';

const span = (start, end) => ({start, end, unit: 'utf16'});
const raw = '😀  학교에 갔어요.\r\n갔어요  학교에 갔어요.\r\n끝';
function material(text = raw) {
  const first = text.indexOf('갔어요'), second = text.lastIndexOf('갔어요');
  return {id: 211, owner_id: 'alice', visibility: 'private', direction: 'read', raw_text: text,
    processed_json: {metadata: {language: 'Korean', explanationLocale: 'ko'}, sequence: ['old-first', 'old-second'],
      dictionary: {'old-first': {text: '갔어요', base_form: '가다', meaning: '분석기의 뜻', sourceSpan: span(first, first + 3)},
        'old-second': {text: '갔어요', base_form: '가다', meaning: '분석기의 뜻', sourceSpan: span(second, second + 3)}}}};
}
function client(row) {
  const query = {select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: async () => ({data: row, error: null})};
  return {from: vi.fn(() => query), query, rpc: vi.fn()};
}
async function payload(row = material(), tokenId = 'old-second', meaning = '去了') {
  const token = {...row.processed_json.dictionary[tokenId], id: tokenId};
  return {word: {word_text: token.text, base_form: token.base_form, meaning, language: 'Korean'},
    source: await koreanReadingSource({materialId: row.id, rawText: row.raw_text, token})};
}
const options = async row => ({rawText: row.raw_text, sourceRevision: await learningSourceRevision(row.raw_text)});

describe('Korean raw source contract', () => {
  it('registers vocabulary without enabling the unverified release or course registry', () => {
    expect(LEARNING_LANGUAGES).toContain('Korean');
    expect(VIEWER_LANGUAGES.Korean.capabilities).toMatchObject({save: 'blocked', review: 'blocked', courses: 'unsupported', pdf: 'unsupported'});
    expect(() => chapterMeta('Korean', 'anything')).toThrow();
  });
  it('uses the full raw source SHA-256 independent of display locale and token IDs', async () => {
    const expected = createHash('sha256').update(JSON.stringify(['raw-utf16-v1', raw])).digest('hex');
    expect(await learningSourceRevision(raw)).toBe(`reading-source:v2:${expected}`);
    expect(await learningSourceRevision(raw)).not.toBe(await learningSourceRevision(raw.normalize('NFC')));
    expect(await learningSourceRevision(raw)).not.toBe(await learningSourceRevision(raw.replaceAll('\r\n', '\n')));
    expect(await learningSourceRevision(null)).toBeNull();
  });
  it('retains exact emoji, spaces, NFD, CRLF and full written surface separately from lemma', async () => {
    const row = material(), body = await payload(row), before = structuredClone(row);
    const result = await resolveSave(client(row), 'alice', body);
    expect(result.word).toMatchObject({word_text: '가다', meaning: '去了', language: 'Korean'});
    expect(result.source.quote).toBe('갔어요  학교에 갔어요.\r\n');
    expect(result.source.locator).toEqual({version: 1, sourceRevision: body.source.sourceRevision,
      sourceSpan: body.source.sourceSpan, quoteSpan: body.source.quoteSpan, surface: '갔어요'});
    expect(result.source.locator).not.toHaveProperty('tokenId');
    expect(row).toEqual(before);
    const nfd = '갔어요';
    const source = await koreanReadingSource({materialId: 211, rawText: raw,
      token: {id: 'nfd', text: nfd, base_form: '가다', sourceSpan: span(raw.indexOf(nfd), raw.indexOf(nfd) + nfd.length)}});
    expect(source.surface).toBe(nfd); expect(source.quote).toBe(result.source.quote);
    const first = await payload(row, 'old-first');
    expect(first.source.quote).toBe('😀  학교에 갔어요.\r\n');
  });
  it('does not join Korean legacy token text into reconstructed quotes', () => {
    expect(tokenContext(material().processed_json, 'old-first')).toBeNull();
  });
  it('keeps source identity when explanation locale and generated token meaning change', async () => {
    const row = material(), body = await payload(row);
    const original = await resolveSave(client(row), 'alice', body);
    for (const locale of ['ko', 'zh-CN', 'zh-TW']) {
      row.processed_json.metadata.explanationLocale = locale;
      row.processed_json.dictionary['old-second'].meaning = `generated ${locale}`;
      const localized = await resolveSave(client(row), 'alice', {...body, uiLocale: locale, explanationLocale: locale});
      expect(localized).toEqual(original);
    }
  });
  it('preserves a confirmed meaning conflict for the RPC instead of auto-merging it', async () => {
    const row = material();
    const first = await resolveSave(client(row), 'alice', await payload(row, 'old-second', '사용자 뜻'));
    const second = await resolveSave(client(row), 'alice', await payload(row, 'old-second', '学习者確認的意思'));
    expect(second.source).toEqual(first.source);
    expect(second.word.meaning).toBe('学习者確認的意思'); expect(second.word.meaning).not.toBe(first.word.meaning);
    await expect(resolveSave(client(row), 'alice', await payload(row, 'old-second', ''))).rejects.toMatchObject({status: 400});
  });
  it('relocates repeated occurrences by raw offsets after reused token IDs and declines ambiguity', async () => {
    const row = material('갔어요 갔어요'), saved = (await resolveSave(client(row), 'alice', await payload(row))).source;
    const json = {metadata: {language: 'Korean'}, sequence: ['old-second', 'new-second'], dictionary: {
      'old-second': {...row.processed_json.dictionary['old-first']}, 'new-second': {...row.processed_json.dictionary['old-second']}}};
    expect(readingSourceTarget(json, saved, await options(row))).toBe('new-second');
    expect(readingSourceTarget(json, saved)).toBeNull();
    expect(readingSourceTarget(json, {locator: {tokenId: 'old-second', surface: '갔어요'}, quote: '갔어요 갔어요'}, await options(row))).toBeNull();
    json.sequence.push('duplicate'); json.dictionary.duplicate = {...json.dictionary['new-second']};
    expect(readingSourceTarget(json, saved, await options(row))).toBeNull();
  });
  it('declines stale source revisions even when the saved literal occurrence survives', async () => {
    const row = material(), saved = (await resolveSave(client(row), 'alice', await payload(row))).source;
    const changed = {...row, raw_text: row.raw_text + ' changed'};
    expect(readingSourceTarget(row.processed_json, saved, await options(changed))).toBeNull();
    expect(readingSourceTarget(row.processed_json, {...saved, locator: {...saved.locator, version: 2}}, await options(row))).toBeNull();
  });
  it('keeps a saved repeated occurrence and its corrected meaning through two locale reanalyses', async () => {
    const row = { ...material('학교 학교'), processed_json: {
      status: 'completed', failed_indices: [], metadata: { language: 'Korean', explanationLocale: 'ko',
        viewerCorrections: { id_0_2_old: ['meaning'] } },
      sequence: ['id_0_0_old', 'id_0_1_old', 'id_0_2_old'], dictionary: {
        id_0_0_old: { text: '학교', meaning: '첫 학교', sourceSpan: span(0, 2) },
        id_0_1_old: { text: ' ', meaning: '', pos: '기호', sourceSpan: span(2, 3) },
        id_0_2_old: { text: '학교', meaning: '사용자가 고친 둘째 학교', sourceSpan: span(3, 5) },
      } } };
    const savedSource = (await resolveSave(client(row), 'alice', await payload(row, 'id_0_2_old', '사용자가 고친 둘째 학교'))).source;
    let current = row;
    for (const locale of ['zh-CN', 'zh-TW']) {
      const query = {select: () => query, eq: () => query, order: () => query, range: async () => ({data: [], error: null})};
      const db = { from: vi.fn(() => query), rpc: vi.fn(async (_, args) => ({data: {material: {
        ...current, raw_text: args.p_raw, processed_json: args.p_json,
      }}, error: null})) };
      current = await runPreservedReanalysis(db, current, new AbortController().signal, async () => ({
        ...structuredClone(current.processed_json), metadata: {language: 'Korean', explanationLocale: locale},
        // Fresh IDs deliberately swap the repeated tokens' previous IDs.
        sequence: ['id_0_2_old', 'id_0_1_old', 'id_0_0_old'], dictionary: {
          id_0_2_old: {text: '학교', meaning: `${locale} first`, explanationLocale: locale, sourceSpan: span(0, 2)},
          id_0_1_old: {text: ' ', meaning: '', pos: '기호', sourceSpan: span(2, 3)},
          id_0_0_old: {text: '학교', meaning: `${locale} second`, explanationLocale: locale, sourceSpan: span(3, 5)},
        },
      }), {explanationLocale: locale});
      const target = readingSourceTarget(current.processed_json, savedSource, await options(current));
      expect(target).toBe('id_0_2_old');
      expect(current.processed_json.dictionary[target]).toMatchObject({meaning: '사용자가 고친 둘째 학교', meaningLocale: 'ko'});
      expect(current.processed_json.dictionary.id_0_0_old.meaning).toBe(`${locale} first`);
      const resolved = await resolveSave(client(current), 'alice', await payload(current, target, '사용자가 고친 둘째 학교'));
      expect(resolved.source).toEqual(savedSource);
      expect(db.from).toHaveBeenCalledWith('token_corrections');
      expect(db.rpc).toHaveBeenCalledWith('viewer_replace_analysis', expect.objectContaining({p_expected_raw: '학교 학교'}));
    }
  });
  it('rejects arbitrary, partial, stale and NFC/whitespace-altered selections without writes', async () => {
    const row = material(), body = await payload(row);
    const patches = [{sourceRevision: 'stale'}, {sourceSpan: span(0, 1)},
      {sourceSpan: span(body.source.sourceSpan.start, body.source.sourceSpan.end - 1), surface: '갔어'},
      {surface: '가다'}, {quote: body.source.quote.normalize('NFC')}, {quote: body.source.quote.trim()},
      {quoteSpan: span(body.source.sourceSpan.start, body.source.sourceSpan.end), quote: '갔어요'},
      {tokenId: 'missing'}, {sourceSpan: undefined}, {quoteSpan: undefined}, {quote: undefined}];
    for (const patch of patches) {
      const db = client(row);
      await expect(resolveSave(db, 'alice', {...body, source: {...body.source, ...patch}})).rejects.toMatchObject({status: 400});
      expect(db.rpc).not.toHaveBeenCalled();
    }
  });
  it('requires an analyzed eojeol and never truncates long source lines', async () => {
    for (const token of [{id: 'drag', text: '갔어요'}, {id: 'bad', text: '\ud83d', sourceSpan: span(0, 1)},
      {id: 'space', text: ' ', sourceSpan: span(2, 3)}, {id: 'partial', text: '갔어', sourceSpan: span(0, 2)}]) {
      expect(await koreanReadingSource({materialId: 211, rawText: raw, token})).toBeNull();
    }
    expect(await koreanReadingSource({materialId: 211, rawText: '갔어요' + ' '.repeat(4000),
      token: {id: 'long', text: '갔어요', sourceSpan: span(0, 3)}})).toBeNull();
  });
  it('accepts a shared raw revision for UI batching but server rejects a stale supplied digest', async () => {
    const row = material(), token = {...row.processed_json.dictionary['old-second'], id: 'old-second'};
    const revision = await learningSourceRevision(raw);
    const shared = await koreanReadingSource({materialId: 211, rawText: raw, token, sourceRevision: revision});
    expect(shared).toEqual((await payload(row)).source);
    expect(await koreanReadingSource({materialId: 211, rawText: raw, token, sourceRevision: 'invalid'})).toBeNull();
    const stale = await koreanReadingSource({materialId: 211, rawText: raw, token,
      sourceRevision: await learningSourceRevision(raw + 'stale')});
    await expect(resolveSave(client(row), 'alice', {...await payload(row), source: stale})).rejects.toMatchObject({status: 400});
  });
  it('enforces private ownership even when a permissive DB mock returns another account', async () => {
    const row = material(), body = await payload(row), db = client({...row, owner_id: 'bob'});
    await expect(resolveSave(db, 'alice', body)).rejects.toMatchObject({status: 404});
    expect(db.query.eq).toHaveBeenCalledWith('id', '211'); expect(db.rpc).not.toHaveBeenCalled();
    const publicRow = {...row, owner_id: 'bob', visibility: 'public'};
    expect((await resolveSave(client(publicRow), 'alice', body)).word.language).toBe('Korean');
  });
  it('rejects Korean PDF/course/note and preserves historical writing-note metadata', async () => {
    const row = material(), body = await payload(row);
    for (const kind of ['pdf', 'textbook', 'course', 'note']) {
      const db = client(row);
      await expect(resolveSave(db, 'alice', {...body, source: {...body.source, kind}})).rejects.toMatchObject({status: 400});
      expect(db.from).not.toHaveBeenCalled();
    }
    for (const changes of [{direction: 'write'}, {processed_json: {...row.processed_json,
      metadata: {language: 'Japanese'}}}, {processed_json: {...row.processed_json,
      metadata: {...row.processed_json.metadata, studyNote: {version: 1}}}}]) {
      const note = {...row, ...changes}, before = structuredClone(note);
      await expect(resolveSave(client(note), 'alice', body)).rejects.toMatchObject({status: 400});
      expect(note).toEqual(before);
    }
  });
  it('uses existing authenticated context links without private quote in URL', () => {
    expect(sourceHref({kind: 'reading', material_id: 211, id: '11111111-1111-4111-8111-111111111111',
      quote: raw, locator: {version: 1, surface: '갔어요'}})).toBe('/viewer/211?sourceContext=11111111-1111-4111-8111-111111111111');
  });
  it('preserves legacy language token-meaning precedence', async () => {
    const row = {id: 211, owner_id: 'alice', visibility: 'private', raw_text: 'Hello', processed_json: {
      metadata: {language: 'English'}, sequence: ['hello'], dictionary: {hello: {text: 'Hello', base_form: 'hello', meaning: '서버의 기존 뜻'}}}};
    const result = await resolveSave(client(row), 'alice', {word: {language: 'English', meaning: '새 표시 뜻'},
      source: {kind: 'reading', materialId: '211', tokenId: 'hello'}});
    expect(result.word.meaning).toBe('서버의 기존 뜻');
    expect(result.source.locator).toEqual({tokenId: 'hello', surface: 'Hello'});
  });
});
