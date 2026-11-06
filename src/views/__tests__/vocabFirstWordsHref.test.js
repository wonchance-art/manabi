import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 발매 점검(2026-11-06 KST): 빈 단어장 「교재에서 표현 고르기」가 언어와 상관없이 일본어 N5 책으로 갔다 — 중국어 학습자가 일본어 교재로.
// 보고 있는 언어의 교재 입구로 되돌린다. VocabPage 모듈은 무거워 함수 본문을 소스에서 꺼내 그대로 실행한다.
const src = readFileSync('src/views/VocabPage.jsx', 'utf8');
const body = src.match(/export function firstWordsHref\(lang\) \{([\s\S]*?)\n\}/)[1];
const firstWordsHref = new Function('lang', body);

describe('빈 단어장 첫 걸음 링크 — 언어별 교재 입구', () => {
  it('일본어 · 언어 미정은 N5 책 그대로', () => {
    expect(firstWordsHref('Japanese')).toBe('/books/japanese-n5');
    expect(firstWordsHref(undefined)).toBe('/books/japanese-n5');
  });
  it('중국어 · 영어 · 프랑스어는 그 언어의 교재 입구(/lessons?lang=…)', () => {
    expect(firstWordsHref('Chinese')).toBe('/lessons?lang=Chinese');
    expect(firstWordsHref('English')).toBe('/lessons?lang=English');
    expect(firstWordsHref('French')).toBe('/lessons?lang=French');
  });
  it('빈 단어장 단추가 이 함수를 쓴다(고정 N5 링크가 돌아오지 않는다)', () => {
    expect(src).toContain("hasAnyWords ? '/home' : firstWordsHref(scope.lang)}");
    expect(src).not.toMatch(/hasAnyWords \? '\/home' : '\/books\/japanese-n5'/);
  });
});
