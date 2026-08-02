import { normalizeSlug } from '../world/storageSchema.js';

const DEFAULT_LANGUAGE = 'Japanese';

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readArray(storage, key) {
  if (!storage || !key) return [];
  try {
    const value = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readObject(storage, key) {
  if (!storage || !key) return {};
  try {
    const value = JSON.parse(storage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function normalizedSet(values) {
  return new Set(
    values
      .map((value) => normalizeSlug(value))
      .filter((value) => typeof value === 'string' && value),
  );
}

function passed(result) {
  if (!result || typeof result !== 'object') return false;
  if (typeof result.passed === 'boolean') return result.passed;
  const right = Number(result.right);
  const total = Number(result.total);
  return Number.isFinite(right) && Number.isFinite(total) && total > 0
    ? right >= Math.ceil(total * 0.8)
    : false;
}

function visitedChapter(storage, manifest) {
  const candidates = [
    readObject(storage, 'ref_last_chapter'),
    readObject(storage, 'ref_last_visit'),
  ];
  return candidates.find((entry) => (
    entry.lang === manifest.language
    && typeof entry.slug === 'string'
  ))?.slug;
}

export function preferredLearnLanguage(
  language,
  catalog,
  storage = defaultStorage(),
) {
  if (language && catalog?.[language]) return language;

  try {
    const saved = storage?.getItem('lessons_lang');
    if (saved && catalog?.[saved]) return saved;
  } catch {}

  if (catalog?.[DEFAULT_LANGUAGE]) return DEFAULT_LANGUAGE;
  return Object.keys(catalog || {})[0] || DEFAULT_LANGUAGE;
}

/**
 * 기존 챕터 기록을 레벨별 방문/완료로 집계한다.
 *
 * 방문: 읽음 배열, 패턴 체크 시도, 마지막 챕터 방문, 명시적 레슨 완료
 * 완료: 패턴 체크 통과 또는 명시적 레슨 완료
 * OT/A0처럼 관문이 없는 intro 레벨은 읽음 기록을 완료로도 센다.
 */
export function readLearnHomeProgress(
  catalog,
  language,
  storage = defaultStorage(),
) {
  const selectedLanguage = preferredLearnLanguage(language, catalog, storage);
  const manifest = catalog?.[selectedLanguage];
  if (!manifest) {
    return {
      language: selectedLanguage,
      name: selectedLanguage,
      track: '',
      levels: [],
      hasProgress: false,
    };
  }

  const read = normalizedSet(readArray(storage, manifest.readKey));
  const studied = normalizedSet(readArray(storage, 'studied_lesson'));
  const checks = readObject(storage, `${manifest.readKey}_check`);
  const checked = normalizedSet(Object.keys(checks));
  const completed = new Set(studied);

  for (const [slug, result] of Object.entries(checks)) {
    if (passed(result)) completed.add(normalizeSlug(slug));
  }

  const lastVisited = normalizeSlug(visitedChapter(storage, manifest));
  const levels = manifest.levels.map((level) => {
    const slugs = normalizedSet(level.chapterSlugs || []);
    let visitedCount = 0;
    let completedCount = 0;

    for (const slug of slugs) {
      const isCompleted = completed.has(slug) || (level.intro && read.has(slug));
      const isVisited = isCompleted
        || read.has(slug)
        || checked.has(slug)
        || lastVisited === slug;
      if (isVisited) visitedCount += 1;
      if (isCompleted) completedCount += 1;
    }

    return {
      key: level.key,
      short: level.short || level.key,
      label: level.label || level.key,
      totalCount: slugs.size,
      visitedCount,
      completedCount,
    };
  });

  return {
    language: selectedLanguage,
    name: manifest.name || selectedLanguage,
    track: manifest.track || '',
    levels,
    hasProgress: levels.some((level) => level.visitedCount > 0 || level.completedCount > 0),
  };
}
