import { describe, expect, it } from 'vitest';
import * as reviewCard from '../reviewCard';
import { expressionKind, hasMeaning, readingLine, readReviewSound, revealTrigger, saveReviewSound,
  shouldAutoplay } from '../reviewCard';

// REV-SCOPE-R1B-1 카드 규격(설계 §3-2 · §3-3 · §6-1 ⑥⑦) — 종류 판별 · 발음 판정 대상 · 문구 · 소리.
describe('종류 판별(읽을 때만, 저장하지 않음)', () => {
  it('「예문 담기」(표현 = 담은 맥락 문장)와 문장 끝 부호(。！？.!?)는 문장, 나머지는 단어', () => {
    const sentence = 'もう 本を 読みましたか。まだ 読んでいません。';
    expect(expressionKind({ word_text: sentence, source_sentence: sentence })).toBe('sentence');
    expect(expressionKind({ word_text: 'ここは カフェです', source_sentence: 'ここは カフェです' })).toBe('sentence');
    for (const text of ['我每天七点吃早餐。', 'Où est la gare ?', 'Is it?', '「行きましょう！」', 'C’est ça.']) expect(expressionKind({ word_text: text })).toBe('sentence');
    for (const text of ['早餐', '駅', 'la famille', 'kick off', '']) expect(expressionKind({ word_text: text })).toBe('word');
    // 문장 속에서 담은 단어(표현 ≠ 맥락 문장)는 단어
    expect(expressionKind({ word_text: 'きっかけ', source_sentence: '学ぶきっかけです。' })).toBe('word');
  });
});

describe('채점 문구 · 읽기 줄', () => {
  it('채점 기준 안내 문구는 없다(오너 2026-10-26 KST 「일부러 없앤 지 오래」) — 문구 · 판정 함수를 내보내지 않는다', () => {
    for (const name of ['GRADE_GUIDE', 'gradeGuide', 'pronunciationJudged']) expect(reviewCard).not.toHaveProperty(name);
  });
  it('뒷면 읽기 줄: 일본어 한자어 = 후리가나(ruby) · 중국어 = 병음 · 영어/프랑스어 = 발음 표기 · 가나만 = 없음(소리만)', () => {
    expect(readingLine({ language: 'Japanese', word_text: '食べる', furigana: 'たべる' })).toEqual({ kind: 'ruby', text: 'たべる' });
    expect(readingLine({ language: 'Chinese', word_text: '早餐', furigana: 'zǎo cān' })).toEqual({ kind: 'pinyin', text: 'zǎo cān' });
    expect(readingLine({ language: 'French', word_text: 'bonjour', furigana: 'bɔ̃ʒuʁ' })).toEqual({ kind: 'phonetic', text: 'bɔ̃ʒuʁ' });
    expect(readingLine({ language: 'Japanese', word_text: 'すし', furigana: 'すし' })).toEqual({ kind: 'none', text: null });
    expect(readingLine({ language: 'Japanese', word_text: 'カフェ', furigana: 'かふぇ' })).toEqual({ kind: 'none', text: null });
    expect(readingLine({ language: 'Chinese', word_text: '早餐' })).toEqual({ kind: 'none', text: null });
  });
  it('뜻 없는 표현은 복습에서 빠진다(§5-6)', () => {
    expect(hasMeaning({ meaning: ' 아침 식사 ' })).toBe(true);
    for (const meaning of ['', '   ', null, undefined]) expect(hasMeaning({ meaning })).toBe(false);
  });
});

describe('소리 규격(§3-3)', () => {
  it('🔈/🔇는 기기별로 기억한다 — 저장소가 막혀도 켜짐으로 동작', () => {
    const map = new Map();
    const storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
    expect(readReviewSound(storage)).toBe(true);
    saveReviewSound(false, storage);
    expect(readReviewSound(storage)).toBe(false);
    expect(readReviewSound({ getItem() { throw new Error('blocked'); } })).toBe(true);
  });
  it('화면 읽기 프로그램 · 키보드로 누른 단추(click detail 0)는 자동 재생하지 않는다 — 포인터 · 단축키만, 소리 꺼짐 · 음성 불가면 안 함', () => {
    expect(revealTrigger({ detail: 1 })).toBe('pointer');
    expect(revealTrigger({ detail: 0 })).toBe('assistive');
    expect(shouldAutoplay({ soundOn: true, ttsSupported: true, trigger: 'pointer' })).toBe(true);
    expect(shouldAutoplay({ soundOn: true, ttsSupported: true, trigger: 'shortcut' })).toBe(true);
    expect(shouldAutoplay({ soundOn: true, ttsSupported: true, trigger: 'assistive' })).toBe(false);
    expect(shouldAutoplay({ soundOn: false, ttsSupported: true, trigger: 'pointer' })).toBe(false);
    expect(shouldAutoplay({ soundOn: true, ttsSupported: false, trigger: 'pointer' })).toBe(false);
  });
});
