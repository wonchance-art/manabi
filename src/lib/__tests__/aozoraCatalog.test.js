import { describe, expect, it } from 'vitest';
import {
  aozoraCardUrl,
  aozoraCatalogEntryPublishable,
  aozoraWorkKey,
  createAozoraCatalog,
  publishableAozoraEntries,
  validateAozoraCatalogEntry,
} from '../aozoraCatalog.js';
import { approvedRights, plainSampleEntry, sampleEntry as entry } from './helpers/aozoraFixtures.js';

describe('Aozora catalog contract', () => {
  it('승인된 일본어 원작을 검증하고 안정된 작품 키·카드 주소를 만든다', () => {
    const work = entry();
    expect(validateAozoraCatalogEntry(work)).toBe(true);
    expect(aozoraWorkKey(work)).toBe('aozora-000001-000001');
    expect(aozoraCardUrl(work)).toBe('https://www.aozora.gr.jp/cards/000001/card1.html');
    expect(aozoraCatalogEntryPublishable(work)).toBe(true);
  });

  it('新字新仮名만 공개한다 — 다른 文字遣い는 형식은 유효하지만 공개 불가', () => {
    const old = entry({ charset: '旧字旧仮名' });
    expect(validateAozoraCatalogEntry(old)).toBe(true);
    expect(aozoraCatalogEntryPublishable(old)).toBe(false);
    expect(() => validateAozoraCatalogEntry(entry({ charset: 'shift_jis' }))).toThrow('charset');
  });

  it('D5 연도가 공개 판정에 들어간다 — 일본 보호기간(작가 1968년 이전 사망)만, 미국은 보지 않는다(개정 2026-10-15)', () => {
    expect(aozoraCatalogEntryPublishable(entry({ publishedYear: 1940, authorDeathYear: 1948 })), '太宰형 — 미국 보호 중이어도 공개').toBe(true);
    expect(aozoraCatalogEntryPublishable(entry({ publishedYear: 1940, authorDeathYear: 1943 }))).toBe(true);
    expect(aozoraCatalogEntryPublishable(entry({ publishedYear: 1960, authorDeathYear: 1968 }))).toBe(false);
    // 사망 연도를 모르면 일본 보호기간을 판정할 수 없다 — 1931년 이전 출판이어도 공개하지 않는다(2026-10-14 보정)
    expect(aozoraCatalogEntryPublishable(entry({ publishedYear: 1925, authorDeathYear: null }))).toBe(false);
    expect(aozoraCatalogEntryPublishable(entry({ publishedYear: 1925, authorDeathYear: 1965 }))).toBe(true);
    expect(aozoraCatalogEntryPublishable(entry({ publishedYear: 1926, authorDeathYear: 1972 }))).toBe(false);
  });

  it('정렬·복제·깊은 동결 — 입력 순서와 외부 변경에 흔들리지 않는다', () => {
    const later = plainSampleEntry();
    const earlier = entry();
    const input = [later, earlier];
    const catalog = createAozoraCatalog(input);

    input[0].title = 'changed outside';
    expect(catalog.entries.map(aozoraWorkKey)).toEqual(['aozora-000001-000001', 'aozora-000002-000002']);
    expect(catalog.entries[1].title).toBe('書式見本　夕方の町');
    expect(Object.isFrozen(catalog.entries[0].rights.reviewedJurisdictions)).toBe(true);
    expect(JSON.stringify(createAozoraCatalog([plainSampleEntry(), entry()])))
      .toBe(JSON.stringify(createAozoraCatalog([entry(), plainSampleEntry()])));
  });

  it('보수적 공개 게이트를 통과한 항목만 돌려준다', () => {
    const candidate = plainSampleEntry({ rights: { status: 'candidate', basis: 'unknown' } });
    const catalog = createAozoraCatalog([candidate, entry()]);
    expect(publishableAozoraEntries(catalog).map(aozoraWorkKey)).toEqual(['aozora-000001-000001']);
  });

  it.each([
    [{ language: 'en' }, 'Japanese originals'],
    [{ cardUrl: 'https://example.com/cards/000001/card1.html' }, 'Aozora URL'],
    [{ cardUrl: 'https://www.aozora.gr.jp/cards/000001/card2.html' }, 'match personId'],
    [{ sourceFileUrl: 'http://www.aozora.gr.jp/cards/000001/files/1.zip' }, 'Aozora URL'],
    [{ sourceFileUrl: 'https://www.aozora.gr.jp/cards/000009/files/1.zip' }, 'same person'],
    [{ sourceFormat: 'xhtml' }, 'must be txt'],
    [{ sourceSha256: 'A'.repeat(64) }, 'sourceSha256'],
    [{ textSha256: 'abc' }, 'textSha256'],
    [{ publishedYear: '1920' }, 'publishedYear'],
    [{ authorDeathYear: undefined }, 'authorDeathYear'],
    [{ level: 'N2' }, 'level'],
    [{ attribution: { author: '다른 저자' } }, 'must match'],
    [{ attribution: { author: '見本太郎', illustrator: null } }, 'translator must be explicit'],
    [{ rights: approvedRights({ reviewedJurisdictions: ['JP', 'US'] }) }, 'JP·KR'],
  ])('위험한 항목을 거부한다 (%#)', (overrides, message) => {
    expect(() => validateAozoraCatalogEntry(entry(overrides))).toThrow(message);
    expect(aozoraCatalogEntryPublishable(entry(overrides))).toBe(false);
  });

  it('같은 작품·같은 원 zip의 중복을 거부한다', () => {
    expect(() => createAozoraCatalog([entry(), entry({ sourceSha256: 'd'.repeat(64) })])).toThrow('duplicate work keys');
    expect(() => createAozoraCatalog([entry(), plainSampleEntry({ sourceSha256: 'a'.repeat(64) })])).toThrow('duplicate source files');
  });
});
