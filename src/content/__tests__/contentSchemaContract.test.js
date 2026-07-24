import { beforeAll, describe, expect, it } from 'vitest';

const grammarLoaders = import.meta.glob([
  '../japanese/grammar/*.js',
  '../french/grammar/*.js',
  '../english/grammar/*.js',
  '../chinese/grammar/*.js',
]);
const grammarSources = import.meta.glob([
  '../japanese/grammar/*.js',
  '../french/grammar/*.js',
  '../english/grammar/*.js',
  '../chinese/grammar/*.js',
], { eager: true, import: 'default', query: '?raw' });

const vocabLoaders = import.meta.glob([
  '../japanese/vocab/*.js',
  '../french/vocab/*.js',
  '../english/vocab/*.js',
  '../chinese/vocab/*.js',
]);
const vocabSources = import.meta.glob([
  '../japanese/vocab/*.js',
  '../french/vocab/*.js',
  '../english/vocab/*.js',
  '../chinese/vocab/*.js',
], { eager: true, import: 'default', query: '?raw' });

const TRACKS = {
  japanese: {
    grammarExampleFields: ['ja', 'yomi', 'ko'],
    vocabWordFields: ['ja', 'yomi', 'ko', 'pos'],
    vocabExampleFields: ['ja', 'yomi', 'ko'],
    everyWordHasExample: true,
  },
  french: {
    grammarExampleFields: ['fr', 'ko'],
    vocabWordFields: ['fr', 'ipa', 'ko', 'pos'],
    vocabExampleFields: ['fr', 'ko'],
    everyWordHasExample: false,
  },
  english: {
    grammarExampleFields: ['en', 'ko'],
    vocabWordFields: ['en', 'ipa', 'ko', 'pos'],
    vocabExampleFields: ['en', 'ko'],
    everyWordHasExample: false,
  },
  chinese: {
    grammarExampleFields: ['zh', 'pinyin', 'ko'],
    vocabWordFields: ['zh', 'pinyin', 'ko'],
    vocabPresentStringFields: ['pos'],
    vocabExampleFields: ['zh', 'pinyin', 'ko'],
    everyWordHasExample: true,
  },
};

const REQUIRED_CHAPTER_STRINGS = [
  'slug',
  'level',
  'title',
  'topic',
  'titleFr',
  'summary',
  'duration',
];

const nonEmptyString = value => typeof value === 'string' && value.trim().length > 0;
const moduleTrack = modulePath => modulePath.match(/\.\.\/([^/]+)\//)?.[1] || null;
const hasDraftFilename = modulePath => /_draft/i.test(modulePath.split('/').pop() || '');
const hasDraftComment = source =>
  /\/\/[^\n]*\bDRAFT\b/.test(source) || /\/\*[\s\S]*?\bDRAFT\b[\s\S]*?\*\//.test(source);
const isDraftModule = (modulePath, source) =>
  hasDraftFilename(modulePath) || hasDraftComment(source);

function expectNonEmptyFields(value, fields, label) {
  for (const field of fields) {
    expect(nonEmptyString(value?.[field]), `${label}.${field}`).toBe(true);
  }
}

function expectPresentStringFields(value, fields = [], label) {
  for (const field of fields) {
    expect(Object.hasOwn(value, field), `${label}.${field} presence`).toBe(true);
    expect(typeof value[field], `${label}.${field} type`).toBe('string');
  }
}

async function loadActiveModules(loaders, sources) {
  const entries = [];
  for (const [modulePath, source] of Object.entries(sources)) {
    if (isDraftModule(modulePath, source)) continue;
    expect(typeof loaders[modulePath], `${modulePath} loader`).toBe('function');
    entries.push({
      modulePath,
      track: moduleTrack(modulePath),
      value: (await loaders[modulePath]()).default,
    });
  }
  return entries.sort((a, b) => a.modulePath.localeCompare(b.modulePath));
}

function isChapterModule(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(chapter => chapter && Array.isArray(chapter.sections));
}

function vocabThemes(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.themes)) return value.themes;
  return null;
}

let grammarModules;
let vocabModules;

beforeAll(async () => {
  [grammarModules, vocabModules] = await Promise.all([
    loadActiveModules(grammarLoaders, grammarSources),
    loadActiveModules(vocabLoaders, vocabSources),
  ]);
});

describe('content draft exclusion rule', () => {
  it('excludes *_draft* files and uppercase DRAFT comments only', () => {
    expect(isDraftModule('../english/vocab/a1_draft_notes.js', 'export default {};')).toBe(true);
    expect(isDraftModule('../english/vocab/a1.js', '// DRAFT: not published\nexport default {};')).toBe(true);
    expect(isDraftModule('../english/vocab/a1.js', 'const word = "draft";\nexport default word;')).toBe(false);
  });

  it('keeps every draft-marked source out of the active module inventory', () => {
    const activePaths = new Set([
      ...grammarModules.map(entry => entry.modulePath),
      ...vocabModules.map(entry => entry.modulePath),
    ]);
    for (const [modulePath, source] of [
      ...Object.entries(grammarSources),
      ...Object.entries(vocabSources),
    ]) {
      if (isDraftModule(modulePath, source)) {
        expect(activePaths.has(modulePath), `${modulePath} active draft`).toBe(false);
      }
    }
  });
});

describe.each(Object.entries(TRACKS))('%s grammar contract', (track, schema) => {
  it('covers every active grammar module as chapters or Chinese example supplements', () => {
    const entries = grammarModules.filter(entry => entry.track === track);
    expect(entries.length, `${track} grammar modules`).toBeGreaterThan(0);

    for (const entry of entries) {
      if (isChapterModule(entry.value)) continue;
      expect(track, `${entry.modulePath} auxiliary track`).toBe('chinese');
      expect(entry.modulePath.endsWith('_examples.js'), `${entry.modulePath} auxiliary filename`).toBe(true);
      expect(entry.value && !Array.isArray(entry.value) && typeof entry.value === 'object',
        `${entry.modulePath} auxiliary export`).toBe(true);

      for (const [slug, sectionExamples] of Object.entries(entry.value)) {
        expect(nonEmptyString(slug), `${entry.modulePath} auxiliary slug`).toBe(true);
        expect(sectionExamples && !Array.isArray(sectionExamples)
          && typeof sectionExamples === 'object', `${entry.modulePath}:${slug}`).toBe(true);
        for (const [sectionIndex, examples] of Object.entries(sectionExamples)) {
          expect(/^\d+$/.test(sectionIndex), `${entry.modulePath}:${slug} section index`).toBe(true);
          expect(Array.isArray(examples) && examples.length > 0,
            `${entry.modulePath}:${slug}[${sectionIndex}]`).toBe(true);
          for (const [index, example] of examples.entries()) {
            expectNonEmptyFields(
              example,
              schema.grammarExampleFields,
              `${entry.modulePath}:${slug}[${sectionIndex}].examples[${index}]`,
            );
          }
        }
      }
    }
  });

  it('guards chapter identity, title, body, sections, and measured example fields', () => {
    const chapterEntries = grammarModules
      .filter(entry => entry.track === track && isChapterModule(entry.value));
    const chapters = chapterEntries.flatMap(entry =>
      entry.value.map(chapter => ({ chapter, modulePath: entry.modulePath })));
    expect(chapters.length, `${track} chapters`).toBeGreaterThan(0);

    const slugs = new Set();
    for (const { chapter, modulePath } of chapters) {
      const label = `${modulePath}:${chapter.slug || '(slug missing)'}`;
      expectNonEmptyFields(chapter, REQUIRED_CHAPTER_STRINGS, label);
      expect(Number.isInteger(chapter.order) && chapter.order > 0, `${label}.order`).toBe(true);
      expect(Array.isArray(chapter.sections) && chapter.sections.length > 0,
        `${label}.sections`).toBe(true);
      expect(slugs.has(chapter.slug), `${label} duplicate slug`).toBe(false);
      slugs.add(chapter.slug);

      const examples = [];
      for (const [sectionIndex, section] of chapter.sections.entries()) {
        expect(nonEmptyString(section.heading), `${label}.sections[${sectionIndex}].heading`).toBe(true);
        if (section.examples !== undefined) {
          expect(Array.isArray(section.examples), `${label}.sections[${sectionIndex}].examples`).toBe(true);
          examples.push(...section.examples);
        }
      }
      expect(chapter.sections.some(section => nonEmptyString(section.body)), `${label} body`).toBe(true);

      if (examples.length === 0) {
        expect(track, `${label} example-free track`).toBe('japanese');
        expect(nonEmptyString(chapter.kana), `${label}.kana alternative`).toBe(true);
        expect(chapter.sections.some(section => section.gojuon || section.table),
          `${label} structured kana material`).toBe(true);
      }
      for (const [index, example] of examples.entries()) {
        expectNonEmptyFields(example, schema.grammarExampleFields, `${label}.examples[${index}]`);
      }
    }
  });
});

describe.each(Object.entries(TRACKS))('%s vocabulary contract', (track, schema) => {
  it('guards every active module, its titled themes, and a 3-word module floor', () => {
    const entries = vocabModules.filter(entry => entry.track === track);
    expect(entries.length, `${track} vocabulary modules`).toBeGreaterThan(0);

    for (const entry of entries) {
      const themes = vocabThemes(entry.value);
      expect(Array.isArray(themes) && themes.length > 0, `${entry.modulePath} themes`).toBe(true);

      if (!Array.isArray(entry.value) && entry.value.level !== undefined) {
        expectNonEmptyFields(entry.value, ['level', 'title', 'desc'], entry.modulePath);
      }

      const words = [];
      for (const [themeIndex, theme] of themes.entries()) {
        const label = `${entry.modulePath}.themes[${themeIndex}]`;
        expect(nonEmptyString(theme.name), `${label}.name`).toBe(true);
        expect(Array.isArray(theme.words) && theme.words.length > 0, `${label}.words`).toBe(true);
        if (theme.icon !== undefined) {
          expect(nonEmptyString(theme.icon), `${label}.icon`).toBe(true);
        }
        words.push(...theme.words);
      }
      expect(words.length, `${entry.modulePath} words`).toBeGreaterThanOrEqual(3);

      let exampleCount = 0;
      for (const [wordIndex, word] of words.entries()) {
        const label = `${entry.modulePath}.words[${wordIndex}]`;
        expectNonEmptyFields(word, schema.vocabWordFields, label);
        expectPresentStringFields(word, schema.vocabPresentStringFields, label);
        if (schema.everyWordHasExample) {
          expect(word.ex && typeof word.ex === 'object', `${label}.ex`).toBe(true);
        }
        if (word.ex) {
          exampleCount += 1;
          expectNonEmptyFields(word.ex, schema.vocabExampleFields, `${label}.ex`);
        }
      }
      expect(exampleCount, `${entry.modulePath} example-bearing words`).toBeGreaterThan(0);
    }
  });
});
