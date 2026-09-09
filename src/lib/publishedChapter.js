// 서버 전용: 한 번 읽은 공개 수정본으로 본문·보기 풀·복습·메타데이터를 함께 해석한다.
import { cache } from 'react';
import { createHash } from 'node:crypto';
import { getOverridesForLang, mergeChapter } from './contentOverrides';

const readPublishedOverrides = cache(getOverridesForLang);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])]),
  );
  return value;
}
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex').slice(0, 24);
const mainText = ex => ex?.ja ?? ex?.zh ?? ex?.fr ?? ex?.en ?? '';

/**
 * 기존 원고의 내용을 식별 기준으로 삼는 이행용 출처 맵.
 * 웹에서 문구를 고쳐도 base 기준 ID는 유지된다. 원고 파일 자체의 구조 개편은 별도 이행이 필요하다.
 * revision은 현재 내용 지문이며, 보관된 출판 판본 ID를 뜻하지 않는다.
 */
export function chapterSources(lang, base, chapter, hrefBase) {
  const revision = digest(chapter);
  const seenSections = new Map();
  const sections = (chapter.sections || []).map((section, si) => {
    const origin = base.sections?.[si] || section;
    const sectionKey = origin.id || digest(origin);
    const occurrence = seenSections.get(sectionKey) || 0;
    seenSections.set(sectionKey, occurrence + 1);
    const sectionId = `tb-${digest([lang, base.slug, sectionKey, occurrence])}`;
    const seenExamples = new Map();
    const examples = (section.examples || []).map((example, ei) => {
      const original = origin.examples?.[ei] || example;
      const key = original.id || digest(original);
      const count = seenExamples.get(key) || 0;
      seenExamples.set(key, count + 1);
      const blockId = `${sectionId}-${digest([key, count])}`;
      return {
        kind: 'textbook', bookId: `${lang}:${chapter.level}`, lang, chapterSlug: base.slug,
        sectionId, blockId, revision, quote: mainText(example), translation: example.ko || '',
        legacySection: si, legacyExample: ei,
        href: `${hrefBase}/grammar/${encodeURIComponent(base.slug)}?sourceRevision=${revision}#${blockId}`,
      };
    });
    return { sectionId, examples };
  });
  return { revision, sections };
}

export function createPublishedRegistry(lang, registry, overrides = new Map()) {
  const chapters = new Map();
  const sources = new Map();
  function resolve(base) {
    if (!base) return base;
    if (!chapters.has(base.slug)) chapters.set(base.slug, mergeChapter(base, overrides.get(base.slug)));
    return chapters.get(base.slug);
  }
  function resolveData(data) {
    if (!data) return data;
    return { ...data, chapter: resolve(data.chapter), prev: resolve(data.prev), next: resolve(data.next) };
  }
  return {
    ...registry,
    get ALL_CHAPTERS() { return (registry.ALL_CHAPTERS || []).map(resolve); },
    resolve,
    hasOverride(slug) { return overrides.has(slug); },
    resolveData,
    getChapter(slug) { return resolveData(registry.getChapter(slug)); },
    getGrammarChapters(level) { return registry.getGrammarChapters(level).map(resolve); },
    getChapterSources(chapter) {
      if (!sources.has(chapter.slug)) {
        const base = registry.getChapter(chapter.slug)?.chapter || chapter;
        sources.set(chapter.slug, chapterSources(lang, base, chapter, registry.base));
      }
      return sources.get(chapter.slug);
    },
  };
}

export async function loadPublishedRegistry(lang, registry) {
  return createPublishedRegistry(lang, registry, await readPublishedOverrides(lang));
}
