import { describe, it, expect } from 'vitest';

// vocabIO → supabase.js가 모듈 로드 시 env를 요구하므로, 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { normalizeWordText } = await import('../vocabIO');

describe('normalizeWordText — 저장용 word_text 정규화 규약', () => {
  it('기본형(base)이 가용하면 기본형을 반환 (활용형 통일)', () => {
    // JA: kuromoji basic_form
    expect(normalizeWordText({ surface: '食べた', base: '食べる' })).toBe('食べる');
    expect(normalizeWordText({ surface: '思い', base: '思う' })).toBe('思う');
    // EN: wink-lemmatizer lemma
    expect(normalizeWordText({ surface: 'running', base: 'run' })).toBe('run');
  });

  it('기본형이 없으면 surface(활용형)로 폴백', () => {
    expect(normalizeWordText({ surface: '食べた', base: '' })).toBe('食べた');
    expect(normalizeWordText({ surface: 'apple' })).toBe('apple');
    expect(normalizeWordText({ surface: 'apple', base: undefined })).toBe('apple');
    expect(normalizeWordText({ surface: 'apple', base: null })).toBe('apple');
  });

  it('기본형과 surface가 같으면 그대로 반환 (분석 불가·불변어)', () => {
    // FR/ZH: 분석기가 base를 주지 않으면 surface가 곧 저장값
    expect(normalizeWordText({ surface: '中国', base: '中国' })).toBe('中国');
    expect(normalizeWordText({ surface: 'bonjour' })).toBe('bonjour');
  });

  it('둘 다 없으면 빈 문자열, 인자 없으면 빈 문자열', () => {
    expect(normalizeWordText({ surface: '', base: '' })).toBe('');
    expect(normalizeWordText({})).toBe('');
    expect(normalizeWordText()).toBe('');
  });
});
