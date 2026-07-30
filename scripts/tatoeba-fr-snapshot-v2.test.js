import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  API_URL,
  LICENSE_ALLOWLIST,
  MAX_PER_PATTERN,
  MIN_PER_PATTERN,
  PATTERNS,
  SOURCE_URL_PREFIX,
  collectQuery,
  serializeSnapshot,
  validateSnapshot,
} from './fetch-tatoeba-fr-v2.mjs';

const snapshotUrl = new URL('./data/tatoeba-fr-snapshot-v2.json', import.meta.url);

function fakeSentence(id, overrides = {}) {
  return {
    id,
    text: `Phrase ${id}`,
    lang: 'fra',
    license: 'CC BY 2.0 FR',
    owner: 'tester',
    is_unapproved: false,
    translations: [],
    ...overrides,
  };
}

describe('Tatoeba fr A2 snapshot v2 collector contract', () => {
  it('follows unstable API paging.next and excludes forbidden licenses', async () => {
    const next = `${API_URL}?lang=fra&q=phrase&after=cursor`;
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      const payload = url === next
        ? {
            data: [fakeSentence(3)],
            paging: { next: null },
          }
        : {
            data: [
              fakeSentence(1),
              fakeSentence(2, { license: 'CC BY-NC 4.0' }),
            ],
            paging: { next },
          };
      return {
        ok: true,
        json: async () => payload,
      };
    };

    const candidates = await collectQuery(
      { query: 'phrase', take: 2, match: /^Phrase/u },
      { fetchImpl, delayMs: 0, maxPages: 2 },
    );

    expect(calls).toHaveLength(2);
    const firstUrl = new URL(calls[0]);
    expect(firstUrl.origin + firstUrl.pathname).toBe(API_URL);
    expect(firstUrl.searchParams.get('sort')).toBe('-created');
    expect(firstUrl.searchParams.get('limit')).toBe('8');
    expect(firstUrl.searchParams.get('is_unapproved')).toBe('no');
    expect(firstUrl.searchParams.get('trans:lang')).toBe('eng');
    expect(calls[1]).toBe(next);
    expect(candidates.map(({ id }) => id)).toEqual([1, 3]);
    expect(candidates.every(({ license }) => LICENSE_ALLOWLIST.includes(license))).toBe(true);
  });

  it('keeps the committed snapshot canonical and validates every sentence', () => {
    const source = fs.readFileSync(snapshotUrl, 'utf8');
    const snapshot = JSON.parse(source);

    expect(validateSnapshot(snapshot)).toBe(true);
    expect(source).toBe(serializeSnapshot(snapshot));
    expect(snapshot.meta).not.toHaveProperty('fetchedAt');
    expect(Object.keys(snapshot.terms)).toEqual(PATTERNS.map(({ key }) => key));
  });

  it('contains 12–20 approved, source-linked sentences for all 10 A2 patterns', () => {
    const snapshot = JSON.parse(fs.readFileSync(snapshotUrl, 'utf8'));
    const ids = new Set();

    expect(PATTERNS).toHaveLength(10);
    for (const pattern of PATTERNS) {
      const term = snapshot.terms[pattern.key];
      expect(term.count).toBeGreaterThanOrEqual(MIN_PER_PATTERN);
      expect(term.count).toBeLessThanOrEqual(MAX_PER_PATTERN);
      expect(term.candidates).toHaveLength(term.count);

      for (const candidate of term.candidates) {
        expect(LICENSE_ALLOWLIST).toContain(candidate.license);
        expect(candidate.license).not.toMatch(/NC/i);
        expect(candidate.sourceUrl).toBe(`${SOURCE_URL_PREFIX}${candidate.id}`);
        expect(ids.has(candidate.id)).toBe(false);
        ids.add(candidate.id);
        for (const translation of candidate.translations) {
          expect(LICENSE_ALLOWLIST).toContain(translation.license);
          expect(translation.sourceUrl).toBe(`${SOURCE_URL_PREFIX}${translation.id}`);
        }
      }
    }
  });
});
