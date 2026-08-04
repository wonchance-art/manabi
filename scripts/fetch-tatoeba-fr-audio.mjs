#!/usr/bin/env node
// Tatoeba fr A1-A2 audio metadata snapshot.
// Reuses the committed v1 query list and v2 pattern contract, requests audio
// metadata only, and keeps recordings whose own license is CC BY or CC0.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  API_URL,
  LICENSE_ALLOWLIST as SENTENCE_LICENSE_ALLOWLIST,
  PATTERNS as V2_PATTERNS,
  SOURCE_URL_PREFIX,
} from './fetch-tatoeba-fr-v2.mjs';

export { API_URL, SOURCE_URL_PREFIX };

export const AUDIO_LICENSE_ALLOWLIST = Object.freeze([
  'CC BY 4.0',
  'CC BY 3.0',
  'CC BY 2.0',
  'CC BY 2.0 FR',
  'CC0 1.0',
]);
export const PAGE_SIZE = 100;
export const TARGET_MIN_PER_PATTERN = 6;
export const TARGET_MAX_PER_PATTERN = 12;
export const DEFAULT_DELAY_MS = 1200;
export const DEFAULT_MAX_PAGES = 12;
export const DEFAULT_TIMEOUT_MS = 20_000;

const V1_SNAPSHOT_URL = new URL('./data/tatoeba-fr-snapshot-v1.json', import.meta.url);
const DEFAULT_OUTPUT = fileURLToPath(
  new URL('./data/tatoeba-fr-audio-v1.json', import.meta.url),
);
const api = new URL(API_URL);
const sentenceLicenses = new Set(SENTENCE_LICENSE_ALLOWLIST);
const audioLicenses = new Set(AUDIO_LICENSE_ALLOWLIST);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeText(value) {
  return String(value ?? '').normalize('NFC');
}

function normalizeComparable(value) {
  return normalizeText(value)
    .toLocaleLowerCase('fr')
    .replace(/[’‘`]/gu, "'")
    .replace(/^=|["“”«»]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function literalMatch(query, text) {
  return normalizeComparable(text).includes(normalizeComparable(query));
}

function sourceUrl(id) {
  return `${SOURCE_URL_PREFIX}${id}`;
}

function createThrottle(delayMs) {
  let lastStartedAt = 0;
  return async () => {
    const remaining = delayMs - (Date.now() - lastStartedAt);
    if (remaining > 0) await sleep(remaining);
    lastStartedAt = Date.now();
  };
}

async function loadV1Patterns() {
  const snapshot = JSON.parse(await fs.readFile(V1_SNAPSHOT_URL, 'utf8'));
  const entries = Object.entries(snapshot?.terms ?? {});
  if (entries.length !== 10) {
    throw new Error(`Expected 10 v1 patterns, got ${entries.length}`);
  }
  return entries.map(([key, term]) => {
    if (typeof term?.query !== 'string' || term.query.trim().length === 0) {
      throw new Error(`${key}: missing v1 query`);
    }
    return {
      key,
      label: key,
      sourceContract: 'v1',
      queries: [{
        query: term.query,
        match: (text) => literalMatch(term.query, text),
      }],
    };
  });
}

const v1Patterns = await loadV1Patterns();

export const PATTERNS = Object.freeze([
  ...v1Patterns,
  ...V2_PATTERNS.map((pattern) => ({
    key: pattern.key,
    label: pattern.label,
    sourceContract: 'v2',
    queries: pattern.queries.map(({ query, match }) => ({ query, match })),
  })),
]);

export function buildSearchUrl(query, pageSize = PAGE_SIZE) {
  const url = new URL(API_URL);
  url.searchParams.set('lang', 'fra');
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('limit', String(pageSize));
  url.searchParams.set('is_unapproved', 'no');
  url.searchParams.set('has_audio', 'yes');
  url.searchParams.set('include', 'audios');
  url.searchParams.set('showtrans', 'none');
  return url.toString();
}

function validatedNextUrl(value) {
  if (!value) return null;
  const next = new URL(value);
  if (next.origin !== api.origin || next.pathname !== api.pathname) {
    throw new Error(`Unsafe Tatoeba paging.next URL: ${next.toString()}`);
  }
  return next.toString();
}

async function fetchPage(url, {
  fetchImpl,
  throttle,
  timeoutMs,
}) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await throttle();
    try {
      const response = await fetchImpl(url, {
        headers: {
          'User-Agent': 'manabi-authentic-audio-metadata/1 (personal study project)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload?.data) || typeof payload?.paging !== 'object') {
        throw new Error('Malformed Tatoeba response');
      }
      return payload;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(1500 * attempt);
    }
  }
  throw new Error('Unreachable Tatoeba retry state');
}

function eligibleAudios(sentence) {
  return (Array.isArray(sentence?.audios) ? sentence.audios : [])
    .map((audio) => ({
      id: audio?.id,
      license: audio?.license ?? audio?.licence,
      author: normalizeText(audio?.author).trim(),
    }))
    .filter((audio) => (
      Number.isInteger(audio.id)
      && audioLicenses.has(audio.license)
      && audio.author.length > 0
    ))
    .sort((a, b) => a.id - b.id);
}

function normalizeCandidate(sentence, audio) {
  return {
    sentenceId: sentence.id,
    audioId: audio.id,
    audioLicense: audio.license,
    audioAttribution: audio.author,
    sentence: normalizeText(sentence.text),
    license: sentence.license,
    sourceUrl: sourceUrl(sentence.id),
  };
}

function matchesQuery(querySpec, text) {
  if (querySpec.match instanceof RegExp) {
    querySpec.match.lastIndex = 0;
    return querySpec.match.test(text);
  }
  return querySpec.match(text);
}

function isEligibleSentence(sentence, querySpec) {
  return (
    Number.isInteger(sentence?.id)
    && sentence.lang === 'fra'
    && typeof sentence.text === 'string'
    && sentence.text.trim().length > 0
    && sentenceLicenses.has(sentence.license)
    && sentence.is_unapproved !== true
    && matchesQuery(querySpec, normalizeText(sentence.text))
  );
}

export async function collectQuery(querySpec, {
  excludedSentenceIds = new Set(),
  fetchImpl = fetch,
  delayMs = DEFAULT_DELAY_MS,
  maxPages = DEFAULT_MAX_PAGES,
  maxResults = TARGET_MAX_PER_PATTERN,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  throttle = createThrottle(delayMs),
} = {}) {
  const selected = new Map();
  let nextUrl = buildSearchUrl(querySpec.query);
  let page = 0;

  while (nextUrl && page < maxPages && selected.size < maxResults) {
    const payload = await fetchPage(nextUrl, {
      fetchImpl,
      throttle,
      timeoutMs,
    });
    page += 1;

    for (const sentence of payload.data) {
      if (
        !isEligibleSentence(sentence, querySpec)
        || excludedSentenceIds.has(sentence.id)
        || selected.has(sentence.id)
      ) {
        continue;
      }
      const audio = eligibleAudios(sentence)[0];
      if (!audio) continue;
      selected.set(sentence.id, normalizeCandidate(sentence, audio));
    }
    nextUrl = validatedNextUrl(payload.paging.next);
  }

  return [...selected.values()]
    .sort((a, b) => a.sentenceId - b.sentenceId || a.audioId - b.audioId)
    .slice(0, maxResults);
}

export async function buildSnapshot({
  fetchImpl = fetch,
  delayMs = DEFAULT_DELAY_MS,
  maxPages = DEFAULT_MAX_PAGES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onPattern = () => {},
} = {}) {
  const usedSentenceIds = new Set();
  const usedAudioIds = new Set();
  const throttle = createThrottle(delayMs);
  const terms = {};

  for (const pattern of PATTERNS) {
    const pool = new Map();
    for (const querySpec of pattern.queries) {
      const queryCandidates = await collectQuery(querySpec, {
        excludedSentenceIds: usedSentenceIds,
        fetchImpl,
        delayMs,
        maxPages,
        maxResults: TARGET_MAX_PER_PATTERN,
        timeoutMs,
        throttle,
      });
      for (const candidate of queryCandidates) {
        if (!pool.has(candidate.sentenceId) && !usedAudioIds.has(candidate.audioId)) {
          pool.set(candidate.sentenceId, candidate);
        }
      }
    }

    const candidates = [...pool.values()]
      .sort((a, b) => a.sentenceId - b.sentenceId || a.audioId - b.audioId)
      .slice(0, TARGET_MAX_PER_PATTERN);
    for (const candidate of candidates) {
      usedSentenceIds.add(candidate.sentenceId);
      usedAudioIds.add(candidate.audioId);
    }

    terms[pattern.key] = {
      label: pattern.label,
      sourceContract: pattern.sourceContract,
      queries: pattern.queries.map(({ query }) => query),
      count: candidates.length,
      shortfall: Math.max(0, TARGET_MIN_PER_PATTERN - candidates.length),
      candidates,
    };
    onPattern(pattern.key, candidates.length, terms[pattern.key].shortfall);
  }

  const snapshot = {
    meta: {
      schemaVersion: 1,
      source: 'tatoeba',
      api: 'unstable/sentences',
      apiUrl: API_URL,
      language: 'fra',
      sentenceLicenseAllowlist: [...SENTENCE_LICENSE_ALLOWLIST],
      audioLicenseAllowlist: [...AUDIO_LICENSE_ALLOWLIST],
      sourceUrlTemplate: `${SOURCE_URL_PREFIX}{id}`,
      sort: 'relevance',
      pageSize: PAGE_SIZE,
      targetMinPerPattern: TARGET_MIN_PER_PATTERN,
      targetMaxPerPattern: TARGET_MAX_PER_PATTERN,
      metadataOnly: true,
      audioFilesDownloaded: false,
      totalCandidates: Object.values(terms).reduce((sum, term) => sum + term.count, 0),
      patternsMeetingTarget: Object.values(terms)
        .filter((term) => term.count >= TARGET_MIN_PER_PATTERN).length,
      totalShortfall: Object.values(terms).reduce((sum, term) => sum + term.shortfall, 0),
      deterministicOrder: 'v1 then v2 pattern order; sentence id then audio id ascending',
    },
    terms,
  };
  validateSnapshot(snapshot);
  return snapshot;
}

export function validateSnapshot(snapshot) {
  if (snapshot?.meta?.schemaVersion !== 1) throw new Error('Expected schemaVersion 1');
  if (snapshot.meta.source !== 'tatoeba' || snapshot.meta.apiUrl !== API_URL) {
    throw new Error('Unexpected Tatoeba source');
  }
  if (snapshot.meta.language !== 'fra') throw new Error('Unexpected language');
  if ('fetchedAt' in snapshot.meta) throw new Error('fetchedAt makes snapshots non-deterministic');
  if (snapshot.meta.metadataOnly !== true || snapshot.meta.audioFilesDownloaded !== false) {
    throw new Error('Audio snapshot must remain metadata-only');
  }
  if (
    JSON.stringify(snapshot.meta.sentenceLicenseAllowlist)
      !== JSON.stringify(SENTENCE_LICENSE_ALLOWLIST)
    || JSON.stringify(snapshot.meta.audioLicenseAllowlist)
      !== JSON.stringify(AUDIO_LICENSE_ALLOWLIST)
  ) {
    throw new Error('Unexpected license allowlist');
  }
  if (
    snapshot.meta.pageSize !== PAGE_SIZE
    || snapshot.meta.targetMinPerPattern !== TARGET_MIN_PER_PATTERN
    || snapshot.meta.targetMaxPerPattern !== TARGET_MAX_PER_PATTERN
  ) {
    throw new Error('Unexpected pagination or target count contract');
  }

  const expectedKeys = PATTERNS.map(({ key }) => key);
  if (JSON.stringify(Object.keys(snapshot.terms ?? {})) !== JSON.stringify(expectedKeys)) {
    throw new Error('Unexpected pattern keys or order');
  }

  const sentenceIds = new Set();
  const audioIds = new Set();
  let totalCandidates = 0;
  let patternsMeetingTarget = 0;
  let totalShortfall = 0;
  const expectedCandidateKeys = [
    'sentenceId',
    'audioId',
    'audioLicense',
    'audioAttribution',
    'sentence',
    'license',
    'sourceUrl',
  ];

  for (const pattern of PATTERNS) {
    const term = snapshot.terms[pattern.key];
    if (
      term?.label !== pattern.label
      || term.sourceContract !== pattern.sourceContract
      || JSON.stringify(term.queries) !== JSON.stringify(pattern.queries.map(({ query }) => query))
      || !Array.isArray(term.candidates)
      || term.count !== term.candidates.length
      || term.count < 0
      || term.count > TARGET_MAX_PER_PATTERN
      || term.shortfall !== Math.max(0, TARGET_MIN_PER_PATTERN - term.count)
    ) {
      throw new Error(`${pattern.key}: invalid term contract`);
    }
    totalCandidates += term.count;
    if (term.count >= TARGET_MIN_PER_PATTERN) patternsMeetingTarget += 1;
    totalShortfall += term.shortfall;

    let previousSentenceId = -1;
    for (const candidate of term.candidates) {
      if (JSON.stringify(Object.keys(candidate)) !== JSON.stringify(expectedCandidateKeys)) {
        throw new Error(`${pattern.key}: invalid candidate schema`);
      }
      if (
        !Number.isInteger(candidate.sentenceId)
        || candidate.sentenceId <= previousSentenceId
        || sentenceIds.has(candidate.sentenceId)
        || !Number.isInteger(candidate.audioId)
        || audioIds.has(candidate.audioId)
      ) {
        throw new Error(`${pattern.key}: duplicate or unsorted candidate`);
      }
      previousSentenceId = candidate.sentenceId;
      sentenceIds.add(candidate.sentenceId);
      audioIds.add(candidate.audioId);

      if (
        !audioLicenses.has(candidate.audioLicense)
        || /(?:NC|SA|ND)/iu.test(candidate.audioLicense)
        || typeof candidate.audioAttribution !== 'string'
        || candidate.audioAttribution.trim().length === 0
      ) {
        throw new Error(`${pattern.key}: forbidden or incomplete audio license metadata`);
      }
      if (
        typeof candidate.sentence !== 'string'
        || candidate.sentence.trim().length === 0
        || !sentenceLicenses.has(candidate.license)
        || candidate.sourceUrl !== sourceUrl(candidate.sentenceId)
      ) {
        throw new Error(`${pattern.key}: invalid sentence metadata`);
      }
    }
  }
  if (
    snapshot.meta.totalCandidates !== totalCandidates
    || snapshot.meta.patternsMeetingTarget !== patternsMeetingTarget
    || snapshot.meta.totalShortfall !== totalShortfall
  ) {
    throw new Error('Snapshot aggregate counts mismatch');
  }
  return true;
}

export function serializeSnapshot(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

function parseIntegerFlag(name, value, minimum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    delayMs: DEFAULT_DELAY_MS,
    maxPages: DEFAULT_MAX_PAGES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--output' && value) {
      options.output = path.resolve(value);
      index += 1;
    } else if (arg === '--delay-ms' && value) {
      options.delayMs = parseIntegerFlag(arg, value, 0);
      index += 1;
    } else if (arg === '--max-pages' && value) {
      options.maxPages = parseIntegerFlag(arg, value, 1);
      index += 1;
    } else if (arg === '--timeout-ms' && value) {
      options.timeoutMs = parseIntegerFlag(arg, value, 1);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = await buildSnapshot({
    delayMs: options.delayMs,
    maxPages: options.maxPages,
    timeoutMs: options.timeoutMs,
    onPattern: (key, count, shortfall) => {
      if (shortfall > 0) {
        console.warn(`shortage ${key}: ${count}/${TARGET_MIN_PER_PATTERN}건 (부족 ${shortfall})`);
      } else {
        console.log(`ok ${key}: ${count}건`);
      }
    },
  });
  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, serializeSnapshot(snapshot));
  console.log(`snapshot → ${path.relative(process.cwd(), options.output)}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
