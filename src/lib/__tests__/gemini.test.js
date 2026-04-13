import { describe, it, expect } from 'vitest';
import { parseGeminiJSON } from '../gemini';

describe('parseGeminiJSON', () => {
  it('파싱: 순수 객체', () => {
    expect(parseGeminiJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it('파싱: 순수 배열', () => {
    expect(parseGeminiJSON('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('파싱: ```json 코드펜스 제거', () => {
    const input = '```json\n{"score":80,"feedback":"good"}\n```';
    expect(parseGeminiJSON(input)).toEqual({ score: 80, feedback: 'good' });
  });

  it('파싱: ``` 코드펜스만 있을 때도 제거', () => {
    const input = '```\n{"ok":true}\n```';
    expect(parseGeminiJSON(input)).toEqual({ ok: true });
  });

  it('파싱: 주변 설명이 있어도 추출', () => {
    const input = '네 아래는 응답입니다:\n{"word":"食べる","reading":"たべる"}\n감사합니다';
    expect(parseGeminiJSON(input)).toEqual({ word: '食べる', reading: 'たべる' });
  });

  it('파싱: 중첩 객체 보존', () => {
    const input = '{"examples":[{"sentence":"a","translation":"b"}]}';
    expect(parseGeminiJSON(input)).toEqual({ examples: [{ sentence: 'a', translation: 'b' }] });
  });

  it('파싱: 객체와 배열이 섞여 있을 때 먼저 나온 쪽 선택', () => {
    // 객체가 먼저
    expect(parseGeminiJSON('앞 {"x":1} 뒤 [9]')).toEqual({ x: 1 });
    // 배열이 먼저
    expect(parseGeminiJSON('앞 [9] 뒤 {"x":1}')).toEqual([9]);
  });

  it('에러: 괄호가 전혀 없을 때', () => {
    expect(() => parseGeminiJSON('plain text')).toThrow(/괄호/);
  });

  it('에러: 잘못된 JSON', () => {
    // 중괄호 닫힘이 있지만 내부 파싱 실패
    expect(() => parseGeminiJSON('{not valid}')).toThrow(/파싱 실패/);
  });

  it('파싱: 빈 객체', () => {
    expect(parseGeminiJSON('{}')).toEqual({});
  });

  it('파싱: 빈 배열', () => {
    expect(parseGeminiJSON('[]')).toEqual([]);
  });
});
