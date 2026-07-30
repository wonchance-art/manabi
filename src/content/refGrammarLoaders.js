import manifest from './refGrammarManifest';
import { createLazyRegistry } from './refRegistry';
import { JAPANESE_GRAMMAR_LOADERS } from './japanese/grammarLoader';
import { FRENCH_GRAMMAR_LOADERS } from './french/grammarLoader';
import { ENGLISH_GRAMMAR_LOADERS } from './english/grammarLoader';
import { CHINESE_GRAMMAR_LOADERS } from './chinese/grammarLoader';

const LOADERS = Object.freeze({
  Japanese: JAPANESE_GRAMMAR_LOADERS,
  French: FRENCH_GRAMMAR_LOADERS,
  English: ENGLISH_GRAMMAR_LOADERS,
  Chinese: CHINESE_GRAMMAR_LOADERS,
});

const registries = new Map();

function getLanguageManifest(language) {
  const languageManifest = manifest.languages[language];
  if (!languageManifest || !LOADERS[language]) {
    throw new Error(`[refGrammarLoaders] unknown language: ${language}`);
  }
  return languageManifest;
}

function createFacade(languageManifest) {
  const levelByKey = new Map(
    languageManifest.levels.map(level => [level.key, level]),
  );
  const bunkeiByLevel = new Map(languageManifest.levels.map(level => [
    level.key,
    level.bunkeiAvailable
      ? {
        themes: [{
          items: level.bunkeiChapterSlugs.map(chapterSlug => ({ ch: chapterSlug })),
        }],
      }
      : null,
  ]));

  return {
    base: languageManifest.base,
    readKey: languageManifest.readKey,
    flag: languageManifest.flag,
    name: languageManifest.name,
    langCode: languageManifest.langCode,
    blurb: languageManifest.blurb,
    legend: languageManifest.legend,
    getBunkei(levelKey) {
      return bunkeiByLevel.get(String(levelKey || '').toUpperCase()) || null;
    },
    countVocab(levelKey) {
      return levelByKey.get(String(levelKey || '').toUpperCase())?.vocabCount || 0;
    },
  };
}

function getRegistry(language) {
  if (registries.has(language)) return registries.get(language);
  const languageManifest = getLanguageManifest(language);
  const registry = createLazyRegistry(
    languageManifest.levelMeta,
    languageManifest,
    LOADERS[language],
    createFacade(languageManifest),
  );
  registries.set(language, registry);
  return registry;
}

function getChapterManifest(languageManifest, slug) {
  for (const level of languageManifest.levels) {
    const chapter = level.chapters.find(entry => entry.slug === slug);
    if (chapter) return chapter;
  }
  return null;
}

export function getGrammarStaticParams(language) {
  return getLanguageManifest(language).levels.flatMap(level =>
    level.chapters.map(chapter => ({ slug: chapter.slug })),
  );
}

export function getGrammarManifest(language) {
  return getLanguageManifest(language);
}

export function loadGrammarLevel(language, levelKey) {
  return getRegistry(language).loadGrammarLevel(levelKey);
}

export async function loadChapter(language, slug) {
  const languageManifest = getLanguageManifest(language);
  const loaded = await getRegistry(language).loadChapter(slug);
  return {
    ...loaded,
    courseLesson: getChapterManifest(languageManifest, slug)?.courseLesson || null,
  };
}
