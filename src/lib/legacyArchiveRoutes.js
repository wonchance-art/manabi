// Server/middleware only. Reuse the chapter manifest without importing textbook bodies.
import manifest from '../content/refGrammarManifest';

const languages = Object.fromEntries(Object.entries(manifest.languages).map(([name, value]) => [name.toLowerCase(), value]));
export function hasLegacyArchivePath(pathname) {
  const parts = pathname.replace(/^\/admin\/legacy-textbooks\/?/, '').split('/').filter(Boolean);
  if (!parts.length) return true;
  const [language, kind, slug] = parts;
  const content = languages[language];
  if (!content) return false;
  if (parts.length === 1) return true;
  if (parts.length !== 3) return false;
  if (kind === 'grammar') return content.levels.some(level => level.chapters.some(chapter => chapter.slug === slug));
  if (kind === 'vocab' || kind === 'bunkei') return content.levels.some(level => level.key.toLowerCase() === slug.toLowerCase());
  return false;
}
