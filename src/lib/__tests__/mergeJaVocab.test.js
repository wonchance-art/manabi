import { describe, it, expect } from 'vitest';
import { mergeJaVocab, _normJa } from '../../content/japanese/index';

// 손작성 base 어휘 픽스처 — 테마 2개, 표제어 4개
const base = {
  level: 'N5',
  title: 'N5 픽스처',
  themes: [
    {
      name: '인사',
      icon: '🙇',
      words: [
        { ja: 'こんにちは', yomi: 'こんにちは', ko: '안녕하세요', pos: '표현' },
        { ja: '〜時', yomi: 'じ', ko: '〜시', pos: '명사' },
      ],
    },
    {
      name: '동사',
      icon: '🏃',
      words: [
        { ja: '食べる', yomi: 'たべる', ko: '먹다', pos: '동사' },
      ],
    },
  ],
};

describe('_normJa', () => {
  it('접미 마커(～〜~)·공백 제거', () => {
    expect(_normJa('〜時')).toBe('時');
    expect(_normJa('～分')).toBe('分');
    expect(_normJa('食べ る')).toBe('食べる');
  });

  it('복수 표기(;／、)는 첫 형태만', () => {
    expect(_normJa('行く／ゆく')).toBe('行く');
    expect(_normJa('明日；あす')).toBe('明日');
    expect(_normJa('方、かた')).toBe('方');
  });

  it('null/undefined 안전', () => {
    expect(_normJa(undefined)).toBe('');
    expect(_normJa(null)).toBe('');
  });
});

describe('mergeJaVocab', () => {
  it('(a) base 단독 병합 시 구조 보존', () => {
    const out = mergeJaVocab(base);
    expect(out.level).toBe('N5');
    expect(out.title).toBe('N5 픽스처');
    expect(out.themes).toHaveLength(2);
    expect(out.themes[0].name).toBe('인사');
    expect(out.themes[0].words).toHaveLength(2);
    expect(out.themes[1].words).toHaveLength(1);
    // 원본 불변(복사본 반환)
    expect(out).not.toBe(base);
    expect(out.themes[0]).not.toBe(base.themes[0]);
  });

  it('(b) 중복 ja는 skip', () => {
    const add = [
      { name: '인사', icon: '🙇', words: [
        { ja: 'こんにちは', ko: '중복 — 버려짐', pos: '표현' },
        { ja: 'こんばんは', ko: '저녁 인사 — 추가됨', pos: '표현' },
      ] },
    ];
    const out = mergeJaVocab(base, add);
    const greet = out.themes.find((t) => t.name === '인사');
    expect(greet.words).toHaveLength(3); // 기존 2 + 신규 1
    expect(greet.words.map((w) => w.ja)).toEqual(['こんにちは', '〜時', 'こんばんは']);
    // 중복은 원본 뜻 유지
    expect(greet.words[0].ko).toBe('안녕하세요');
  });

  it('(c) ～마커 정규화로 dedup', () => {
    // base의 '〜時'와 보강의 '時'는 정규화 후 동일 → skip
    const add = [
      { name: '시간', icon: '⏰', words: [
        { ja: '時', ko: '시 — 중복이므로 버려짐', pos: '명사' },
      ] },
    ];
    const out = mergeJaVocab(base, add);
    // 새 테마 '시간'은 신규 단어가 없어 생성되지 않음
    expect(out.themes.find((t) => t.name === '시간')).toBeUndefined();
    expect(out.themes).toHaveLength(2);
  });

  it('(d) 새 이름 테마는 뒤에 append', () => {
    const add = [
      { name: '음식', icon: '🍙', words: [
        { ja: 'ごはん', ko: '밥', pos: '명사' },
      ] },
    ];
    const out = mergeJaVocab(base, add);
    expect(out.themes).toHaveLength(3);
    expect(out.themes[2].name).toBe('음식');
    expect(out.themes[2].icon).toBe('🍙');
    expect(out.themes[2].words).toHaveLength(1);
  });

  it('{ themes } 형태(ZH식) 보강 리스트도 허용', () => {
    const out = mergeJaVocab(base, { themes: [
      { name: '음식', icon: '🍙', words: [{ ja: 'みず', ko: '물', pos: '명사' }] },
    ] });
    expect(out.themes.find((t) => t.name === '음식')?.words[0].ja).toBe('みず');
  });

  it('빈/누락 보강 리스트는 무시', () => {
    const out = mergeJaVocab(base, null, undefined, [], { themes: [] });
    expect(out.themes).toHaveLength(2);
  });
});
