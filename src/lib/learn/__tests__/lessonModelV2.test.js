/**
 * F3 v2 섹션 검증 테스트
 * RFC "실전 샌드위치" v2 필드 검증 확인
 */

import { describe, it, expect } from "vitest";
import { validateSectionV2 } from "../lessonModel.js";

describe("validateSectionV2", () => {
  describe("authenticIntro 검증", () => {
    it("유효한 authenticIntro 통과", () => {
      const section = {
        type: "authenticIntro",
        audio: {
          url: "https://manabi-public.s3.amazonaws.com/audio/fr-cafe-01.mp3",
          sourceId: "tatoeba-fr-cafe-01",
          duration: "0:28",
          license: "CC-BY 2.0",
          attribution: "Tatoeba (CC BY 2.0) — Native French speakers",
        },
        captions: {
          original: "— Bonjour, qu'est-ce que vous prenez?\n— Je voudrais un café.",
          translation: "— 안녕하세요, 뭘 드릴까요?\n— 저는 커피를 원해요.",
        },
        presentationFraming: "못 알아들어도 정상이에요! 전체 대화를 몇 번 들어 보세요.",
      };

      const result = validateSectionV2(section);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("audio.url 누락 시 오류", () => {
      const section = {
        type: "authenticIntro",
        audio: {
          sourceId: "tatoeba-fr-cafe-01",
          license: "CC-BY 2.0",
          attribution: "Tatoeba",
        },
        captions: {
          original: "Test",
          translation: "테스트",
        },
        presentationFraming: "Test framing",
      };

      const result = validateSectionV2(section);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("audio.url"))).toBe(true);
    });

    it("captions.original 누락 시 오류", () => {
      const section = {
        type: "authenticIntro",
        audio: {
          url: "https://example.com/audio.mp3",
          sourceId: "tatoeba-fr-cafe-01",
          license: "CC-BY 2.0",
          attribution: "Tatoeba",
        },
        captions: {
          translation: "테스트",
        },
        presentationFraming: "Test",
      };

      const result = validateSectionV2(section);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("original"))).toBe(true);
    });
  });

  describe("vocabPreview 검증", () => {
    it("유효한 vocabPreview 통과", () => {
      const section = {
        type: "vocabPreview",
        vocabs: [
          {
            word: "voudrais",
            meanings: ["원하다 (조건법)", "~를 원해요"],
            exampleSentence: "Je voudrais un café.",
          },
          {
            word: "café",
            meanings: ["커피"],
            exampleSentence: "Un café, s'il vous plaît.",
          },
        ],
      };

      const result = validateSectionV2(section);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("vocabs 배열 비어있으면 오류", () => {
      const section = {
        type: "vocabPreview",
        vocabs: [],
      };

      const result = validateSectionV2(section);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("vocabs"))).toBe(true);
    });

    it("vocab 아이템이 word 누락 시 오류", () => {
      const section = {
        type: "vocabPreview",
        vocabs: [
          {
            meanings: ["뜻"],
          },
        ],
      };

      const result = validateSectionV2(section);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("word"))).toBe(true);
    });
  });

  describe("authenticReplay 검증", () => {
    it("유효한 authenticReplay 통과", () => {
      const section = {
        type: "authenticReplay",
        original: {
          audio: {
            url: "https://example.com/audio1.mp3",
            sourceId: "tatoeba-fr-cafe-01",
            license: "CC-BY 2.0",
            attribution: "Tatoeba",
          },
          captions: {
            original: "Original text",
            translation: "번역",
          },
        },
        variant: {
          audio: {
            url: "https://example.com/audio2.mp3",
            sourceId: "tatoeba-fr-cafe-02",
            license: "CC-BY 2.0",
            attribution: "Tatoeba",
          },
          captions: {
            original: "Variant text",
            translation: "변형 번역",
          },
          transitionNote: "같은 표현인데 다른 상황",
        },
        selfCheckOptions: [
          { label: "다 들었어요", value: "full", fsrsSignal: 1 },
          { label: "부분만 들었어요", value: "partial", fsrsSignal: 0.5 },
        ],
      };

      const result = validateSectionV2(section);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("selfCheckOptions 비어있으면 오류", () => {
      const section = {
        type: "authenticReplay",
        original: {
          audio: { url: "test", sourceId: "test", license: "CC-BY 2.0", attribution: "test" },
          captions: { original: "test", translation: "테스트" },
        },
        variant: {
          audio: { url: "test2", sourceId: "test2", license: "CC-BY 2.0", attribution: "test2" },
          captions: { original: "test2", translation: "테스트2" },
          transitionNote: "Transition",
        },
        selfCheckOptions: [],
      };

      const result = validateSectionV2(section);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("selfCheckOptions"))).toBe(true);
    });
  });

  describe("practiceAndRegistration 검증", () => {
    it("유효한 practiceAndRegistration 통과", () => {
      const section = {
        type: "practiceAndRegistration",
        writingPrompts: [
          "첫 번째 쓰기 연습",
          "두 번째 쓰기 연습",
        ],
        quizItems: [
          {
            type: "matching",
            question: "다음을 매칭하세요",
            pairs: [],
          },
        ],
        autoRegisterVocabs: true,
      };

      const result = validateSectionV2(section);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("writingPrompts 비어있으면 오류", () => {
      const section = {
        type: "practiceAndRegistration",
        writingPrompts: [],
        quizItems: [{ type: "matching" }],
        autoRegisterVocabs: true,
      };

      const result = validateSectionV2(section);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("writingPrompts"))).toBe(true);
    });

    it("autoRegisterVocabs boolean 아니면 오류", () => {
      const section = {
        type: "practiceAndRegistration",
        writingPrompts: ["Writing prompt"],
        quizItems: [{ type: "matching" }],
        autoRegisterVocabs: "yes",
      };

      const result = validateSectionV2(section);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("autoRegisterVocabs"))).toBe(true);
    });
  });
});
