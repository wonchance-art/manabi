import { describe, it, expect, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { buildConditions, ACHIEVEMENTS, ACHIEVEMENT_MAP } from '../achievements';

describe('buildConditions', () => {
  const EMPTY = {
    vocabCount: 0, masteredCount: 0, reviewedCount: 0,
    readCount: 0, xp: 0, streak: 0, firstPost: false, vocabSample: [],
  };

  it('모든 통계 0 → 모든 조건 false', () => {
    const c = buildConditions(EMPTY);
    Object.values(c).forEach(v => expect(v).toBe(false));
  });

  it('어휘 수 임계값 테스트', () => {
    const c = buildConditions({ ...EMPTY, vocabCount: 10 });
    expect(c.first_word).toBe(true);
    expect(c.vocab_10).toBe(true);
    expect(c.vocab_100).toBe(false);
  });

  it('경계값: 정확히 임계값', () => {
    expect(buildConditions({ ...EMPTY, vocabCount: 100 }).vocab_100).toBe(true);
    expect(buildConditions({ ...EMPTY, vocabCount: 99 }).vocab_100).toBe(false);
  });

  it('마스터 단어 수', () => {
    expect(buildConditions({ ...EMPTY, masteredCount: 10 }).master_10).toBe(true);
    expect(buildConditions({ ...EMPTY, masteredCount: 9 }).master_10).toBe(false);
  });

  it('스트릭 임계값', () => {
    const c = buildConditions({ ...EMPTY, streak: 30 });
    expect(c.streak_7).toBe(true);
    expect(c.streak_30).toBe(true);
    expect(c.streak_100).toBe(false);
  });

  it('XP 임계값', () => {
    const c = buildConditions({ ...EMPTY, xp: 1000 });
    expect(c.xp_100).toBe(true);
    expect(c.xp_1000).toBe(true);
    expect(c.xp_5000).toBe(false);
  });

  it('레벨 임계값 (XP 기반)', () => {
    // XP 2000 = 레벨 6
    const c = buildConditions({ ...EMPTY, xp: 2000 });
    expect(c.level_5).toBe(true);
    expect(c.level_10).toBe(false);
  });

  it('polyglot: 일본어 + 영어 단어 모두 있을 때', () => {
    const c = buildConditions({
      ...EMPTY,
      vocabSample: [
        { word_text: '勉強', language: 'Japanese' },
        { word_text: 'hello', language: 'English' },
      ],
    });
    expect(c.polyglot).toBe(true);
  });

  it('polyglot: 한 언어만 → false', () => {
    const c = buildConditions({
      ...EMPTY,
      vocabSample: [{ word_text: '勉強', language: 'Japanese' }],
    });
    expect(c.polyglot).toBe(false);
  });

  it('polyglot: language 필드 없이 문자 기반 감지', () => {
    const c = buildConditions({
      ...EMPTY,
      vocabSample: [
        { word_text: 'こんにちは' },  // 히라가나 → JP
        { word_text: 'world' },       // 영어 → EN
      ],
    });
    expect(c.polyglot).toBe(true);
  });

  it('first_post', () => {
    expect(buildConditions({ ...EMPTY, firstPost: true }).first_post).toBe(true);
    expect(buildConditions({ ...EMPTY, firstPost: false }).first_post).toBe(false);
  });
});

describe('ACHIEVEMENTS 상수', () => {
  it('20개 업적 정의', () => {
    expect(ACHIEVEMENTS).toHaveLength(20);
  });

  it('모든 업적에 필수 필드 존재', () => {
    ACHIEVEMENTS.forEach(a => {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('icon');
      expect(a).toHaveProperty('name');
      expect(a).toHaveProperty('desc');
      expect(a).toHaveProperty('category');
    });
  });

  it('ACHIEVEMENT_MAP 매핑 일치', () => {
    ACHIEVEMENTS.forEach(a => {
      expect(ACHIEVEMENT_MAP[a.id]).toBe(a);
    });
  });
});
