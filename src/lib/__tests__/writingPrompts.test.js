import { describe, it, expect } from 'vitest';
import {
  WRITING_LEVELS, levelBand, topicsFor,
  buildFeedbackPrompt, validateFeedback, FEEDBACK_SCHEMA,
} from '../writingPrompts';

describe('levelBand', () => {
  it('언어별 레벨을 밴드로 매핑한다', () => {
    expect(levelBand('Japanese', 'N5')).toBe('beginner');
    expect(levelBand('Japanese', 'N3')).toBe('intermediate');
    expect(levelBand('Japanese', 'N1')).toBe('advanced');
    expect(levelBand('English', 'A1')).toBe('beginner');
    expect(levelBand('English', 'C2')).toBe('advanced');
    expect(levelBand('Chinese', 'H4')).toBe('intermediate');
  });

  it('모르는 레벨은 beginner로 폴백', () => {
    expect(levelBand('Japanese', 'X9')).toBe('beginner');
  });
});

describe('topicsFor', () => {
  it('4개 언어 × 전 레벨에서 주제가 나온다', () => {
    for (const [lang, levels] of Object.entries(WRITING_LEVELS)) {
      for (const lv of levels) {
        const topics = topicsFor(lang, lv);
        expect(topics.length).toBeGreaterThanOrEqual(5);
        topics.forEach(t => expect(typeof t).toBe('string'));
      }
    }
  });
});

describe('buildFeedbackPrompt', () => {
  it('4개 언어 모두 rubric 프롬프트를 만든다', () => {
    for (const lang of Object.keys(WRITING_LEVELS)) {
      const p = buildFeedbackPrompt({
        language: lang, level: WRITING_LEVELS[lang][0],
        text: 'test', promptType: 'free', prompt: '',
      });
      expect(p).toContain('한국인 학습자');
      expect(p).toContain('JSON');
    }
  });

  it('챕터 패턴이 프롬프트에 포함된다', () => {
    const p = buildFeedbackPrompt({
      language: 'Japanese', level: 'N4', text: '音楽を聞きながら勉強します。',
      promptType: 'chapter', prompt: '',
      chapterPatterns: [{ pattern: 'ます형 어간 + ながら', patternKo: '~하면서' }],
    });
    expect(p).toContain('ながら');
    expect(p).toContain('~하면서');
  });

  it('지원하지 않는 언어는 null', () => {
    expect(buildFeedbackPrompt({ language: 'Korean', level: 'A1', text: 'x' })).toBeNull();
  });

  it('sentenceMode면 targetScore 지시와 대상 문법을 포함한다', () => {
    const p = buildFeedbackPrompt({
      language: 'Japanese', level: 'N4', text: '音楽を聞きながら歩く。',
      sentenceMode: true, targetPattern: { pattern: 'ながら', patternKo: '~하면서' },
    });
    expect(p).toContain('targetScore');
    expect(p).toContain('ながら');
    expect(p).toContain('~하면서');
    expect(p).toContain('한 문장');
  });
});

describe('validateFeedback — 방어 검증', () => {
  const GOOD = {
    score: 4, summary: '좋아요', levelFit: 'fit',
    sentences: [{
      original: '私は学生です。', corrected: '私は学生です。',
      errors: [],
    }, {
      original: '本が読みたいです。', corrected: '本が読みたいです。',
      errors: [{ part: 'を', fix: 'が', why: '희망 표현은 が', tag: '조사 が' }],
    }],
    naturalness: ['제안1'],
  };

  it('정상 응답을 그대로 통과시킨다', () => {
    const v = validateFeedback(GOOD);
    expect(v.score).toBe(4);
    expect(v.sentences).toHaveLength(2);
    expect(v.sentences[1].errors[0].tag).toBe('조사 が');
  });

  it('score 범위를 1~5로 클램프한다', () => {
    expect(validateFeedback({ ...GOOD, score: 99 }).score).toBe(5);
    expect(validateFeedback({ ...GOOD, score: -3 }).score).toBe(1);
    expect(validateFeedback({ ...GOOD, score: 'abc' }).score).toBe(3);
  });

  it('깨진 문장·오류 항목은 걸러낸다', () => {
    const v = validateFeedback({
      ...GOOD,
      sentences: [
        GOOD.sentences[0],
        { original: 123 },                                     // 깨진 문장 — 제거
        { original: 'a', corrected: 'b', errors: [{ part: 'x' }, null] }, // fix 없는 오류 제거
      ],
    });
    expect(v.sentences).toHaveLength(2);
    expect(v.sentences[1].errors).toHaveLength(0);
  });

  it('sentences가 전멸하면 null', () => {
    expect(validateFeedback({ score: 5, summary: 'x', sentences: [] })).toBeNull();
    expect(validateFeedback({ score: 5 })).toBeNull();
    expect(validateFeedback(null)).toBeNull();
    expect(validateFeedback('text')).toBeNull();
  });

  it('levelFit·naturalness 이상값을 기본값으로 되돌린다', () => {
    const v = validateFeedback({ ...GOOD, levelFit: 'weird', naturalness: 'not-array' });
    expect(v.levelFit).toBe('fit');
    expect(v.naturalness).toEqual([]);
  });

  it('targetScore가 있으면 0~3으로 클램프해 보존', () => {
    expect(validateFeedback({ ...GOOD, targetScore: 2 }).targetScore).toBe(2);
    expect(validateFeedback({ ...GOOD, targetScore: 9 }).targetScore).toBe(3);
    expect(validateFeedback({ ...GOOD, targetScore: -1 }).targetScore).toBe(0);
  });

  it('targetScore가 없으면 null', () => {
    expect(validateFeedback(GOOD).targetScore).toBeNull();
  });
});

describe('FEEDBACK_SCHEMA', () => {
  it('Gemini responseSchema 형식(필수 필드)을 갖춘다', () => {
    expect(FEEDBACK_SCHEMA.type).toBe('OBJECT');
    expect(FEEDBACK_SCHEMA.required).toContain('sentences');
    expect(FEEDBACK_SCHEMA.properties.sentences.items.required).toEqual(['original', 'corrected', 'errors']);
  });
});
