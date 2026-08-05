import { readdir } from 'node:fs/promises';

const DEFAULT_CONTENT_ROOT = new URL('../src/content/', import.meta.url);

/**
 * Discover every grammar module whose default export is a chapter array.
 * Sidecar maps such as `*_examples.js` are intentionally ignored.
 */
export async function discoverGrammarModules(language, { contentRoot = DEFAULT_CONTENT_ROOT } = {}) {
  const grammarRoot = new URL(`${language}/grammar/`, contentRoot);
  const files = (await readdir(grammarRoot))
    .filter(file => file.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const modules = [];
  for (const file of files) {
    const loaded = await import(new URL(file, grammarRoot));
    if (!Array.isArray(loaded.default)) continue;
    modules.push({
      file,
      relativePath: `src/content/${language}/grammar/${file}`,
      chapters: loaded.default,
    });
  }
  return modules;
}
