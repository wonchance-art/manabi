#!/usr/bin/env node
// Tatoeba fr A2 snapshot v2.
// The unstable API is cursor-paginated. We follow its returned `paging.next`
// links, retain only approved CC BY 2.0 FR / CC0 sentences, and write a
// timestamp-free canonical snapshot so repeated runs remain byte-identical.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const API_URL = 'https://api.tatoeba.org/unstable/sentences';
export const SOURCE_URL_PREFIX = 'https://tatoeba.org/en/sentences/show/';
export const LICENSE_ALLOWLIST = Object.freeze(['CC BY 2.0 FR', 'CC0 1.0']);
export const PAGE_SIZE = 8;
export const MIN_PER_PATTERN = 12;
export const MAX_PER_PATTERN = 20;
export const DEFAULT_DELAY_MS = 1200;
export const DEFAULT_MAX_PAGES = 12;
export const DEFAULT_TIMEOUT_MS = 20_000;

const DEFAULT_OUTPUT = fileURLToPath(
  new URL('./data/tatoeba-fr-snapshot-v2.json', import.meta.url),
);

export const PATTERNS = Object.freeze([
  {
    key: 'passe-compose-avoir',
    label: 'passé composé avoir',
    queries: [
      {
        query: '"j\'ai acheté"',
        take: 10,
        match: /\bj['’]ai acheté(?!\p{L})/iu,
      },
      { query: '"j\'ai pris"', take: 10, match: /\bj['’]ai pris\b/iu },
    ],
  },
  {
    key: 'passe-compose-etre',
    label: 'passé composé être',
    queries: [
      {
        query: '"je suis allé"',
        take: 10,
        match: /\bje suis allé(?:e)?(?!\p{L})/iu,
      },
      {
        query: '"elle est arrivée"',
        take: 10,
        match: /\belle est arrivée(?!\p{L})/iu,
      },
    ],
  },
  {
    key: 'imparfait',
    label: 'imparfait',
    queries: [
      { query: '"j\'étais"', take: 10, match: /\bj['’]étais\b/iu },
      { query: '"il était"', take: 10, match: /\bil était\b/iu },
    ],
  },
  {
    key: 'futur-proche',
    label: 'futur proche',
    queries: [
      { query: '"je vais aller"', take: 10, match: /\bje vais aller\b/iu },
      { query: '"je vais partir"', take: 10, match: /\bje vais partir\b/iu },
    ],
  },
  {
    key: 'verbes-pronominaux',
    label: 'verbes pronominaux',
    queries: [
      {
        query: '"je me lève"',
        take: 10,
        match: /\bje me lève(?!\p{L})/iu,
      },
      {
        query: '"je me suis levé"',
        take: 10,
        match: /\bje me suis levé(?:e)?(?!\p{L})/iu,
      },
    ],
  },
  {
    key: 'comparatif',
    label: 'comparatif',
    queries: [
      {
        query: '"plus grand que"',
        take: 10,
        match: /\bplus grand(?:e|es|s)? que\b/iu,
      },
      {
        query: '"moins cher que"',
        take: 10,
        match: /\bmoins (?:cher|chère|chers|chères) que\b/iu,
      },
    ],
  },
  {
    key: 'partitif',
    label: 'partitif',
    queries: [
      { query: '"il y a du"', take: 10, match: /\bil y a du\b/iu },
      { query: '"il y a de la"', take: 10, match: /\bil y a de la\b/iu },
    ],
  },
  {
    key: 'pronoms-y-en',
    label: 'pronoms y·en',
    queries: [
      { query: '"j\'y suis"', take: 10, match: /\bj['’]y suis\b/iu },
      { query: '"j\'en ai"', take: 10, match: /\bj['’]en ai\b/iu },
    ],
  },
  {
    key: 'relatives-qui-que',
    label: 'relatives qui·que',
    queries: [
      { query: '"celui qui"', take: 10, match: /\bcelui qui\b/iu },
      { query: '"tout ce que"', take: 10, match: /\btout ce que\b/iu },
    ],
  },
  {
    key: 'imperatif',
    label: 'impératif',
    queries: [
      {
        query: '=regardez',
        take: 10,
        match: /^\s*[«"“]?\s*regardez\b/iu,
      },
      {
        query: '=venez',
        take: 10,
        match: /^\s*[«"“]?\s*venez\b/iu,
      },
    ],
  },
]);

const allowedLicenses = new Set(LICENSE_ALLOWLIST);
const api = new URL(API_URL);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function normalizeText(value) {
  return String(value ?? '').normalize('NFC');
}

function isEligibleSentence(sentence) {
  return (
    Number.isInteger(sentence?.id)
    && sentence.lang === 'fra'
    && typeof sentence.text === 'string'
    && sentence.text.trim().length > 0
    && allowedLicenses.has(sentence.license)
    && sentence.is_unapproved !== true
  );
}

function normalizeTranslations(translations) {
  return (Array.isArray(translations) ? translations : [])
    .filter((translation) => (
      Number.isInteger(translation?.id)
      && translation.lang === 'eng'
      && typeof translation.text === 'string'
      && translation.text.trim().length > 0
      && allowedLicenses.has(translation.license)
      && translation.is_unapproved !== true
    ))
    .sort((a, b) => (
      Number(Boolean(b.is_direct)) - Number(Boolean(a.is_direct))
      || a.id - b.id
    ))
    .slice(0, 2)
    .map((translation) => ({
      id: translation.id,
      text: normalizeText(translation.text),
      lang: translation.lang,
      license: translation.license,
      sourceUrl: sourceUrl(translation.id),
      owner: translation.owner ?? null,
    }));
}

function normalizeSentence(sentence, matchedQuery) {
  return {
    id: sentence.id,
    text: normalizeText(sentence.text),
    license: sentence.license,
    sourceUrl: sourceUrl(sentence.id),
    owner: sentence.owner ?? null,
    unapproved: false,
    matchedQuery,
    translations: normalizeTranslations(sentence.translations),
  };
}

export function buildSearchUrl(query, pageSize = PAGE_SIZE) {
  const url = new URL(API_URL);
  url.searchParams.set('lang', 'fra');
  url.searchParams.set('q', query);
  url.searchParams.set('sort', '-created');
  url.searchParams.set('limit', String(pageSize));
  url.searchParams.set('is_unapproved', 'no');
  url.searchParams.set('trans:lang', 'eng');
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
          'User-Agent': 'manabi-authentic-sources/2 (personal study project)',
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

export async function collectQuery(querySpec, {
  excludedIds = new Set(),
  fetchImpl = fetch,
  delayMs = DEFAULT_DELAY_MS,
  maxPages = DEFAULT_MAX_PAGES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  throttle = createThrottle(delayMs),
} = {}) {
  const selected = new Map();
  let nextUrl = buildSearchUrl(querySpec.query);
  let page = 0;

  while (nextUrl && page < maxPages && selected.size < querySpec.take) {
    const payload = await fetchPage(nextUrl, {
      fetchImpl,
      throttle,
      timeoutMs,
    });
    page += 1;

    for (const sentence of payload.data) {
      const text = normalizeText(sentence?.text);
      if (
        !isEligibleSentence(sentence)
        || excludedIds.has(sentence.id)
        || selected.has(sentence.id)
        || !querySpec.match.test(text)
      ) {
        continue;
      }
      selected.set(sentence.id, normalizeSentence(sentence, querySpec.query));
    }
    nextUrl = validatedNextUrl(payload.paging.next);
  }

  const candidates = [...selected.values()]
    .sort((a, b) => a.id - b.id)
    .slice(0, querySpec.take);
  if (candidates.length < querySpec.take) {
    throw new Error(
      `${querySpec.query}: expected ${querySpec.take} candidates, got ${candidates.length} `
      + `after ${page} page(s)`,
    );
  }
  return candidates;
}

export async function buildSnapshot({
  fetchImpl = fetch,
  delayMs = DEFAULT_DELAY_MS,
  maxPages = DEFAULT_MAX_PAGES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onPattern = () => {},
} = {}) {
  const usedIds = new Set();
  const throttle = createThrottle(delayMs);
  const terms = {};

  for (const pattern of PATTERNS) {
    const candidates = [];
    for (const querySpec of pattern.queries) {
      const queryCandidates = await collectQuery(querySpec, {
        excludedIds: usedIds,
        fetchImpl,
        delayMs,
        maxPages,
        timeoutMs,
        throttle,
      });
      for (const candidate of queryCandidates) {
        usedIds.add(candidate.id);
        candidates.push(candidate);
      }
    }
    candidates.sort((a, b) => a.id - b.id);
    terms[pattern.key] = {
      label: pattern.label,
      queries: pattern.queries.map(({ query }) => query),
      count: candidates.length,
      candidates,
    };
    onPattern(pattern.key, candidates.length);
  }

  const snapshot = {
    meta: {
      schemaVersion: 2,
      source: 'tatoeba',
      api: 'unstable/sentences',
      apiUrl: API_URL,
      language: 'fra',
      translationLanguage: 'eng',
      licenseAllowlist: [...LICENSE_ALLOWLIST],
      sourceUrlTemplate: `${SOURCE_URL_PREFIX}{id}`,
      sort: '-created',
      pageSize: PAGE_SIZE,
      minPerPattern: MIN_PER_PATTERN,
      maxPerPattern: MAX_PER_PATTERN,
      deterministicOrder: 'pattern config order; sentence id ascending; translation direct-first then id',
    },
    terms,
  };
  validateSnapshot(snapshot);
  return snapshot;
}

export function validateSnapshot(snapshot) {
  if (snapshot?.meta?.schemaVersion !== 2) throw new Error('Expected schemaVersion 2');
  if (snapshot.meta.source !== 'tatoeba') throw new Error('Expected Tatoeba source');
  if (snapshot.meta.apiUrl !== API_URL) throw new Error('Unexpected API URL');
  if (snapshot.meta.language !== 'fra' || snapshot.meta.translationLanguage !== 'eng') {
    throw new Error('Unexpected snapshot languages');
  }
  if (
    snapshot.meta.pageSize !== PAGE_SIZE
    || snapshot.meta.minPerPattern !== MIN_PER_PATTERN
    || snapshot.meta.maxPerPattern !== MAX_PER_PATTERN
  ) {
    throw new Error('Unexpected pagination or pattern count contract');
  }
  if (snapshot.meta.sourceUrlTemplate !== `${SOURCE_URL_PREFIX}{id}`) {
    throw new Error('Unexpected source URL template');
  }
  if ('fetchedAt' in snapshot.meta) throw new Error('fetchedAt makes snapshots non-deterministic');
  if (
    JSON.stringify(snapshot.meta.licenseAllowlist)
    !== JSON.stringify(LICENSE_ALLOWLIST)
  ) {
    throw new Error('Unexpected license allowlist');
  }

  const expectedKeys = PATTERNS.map(({ key }) => key);
  if (JSON.stringify(Object.keys(snapshot.terms ?? {})) !== JSON.stringify(expectedKeys)) {
    throw new Error('Unexpected A2 pattern keys or order');
  }

  const globalIds = new Set();
  for (const pattern of PATTERNS) {
    const term = snapshot.terms[pattern.key];
    const candidates = term?.candidates;
    if (term?.label !== pattern.label) {
      throw new Error(`${pattern.key}: label mismatch`);
    }
    if (!Array.isArray(candidates) || term.count !== candidates.length) {
      throw new Error(`${pattern.key}: count mismatch`);
    }
    if (term.count < MIN_PER_PATTERN || term.count > MAX_PER_PATTERN) {
      throw new Error(`${pattern.key}: count ${term.count} outside ${MIN_PER_PATTERN}..${MAX_PER_PATTERN}`);
    }
    const queries = pattern.queries.map(({ query }) => query);
    if (JSON.stringify(term.queries) !== JSON.stringify(queries)) {
      throw new Error(`${pattern.key}: query contract mismatch`);
    }

    let previousId = -1;
    for (const candidate of candidates) {
      if (!Number.isInteger(candidate.id) || candidate.id <= previousId) {
        throw new Error(`${pattern.key}: candidate ids must be strictly ascending`);
      }
      previousId = candidate.id;
      if (globalIds.has(candidate.id)) {
        throw new Error(`Duplicate sentence id across patterns: ${candidate.id}`);
      }
      globalIds.add(candidate.id);
      if (!allowedLicenses.has(candidate.license)) {
        throw new Error(`${pattern.key}: forbidden license ${candidate.license}`);
      }
      if (typeof candidate.text !== 'string' || candidate.text.trim().length === 0) {
        throw new Error(`${pattern.key}: empty sentence ${candidate.id}`);
      }
      if (candidate.owner !== null && typeof candidate.owner !== 'string') {
        throw new Error(`${pattern.key}: invalid owner for ${candidate.id}`);
      }
      if (candidate.unapproved !== false) {
        throw new Error(`${pattern.key}: unapproved sentence ${candidate.id}`);
      }
      if (candidate.sourceUrl !== sourceUrl(candidate.id)) {
        throw new Error(`${pattern.key}: invalid sourceUrl for ${candidate.id}`);
      }
      const querySpec = pattern.queries.find(({ query }) => query === candidate.matchedQuery);
      if (!querySpec || !querySpec.match.test(candidate.text)) {
        throw new Error(`${pattern.key}: sentence ${candidate.id} does not match its query`);
      }
      if (!Array.isArray(candidate.translations) || candidate.translations.length > 2) {
        throw new Error(`${pattern.key}: invalid translations for ${candidate.id}`);
      }
      const translationIds = new Set();
      for (const translation of candidate.translations) {
        if (
          !Number.isInteger(translation.id)
          || translationIds.has(translation.id)
          || typeof translation.text !== 'string'
          || translation.text.trim().length === 0
          || translation.lang !== 'eng'
          || !allowedLicenses.has(translation.license)
          || translation.sourceUrl !== sourceUrl(translation.id)
          || (translation.owner !== null && typeof translation.owner !== 'string')
        ) {
          throw new Error(`${pattern.key}: invalid translation ${translation.id}`);
        }
        translationIds.add(translation.id);
      }
    }
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
    onPattern: (key, count) => console.log(`ok ${key}: ${count}건`),
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
