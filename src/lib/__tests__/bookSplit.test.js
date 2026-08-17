import { describe, expect, it } from 'vitest';
import {
  isHeadingLine,
  splitTextIntoChapters,
  mergeWithPrevious,
  CHAPTER_MAX_CHARS,
} from '../bookSplit.js';

// 계약: 책 묶음 반입의 분할 — 헤딩(제N장·第N章·Chapter N·마크다운) 우선, 무헤딩은 문단
// 경계 길이 분할, 어느 경로든 상한 초과 챕터는 재분할. 경계는 미리보기에서 수동 병합 가능.

describe('isHeadingLine — 표제 줄 판정', () => {
  it('한·중·일·영 표제 패턴을 인식한다', () => {
    expect(isHeadingLine('제1장 만남')).toBe(true);
    expect(isHeadingLine('제 12 화')).toBe(true);
    expect(isHeadingLine('第三章 告白')).toBe(true);
    expect(isHeadingLine('第12课')).toBe(true);
    expect(isHeadingLine('Chapter 7')).toBe(true);
    expect(isHeadingLine('## 서울의 밤')).toBe(true);
    expect(isHeadingLine('프롤로그')).toBe(true);
    expect(isHeadingLine('3. 새로운 시작')).toBe(true);
  });

  it('본문 문장은 표제가 아니다(길이·문장부호 게이트)', () => {
    expect(isHeadingLine('제1장에서 그는 이렇게 말했다.')).toBe(false); // 문장부호 종결
    expect(isHeadingLine('第三章の内容はとても長くて、これは普通の文章でありまだまだ続きます、そしてさらに続いていきます')).toBe(false); // 40자 초과
    expect(isHeadingLine('그날은 비가 왔다')).toBe(false); // 패턴 불일치
    expect(isHeadingLine('')).toBe(false);
  });
});

describe('splitTextIntoChapters — 분할', () => {
  it('헤딩 2개 이상이면 헤딩 분할(표제=챕터 제목, 도입부 보존)', () => {
    const text = ['머리글 문단입니다', '', '제1장 만남', '본문 하나', '', '제2장 이별', '본문 둘'].join('\n');
    const ch = splitTextIntoChapters(text);
    expect(ch.map((c) => c.title)).toEqual(['머리글 문단입니다', '제1장 만남', '제2장 이별']);
    expect(ch[1].text).toBe('본문 하나');
    expect(ch[2].text).toBe('본문 둘');
  });

  it('헤딩이 없으면 문단 경계에서 목표 크기로 길이 분할한다', () => {
    const para = '가'.repeat(900);
    const text = Array.from({ length: 10 }, () => para).join('\n\n');
    const ch = splitTextIntoChapters(text, { targetChars: 2000 });
    expect(ch.length).toBeGreaterThan(1);
    expect(ch[0].title).toMatch(/^본문 \(1\//);
    for (const c of ch) expect(c.text.length).toBeLessThanOrEqual(2000 + 900); // 문단 단위라 초과는 1문단 이내
  });

  it('상한(maxChars) 초과 챕터는 제목을 유지한 채 재분할된다', () => {
    const big = '나'.repeat(CHAPTER_MAX_CHARS + 5000);
    const text = `제1장 긴 장\n${'다'.repeat(100)}\n\n${big}\n\n제2장 짧은 장\n본문`;
    const ch = splitTextIntoChapters(text);
    const firstParts = ch.filter((c) => c.title.startsWith('제1장 긴 장'));
    expect(firstParts.length).toBeGreaterThan(1);
    for (const c of ch) expect(c.text.length).toBeLessThanOrEqual(CHAPTER_MAX_CHARS);
    expect(ch.at(-1).title).toBe('제2장 짧은 장');
  });

  it('빈 입력은 빈 배열, 헤딩 1개뿐이면 길이 분할 경로', () => {
    expect(splitTextIntoChapters('')).toEqual([]);
    const ch = splitTextIntoChapters('제1장 유일\n짧은 본문');
    expect(ch).toHaveLength(1);
    expect(ch[0].title).toBe('본문');
  });
});

describe('mergeWithPrevious — 경계 수동 병합', () => {
  const chapters = [
    { title: 'A', text: 'a' },
    { title: 'B', text: 'b' },
    { title: 'C', text: 'c' },
  ];

  it('지정 챕터를 앞 챕터에 합친다(앞 제목 유지)', () => {
    expect(mergeWithPrevious(chapters, 1)).toEqual([
      { title: 'A', text: 'a\n\nb' },
      { title: 'C', text: 'c' },
    ]);
  });

  it('첫 챕터·범위 밖은 무변경', () => {
    expect(mergeWithPrevious(chapters, 0)).toBe(chapters);
    expect(mergeWithPrevious(chapters, 5)).toBe(chapters);
  });
});
