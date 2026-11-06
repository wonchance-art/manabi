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

describe('빈 단어장 문구 — 언어와 상관없는 안내 · 언어 입구 이름 (발매 점검 #5, 오너 승인 2026-11-06 KST)', () => {
  const labelBody = src.match(/export function firstWordsLabel\(lang\) \{([\s\S]*?)\n\}/)[1];
  const firstWordsLabel = new Function('lang', labelBody);
  it('단추 이름 — 중국어는 HSK 단어 목록, 나머지는 교재', () => {
    expect(firstWordsLabel('Chinese')).toBe('HSK 단어 목록에서 고르기 →');
    expect(firstWordsLabel('Japanese')).toBe('교재에서 표현 고르기 →');
    expect(firstWordsLabel(undefined)).toBe('교재에서 표현 고르기 →');
    expect(src).toContain("hasAnyWords ? '오늘로 →' : firstWordsLabel(scope.lang)}");
  });
  it('첫 표현 안내는 교재 예문이 아니라 읽다가 고르는 방법(모든 언어)', () => {
    expect(src).toContain("자료를 읽다가 모르는 말을 누르고 「얼마나 알겠어요?」를 고르면 여기에 모여요.");
    expect(src).not.toContain('교재 예문의 ‘예문 담기’로 기억하고 싶은 문장을 골라 주세요.');
  });
  it('「N5 과별 답안과는 별개예요」는 일본어(또는 언어 미정)에서만', () => {
    expect(src).toContain("${!scope.lang || scope.lang === 'Japanese' ? ' N5 과별 답안과는 별개예요.' : ''}");
  });
});

