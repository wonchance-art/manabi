/**
 * F1 어댑터 계층 — 기존 콘텐츠 파일을 레슨 모델로 읽기
 * 4개 트랙(일본어, 프랑스어, 영어, 중국어) 어댑터 + 공통 인터페이스
 */

import {
  generateCourseId,
  generateUnitId,
  generateLessonId,
  normalizeLanguage,
  validateCourse,
  validateLesson,
  DURATION_SPLIT_THRESHOLD,
} from "./lessonModel.js";

/**
 * 챕터 → 레슨 변환 (공통 로직)
 * @param {Object} chapter - grammar file의 한 챕터
 * @param {string} language - "Japanese" | "French" | "English" | "Chinese"
 * @param {string} level - "N5", "A1", "H1" 등
 * @param {number} unitNum - 유닛 번호 (chapter.order를 기반으로 계산)
 * @param {Array} [vocabThemes] - 어휘 테마 배열 (선택사항)
 * @returns {Lesson}
 */
function chapterToLesson(chapter, language, level, unitNum, lessonOrder, vocabThemes = []) {
  const langLower = language.toLowerCase();
  const courseId = generateCourseId(language, level);
  const unitId = generateUnitId(courseId, unitNum);
  const lessonId = generateLessonId(unitId, lessonOrder);

  // Duration 파싱 (예: "약 8분" → 8)
  const durationMatch = chapter.duration?.match(/\d+/);
  const estimatedMinutes = durationMatch ? parseInt(durationMatch[0], 10) : 15;

  // 섹션 수로 핵심 개념 추출
  const concepts = (chapter.sections || []).map((sec) => sec.heading || sec.pattern || "");

  // 어휘 테마에서 핵심 단어 추출 (단순화: 첫 번째 테마 사용)
  let coreWords = [];
  let themeRef = "";
  let newWordsCount = 0;

  if (vocabThemes && vocabThemes.length > 0) {
    // 챕터와 매칭되는 테마 찾기 (chapter.order 기반)
    const themeIdx = Math.min(
      Math.floor((chapter.order - 1) / 2),
      vocabThemes.length - 1
    );
    const matchedTheme = vocabThemes[themeIdx];

    if (matchedTheme && matchedTheme.words) {
      coreWords = (matchedTheme.words || []).slice(0, 15).map((word) => {
        return word.id || `${langLower}-${word.ja || word.fr || word.en || "unknown"}`.toLowerCase();
      });
      newWordsCount = matchedTheme.words.length;
      themeRef = matchedTheme.name || `vocab-${chapter.order}`;
    }
  }

  // 폴백: 테마가 없으면 더미 단어 생성 (테스트용)
  if (coreWords.length === 0) {
    coreWords = [`${langLower}-word-1`, `${langLower}-word-2`];
    newWordsCount = 2;
    themeRef = `${langLower}-${level.toLowerCase()}-vocab-${chapter.slug.split("-")[0]}`;
  }

  return {
    id: lessonId,
    unitId,
    order: lessonOrder,
    title: chapter.title,
    summary: chapter.summary || "",
    grammar: {
      concepts: concepts.filter((c) => c.length > 0),
      chapterRefs: [
        {
          chapterSlug: chapter.slug,
          sectionIndices: Array.from({ length: chapter.sections?.length || 0 }, (_, i) => i),
        },
      ],
      explanation: `원본 챕터: ${chapter.slug}`,
    },
    vocabulary: {
      coreWords,
      themeRef,
      newWordsCount,
    },
    exercises: [
      {
        type: "pattern-fill",
        description: "문형 연습",
        estimatedMinutes: 5,
      },
    ],
    estimatedMinutes,
    specialFields: {
      originalChapterSlug: chapter.slug,
      originalLevel: chapter.level,
      kanjiExempt: chapter.kanjiExempt || undefined, // 일본어 한자 예외
    },
  };
}

/**
 * 어휘 테마 → 레슨 어휘 정보 변환
 * @param {Object} theme - vocab file의 한 테마 객체
 * @param {string} language
 * @param {string} level
 * @returns {Object} - vocabulary 필드
 */
function themeToLessonVocab(theme, language, level) {
  const langLower = language.toLowerCase();

  return {
    coreWords: (theme.words || []).map((word) => {
      // 단어 ID 생성: 필드가 없으면 ja 필드로 생성
      return word.id || `${langLower}-${word.ja || word.fr || word.en || "unknown"}`.toLowerCase();
    }),
    themeRef: `${langLower}-${level.toLowerCase()}-${theme.name || "vocab"}`,
    newWordsCount: theme.words?.length || 0,
  };
}

/**
 * 일본어 어댑터
 * 트랙별 어댑터 중 가장 복잡 (레벨 OT~N1, 문법 + 어휘 분리)
 */
export class JapaneseAdapter {
  constructor(grammarLevels, vocabLevels) {
    // grammarLevels: { ot: chapters[], n5: chapters[], ... }
    // vocabLevels: { n5: { themes, ... }, n4: { themes, ... }, ... }
    this.grammarLevels = grammarLevels;
    this.vocabLevels = vocabLevels;
  }

  /**
   * @param {string} level - "OT", "N5", "N4", ...
   * @returns {Course}
   */
  getCourse(level) {
    const courseId = generateCourseId("Japanese", level);
    const chapters = this.grammarLevels[level.toLowerCase()] || [];
    const vocabThemes = this.vocabLevels[level.toLowerCase()]?.themes || [];

    const course = {
      id: courseId,
      language: "Japanese",
      level,
      title: `일본어 ${level} ${this._levelTitle(level)}`,
      description: `JLPT ${level} 레벨 문법과 어휘`,
      targetLearners: this._targetLearner(level),
      estimatedDurationWeeks: 4,
      prerequisites: level !== "OT" ? [`japanese-${this._prevLevel(level)}`] : [],
    };

    const validation = validateCourse(course);
    if (!validation.valid) {
      console.error(`JapaneseAdapter.getCourse(${level}) 검증 실패:`, validation.errors);
    }

    return course;
  }

  /**
   * 코스 내 모든 유닛/레슨 생성
   * @param {string} level
   * @returns {{units: Unit[], lessons: Lesson[]}}
   */
  getUnitsAndLessons(level) {
    const chapters = this.grammarLevels[level.toLowerCase()] || [];
    const vocabThemes = this.vocabLevels[level.toLowerCase()]?.themes || [];
    const courseId = generateCourseId("Japanese", level);

    const units = [];
    const lessons = [];

    // 챕터를 유닛으로 분할 (3개 챕터 = 1주)
    chapters.forEach((chapter, idx) => {
      const week = Math.floor(idx / 3) + 1;
      const unitId = generateUnitId(courseId, week);

      // 유닛 중복 방지
      if (!units.find((u) => u.id === unitId)) {
        units.push({
          id: unitId,
          courseId,
          week,
          title: `${week}주차: ${chapter.topic || "학습"}`,
          themeName: chapter.topic || "",
        });
      }

      // 챕터 → 레슨
      const lesson = chapterToLesson(chapter, "Japanese", level, week, idx % 3 + 1, vocabThemes);
      lessons.push(lesson);
    });

    return { units, lessons };
  }

  _levelTitle(level) {
    const titles = { OT: "오리엔테이션", N5: "기초", N4: "초급", N3: "중급", N2: "상급", N1: "최상급" };
    return titles[level] || "";
  }

  _targetLearner(level) {
    return level === "OT" ? "beginner" : level <= "N4" ? "beginner" : level <= "N2" ? "intermediate" : "advanced";
  }

  _prevLevel(level) {
    const order = ["ot", "n5", "n4", "n3", "n2", "n1"];
    const idx = order.indexOf(level.toLowerCase());
    return idx > 0 ? order[idx - 1] : "ot";
  }
}

/**
 * 프랑스어 어댑터
 */
export class FrenchAdapter {
  constructor(grammarLevels) {
    // grammarLevels: { a0: chapters[], a1: chapters[], ... }
    this.grammarLevels = grammarLevels;
  }

  /**
   * @param {string} level - "A0", "A1", "A2", "B1", "B2", "C1", "C2"
   * @returns {Course}
   */
  getCourse(level) {
    const courseId = generateCourseId("French", level);
    const chapters = this.grammarLevels[level.toLowerCase()] || [];

    const course = {
      id: courseId,
      language: "French",
      level,
      title: `프랑스어 ${level} ${this._levelTitle(level)}`,
      description: `CEFR ${level} 레벨 문법`,
      targetLearners: this._targetLearner(level),
      estimatedDurationWeeks: 4,
      prerequisites: level !== "A0" ? [`french-${this._prevLevel(level)}`] : [],
    };

    const validation = validateCourse(course);
    if (!validation.valid) {
      console.error(`FrenchAdapter.getCourse(${level}) 검증 실패:`, validation.errors);
    }

    return course;
  }

  getUnitsAndLessons(level) {
    const chapters = this.grammarLevels[level.toLowerCase()] || [];
    const courseId = generateCourseId("French", level);

    const units = [];
    const lessons = [];

    chapters.forEach((chapter, idx) => {
      const week = Math.floor(idx / 2) + 1;
      const unitId = generateUnitId(courseId, week);

      if (!units.find((u) => u.id === unitId)) {
        units.push({
          id: unitId,
          courseId,
          week,
          title: `${week}주차: ${chapter.topic || "학습"}`,
          themeName: chapter.topic || "",
        });
      }

      const lesson = chapterToLesson(chapter, "French", level, week, idx % 2 + 1, []);
      lessons.push(lesson);
    });

    return { units, lessons };
  }

  _levelTitle(level) {
    const lvNum = parseInt(level.charCodeAt(0)) - "A".charCodeAt(0);
    const titles = { 0: "시작", 1: "입문", 2: "초급", 3: "중급 상", 4: "중급 하", 5: "고급", 6: "최고급" };
    return titles[lvNum] || "";
  }

  _targetLearner(level) {
    return level <= "A1" ? "beginner" : level <= "B1" ? "intermediate" : "advanced";
  }

  _prevLevel(level) {
    const order = ["a0", "a1", "a2", "b1", "b2", "c1", "c2"];
    const idx = order.indexOf(level.toLowerCase());
    return idx > 0 ? order[idx - 1] : "a0";
  }
}

/**
 * 영어 어댑터 (프랑스어와 동일 구조)
 */
export class EnglishAdapter {
  constructor(grammarLevels) {
    this.grammarLevels = grammarLevels;
  }

  getCourse(level) {
    const courseId = generateCourseId("English", level);
    const chapters = this.grammarLevels[level.toLowerCase()] || [];

    const course = {
      id: courseId,
      language: "English",
      level,
      title: `영어 ${level} ${this._levelTitle(level)}`,
      description: `CEFR ${level} 레벨 문법`,
      targetLearners: this._targetLearner(level),
      estimatedDurationWeeks: 4,
      prerequisites: level !== "OT" ? [`english-${this._prevLevel(level)}`] : [],
    };

    const validation = validateCourse(course);
    if (!validation.valid) {
      console.error(`EnglishAdapter.getCourse(${level}) 검증 실패:`, validation.errors);
    }

    return course;
  }

  getUnitsAndLessons(level) {
    const chapters = this.grammarLevels[level.toLowerCase()] || [];
    const courseId = generateCourseId("English", level);

    const units = [];
    const lessons = [];

    chapters.forEach((chapter, idx) => {
      const week = Math.floor(idx / 2) + 1;
      const unitId = generateUnitId(courseId, week);

      if (!units.find((u) => u.id === unitId)) {
        units.push({
          id: unitId,
          courseId,
          week,
          title: `${week}주차: ${chapter.topic || "학습"}`,
          themeName: chapter.topic || "",
        });
      }

      const lesson = chapterToLesson(chapter, "English", level, week, idx % 2 + 1, []);
      lessons.push(lesson);
    });

    return { units, lessons };
  }

  _levelTitle(level) {
    if (level === "OT") return "오리엔테이션";
    const lvNum = parseInt(level.charCodeAt(0)) - "A".charCodeAt(0);
    const titles = { 0: "시작", 1: "입문", 2: "초급", 3: "중급 상", 4: "중급 하", 5: "고급", 6: "최고급" };
    return titles[lvNum] || "";
  }

  _targetLearner(level) {
    return level === "OT" ? "beginner" : level <= "A1" ? "beginner" : level <= "B1" ? "intermediate" : "advanced";
  }

  _prevLevel(level) {
    const order = ["ot", "a1", "a2", "b1", "b2", "c1", "c2"];
    const idx = order.indexOf(level.toLowerCase());
    return idx > 0 ? order[idx - 1] : "ot";
  }
}

/**
 * 중국어 어댑터 (HSK 레벨)
 */
export class ChineseAdapter {
  constructor(grammarLevels) {
    // grammarLevels: { h1: chapters[], h2: chapters[], ... }
    this.grammarLevels = grammarLevels;
  }

  getCourse(level) {
    const courseId = generateCourseId("Chinese", level);
    const chapters = this.grammarLevels[level.toLowerCase()] || [];

    const course = {
      id: courseId,
      language: "Chinese",
      level,
      title: `중국어 ${level} ${this._levelTitle(level)}`,
      description: `HSK ${level} 레벨 문법`,
      targetLearners: this._targetLearner(level),
      estimatedDurationWeeks: 4,
      prerequisites: level !== "H1" ? [`chinese-${this._prevLevel(level)}`] : [],
    };

    const validation = validateCourse(course);
    if (!validation.valid) {
      console.error(`ChineseAdapter.getCourse(${level}) 검증 실패:`, validation.errors);
    }

    return course;
  }

  getUnitsAndLessons(level) {
    const chapters = this.grammarLevels[level.toLowerCase()] || [];
    const courseId = generateCourseId("Chinese", level);

    const units = [];
    const lessons = [];

    chapters.forEach((chapter, idx) => {
      const week = Math.floor(idx / 2) + 1;
      const unitId = generateUnitId(courseId, week);

      if (!units.find((u) => u.id === unitId)) {
        units.push({
          id: unitId,
          courseId,
          week,
          title: `${week}주차: ${chapter.topic || "학습"}`,
          themeName: chapter.topic || "",
        });
      }

      const lesson = chapterToLesson(chapter, "Chinese", level, week, idx % 2 + 1, []);
      lessons.push(lesson);
    });

    return { units, lessons };
  }

  _levelTitle(level) {
    const lvNum = parseInt(level.charAt(1));
    const titles = { 1: "입문", 2: "초급", 3: "초급상", 4: "중급", 5: "중급상", 6: "고급" };
    return titles[lvNum] || "";
  }

  _targetLearner(level) {
    const lvNum = parseInt(level.charAt(1));
    return lvNum <= 2 ? "beginner" : lvNum <= 4 ? "intermediate" : "advanced";
  }

  _prevLevel(level) {
    const lvNum = parseInt(level.charAt(1));
    return lvNum > 1 ? `h${lvNum - 1}` : "h1";
  }
}

export default {
  JapaneseAdapter,
  FrenchAdapter,
  EnglishAdapter,
  ChineseAdapter,
};
