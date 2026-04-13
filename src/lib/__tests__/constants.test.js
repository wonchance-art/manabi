import { describe, it, expect } from 'vitest';
import { detectLang, JP_LEVELS, EN_LEVELS, LEVELS } from '../constants';

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
