import { describe, expect, it } from 'vitest';
import { splitRuby } from '../splitRuby.js';

// 계약: 중국어/일본어 판별 — 이 표식(pinyin)이 격자 조판(1em 고정·0.26em 단일 크기)·
// Noto Sans·성조색의 스위치다. 오분류는 곧 "병음이 크게 나온다"류의 시각 회귀다.
describe('splitRuby — 중국어 병음 분류', () => {
  it('한 글자 단어도 병음이다 — 공백이 없다고 일본어로 흘리면 요미 크기(0.5em)로 커진다(오너 발견)', () => {
    expect(splitRuby('我', 'wǒ')).toEqual([{ kanji: '我', reading: 'wǒ', pinyin: true }]);
    expect(splitRuby('去', 'qù')).toEqual([{ kanji: '去', reading: 'qù', pinyin: true }]);
  });

  it('여러 글자는 공백 구분 음절을 글자별로 분배한다', () => {
    expect(splitRuby('图书馆', 'tú shū guǎn')).toEqual([
      { kanji: '图', reading: 'tú', pinyin: true },
      { kanji: '书', reading: 'shū', pinyin: true },
      { kanji: '馆', reading: 'guǎn', pinyin: true },
    ]);
  });

  it('성조 부호만 있는 음절(ǹg 같은 감탄사)도 라틴 스크립트로 판별한다', () => {
    expect(splitRuby('嗯', 'ǹg')[0].pinyin).toBe(true);
    expect(splitRuby('嗯', 'ǹ')[0].pinyin).toBe(true);
  });

  it('음절 수와 글자 수가 어긋나면 병음 격자를 포기한다(전체 독음 통짜 폴백)', () => {
    const segs = splitRuby('图书馆', 'túshūguǎn');
    expect(segs[0].pinyin).toBeUndefined();
    expect(segs[0].reading).toBe('túshūguǎn');
  });
});

describe('splitRuby — 일본어 요미가나 분류(무영향 확인)', () => {
  it('가나 독음은 병음 표식을 받지 않는다', () => {
    expect(splitRuby('私', 'わたし')).toEqual([{ kanji: '私', reading: 'わたし' }]);
  });

  it('오쿠리가나 앵커 분해는 그대로다', () => {
    expect(splitRuby('取りまとめ', 'とりまとめ')).toEqual([
      { kanji: '取', reading: 'と' },
      { plain: 'りまとめ' },
    ]);
  });

  it('독음이 없으면 plain', () => {
    expect(splitRuby('東京', null)).toEqual([{ plain: '東京' }]);
  });
});
