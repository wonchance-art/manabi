import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sliceBetween } from './helpers/sliceBetween.js';

// LINE-BREAK-001: src/index.css가 <html lang="ko">에서 상속되는 [lang|="ko"]{word-break:keep-all}을 건다.
// 학습 언어(일본어·중국어) 글자가 자기나 조상에 lang 없이 그려지면 한국어 어절 규칙을 물려받아
// 줄이 통째로 넘어간다. 그래서 학습 언어 글이 나오는 대표 자리는 lang 바인딩을 가져야 한다 —
// 이 계약은 그 바인딩이 리팩터링 중에 조용히 빠지는 것을 막는다(표시·문구 변경 없음, 속성만).
const read = path => readFileSync(path, 'utf8');

describe('학습 언어 글에 lang 바인딩 (LINE-BREAK-001)', () => {
  it('서재 줄 — 제목 · 발췌 · 담긴 글이 자료 언어 lang을 단다', () => {
    const src = read('src/components/library/LibraryRow.jsx');
    expect(src).toMatch(/titleLang=encounterLookupLang\(row\.language\)\|\|undefined/);
    const copy = sliceBetween(src, '<div className="shelf-row-copy">', '</RowLink>');
    expect(copy).toMatch(/<h3 lang=\{row\.title\?titleLang:undefined\}>/);
    expect(copy).toMatch(/\{row\.excerpt&&<p lang=\{titleLang\}>/);
    expect(src).toMatch(/children\.data\.items\.map\(c=><li key=\{c\.id\} lang=\{titleLang\}>/);
  });

  it('홈 산책 추천 — 이어 읽기 타일 제목에 titleLang을 넘긴다', () => {
    const src = read('src/views/HomePage.jsx');
    const item = sliceBetween(src, "kicker: '산책 추천'", "cta: '읽어 보기'");
    expect(item).toContain('titleLang: encounterLookupLang(suggestion.language) || undefined');
  });

  it('뷰어 — 제목 h1과 다음 편/다음 과 제목이 자료 언어 태그를 단다(루트 lang=uiLocale 아래)', () => {
    const src = read('src/views/ViewerPage.jsx');
    expect(src).toContain('<h1 className="page-header__title" lang={contentLangTag}>{material.title}</h1>');
    expect(src).toContain('<div className="next-lesson-card__title" lang={contentLangTag}>{nextLesson.title}</div>');
    expect(src).toContain('<div className="next-lesson-card__title" lang={contentLangTag}>{bookNav.next.title}</div>');
  });

  it('복습 카드 문맥 — 대표 문장과 다른 문맥 인용이 단어 언어 lang을 단다', () => {
    const src = read('src/components/learning/VocabularyContexts.jsx');
    expect(src).toContain('const quoteLang=encounterLookupLang(word?.language) || undefined;');
    expect(src).toContain('<p className="review-card__source" lang={quoteLang}>');
    expect(src).toContain('<p className="learning-source-quote" lang={quoteLang}>');
    // ReviewCardParts가 이 파일을 import한다 — langTag를 거꾸로 가져오면 순환이 된다.
    expect(src).not.toMatch(/from '\.\.\/vocab\/ReviewCardParts'/);
  });

  it('단어 상세 — 후리가나 · 표제어 · 출처 문장이 langTag(v)를 단다', () => {
    const src = read('src/views/VocabDetailCard.jsx');
    const header = sliceBetween(src, '<div className="vocab-detail-card__header">', 'id="vocab-detail-meaning"');
    expect(header).toContain('<span className="vocab-detail-card__furigana" lang={langTag(v)}>');
    expect(header).toContain('className="vocab-detail-card__word" lang={langTag(v)}>');
    const source = sliceBetween(src, '{v.source_sentence && (', 'v.source_sentence.split');
    expect(source).toContain('<p lang={langTag(v)}');
  });
});
