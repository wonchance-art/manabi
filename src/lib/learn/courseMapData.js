import {
  JA_LEVEL_META,
  getGrammarChapters as getJapaneseGrammar,
  getVocab as getJapaneseVocab,
} from '../../content/japanese';
import {
  FR_LEVEL_META,
  getGrammarChapters as getFrenchGrammar,
  getVocab as getFrenchVocab,
} from '../../content/french';
import {
  EN_LEVEL_META,
  getGrammarChapters as getEnglishGrammar,
  getVocab as getEnglishVocab,
} from '../../content/english';
import {
  ZH_LEVEL_META,
  getGrammarChapters as getChineseGrammar,
  getVocab as getChineseVocab,
} from '../../content/chinese';
import {
  ChineseAdapter,
  EnglishAdapter,
  FrenchAdapter,
  JapaneseAdapter,
} from './lessonAdapters';
import { generateLessonId, generateUnitId } from './lessonModel';

const TRACK_DEFINITIONS = {
  japanese: {
    label: '일본어',
    language: 'Japanese',
    defaultLevel: 'N5',
    levelMeta: JA_LEVEL_META,
    Adapter: JapaneseAdapter,
    getGrammar: getJapaneseGrammar,
    getVocab: getJapaneseVocab,
  },
  french: {
    label: '프랑스어',
    language: 'French',
    defaultLevel: 'A1',
    levelMeta: FR_LEVEL_META,
    Adapter: FrenchAdapter,
    getGrammar: getFrenchGrammar,
    getVocab: getFrenchVocab,
  },
  english: {
    label: '영어',
    language: 'English',
    defaultLevel: 'A1',
    levelMeta: EN_LEVEL_META,
    Adapter: EnglishAdapter,
    getGrammar: getEnglishGrammar,
    getVocab: getEnglishVocab,
  },
  chinese: {
    label: '중국어',
    language: 'Chinese',
    defaultLevel: 'H1',
    levelMeta: ZH_LEVEL_META,
    Adapter: ChineseAdapter,
    getGrammar: getChineseGrammar,
    getVocab: getChineseVocab,
  },
};

export const COURSE_TRACKS = Object.freeze(
  Object.entries(TRACK_DEFINITIONS).map(([id, definition]) => Object.freeze({
    id,
    label: definition.label,
    defaultLevel: definition.defaultLevel,
  })),
);

const TRACK_BY_LANGUAGE = Object.freeze(
  Object.fromEntries(
    Object.entries(TRACK_DEFINITIONS).map(([track, definition]) => [
      definition.language,
      track,
    ]),
  ),
);

function normalizeTrack(value) {
  const track = String(value || '').toLowerCase();
  return TRACK_DEFINITIONS[track] ? track : 'english';
}

function normalizeLevel(definition, value) {
  const level = String(value || '').toUpperCase();
  const levels = definition.levelMeta.map((meta) => meta.key);
  return levels.includes(level) ? level : definition.defaultLevel;
}

function buildLevelMap(levelMeta, getter) {
  return Object.fromEntries(
    levelMeta.map(({ key }) => [key.toLowerCase(), getter(key)]),
  );
}

function wordText(word) {
  return word.id || word.ja || word.fr || word.en || word.zh || '';
}

function wordKey(word, language, index) {
  const text = wordText(word);
  return text ? `${language.toLowerCase()}-${text}`.toLowerCase() : `${language.toLowerCase()}-word-${index + 1}`;
}

function vocabularyForThemes(themes, language) {
  const words = themes.flatMap((theme) => theme.words || []);
  return {
    coreWords: words.map((word, index) => wordKey(word, language, index)),
    themeRef: themes.map((theme) => theme.name).join(' · '),
    newWordsCount: words.length,
  };
}

function attachVocabularyThemes(lessons, vocab, language) {
  const themes = vocab?.themes || [];
  if (lessons.length === 0 || themes.length === 0) return lessons;

  const buckets = Array.from({ length: lessons.length }, () => []);
  themes.forEach((theme, index) => {
    buckets[index % lessons.length].push(theme);
  });

  return lessons.map((lesson, index) => {
    const lessonThemes = buckets[index];
    if (lessonThemes.length === 0) return lesson;

    return {
      ...lesson,
      vocabulary: vocabularyForThemes(lessonThemes, language),
      specialFields: {
        ...lesson.specialFields,
        contentType: 'grammar',
        vocabThemeNames: lessonThemes.map((theme) => theme.name),
      },
    };
  });
}

function buildVocabularyOnlyMap(course, vocab, track, definition, level) {
  const themes = vocab?.themes || [];
  const units = [];
  const lessons = [];

  themes.forEach((theme, index) => {
    const week = Math.floor(index / 3) + 1;
    const unitId = generateUnitId(course.id, week);

    if (!units.some((unit) => unit.id === unitId)) {
      units.push({
        id: unitId,
        courseId: course.id,
        week,
        title: `${week}주차: 생활 어휘`,
        themeName: '생활 어휘',
      });
    }

    const order = (index % 3) + 1;
    lessons.push({
      id: generateLessonId(unitId, order),
      unitId,
      order,
      title: theme.name,
      summary: `${theme.words?.length || 0}개 표현을 상황별로 익혀요.`,
      grammar: {
        concepts: [`${definition.label} 생활 어휘`],
        chapterRefs: [],
        explanation: '기존 레벨별 어휘 학습 페이지로 연결됩니다.',
      },
      vocabulary: vocabularyForThemes([theme], definition.language),
      exercises: [],
      estimatedMinutes: Math.min(20, Math.max(15, (theme.words?.length || 0) * 2)),
      specialFields: {
        contentType: 'vocabulary',
        originalLevel: level,
        progressSlug: `vocab:${track}:${level.toLowerCase()}:${index + 1}`,
        contentHref: `/${track}/vocab/${level.toLowerCase()}#theme-${index + 1}`,
        vocabThemeNames: [theme.name],
        vocabProgressStorageKey: `as_vcheck_${definition.language}_${level}`,
        vocabProgressWords: (theme.words || []).map(wordText).filter(Boolean),
      },
    });
  });

  return { units, lessons };
}

export function buildCourseMap(trackValue, levelValue) {
  const selectedTrack = normalizeTrack(trackValue);
  const definition = TRACK_DEFINITIONS[selectedTrack];
  const selectedLevel = normalizeLevel(definition, levelValue);
  const grammarLevels = buildLevelMap(definition.levelMeta, definition.getGrammar);
  const vocabLevels = buildLevelMap(definition.levelMeta, definition.getVocab);
  const adapter = selectedTrack === 'japanese'
    ? new definition.Adapter(grammarLevels, vocabLevels)
    : new definition.Adapter(grammarLevels);
  const course = adapter.getCourse(selectedLevel);
  const grammarMap = adapter.getUnitsAndLessons(selectedLevel);
  const vocab = definition.getVocab(selectedLevel);
  const map = grammarMap.lessons.length > 0
    ? {
      units: grammarMap.units,
      lessons: attachVocabularyThemes(grammarMap.lessons, vocab, definition.language),
    }
    : buildVocabularyOnlyMap(course, vocab, selectedTrack, definition, selectedLevel);

  return {
    course,
    ...map,
    tracks: COURSE_TRACKS,
    selectedTrack,
    trackLabel: definition.label,
    levels: definition.levelMeta.map((meta) => meta.key),
    levelLabels: Object.fromEntries(
      definition.levelMeta.map((meta) => [meta.key, meta.short || meta.key]),
    ),
    selectedLevel,
  };
}

function lessonProgressSlug(lesson) {
  return lesson?.specialFields?.originalChapterSlug
    || lesson?.specialFields?.progressSlug
    || '';
}

function lessonContentHref(lesson, track) {
  if (lesson?.specialFields?.contentHref) return lesson.specialFields.contentHref;

  const slug = lesson?.specialFields?.originalChapterSlug;
  return slug ? `/${track}/grammar/${encodeURIComponent(slug)}` : '/lessons';
}

/**
 * 문법 상세 페이지를 F5 코스 지도의 정확한 F1 레슨과 연결한다.
 * 반환 객체는 서버→클라이언트 props로 넘길 수 있는 직렬화 가능한 값만 포함한다.
 */
export function getCourseLessonContext(language, level, slug) {
  const track = TRACK_BY_LANGUAGE[language];
  if (!track || !slug) return null;

  const map = buildCourseMap(track, level);
  const lessonIndex = map.lessons.findIndex(
    (lesson) => lessonProgressSlug(lesson) === slug,
  );
  if (lessonIndex < 0) return null;

  const lesson = map.lessons[lessonIndex];
  const nextLesson = map.lessons[lessonIndex + 1];

  return {
    lessonRef: {
      id: lesson.id,
      lang: map.course.language,
      slug: lessonProgressSlug(lesson),
      source: 'lesson',
    },
    nextLesson: nextLesson ? {
      id: nextLesson.id,
      href: lessonContentHref(nextLesson, track),
    } : null,
  };
}

export default buildCourseMap;
