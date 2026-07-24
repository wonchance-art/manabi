/**
 * F1 RC — 코스·유닛·레슨·복습 도메인 모델
 * 기존 chapters + themes를 통합하는 공통 스키마 정의
 */

/**
 * 코스 = 트랙(언어) × 레벨
 * @typedef {Object} Course
 * @property {string} id - "japanese-n5", "french-a1" 형식
 * @property {"Japanese" | "French" | "English" | "Chinese"} language
 * @property {string} level - "N5", "A1", "H1" 등
 * @property {string} title - "일본어 N5 기초"
 * @property {string} description
 * @property {"beginner" | "intermediate" | "advanced"} targetLearners
 * @property {number} estimatedDurationWeeks - 4 (권고)
 * @property {string[]} [prerequisites] - ["japanese-ot"] 등
 */

/**
 * 유닛 = 주차/테마 단위
 * @typedef {Object} Unit
 * @property {string} id - "japanese-n5-u01" 형식
 * @property {string} courseId
 * @property {number} week - 1~4
 * @property {string} title
 * @property {string} themeName
 */

/**
 * 레슨 = 15~20분 콘텐츠 묶음
 * @typedef {Object} Lesson
 * @property {string} id - "japanese-n5-u01-l01"
 * @property {string} unitId
 * @property {number} order
 * @property {string} title
 * @property {string} summary
 * @property {Object} grammar
 * @property {string[]} grammar.concepts
 * @property {Array<{chapterSlug: string, sectionIndices: number[]}>} grammar.chapterRefs
 * @property {string} [grammar.explanation]
 * @property {Object} vocabulary
 * @property {string[]} vocabulary.coreWords
 * @property {string} vocabulary.themeRef
 * @property {number} vocabulary.newWordsCount
 * @property {Array<{type: string, description: string, estimatedMinutes: number}>} exercises
 * @property {number} estimatedMinutes
 * @property {number} [difficultyRating] - 1~5
 * @property {string[]} [prerequisites]
 * @property {string} [nextLesson]
 * @property {Object} [specialFields] - 트랙별 확장 필드
 */

/**
 * 복습 기록 (FSRS)
 * @typedef {Object} Review
 * @property {string} id
 * @property {string} lessonId
 * @property {"vocabulary" | "grammar" | "pattern"} type
 * @property {number} interval
 * @property {number} easeFactor
 * @property {Date} nextReviewAt
 * @property {Date} [lastReviewedAt]
 * @property {number} [quality]
 * @property {number} [repetitions]
 */

/**
 * 코스 검증 함수
 * @param {Course} course
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateCourse(course) {
  const errors = [];

  if (!course.id || typeof course.id !== "string") {
    errors.push("Course.id는 필수 문자열");
  }

  if (!["Japanese", "French", "English", "Chinese"].includes(course.language)) {
    errors.push(`Course.language는 유효한 언어여야 함: ${course.language}`);
  }

  if (!course.level || typeof course.level !== "string") {
    errors.push("Course.level은 필수");
  }

  if (!course.title || typeof course.title !== "string") {
    errors.push("Course.title은 필수");
  }

  if (
    typeof course.estimatedDurationWeeks !== "number" ||
    course.estimatedDurationWeeks < 1
  ) {
    errors.push("Course.estimatedDurationWeeks는 1 이상의 숫자");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 유닛 검증 함수
 * @param {Unit} unit
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateUnit(unit) {
  const errors = [];

  if (!unit.id || typeof unit.id !== "string") {
    errors.push("Unit.id는 필수 문자열");
  }

  if (!unit.courseId || typeof unit.courseId !== "string") {
    errors.push("Unit.courseId는 필수");
  }

  if (typeof unit.week !== "number" || unit.week < 1 || unit.week > 52) {
    errors.push("Unit.week는 1~52 범위의 숫자");
  }

  if (!unit.title || typeof unit.title !== "string") {
    errors.push("Unit.title은 필수");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 레슨 검증 함수
 * @param {Lesson} lesson
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateLesson(lesson) {
  const errors = [];

  if (!lesson.id || typeof lesson.id !== "string") {
    errors.push("Lesson.id는 필수 문자열");
  }

  if (!lesson.unitId || typeof lesson.unitId !== "string") {
    errors.push("Lesson.unitId는 필수");
  }

  if (typeof lesson.order !== "number" || lesson.order < 1) {
    errors.push("Lesson.order는 1 이상의 정수");
  }

  if (!lesson.title || typeof lesson.title !== "string") {
    errors.push("Lesson.title은 필수");
  }

  if (!lesson.summary || typeof lesson.summary !== "string") {
    errors.push("Lesson.summary는 필수");
  }

  // Grammar 검증
  if (!lesson.grammar || typeof lesson.grammar !== "object") {
    errors.push("Lesson.grammar는 필수 객체");
  } else {
    if (
      !Array.isArray(lesson.grammar.concepts) ||
      lesson.grammar.concepts.length === 0
    ) {
      errors.push("Lesson.grammar.concepts는 1개 이상의 배열");
    }

    if (!Array.isArray(lesson.grammar.chapterRefs)) {
      errors.push("Lesson.grammar.chapterRefs는 배열");
    }
  }

  // Vocabulary 검증
  if (!lesson.vocabulary || typeof lesson.vocabulary !== "object") {
    errors.push("Lesson.vocabulary는 필수 객체");
  } else {
    if (
      !Array.isArray(lesson.vocabulary.coreWords) ||
      lesson.vocabulary.coreWords.length === 0
    ) {
      errors.push("Lesson.vocabulary.coreWords는 1개 이상의 배열");
    }

    if (typeof lesson.vocabulary.newWordsCount !== "number") {
      errors.push("Lesson.vocabulary.newWordsCount는 숫자");
    }
  }

  // Duration 검증
  if (typeof lesson.estimatedMinutes !== "number" || lesson.estimatedMinutes < 1) {
    errors.push("Lesson.estimatedMinutes는 1 이상의 숫자");
  }

  if (
    lesson.difficultyRating !== undefined &&
    (typeof lesson.difficultyRating !== "number" ||
      lesson.difficultyRating < 1 ||
      lesson.difficultyRating > 5)
  ) {
    errors.push("Lesson.difficultyRating는 1~5 범위");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 복습 검증 함수
 * @param {Review} review
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateReview(review) {
  const errors = [];

  if (!review.id || typeof review.id !== "string") {
    errors.push("Review.id는 필수 문자열");
  }

  if (!review.lessonId || typeof review.lessonId !== "string") {
    errors.push("Review.lessonId는 필수");
  }

  if (!["vocabulary", "grammar", "pattern"].includes(review.type)) {
    errors.push("Review.type은 vocabulary | grammar | pattern 중 하나");
  }

  if (typeof review.interval !== "number" || review.interval < 0) {
    errors.push("Review.interval는 0 이상의 숫자");
  }

  if (
    typeof review.easeFactor !== "number" ||
    review.easeFactor < 1.3 ||
    review.easeFactor > 2.5
  ) {
    errors.push("Review.easeFactor는 1.3~2.5 범위");
  }

  if (!(review.nextReviewAt instanceof Date)) {
    errors.push("Review.nextReviewAt는 Date 객체");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 트랙 언어명을 정규화
 * @param {string} langKey - "japanese", "french", "english", "chinese"
 * @returns {string} - "Japanese" | "French" | "English" | "Chinese"
 */
export function normalizeLanguage(langKey) {
  const mapping = {
    japanese: "Japanese",
    french: "French",
    english: "English",
    chinese: "Chinese",
  };
  return mapping[langKey.toLowerCase()] || langKey;
}

/**
 * 코스 ID 생성 헬퍼
 * @param {string} language - "Japanese" | "French" | "English" | "Chinese"
 * @param {string} level - "N5", "A1", "H1" 등
 * @returns {string} - "japanese-n5" 형식
 */
export function generateCourseId(language, level) {
  const langLower = language.toLowerCase();
  return `${langLower}-${level.toLowerCase()}`;
}

/**
 * 유닛 ID 생성 헬퍼
 * @param {string} courseId
 * @param {number} week
 * @returns {string} - "japanese-n5-u01" 형식
 */
export function generateUnitId(courseId, week) {
  const weekStr = String(week).padStart(2, "0");
  return `${courseId}-u${weekStr}`;
}

/**
 * 레슨 ID 생성 헬퍼
 * @param {string} unitId
 * @param {number} order
 * @returns {string} - "japanese-n5-u01-l01" 형식
 */
export function generateLessonId(unitId, order) {
  const orderStr = String(order).padStart(2, "0");
  return `${unitId}-l${orderStr}`;
}

/**
 * 복습 ID 생성 헬퍼
 * @param {string} type - "vocabulary" | "grammar" | "pattern"
 * @param {string} contentId - 단어/문법 고유 ID
 * @returns {string} - "vocab-ja-3094" 형식
 */
export function generateReviewId(type, contentId) {
  const typePrefix = type === "vocabulary" ? "vocab" : type === "grammar" ? "gram" : "ptrn";
  return `${typePrefix}-${contentId}`;
}

/**
 * RFC v2 섹션 검증 함수
 * v2 필드들(authenticIntro, vocabPreview, authenticReplay, practiceAndRegistration)의 유효성 확인
 * @param {Object} section - 섹션 객체
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateSectionV2(section) {
  const errors = [];

  if (!section || typeof section !== "object") {
    errors.push("Section은 필수 객체");
    return { valid: false, errors };
  }

  const sectionType = section.type;

  // authenticIntro 검증
  if (sectionType === "authenticIntro") {
    if (!section.audio || typeof section.audio !== "object") {
      errors.push("authenticIntro.audio는 필수 객체");
    } else {
      if (!section.audio.url || typeof section.audio.url !== "string") {
        errors.push("authenticIntro.audio.url은 필수 문자열");
      }
      if (!section.audio.sourceId || typeof section.audio.sourceId !== "string") {
        errors.push("authenticIntro.audio.sourceId는 필수 (예: tatoeba-fr-0234821)");
      }
      if (!section.audio.license || typeof section.audio.license !== "string") {
        errors.push("authenticIntro.audio.license는 필수 (예: CC-BY 2.0)");
      }
      if (!section.audio.attribution || typeof section.audio.attribution !== "string") {
        errors.push("authenticIntro.audio.attribution은 필수 (저자 표기)");
      }
    }

    if (!section.captions || typeof section.captions !== "object") {
      errors.push("authenticIntro.captions는 필수 객체");
    } else {
      if (!section.captions.original || typeof section.captions.original !== "string") {
        errors.push("authenticIntro.captions.original은 필수 원문");
      }
      if (!section.captions.translation || typeof section.captions.translation !== "string") {
        errors.push("authenticIntro.captions.translation은 필수 번역");
      }
    }

    if (!section.presentationFraming || typeof section.presentationFraming !== "string") {
      errors.push("authenticIntro.presentationFraming은 필수 (학습자 프레임)");
    }
  }

  // vocabPreview 검증
  if (sectionType === "vocabPreview") {
    if (!Array.isArray(section.vocabs) || section.vocabs.length === 0) {
      errors.push("vocabPreview.vocabs는 1개 이상의 배열");
    } else {
      for (let i = 0; i < section.vocabs.length; i++) {
        const vocab = section.vocabs[i];
        if (!vocab.word || typeof vocab.word !== "string") {
          errors.push(`vocabPreview.vocabs[${i}].word는 필수`);
        }
        if (!Array.isArray(vocab.meanings) || vocab.meanings.length === 0) {
          errors.push(`vocabPreview.vocabs[${i}].meanings는 1개 이상의 배열`);
        }
      }
    }
  }

  // authenticReplay 검증
  if (sectionType === "authenticReplay") {
    if (!section.original || typeof section.original !== "object") {
      errors.push("authenticReplay.original은 필수 객체");
    } else {
      if (!section.original.audio || typeof section.original.audio !== "object") {
        errors.push("authenticReplay.original.audio는 필수");
      }
      if (!section.original.captions || typeof section.original.captions !== "object") {
        errors.push("authenticReplay.original.captions는 필수");
      }
    }

    if (!section.variant || typeof section.variant !== "object") {
      errors.push("authenticReplay.variant은 필수 객체");
    } else {
      if (!section.variant.audio || typeof section.variant.audio !== "object") {
        errors.push("authenticReplay.variant.audio는 필수");
      }
      if (!section.variant.captions || typeof section.variant.captions !== "object") {
        errors.push("authenticReplay.variant.captions는 필수");
      }
      if (!section.variant.transitionNote || typeof section.variant.transitionNote !== "string") {
        errors.push("authenticReplay.variant.transitionNote는 필수 (전환 설명)");
      }
    }

    if (!Array.isArray(section.selfCheckOptions) || section.selfCheckOptions.length === 0) {
      errors.push("authenticReplay.selfCheckOptions는 1개 이상의 배열");
    }
  }

  // practiceAndRegistration 검증
  if (sectionType === "practiceAndRegistration") {
    if (!Array.isArray(section.writingPrompts) || section.writingPrompts.length === 0) {
      errors.push("practiceAndRegistration.writingPrompts는 1개 이상의 배열");
    }

    if (!Array.isArray(section.quizItems) || section.quizItems.length === 0) {
      errors.push("practiceAndRegistration.quizItems는 1개 이상의 배열");
    }

    if (typeof section.autoRegisterVocabs !== "boolean") {
      errors.push("practiceAndRegistration.autoRegisterVocabs는 boolean");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export const DURATION_MIN_MINUTES = 15;
export const DURATION_MAX_MINUTES = 20;
export const DURATION_SPLIT_THRESHOLD = 25; // 25분 이상이면 분할 검토

export default {
  validateCourse,
  validateUnit,
  validateLesson,
  validateReview,
  validateSectionV2,
  normalizeLanguage,
  generateCourseId,
  generateUnitId,
  generateLessonId,
  generateReviewId,
  DURATION_MIN_MINUTES,
  DURATION_MAX_MINUTES,
  DURATION_SPLIT_THRESHOLD,
};
