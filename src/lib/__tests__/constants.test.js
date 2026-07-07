import { describe, it, expect } from 'vitest';
import { detectLang, splitSentenceAroundWord, JP_LEVELS, EN_LEVELS, LEVELS } from '../constants';

describe('detectLang', () => {
  it('히라가나 → Japanese', () => {
    expect(detectLang('こんにちは')).toBe('Japanese');
  });

  it('카타카나 → Japanese', () => {
    expect(detectLang('コンピューター')).toBe('Japanese');
  });

  it('한자(CJK) → Japanese', () => {
    expect(detectLang('勉強')).toBe('Japanese');
  });

  it('영어 단어 → English', () => {
    expect(detectLang('hello')).toBe('English');
  });

  it('대문자 영어 → English', () => {
    expect(detectLang('WORLD')).toBe('English');
  });

  it('혼합 (일본어+영어) → Japanese (일본어 우선)', () => {
    expect(detectLang('hello世界')).toBe('Japanese');
  });

  it('숫자만 → English (일본어 문자 없음)', () => {
    expect(detectLang('12345')).toBe('English');
  });

  it('빈 문자열 → English (일본어 문자 없음)', () => {
    expect(detectLang('')).toBe('English');
  });

  it('특수문자만 → English', () => {
    expect(detectLang('!@#$%')).toBe('English');
  });
});

describe('splitSentenceAroundWord', () => {
  it('word_text가 문장에 그대로 있으면 word_text로 분할', () => {
    const r = splitSentenceAroundWord('本を読む人', '読む', '読む');
    expect(r.term).toBe('読む');
    expect(r.parts).toEqual(['本を', '人']);
  });

  it('활용형 문장 — word_text(기본형)는 불일치, base_form이 문장에 있으면 base_form으로 마스킹', () => {
    // 문장은 활용형 표기(飲みます가 아니라 기본형 飲む가 등장하는 케이스)이고
    // 저장된 word_text는 문장에 없는 표기(飲みたい) → base_form(飲む)로 폴백 매칭.
    const r = splitSentenceAroundWord('毎日水を飲む', '飲みたい', '飲む');
    expect(r.term).toBe('飲む');
    expect(r.parts).toEqual(['毎日水を', '']);
    expect(r.parts.length).toBeGreaterThan(1);   // 마스크가 삽입될 자리가 생김
  });

  it('word_text·base_form 둘 다 불일치 → 통짜 표시(term null, parts 1개)', () => {
    const r = splitSentenceAroundWord('思います', '思う', '思う');
    expect(r.term).toBeNull();
    expect(r.parts).toEqual(['思います']);
  });

  it('source_sentence 없음(null) → 빈 문자열 통짜', () => {
    const r = splitSentenceAroundWord(null, '読む', '読む');
    expect(r.term).toBeNull();
    expect(r.parts).toEqual(['']);
  });
});

describe('LEVELS 상수', () => {
  it('JP_LEVELS 5개 (N5~N1)', () => {
    expect(JP_LEVELS).toHaveLength(5);
    expect(JP_LEVELS[0]).toContain('N5');
    expect(JP_LEVELS[4]).toContain('N1');
  });

  it('EN_LEVELS 6개 (A1~C2)', () => {
    expect(EN_LEVELS).toHaveLength(6);
    expect(EN_LEVELS[0]).toContain('A1');
    expect(EN_LEVELS[5]).toContain('C2');
  });

  it('LEVELS 맵 연결 확인', () => {
    expect(LEVELS.Japanese).toBe(JP_LEVELS);
    expect(LEVELS.English).toBe(EN_LEVELS);
  });
});
