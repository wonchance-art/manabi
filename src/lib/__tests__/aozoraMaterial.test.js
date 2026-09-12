import { describe, expect, it } from 'vitest';
import { createAozoraMaterialDraft } from '../aozoraMaterial.js';
import { parseAozoraText } from '../aozoraParser.js';

const catalogEntry = (overrides = {}) => ({
  schemaVersion: 1,
  personId: '000148',
  workId: '773',
  title: '試験作品',
  author: '試験作者',
  language: 'ja',
  cardUrl: 'https://www.aozora.gr.jp/cards/000148/card773.html',
  sourceFileUrl: 'https://www.aozora.gr.jp/cards/000148/files/773_test.txt',
  sourceFormat: 'txt',
  attribution: { author: '試験作者', translator: null, illustrator: null },
  rights: {
    status: 'approved',
    basis: 'public-domain',
    reviewedBy: 'owner',
    reviewedAt: '2026-09-09',
    reviewedJurisdictions: ['JP', 'KR'],
    evidenceUrl: 'https://www.aozora.gr.jp/cards/000148/card773.html',
  },
  ...overrides,
});

const source = [
  '第一章',
  '私は｜先生《せんせい》と歩いた。',
  '',
  '第二章',
  '明日《あした》も歩いた。',
].join('\n');

describe('createAozoraMaterialDraft', () => {
  it('turns source headings into ordered existing-book-compatible chapter drafts', () => {
    const document = parseAozoraText(source, { title: '試験作品', author: '試験作者' });
    const draft = createAozoraMaterialDraft(catalogEntry(), document);

    expect(draft.book).toEqual({
      key: 'aozora-000148-000773', title: '試験作品', author: '試験作者', total: 2,
    });
    expect(draft.chapters.map(({ order, title, rawText }) => ({ order, title, rawText }))).toEqual([
      { order: 1, title: '第一章', rawText: '私は先生と歩いた。' },
      { order: 2, title: '第二章', rawText: '明日も歩いた。' },
    ]);
    expect(draft.chapters[0].metadata.book).toEqual({
      key: 'aozora-000148-000773', title: '試験作品', author: '試験作者', order: 1, total: 2,
    });
  });

  it('maps authoritative Aozora ruby to chapter-local character offsets', () => {
    const draft = createAozoraMaterialDraft(
      catalogEntry(),
      parseAozoraText(source, { title: '試験作品', author: '試験作者' }),
    );

    expect(draft.chapters[0].rubyLocks).toEqual([
      { start: 2, end: 4, base: '先生', reading: 'せんせい', source: 'aozora', locked: true },
    ]);
    expect(draft.chapters[1].rubyLocks).toEqual([
      { start: 0, end: 2, base: '明日', reading: 'あした', source: 'aozora', locked: true },
    ]);
    expect(draft.diagnostics).toMatchObject({ rubyCount: 2, mappedRubyCount: 2 });
  });

  it('preserves provenance on every chapter and reports unresolved source issues', () => {
    const document = parseAozoraText('本文※［＃外字］', { title: '試験作品', author: '試験作者' });
    const draft = createAozoraMaterialDraft(catalogEntry(), document);

    expect(draft.chapters[0].metadata.literature).toMatchObject({
      provider: 'aozora', providerPersonId: '000148', providerWorkId: '773',
      sourceFormat: 'txt',
      attribution: { author: '試験作者', translator: null, illustrator: null },
      rights: { status: 'approved', basis: 'public-domain' },
    });
    expect(draft.diagnostics.unresolvedGaijiCount).toBe(1);
  });

  it('is deterministic, deeply immutable, and does not mutate its inputs', () => {
    const entry = catalogEntry();
    const document = parseAozoraText(source, { title: '試験作品', author: '試験作者' });
    const before = JSON.stringify(entry);
    const first = createAozoraMaterialDraft(entry, document);
    const second = createAozoraMaterialDraft(entry, document);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(entry)).toBe(before);
    expect(Object.isFrozen(first.chapters[0].metadata.rights)).toBe(true);
    expect(() => { first.chapters.push({}); }).toThrow();
  });

  it('fails closed for unapproved, translated, mismatched, and empty inputs', () => {
    const document = parseAozoraText('本文', { title: '試験作品', author: '試験作者' });
    expect(() => createAozoraMaterialDraft(catalogEntry({ rights: { status: 'candidate', basis: 'unknown' } }), document))
      .toThrow('not publishable');
    expect(() => createAozoraMaterialDraft(catalogEntry({ attribution: { author: '試験作者', translator: '翻訳者', illustrator: null } }), document))
      .toThrow('not publishable');
    expect(() => createAozoraMaterialDraft(catalogEntry(), parseAozoraText('本文', { title: '別作品' })))
      .toThrow('title');
    expect(() => createAozoraMaterialDraft(catalogEntry(), parseAozoraText(''))).toThrow('no readable blocks');
  });
});
