import { describe, expect, it } from 'vitest';
import {
  aozoraCatalogEntryPublishable,
  aozoraWorkKey,
  createAozoraCatalog,
  publishableAozoraEntries,
  validateAozoraCatalogEntry,
} from '../aozoraCatalog.js';

const entry = (overrides = {}) => ({
  schemaVersion: 1,
  personId: '000148',
  workId: '773',
  title: '試験作品',
  author: '試験作者',
  language: 'ja',
  cardUrl: 'https://www.aozora.gr.jp/cards/000148/card773.html',
  sourceFileUrl: 'https://www.aozora.gr.jp/cards/000148/files/773_test.xhtml',
  sourceFormat: 'xhtml',
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

describe('Aozora catalog contract', () => {
  it('validates a reviewed Japanese original and derives a stable key', () => {
    const work = entry();
    expect(validateAozoraCatalogEntry(work)).toBe(true);
    expect(aozoraWorkKey(work)).toBe('aozora-000148-000773');
    expect(aozoraCatalogEntryPublishable(work)).toBe(true);
  });

  it('sorts, clones, and deeply freezes a deterministic catalog snapshot', () => {
    const later = entry({ personId: '000149', workId: '2', cardUrl: 'https://www.aozora.gr.jp/cards/000149/card2.html', sourceFileUrl: 'https://www.aozora.gr.jp/cards/000149/files/2.txt', sourceFormat: 'txt' });
    const earlier = entry();
    const input = [later, earlier];
    const catalog = createAozoraCatalog(input);

    input[0].title = 'changed outside';
    expect(catalog.entries.map(aozoraWorkKey)).toEqual(['aozora-000148-000773', 'aozora-000149-000002']);
    expect(catalog.entries[1].title).toBe('試験作品');
    expect(Object.isFrozen(catalog.entries[0].rights)).toBe(true);
    expect(JSON.stringify(createAozoraCatalog([later, earlier])))
      .toBe(JSON.stringify(createAozoraCatalog([earlier, later])));
  });

  it('returns only entries passing the conservative publication gate', () => {
    const candidate = entry({
      personId: '000149', workId: '2',
      cardUrl: 'https://www.aozora.gr.jp/cards/000149/card2.html',
      sourceFileUrl: 'https://www.aozora.gr.jp/cards/000149/files/2.txt',
      rights: { status: 'candidate', basis: 'unknown' },
    });
    const catalog = createAozoraCatalog([candidate, entry()]);
    expect(publishableAozoraEntries(catalog).map(aozoraWorkKey)).toEqual(['aozora-000148-000773']);
  });

  it.each([
    [{ language: 'en' }, 'Japanese originals'],
    [{ cardUrl: 'https://example.com/card773.html' }, 'Aozora URL'],
    [{ sourceFileUrl: 'http://www.aozora.gr.jp/file.txt' }, 'Aozora URL'],
    [{ sourceFormat: 'pdf' }, 'txt or xhtml'],
    [{ attribution: { author: '다른 저자' } }, 'must match'],
    [{ attribution: { author: '試験作者', illustrator: null } }, 'translator must be explicit'],
  ])('rejects unsafe catalog entries', (overrides, message) => {
    expect(() => validateAozoraCatalogEntry(entry(overrides))).toThrow(message);
  });

  it('rejects duplicate works and duplicate cards', () => {
    expect(() => createAozoraCatalog([entry(), entry({ sourceFileUrl: 'https://www.aozora.gr.jp/cards/000148/files/other.txt' })]))
      .toThrow('duplicate work keys');
    expect(() => createAozoraCatalog([entry(), entry({ personId: '000149', workId: '2' })]))
      .toThrow('duplicate card URLs');
  });
});
