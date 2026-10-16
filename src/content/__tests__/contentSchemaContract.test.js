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

const DIALOGUE_LANGUAGE_FIELDS = ['fr', 'ja', 'en', 'zh'];
const FLAT_EXAMPLE_TEXT_FIELDS = [...DIALOGUE_LANGUAGE_FIELDS, 'ipa', 'yomi', 'pinyin', 'ko'];
const DIALOGUE_LINE_FIELDS = new Set(['speaker', ...DIALOGUE_LANGUAGE_FIELDS, 'ipa', 'ko']);

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

function expectGrammarExample(example, flatFields, label) {
  if (!Object.hasOwn(example || {}, 'dialogue')) {
    expectNonEmptyFields(example, flatFields, label);
    return;
  }

  expect(FLAT_EXAMPLE_TEXT_FIELDS.some(field => Object.hasOwn(example, field)),
    `${label} flat/dialogue exclusivity`).toBe(false);
  expect(Array.isArray(example.dialogue) && example.dialogue.length > 0,
    `${label}.dialogue`).toBe(true);

  for (const [lineIndex, line] of example.dialogue.entries()) {
    const lineLabel = `${label}.dialogue[${lineIndex}]`;
    expect(line && !Array.isArray(line) && typeof line === 'object', lineLabel).toBe(true);
    expect(Object.keys(line).every(field => DIALOGUE_LINE_FIELDS.has(field)),
      `${lineLabel} fields`).toBe(true);
    expectNonEmptyFields(line, ['speaker', 'ko'], lineLabel);
    const languageFields = DIALOGUE_LANGUAGE_FIELDS.filter(field => Object.hasOwn(line, field));
    expect(languageFields.length, `${lineLabel} language field count`).toBe(1);
    expect(nonEmptyString(line[languageFields[0]]), `${lineLabel}.${languageFields[0]}`).toBe(true);
    if (Object.hasOwn(line, 'ipa')) {
      expect(nonEmptyString(line.ipa), `${lineLabel}.ipa`).toBe(true);
    }
  }
}

/**
 * 콘텐츠 데이터 모듈(import · 부수효과 없는 `const … ; export default …;`)을 이미 읽은 원문(?raw)에서 평가한다(CONTENT-SCHEMA-SPEED-001).
 * 152개 · 9.7MB를 vite 모듈 변환으로 하나씩 적재하면 단독 5.6s(부하 평균 8)였고, 병렬 실행에서는 변환이 한 프로세스에 몰려
 * 60s 훅 제한을 넘었다(2026-10-17 KST 여러 세션 재현). 같은 원문을 엄격 모드 함수로 평가하면 0.3s 안팎이다.
 * 데이터 모듈 모양을 벗어나면(import · 다른 export) 평가하지 않고 실패한다 — 그때는 모듈 적재로 되돌린다.
 * 모듈 적재와 같은 값인지는 아래 「모듈 적재 대조」가 트랙 · 종류마다 하나씩 확인한다.
 */
function evaluateDataModule(modulePath, source) {
  expect(/^\s*import\b/m.test(source), `${modulePath}: 데이터 모듈은 import가 없다`).toBe(false);
  expect((source.match(/^export default /gm) || []).length, `${modulePath}: export default는 하나`).toBe(1);
  expect(source.match(/^export (?!default |const )/gm), `${modulePath}: export default · export const 밖의 export 없음`).toBe(null);
  const body = source.replace(/^export const /gm, 'const ').replace(/^export default /m, 'return ');
  return new Function(`"use strict";\n${body}`)();
}

function loadActiveModules(loaders, sources) {
  const entries = [];
  for (const [modulePath, source] of Object.entries(sources)) {
    if (isDraftModule(modulePath, source)) continue;
    expect(typeof loaders[modulePath], `${modulePath} loader`).toBe('function');
    entries.push({
      modulePath,
      track: moduleTrack(modulePath),
      value: evaluateDataModule(modulePath, source),
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

// 4트랙 문법·어휘 모듈 전량 — 원문(?raw)에서 평가한다(evaluateDataModule). 예전 모듈 적재는 단독 9.96s(2026-08-19) · 5.6s(10-17)로
// 무거워 60s를 주었고, 병렬 부하에서는 그래도 넘었다. 제한은 그대로 둔다(늘리지 않는다).
beforeAll(() => {
  grammarModules = loadActiveModules(grammarLoaders, grammarSources);
  vocabModules = loadActiveModules(vocabLoaders, vocabSources);
}, 60000);

describe('content data evaluation matches module loading', () => {
  // 트랙(4) × 종류(문법 · 어휘)마다 가장 작은 활성 모듈 하나를 실제 모듈 적재로 받아 평가값과 대조한다 — 평가 경로가 모듈 시스템과
  // 같은 값을 낸다는 근거(작은 파일이라 적재 비용이 작다).
  const samples = (loaders, sources) => Object.values(Object.entries(sources)
    .filter(([modulePath, source]) => !isDraftModule(modulePath, source))
    .reduce((smallest, [modulePath, source]) => {
      const track = moduleTrack(modulePath);
      if (!smallest[track] || source.length < smallest[track].source.length) smallest[track] = { modulePath, source, loader: loaders[modulePath] };
      return smallest;
    }, {}));
  const cases = [...samples(grammarLoaders, grammarSources), ...samples(vocabLoaders, vocabSources)];
  it('표본이 트랙 · 종류마다 있다', () => {
    expect(cases.length).toBe(8);
  });
  it.each(cases.map(sample => [sample.modulePath, sample]))('%s', async (_, sample) => {
    expect((await sample.loader()).default).toStrictEqual(evaluateDataModule(sample.modulePath, sample.source));
  });
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
            expectGrammarExample(
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
      // RFC v2 "실전 샌드위치" 섹션(type: authenticIntro|vocabPreview|authenticReplay|practiceAndRegistration)은
      // 자체 콘텐츠(audio, vocabs, 등)를 가지므로 body 필드 불필수
      const hasV2Sections = chapter.sections.some(s =>
        ['authenticIntro', 'vocabPreview', 'authenticReplay', 'practiceAndRegistration'].includes(s.type)
      );
      const hasBodySection = chapter.sections.some(section => nonEmptyString(section.body));
      expect(hasBodySection || hasV2Sections, `${label} body or v2 content`).toBe(true);

      if (examples.length === 0) {
        expect(track, `${label} example-free track`).toBe('japanese');
        expect(nonEmptyString(chapter.kana), `${label}.kana alternative`).toBe(true);
        expect(chapter.sections.some(section => section.gojuon || section.table),
          `${label} structured kana material`).toBe(true);
      }
      for (const [index, example] of examples.entries()) {
        expectGrammarExample(example, schema.grammarExampleFields, `${label}.examples[${index}]`);
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
