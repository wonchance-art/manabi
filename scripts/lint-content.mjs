#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const CONTENT_ROOT = path.join(REPO_ROOT, 'src/content');
const TRACK_NAMES = ['chinese', 'english', 'french', 'japanese'];
const KINDS = ['grammar', 'vocab'];
const REQUIRED_CHAPTER_STRINGS = [
  'slug',
  'level',
  'title',
  'topic',
  'titleFr',
  'summary',
  'duration',
];
const TRACKS = {
  chinese: {
    grammarExampleFields: ['zh', 'pinyin', 'ko'],
    vocabWordFields: ['zh', 'pinyin', 'ko'],
    vocabPresentStringFields: ['pos'],
    vocabExampleFields: ['zh', 'pinyin', 'ko'],
    everyWordHasExample: true,
    wordIdentityField: 'zh',
  },
  english: {
    grammarExampleFields: ['en', 'ko'],
    vocabWordFields: ['en', 'ipa', 'ko', 'pos'],
    vocabPresentStringFields: [],
    vocabExampleFields: ['en', 'ko'],
    everyWordHasExample: false,
    wordIdentityField: 'en',
  },
  french: {
    grammarExampleFields: ['fr', 'ko'],
    vocabWordFields: ['fr', 'ipa', 'ko', 'pos'],
    vocabPresentStringFields: [],
    vocabExampleFields: ['fr', 'ko'],
    everyWordHasExample: false,
    wordIdentityField: 'fr',
  },
  japanese: {
    grammarExampleFields: ['ja', 'yomi', 'ko'],
    vocabWordFields: ['ja', 'yomi', 'ko', 'pos'],
    vocabPresentStringFields: [],
    vocabExampleFields: ['ja', 'yomi', 'ko'],
    everyWordHasExample: true,
    wordIdentityField: 'ja',
  },
};
const AUTHORING_SET_MIN = 8;
const AUTHORING_SET_MAX = 10;
const MODULE_WORD_FLOOR = 3;

const diagnostics = [];
const identitySeen = new Map();

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
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

function hasDraftFilename(filePath) {
  return /_draft/i.test(path.basename(filePath));
}

function hasDraftComment(source) {
  return /\/\/[^\n]*\bDRAFT\b/.test(source)
    || /\/\*[\s\S]*?\bDRAFT\b[\s\S]*?\*\//.test(source);
}

function isDraftModule(filePath, source) {
  return hasDraftFilename(filePath) || hasDraftComment(source);
}

function isAuthoringSetModule(entry) {
  return entry.isDraft
    || /(?:^|_)expansion(?:[_-]|\.|$)/i.test(path.basename(entry.absolutePath));
}

function endsInHaeyoStyle(value) {
  return nonEmptyString(value) && /요[.!?…]*$/u.test(value.trim());
}

function offsetToLocation(source, offset) {
  const safeOffset = Math.max(0, Math.min(offset, source.length));
  const before = source.slice(0, safeOffset);
  const lastNewline = before.lastIndexOf('\n');
  return {
    line: before.split('\n').length,
    column: safeOffset - lastNewline,
  };
}

function keyOffset(source, key, occurrence = 0, startOffset = 0) {
  const pattern = new RegExp(`\\b${key}\\s*:`, 'g');
  pattern.lastIndex = startOffset;
  let match;
  for (let index = 0; index <= occurrence; index += 1) {
    match = pattern.exec(source);
    if (!match) return startOffset;
  }
  return match.index;
}

function propertyValueOffset(source, key, value, startOffset = 0) {
  if (!nonEmptyString(value)) return keyOffset(source, key, 0, startOffset);
  const literals = [
    JSON.stringify(value),
    `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`,
  ];
  const keyBeforeValue = new RegExp(`\\b${key}\\s*:\\s*$`);

  for (const literal of literals) {
    let valueOffset = source.indexOf(literal, startOffset);
    while (valueOffset >= 0) {
      const prefixStart = Math.max(startOffset, valueOffset - 160);
      const prefix = source.slice(prefixStart, valueOffset);
      const match = prefix.match(keyBeforeValue);
      if (match) return prefixStart + match.index;
      valueOffset = source.indexOf(literal, valueOffset + literal.length);
    }
  }
  return keyOffset(source, key, 0, startOffset);
}

function textOffset(source, value, startOffset = 0) {
  if (!nonEmptyString(value)) return startOffset;
  const doubleQuoted = JSON.stringify(value);
  const doubleOffset = source.indexOf(doubleQuoted, startOffset);
  if (doubleOffset >= 0) return doubleOffset;
  const singleQuoted = `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
  const singleOffset = source.indexOf(singleQuoted, startOffset);
  return singleOffset >= 0 ? singleOffset : startOffset;
}

function addDiagnostic(entry, {
  code,
  message,
  offset = 0,
  severity = 'error',
}) {
  const { line, column } = offsetToLocation(entry.source, offset);
  diagnostics.push({
    code,
    column,
    file: entry.relativePath,
    line,
    message,
    severity,
  });
}

function requireNonEmptyFields(entry, value, fields, label, offset) {
  for (const field of fields) {
    if (!nonEmptyString(value?.[field])) {
      addDiagnostic(entry, {
        code: 'schema/non-empty-field',
        message: `${label}.${field} must be a non-empty string`,
        offset,
      });
    }
  }
}

function requirePresentStringFields(entry, value, fields, label, offset) {
  for (const field of fields) {
    if (!Object.hasOwn(value || {}, field) || typeof value[field] !== 'string') {
      addDiagnostic(entry, {
        code: 'schema/present-string-field',
        message: `${label}.${field} must be present and contain a string`,
        offset,
      });
    }
  }
}

function registerIdentity(entry, value, kind, offset) {
  if (!nonEmptyString(value)) {
    addDiagnostic(entry, {
      code: 'quality/invalid-id',
      message: `${kind} must be a non-empty string`,
      offset,
    });
    return;
  }

  const namespaceKey = `${entry.track}\0${value}`;
  const first = identitySeen.get(namespaceKey);
  if (first) {
    addDiagnostic(entry, {
      code: 'quality/duplicate-id',
      message: `${kind} "${value}" duplicates ${first.kind} at ${first.file}:${first.line}:${first.column}`,
      offset,
    });
    return;
  }

  const { line, column } = offsetToLocation(entry.source, offset);
  identitySeen.set(namespaceKey, {
    column,
    file: entry.relativePath,
    kind,
    line,
  });
}

function registerExplicitIds(entry, value) {
  let idOccurrence = 0;

  function visit(current) {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!current || typeof current !== 'object') return;

    for (const [key, nested] of Object.entries(current)) {
      if (key === 'id') {
        const offset = keyOffset(entry.source, 'id', idOccurrence);
        idOccurrence += 1;
        registerIdentity(entry, nested, 'id', offset);
      }
      visit(nested);
    }
  }

  visit(value);
}

function validateChineseExamples(entry, schema) {
  if (
    !entry.value
    || Array.isArray(entry.value)
    || typeof entry.value !== 'object'
    || !entry.relativePath.endsWith('_examples.js')
  ) {
    addDiagnostic(entry, {
      code: 'schema/grammar-module-shape',
      message: 'non-chapter grammar exports are allowed only for Chinese *_examples.js objects',
    });
    return;
  }

  for (const [slug, sectionExamples] of Object.entries(entry.value)) {
    const slugOffset = textOffset(entry.source, slug);
    if (!nonEmptyString(slug)) {
      addDiagnostic(entry, {
        code: 'schema/auxiliary-slug',
        message: 'Chinese example supplement slug must be non-empty',
        offset: slugOffset,
      });
    }
    if (
      !sectionExamples
      || Array.isArray(sectionExamples)
      || typeof sectionExamples !== 'object'
    ) {
      addDiagnostic(entry, {
        code: 'schema/auxiliary-sections',
        message: `Chinese example supplement "${slug}" must map section indices to arrays`,
        offset: slugOffset,
      });
      continue;
    }

    for (const [sectionIndex, examples] of Object.entries(sectionExamples)) {
      const sectionOffset = textOffset(entry.source, sectionIndex, slugOffset);
      if (!/^\d+$/.test(sectionIndex)) {
        addDiagnostic(entry, {
          code: 'schema/auxiliary-section-index',
          message: `Chinese example supplement "${slug}" has non-numeric section index "${sectionIndex}"`,
          offset: sectionOffset,
        });
      }
      if (!Array.isArray(examples) || examples.length === 0) {
        addDiagnostic(entry, {
          code: 'quality/missing-examples',
          message: `Chinese example supplement "${slug}" section ${sectionIndex} needs at least one example`,
          offset: sectionOffset,
        });
        continue;
      }
      examples.forEach((example, exampleIndex) => {
        requireNonEmptyFields(
          entry,
          example,
          schema.grammarExampleFields,
          `${slug}[${sectionIndex}].examples[${exampleIndex}]`,
          sectionOffset,
        );
      });
    }
  }
}

function validateGrammar(entry) {
  const schema = TRACKS[entry.track];
  if (!isChapterModule(entry.value)) {
    if (entry.track === 'chinese') {
      validateChineseExamples(entry, schema);
    } else {
      addDiagnostic(entry, {
        code: 'schema/grammar-module-shape',
        message: 'grammar module default export must be a non-empty chapter array',
      });
    }
    registerExplicitIds(entry, entry.value);
    return;
  }

  let chapterSearchOffset = 0;
  let sectionOccurrence = 0;
  entry.value.forEach((chapter, chapterIndex) => {
    const chapterOffset = propertyValueOffset(
      entry.source,
      'slug',
      chapter.slug,
      chapterSearchOffset,
    );
    chapterSearchOffset = chapterOffset + 1;
    const chapterLabel = chapter.slug || `(chapter ${chapterIndex})`;
    requireNonEmptyFields(
      entry,
      chapter,
      REQUIRED_CHAPTER_STRINGS,
      chapterLabel,
      chapterOffset,
    );
    registerIdentity(entry, chapter.slug, 'chapter slug', chapterOffset);

    if (!Number.isInteger(chapter.order) || chapter.order <= 0) {
      addDiagnostic(entry, {
        code: 'schema/chapter-order',
        message: `${chapterLabel}.order must be a positive integer`,
        offset: chapterOffset,
      });
    }
    if (!Array.isArray(chapter.sections) || chapter.sections.length === 0) {
      addDiagnostic(entry, {
        code: 'schema/chapter-sections',
        message: `${chapterLabel}.sections must be a non-empty array`,
        offset: chapterOffset,
      });
      return;
    }

    const examples = [];
    let hasBody = false;
    let hasStructuredKanaMaterial = false;
    chapter.sections.forEach((section, sectionIndex) => {
      const sectionOffset = keyOffset(entry.source, 'heading', sectionOccurrence);
      sectionOccurrence += 1;
      const sectionLabel = `${chapterLabel}.sections[${sectionIndex}]`;
      if (!nonEmptyString(section?.heading)) {
        addDiagnostic(entry, {
          code: 'schema/section-heading',
          message: `${sectionLabel}.heading must be a non-empty string`,
          offset: sectionOffset,
        });
      }
      if (nonEmptyString(section?.body)) hasBody = true;
      if (section?.gojuon || section?.table) hasStructuredKanaMaterial = true;
      if (section?.examples !== undefined && !Array.isArray(section.examples)) {
        addDiagnostic(entry, {
          code: 'schema/examples-array',
          message: `${sectionLabel}.examples must be an array when present`,
          offset: sectionOffset,
        });
      } else if (Array.isArray(section?.examples)) {
        examples.push(...section.examples.map((example, exampleIndex) => ({
          example,
          exampleIndex,
          sectionIndex,
          sectionOffset,
        })));
      }
    });

    if (!hasBody) {
      addDiagnostic(entry, {
        code: 'schema/chapter-body',
        message: `${chapterLabel} needs at least one non-empty section body`,
        offset: chapterOffset,
      });
    }

    if (examples.length === 0) {
      if (
        entry.track !== 'japanese'
        || !nonEmptyString(chapter.kana)
        || !hasStructuredKanaMaterial
      ) {
        addDiagnostic(entry, {
          code: 'quality/missing-examples',
          message: `${chapterLabel} needs at least two examples`,
          offset: chapterOffset,
        });
      }
    } else if (examples.length < 2) {
      addDiagnostic(entry, {
        code: 'quality/missing-examples',
        message: `${chapterLabel} has ${examples.length} example; at least two are required`,
        offset: chapterOffset,
      });
    }

    examples.forEach(({
      example,
      exampleIndex,
      sectionIndex,
      sectionOffset,
    }) => {
      const exampleLabel = `${chapterLabel}.sections[${sectionIndex}].examples[${exampleIndex}]`;
      if (Array.isArray(example?.dialogue)) {
        // RFC dialogue-field: 구조화 대화는 라인 단위로 speaker·원어·ko를 검사한다
        example.dialogue.forEach((line, lineIndex) => {
          requireNonEmptyFields(
            entry,
            line,
            ['speaker', schema.grammarExampleFields[0], 'ko'],
            `${exampleLabel}.dialogue[${lineIndex}]`,
            sectionOffset,
          );
        });
        return;
      }
      requireNonEmptyFields(
        entry,
        example,
        schema.grammarExampleFields,
        exampleLabel,
        sectionOffset,
      );
    });
  });

  const proseSample = entry.value[0]?.summary;
  if (nonEmptyString(proseSample) && !endsInHaeyoStyle(proseSample)) {
    addDiagnostic(entry, {
      code: 'tone/haeyo-sample',
      message: 'deterministic prose sample (first chapter summary) does not end in 해요체 /요/',
      offset: keyOffset(entry.source, 'summary'),
      severity: 'warning',
    });
  }

  registerExplicitIds(entry, entry.value);
}

function validateVocab(entry) {
  const schema = TRACKS[entry.track];
  const themes = vocabThemes(entry.value);
  if (!Array.isArray(themes) || themes.length === 0) {
    addDiagnostic(entry, {
      code: 'schema/vocab-module-shape',
      message: 'vocabulary module must export a non-empty theme array or { themes } object',
    });
    registerExplicitIds(entry, entry.value);
    return;
  }

  if (!Array.isArray(entry.value) && entry.value.level !== undefined) {
    requireNonEmptyFields(
      entry,
      entry.value,
      ['level', 'title', 'desc'],
      'vocabulary shell',
      0,
    );
  }

  const enforceAuthoringSets = isAuthoringSetModule(entry);
  let moduleWordCount = 0;
  let moduleExampleCount = 0;
  let themeSearchOffset = 0;
  let wordSearchOffset = 0;

  themes.forEach((theme, themeIndex) => {
    const themeOffset = propertyValueOffset(
      entry.source,
      'name',
      theme?.name,
      themeSearchOffset,
    );
    themeSearchOffset = themeOffset + 1;
    const themeLabel = `themes[${themeIndex}]`;
    if (!nonEmptyString(theme?.name)) {
      addDiagnostic(entry, {
        code: 'schema/theme-name',
        message: `${themeLabel}.name must be a non-empty string`,
        offset: themeOffset,
      });
    }
    if (theme?.icon !== undefined && !nonEmptyString(theme.icon)) {
      addDiagnostic(entry, {
        code: 'schema/theme-icon',
        message: `${themeLabel}.icon must be a non-empty string when present`,
        offset: themeOffset,
      });
    }
    if (!Array.isArray(theme?.words) || theme.words.length === 0) {
      addDiagnostic(entry, {
        code: 'schema/theme-words',
        message: `${themeLabel}.words must be a non-empty array`,
        offset: themeOffset,
      });
      return;
    }

    moduleWordCount += theme.words.length;
    if (
      enforceAuthoringSets
      && (
        theme.words.length < AUTHORING_SET_MIN
        || theme.words.length > AUTHORING_SET_MAX
      )
    ) {
      addDiagnostic(entry, {
        code: 'quality/set-size',
        message: `${themeLabel} "${theme.name || '(unnamed)'}" has ${theme.words.length} words; new sets require ${AUTHORING_SET_MIN}-${AUTHORING_SET_MAX}`,
        offset: themeOffset,
      });
    }

    theme.words.forEach((word, wordIndex) => {
      const wordOffset = propertyValueOffset(
        entry.source,
        schema.wordIdentityField,
        word?.[schema.wordIdentityField],
        Math.max(themeOffset, wordSearchOffset),
      );
      wordSearchOffset = wordOffset + 1;
      const wordLabel = `${themeLabel}.words[${wordIndex}]`;
      requireNonEmptyFields(
        entry,
        word,
        schema.vocabWordFields,
        wordLabel,
        wordOffset,
      );
      requirePresentStringFields(
        entry,
        word,
        schema.vocabPresentStringFields,
        wordLabel,
        wordOffset,
      );

      const exampleRequired = schema.everyWordHasExample || enforceAuthoringSets;
      if (exampleRequired && (!word?.ex || typeof word.ex !== 'object')) {
        addDiagnostic(entry, {
          code: 'quality/missing-examples',
          message: `${wordLabel} needs an example object`,
          offset: wordOffset,
        });
      }
      if (word?.ex && typeof word.ex === 'object') {
        moduleExampleCount += 1;
        requireNonEmptyFields(
          entry,
          word.ex,
          schema.vocabExampleFields,
          `${wordLabel}.ex`,
          wordOffset,
        );
      }
    });
  });

  if (moduleWordCount < MODULE_WORD_FLOOR) {
    addDiagnostic(entry, {
      code: 'quality/module-size',
      message: `vocabulary module has ${moduleWordCount} words; at least ${MODULE_WORD_FLOOR} are required`,
    });
  }
  if (moduleExampleCount === 0) {
    addDiagnostic(entry, {
      code: 'quality/missing-examples',
      message: 'vocabulary module needs at least one example-bearing word',
    });
  }

  const proseSample = Array.isArray(entry.value) ? null : entry.value.desc;
  if (nonEmptyString(proseSample) && !endsInHaeyoStyle(proseSample)) {
    addDiagnostic(entry, {
      code: 'tone/haeyo-sample',
      message: 'deterministic prose sample (module desc) does not end in 해요체 /요/',
      offset: keyOffset(entry.source, 'desc'),
      severity: 'warning',
    });
  }

  registerExplicitIds(entry, entry.value);
}

async function discoverModules(includeDrafts) {
  const entries = [];
  for (const track of TRACK_NAMES) {
    for (const kind of KINDS) {
      const directory = path.join(CONTENT_ROOT, track, kind);
      const names = (await fs.readdir(directory))
        .filter(name => name.endsWith('.js'))
        .sort((a, b) => a.localeCompare(b, 'en'));

      for (const name of names) {
        const absolutePath = path.join(directory, name);
        const source = await fs.readFile(absolutePath, 'utf8');
        const draft = isDraftModule(absolutePath, source);
        if (draft && !includeDrafts) continue;

        const relativePath = path
          .relative(REPO_ROOT, absolutePath)
          .split(path.sep)
          .join('/');
        const entry = {
          absolutePath,
          isDraft: draft,
          kind,
          relativePath,
          source,
          track,
          value: null,
        };
        try {
          const url = pathToFileURL(absolutePath);
          url.searchParams.set('lint-content', '1');
          entry.value = (await import(url.href)).default;
        } catch (error) {
          addDiagnostic(entry, {
            code: 'schema/import',
            message: `module import failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
        entries.push(entry);
      }
    }
  }
  return entries;
}

function sortDiagnostics(left, right) {
  return left.file.localeCompare(right.file, 'en')
    || left.line - right.line
    || left.column - right.column
    || left.severity.localeCompare(right.severity, 'en')
    || left.code.localeCompare(right.code, 'en')
    || left.message.localeCompare(right.message, 'en');
}

function printHelp() {
  process.stdout.write([
    'Usage: node scripts/lint-content.mjs [--drafts]',
    '',
    'Checks the four grammar/vocabulary tracks. Draft modules are excluded by',
    'default; --drafts includes files with *_draft* names or uppercase DRAFT',
    'tokens in JavaScript comments.',
    '',
    'Exit codes: 0 = no errors, 1 = content errors, 2 = CLI/internal failure.',
    '',
  ].join('\n'));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }
  const unknown = args.filter(argument => argument !== '--drafts');
  if (unknown.length > 0) {
    process.stdout.write(
      `scripts/lint-content.mjs:1:1 error cli/unknown-option unknown option: ${unknown[0]}\n`,
    );
    process.exitCode = 2;
    return;
  }

  const includeDrafts = args.includes('--drafts');
  const entries = await discoverModules(includeDrafts);
  entries.forEach(entry => {
    if (entry.value === null) return;
    if (entry.kind === 'grammar') validateGrammar(entry);
    else validateVocab(entry);
  });

  diagnostics.sort(sortDiagnostics);
  if (diagnostics.length > 0) {
    process.stdout.write(`${diagnostics.map(diagnostic =>
      `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} ${diagnostic.code} ${diagnostic.message}`
    ).join('\n')}\n`);
  }

  const errorCount = diagnostics.filter(({ severity }) => severity === 'error').length;
  const warningCount = diagnostics.length - errorCount;
  const draftCount = entries.filter(entry => entry.isDraft).length;
  const activeCount = entries.length - draftCount;
  process.stdout.write(
    `content lint: ${activeCount} active + ${draftCount} draft modules, ${errorCount} errors, ${warningCount} warnings\n`,
  );
  if (errorCount > 0) process.exitCode = 1;
}

main().catch(error => {
  process.stdout.write(
    `scripts/lint-content.mjs:1:1 error internal/failure ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 2;
});
