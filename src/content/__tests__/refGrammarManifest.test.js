import { describe, expect, it } from 'vitest';
import { REF_LANGS } from '../refLangs.js';
import manifest from '../refGrammarManifest.js';
import {
  getGrammarManifest,
  getGrammarStaticParams,
  loadChapter,
  loadGrammarLevel,
} from '../refGrammarLoaders.js';
import { GRAMMAR_CHAPTER_COMPARATOR } from '../refRegistry.js';
import { getCourseLessonContext } from '../../lib/learn/courseMapData.js';

const LANGUAGES = ['English', 'French', 'Japanese', 'Chinese'];

function bunkeiChapterSlugs(ref, levelKey) {
  const bunkei = ref.getBunkei?.(levelKey);
  return bunkei
    ? bunkei.themes.flatMap(theme => theme.items).map(item => item.ch).filter(Boolean)
    : [];
}

describe('generated ref grammar manifest', () => {
  it('eager registry의 level/slug/order/경량 facade/course context와 exact 일치한다', () => {
    expect(manifest.version).toBe(1);
    expect(Object.keys(manifest.languages)).toEqual(LANGUAGES);

    for (const language of LANGUAGES) {
      const eager = REF_LANGS[language];
      const generated = getGrammarManifest(language);
      expect(generated.levelMeta).toEqual(eager.LEVEL_META);
      expect(generated.introLevel).toBe(eager.INTRO_LEVEL);
      expect(getGrammarStaticParams(language)).toEqual(
        eager.ALL_CHAPTERS.map(chapter => ({ slug: chapter.slug })),
      );

      for (const level of generated.levels) {
        const eagerChapters = eager.getGrammarChapters(level.key);
        expect(level.chapters.map(chapter => [
          chapter.slug,
          chapter.level,
          chapter.order,
        ])).toEqual(eagerChapters.map(chapter => [
          chapter.slug,
          chapter.level,
          Number.isFinite(chapter.order) ? chapter.order : null,
        ]));
        expect(level.vocabCount).toBe(eager.countVocab(level.key));
        expect(level.bunkeiAvailable).toBe(Boolean(eager.getBunkei?.(level.key)));
        expect(level.bunkeiChapterSlugs).toEqual(
          bunkeiChapterSlugs(eager, level.key),
        );

        for (const chapter of level.chapters) {
          expect(chapter.courseLesson).toEqual(
            getCourseLessonContext(language, chapter.level, chapter.slug),
          );
          expect(Object.keys(chapter).sort()).toEqual([
            'courseLesson',
            'duration',
            'level',
            'order',
            'slug',
            'summary',
            'title',
            'topic',
          ]);
        }
      }
    }
  });

  it('네 언어 모든 level의 loaded view가 eager full Chapter[]와 byte-for-byte 동등하다', async () => {
    for (const language of LANGUAGES) {
      const eager = REF_LANGS[language];
      for (const { key } of eager.LEVEL_META) {
        const loaded = await loadGrammarLevel(language, key);
        expect(loaded.SORT_COMPARATOR).toBe(GRAMMAR_CHAPTER_COMPARATOR);
        expect(loaded.getGrammarChapters(key)).toEqual(
          eager.getGrammarChapters(key),
        );
        expect(loaded.countVocab(key)).toBe(eager.countVocab(key));
        expect(
          loaded.getBunkei?.(key)?.themes.flatMap(theme => theme.items)
            .map(item => item.ch).filter(Boolean) || [],
        ).toEqual(bunkeiChapterSlugs(eager, key));
      }
    }
  });

  it('loadChapter의 full chapter/prev/next와 course CTA가 eager 결과와 동일하다', async () => {
    for (const language of LANGUAGES) {
      const eager = REF_LANGS[language];
      for (const chapter of eager.ALL_CHAPTERS) {
        const loaded = await loadChapter(language, chapter.slug);
        expect(loaded.data).toEqual(eager.getChapter(chapter.slug));
        expect(loaded.courseLesson).toEqual(
          getCourseLessonContext(language, chapter.level, chapter.slug),
        );
      }
    }
  });
});
