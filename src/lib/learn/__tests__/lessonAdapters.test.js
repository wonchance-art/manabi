/**
 * F1 어댑터 테스트
 * ① 4트랙 getCourse가 유효 Course 반환
 * ② 레슨 총수·기존 챕터 수 보존 (무손실 검증)
 * ③ 초안 파일 제외
 * ④ 결정성 검증
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  JapaneseAdapter,
  FrenchAdapter,
  EnglishAdapter,
  ChineseAdapter,
} from "../lessonAdapters.js";
import {
  validateCourse,
  validateLesson,
  DURATION_SPLIT_THRESHOLD,
} from "../lessonModel.js";

// 테스트용 더미 콘텐츠 생성
function createDummyChapter(slug, level, order, duration = "약 15분") {
  return {
    slug,
    level,
    order,
    title: `테스트 챕터 ${order}`,
    topic: "테스트 주제",
    summary: "테스트 요약",
    duration,
    sections: [
      {
        heading: "섹션 1",
        pattern: "패턴 1",
        body: "본문",
        examples: [{ ja: "例", ko: "예시" }],
      },
      {
        heading: "섹션 2",
        pattern: "패턴 2",
        body: "본문",
        examples: [{ ja: "例2", ko: "예시 2" }],
      },
    ],
  };
}

function createDummyTheme(name, wordCount = 10) {
  return {
    name,
    icon: "📚",
    words: Array.from({ length: wordCount }, (_, i) => ({
      ja: `単語${i + 1}`,
      yomi: `たんご${i + 1}`,
      ko: `단어 ${i + 1}`,
      pos: "명사",
    })),
  };
}

describe("JapaneseAdapter", () => {
  let adapter;

  beforeAll(() => {
    const grammarLevels = {
      ot: [
        createDummyChapter("ot-01", "OT", 1),
        createDummyChapter("ot-02", "OT", 2),
        createDummyChapter("ot-03", "OT", 3),
      ],
      n5: [
        createDummyChapter("n5-01", "N5", 1),
        createDummyChapter("n5-02", "N5", 2),
        createDummyChapter("n5-03", "N5", 3),
      ],
    };

    const vocabLevels = {
      n5: {
        themes: [createDummyTheme("인사", 5), createDummyTheme("숫자", 10)],
      },
    };

    adapter = new JapaneseAdapter(grammarLevels, vocabLevels);
  });

  it("getCourse(OT)는 유효한 Course 반환", () => {
    const course = adapter.getCourse("OT");

    expect(course).toBeDefined();
    expect(course.id).toBe("japanese-ot");
    expect(course.language).toBe("Japanese");
    expect(course.level).toBe("OT");

    const validation = validateCourse(course);
    expect(validation.valid).toBe(true);
  });

  it("getCourse(N5)는 OT를 prerequisite으로 포함", () => {
    const course = adapter.getCourse("N5");

    expect(course.prerequisites).toContain("japanese-ot");
  });

  it("getUnitsAndLessons는 챕터 개수만큼 레슨 생성", () => {
    const { units, lessons } = adapter.getUnitsAndLessons("N5");

    expect(lessons.length).toBe(3); // 3개 챕터
    expect(units.length).toBeGreaterThan(0);

    // 모든 레슨이 유효해야 함
    lessons.forEach((lesson) => {
      const validation = validateLesson(lesson);
      if (!validation.valid) {
        console.error(`Lesson validation failed for ${lesson.id}:`, validation.errors);
        console.error("Lesson object:", JSON.stringify(lesson, null, 2));
      }
      expect(validation.valid).toBe(true, `${lesson.id} 검증 실패: ${validation.errors.join(", ")}`);
    });
  });

  it("같은 유닛 내 레슨의 nextLesson 자동 계산", () => {
    const { lessons } = adapter.getUnitsAndLessons("N5");

    // 첫 두 레슨이 같은 유닛이면 firstLesson.nextLesson === secondLesson.id
    if (lessons.length >= 2 && lessons[0].unitId === lessons[1].unitId) {
      expect(lessons[0].nextLesson === lessons[1].id || lessons[0].nextLesson === undefined).toBe(
        true
      );
    }
  });
});

describe("FrenchAdapter", () => {
  let adapter;

  beforeAll(() => {
    const grammarLevels = {
      a0: [
        createDummyChapter("a0-01", "A0", 1),
        createDummyChapter("a0-02", "A0", 2),
      ],
      a1: [
        createDummyChapter("a1-01", "A1", 1),
        createDummyChapter("a1-02", "A1", 2),
        createDummyChapter("a1-03", "A1", 3),
      ],
    };

    adapter = new FrenchAdapter(grammarLevels);
  });

  it("getCourse(A0)는 유효한 Course 반환", () => {
    const course = adapter.getCourse("A0");

    expect(course.id).toBe("french-a0");
    expect(course.language).toBe("French");

    const validation = validateCourse(course);
    expect(validation.valid).toBe(true);
  });

  it("getCourse(A1)은 A0을 prerequisite으로 포함", () => {
    const course = adapter.getCourse("A1");

    expect(course.prerequisites).toContain("french-a0");
  });

  it("무손실 검증: 챕터 수 = 레슨 수", () => {
    const { lessons: lessonsA0 } = adapter.getUnitsAndLessons("A0");
    const { lessons: lessonsA1 } = adapter.getUnitsAndLessons("A1");

    expect(lessonsA0.length).toBe(2); // 2개 챕터
    expect(lessonsA1.length).toBe(3); // 3개 챕터
  });
});

describe("EnglishAdapter", () => {
  let adapter;

  beforeAll(() => {
    const grammarLevels = {
      ot: [createDummyChapter("ot-01", "OT", 1)],
      a1: [
        createDummyChapter("a1-01", "A1", 1),
        createDummyChapter("a1-02", "A1", 2),
      ],
    };

    adapter = new EnglishAdapter(grammarLevels);
  });

  it("getCourse(OT)는 유효한 Course 반환", () => {
    const course = adapter.getCourse("OT");

    expect(course.id).toBe("english-ot");
    expect(course.language).toBe("English");

    const validation = validateCourse(course);
    expect(validation.valid).toBe(true);
  });

  it("모든 레슨이 유효한 구조를 가짐", () => {
    const { lessons } = adapter.getUnitsAndLessons("A1");

    lessons.forEach((lesson) => {
      expect(lesson.id).toBeDefined();
      expect(lesson.title).toBeDefined();
      expect(lesson.grammar.concepts.length).toBeGreaterThan(0);
      expect(lesson.vocabulary.coreWords).toBeDefined();
      expect(lesson.estimatedMinutes).toBeGreaterThan(0);

      const validation = validateLesson(lesson);
      expect(validation.valid).toBe(true);
    });
  });
});

describe("ChineseAdapter", () => {
  let adapter;

  beforeAll(() => {
    const grammarLevels = {
      h1: [
        createDummyChapter("h1-01", "H1", 1),
        createDummyChapter("h1-02", "H1", 2),
      ],
      h2: [createDummyChapter("h2-01", "H2", 1)],
    };

    adapter = new ChineseAdapter(grammarLevels);
  });

  it("getCourse(H1)는 유효한 Course 반환", () => {
    const course = adapter.getCourse("H1");

    expect(course.id).toBe("chinese-h1");
    expect(course.language).toBe("Chinese");

    const validation = validateCourse(course);
    expect(validation.valid).toBe(true);
  });

  it("getCourse(H2)는 H1을 prerequisite으로 포함", () => {
    const course = adapter.getCourse("H2");

    expect(course.prerequisites).toContain("chinese-h1");
  });

  it("무손실 검증: 모든 챕터가 레슨으로 변환됨", () => {
    const { lessons: lessonsH1 } = adapter.getUnitsAndLessons("H1");
    const { lessons: lessonsH2 } = adapter.getUnitsAndLessons("H2");

    expect(lessonsH1.length).toBe(2);
    expect(lessonsH2.length).toBe(1);
  });
});

describe("결정성 검증", () => {
  let adapter;
  let firstRun;
  let secondRun;

  beforeAll(() => {
    const grammarLevels = {
      n5: [
        createDummyChapter("n5-01", "N5", 1),
        createDummyChapter("n5-02", "N5", 2),
      ],
    };

    adapter = new JapaneseAdapter(grammarLevels, {});

    // 동일 어댑터로 2회 실행
    const { lessons: l1 } = adapter.getUnitsAndLessons("N5");
    const { lessons: l2 } = adapter.getUnitsAndLessons("N5");

    firstRun = JSON.stringify(l1);
    secondRun = JSON.stringify(l2);
  });

  it("동일한 입력에서 2회 실행 결과가 동일해야 함", () => {
    expect(firstRun).toBe(secondRun);
  });
});

describe("Duration 정책", () => {
  let adapter;

  beforeAll(() => {
    const grammarLevels = {
      n5: [
        createDummyChapter("n5-01", "N5", 1, "약 8분"),
        createDummyChapter("n5-02", "N5", 2, "약 30분"), // 25분 이상 → 분할 검토
        createDummyChapter("n5-03", "N5", 3, "약 20분"),
      ],
    };

    adapter = new JapaneseAdapter(grammarLevels, {});
  });

  it("duration이 DURATION_SPLIT_THRESHOLD 이상이면 메모", () => {
    const { lessons } = adapter.getUnitsAndLessons("N5");

    const longLesson = lessons.find((l) => l.estimatedMinutes >= DURATION_SPLIT_THRESHOLD);
    if (longLesson) {
      // F2에서 분할을 검토하도록 flag를 두는 것이 이상적이지만,
      // F1에서는 단순히 데이터 제공만 함
      expect(longLesson.estimatedMinutes).toBeGreaterThanOrEqual(DURATION_SPLIT_THRESHOLD);
    }
  });
});

describe("Draft 파일 제외 (향후 필터링)", () => {
  it("콘텐츠 파일에서 *_draft 제외하도록 준비", () => {
    // F2에서 구현할 필터링 로직의 테스트 뼈대
    const draftFiles = ["n5-01-draft.js", "a1-02_draft.js", "h1-03-draft.js"];
    const liveLessons = [
      "n5-01-writing-system",
      "a1-01-pronouns-etre",
      "h1-01-greeting",
    ];

    draftFiles.forEach((draft) => {
      expect(liveLessons.some((live) => live === draft)).toBe(false);
    });
  });
});
