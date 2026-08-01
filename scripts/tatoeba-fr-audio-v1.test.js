import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AUDIO_LICENSE_ALLOWLIST,
  API_URL,
  PAGE_SIZE,
  PATTERNS,
  SOURCE_URL_PREFIX,
  TARGET_MAX_PER_PATTERN,
  TARGET_MIN_PER_PATTERN,
  collectQuery,
  serializeSnapshot,
  validateSnapshot,
} from './fetch-tatoeba-fr-audio.mjs';

const snapshotUrl = new URL('./data/tatoeba-fr-audio-v1.json', import.meta.url);

function fakeSentence(id, overrides = {}) {
  return {
    id,
    text: `Phrase ${id}`,
    lang: 'fra',
    license: 'CC BY 2.0 FR',
    is_unapproved: false,
    audios: [],
    ...overrides,
  };
}

function fakeAudio(id, overrides = {}) {
  return {
    id,
    author: `reader-${id}`,
    license: 'CC BY 4.0',
    ...overrides,
  };
}

describe('Tatoeba fr A1-A2 audio metadata snapshot contract', () => {
  it('requests audio metadata, follows paging.next, and excludes NC or unlicensed audio', async () => {
    const next = `${API_URL}?lang=fra&q=phrase&after=cursor`;
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      const payload = url === next
        ? {
            data: [
              fakeSentence(4, {
                audios: [fakeAudio(104, { license: undefined, licence: 'CC0 1.0' })],
              }),
            ],
            paging: { next: null },
          }
        : {
            data: [
              fakeSentence(1, { audios: [fakeAudio(101)] }),
              fakeSentence(2, { audios: [fakeAudio(102, { license: 'CC BY-NC 4.0' })] }),
              fakeSentence(3, { audios: [fakeAudio(103, { license: null })] }),
            ],
            paging: { next },
          };
      return { ok: true, json: async () => payload };
    };

    const candidates = await collectQuery(
      { query: 'phrase', match: (text) => /^Phrase/u.test(text) },
      { fetchImpl, delayMs: 0, maxPages: 2, maxResults: 2 },
    );

    expect(calls).toHaveLength(2);
    const firstUrl = new URL(calls[0]);
    expect(firstUrl.origin + firstUrl.pathname).toBe(API_URL);
    expect(firstUrl.searchParams.get('sort')).toBe('relevance');
    expect(firstUrl.searchParams.get('limit')).toBe(String(PAGE_SIZE));
    expect(firstUrl.searchParams.get('is_unapproved')).toBe('no');
    expect(firstUrl.searchParams.get('has_audio')).toBe('yes');
    expect(firstUrl.searchParams.get('include')).toBe('audios');
    expect(firstUrl.searchParams.get('showtrans')).toBe('none');
    expect(calls[1]).toBe(next);
    expect(candidates.map(({ sentenceId }) => sentenceId)).toEqual([1, 4]);
    expect(candidates.map(({ audioLicense }) => audioLicense)).toEqual(['CC BY 4.0', 'CC0 1.0']);
  });

  it('keeps the committed snapshot canonical and validates all 20 pattern groups', () => {
    const source = fs.readFileSync(snapshotUrl, 'utf8');
    const snapshot = JSON.parse(source);

    expect(PATTERNS).toHaveLength(20);
    expect(validateSnapshot(snapshot)).toBe(true);
    expect(source).toBe(serializeSnapshot(snapshot));
    expect(snapshot.meta).not.toHaveProperty('fetchedAt');
    expect(snapshot.meta.metadataOnly).toBe(true);
    expect(snapshot.meta.audioFilesDownloaded).toBe(false);
    expect(Object.keys(snapshot.terms)).toEqual(PATTERNS.map(({ key }) => key));
  });

  it('allows only explicit CC BY or CC0 audio licenses and records deterministic shortfalls', () => {
    const snapshot = JSON.parse(fs.readFileSync(snapshotUrl, 'utf8'));
    const sentenceIds = new Set();
    const audioIds = new Set();
    let total = 0;
    let meetingTarget = 0;
    let totalShortfall = 0;

    for (const pattern of PATTERNS) {
      const term = snapshot.terms[pattern.key];
      expect(term.count).toBeLessThanOrEqual(TARGET_MAX_PER_PATTERN);
      expect(term.shortfall).toBe(Math.max(0, TARGET_MIN_PER_PATTERN - term.count));
      expect(term.candidates).toHaveLength(term.count);
      total += term.count;
      if (term.count >= TARGET_MIN_PER_PATTERN) meetingTarget += 1;
      totalShortfall += term.shortfall;

      for (const candidate of term.candidates) {
        expect(AUDIO_LICENSE_ALLOWLIST).toContain(candidate.audioLicense);
        expect(candidate.audioLicense).not.toMatch(/NC|SA|ND/i);
        expect(candidate.audioAttribution.trim()).not.toBe('');
        expect(candidate.sourceUrl).toBe(`${SOURCE_URL_PREFIX}${candidate.sentenceId}`);
        expect(sentenceIds.has(candidate.sentenceId)).toBe(false);
        expect(audioIds.has(candidate.audioId)).toBe(false);
        expect(candidate).not.toHaveProperty('downloadUrl');
        expect(candidate).not.toHaveProperty('audioUrl');
        sentenceIds.add(candidate.sentenceId);
        audioIds.add(candidate.audioId);
      }
    }
    expect(snapshot.meta.totalCandidates).toBe(total);
    expect(snapshot.meta.patternsMeetingTarget).toBe(meetingTarget);
    expect(snapshot.meta.totalShortfall).toBe(totalShortfall);
  });
});
