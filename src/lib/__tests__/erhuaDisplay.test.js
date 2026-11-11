import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { displayReading, joinErhuaPinyin } from '../erhuaDisplay.js';
import { readingLine } from '../reviewCard.js';
import { splitRuby } from '../splitRuby.js';

/**
 * 계약: 얼화(儿化) 표시(ZH-ERHUA, 오너 「권장대로」 2026-11-11 KST — 목업 https://claude.ai/artifact/56efQEdSzf5PV38A14hfge 안 A).
 * 저장은 글자마다 한 음절(「nǎ r」), 낱말 꼴로 읽기를 보이는 자리만 「nǎr」로 붙인다. 본문 루비는 글자별 그대로(哪 nǎ · 儿 r).
 */
describe('joinErhuaPinyin — 홀로 선 r만 앞 음절에 붙인다', () => {
  it('얼화 낱말', () => {
    expect(joinErhuaPinyin('nǎ r')).toBe('nǎr');
    expect(joinErhuaPinyin('zhè r')).toBe('zhèr');
    expect(joinErhuaPinyin('yì diǎn r')).toBe('yì diǎnr');
    expect(joinErhuaPinyin('yǒu diǎn r')).toBe('yǒu diǎnr');
    expect(joinErhuaPinyin('hǎo wán r')).toBe('hǎo wánr');
  });
  it('문장 안 · 구두점 앞', () => {
    expect(joinErhuaPinyin('nǐ zài nǎ r?')).toBe('nǐ zài nǎr?');
    expect(joinErhuaPinyin('qǐng gěi wǒ yì diǎn r shuǐ.')).toBe('qǐng gěi wǒ yì diǎnr shuǐ.');
  });
  it('실음절 ér · r로 시작하는 음절은 그대로', () => {
    expect(joinErhuaPinyin('nǚ ér')).toBe('nǚ ér');
    expect(joinErhuaPinyin('ér zi')).toBe('ér zi');
    expect(joinErhuaPinyin('ér tóng')).toBe('ér tóng');
    expect(joinErhuaPinyin('zhōng guó rén')).toBe('zhōng guó rén');
    expect(joinErhuaPinyin('rè')).toBe('rè');
  });
  it('이미 붙은 꼴 · 빈 값 · 문자열 아님은 그대로', () => {
    expect(joinErhuaPinyin('nǎr')).toBe('nǎr');
    expect(joinErhuaPinyin('')).toBe('');
    expect(joinErhuaPinyin(null)).toBe(null);
    expect(joinErhuaPinyin(undefined)).toBe(undefined);
  });
});

describe('displayReading — 중국어만 붙이고 다른 언어 읽기에는 닿지 않는다', () => {
  it('중국어', () => { expect(displayReading('nǎ r', 'Chinese')).toBe('nǎr'); });
  it('일본어 · 영어 · 프랑스어는 그대로', () => {
    expect(displayReading('かれ r', 'Japanese')).toBe('かれ r');
    expect(displayReading('car r', 'English')).toBe('car r');
    expect(displayReading('heure r', 'French')).toBe('heure r');
  });
});

describe('표시 자리 배선', () => {
  it('복습 카드 중국어 읽기 줄은 붙인 꼴, 저장 값은 그대로', () => {
    const word = { language: 'Chinese', word_text: '哪儿', furigana: 'nǎ r' };
    expect(readingLine(word)).toEqual({ kind: 'pinyin', text: 'nǎr' });
    expect(word.furigana).toBe('nǎ r');
  });
  it('담은 표현 목록 · 표현 카드는 displayReading(v.furigana, v.language)로 보인다', () => {
    for (const f of ['src/views/VocabList.jsx', 'src/views/VocabDetailCard.jsx']) {
      expect(fs.readFileSync(path.join(process.cwd(), f), 'utf8')).toContain('displayReading(v.furigana, v.language)');
    }
  });
  it('본문 루비는 글자별 그대로 — 哪 nǎ · 儿 r(렌더러 무변경)', () => {
    expect(splitRuby('哪儿', 'nǎ r')).toEqual([{ kanji: '哪', reading: 'nǎ', pinyin: true }, { kanji: '儿', reading: 'r', pinyin: true }]);
  });
});
