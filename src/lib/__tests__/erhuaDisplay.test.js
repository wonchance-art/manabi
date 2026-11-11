import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { displayReading, joinErhuaPinyin, splitErhuaPinyin } from '../erhuaDisplay.js';
import { buildVocabularyCSV, csvToVocabRows } from '../vocabIO.js';
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

describe('CSV 왕복 — 내보내기는 붙인 꼴, 가져오기는 저장 꼴(글자 1 = 음절 1)로', () => {
  it('splitErhuaPinyin: 붙인 꼴만 되돌리고 실음절 ér은 그대로', () => {
    expect(splitErhuaPinyin('nǎr', '哪儿')).toBe('nǎ r');
    expect(splitErhuaPinyin('yì diǎnr', '一点儿')).toBe('yì diǎn r');
    expect(splitErhuaPinyin('yí huìr', '一会儿')).toBe('yí huì r');
    expect(splitErhuaPinyin('nǎ r', '哪儿')).toBe('nǎ r');
    expect(splitErhuaPinyin('nǚ ér', '女儿')).toBe('nǚ ér');
    expect(splitErhuaPinyin('yīngér', '婴儿')).toBe('yīngér');
    expect(splitErhuaPinyin('ér zi', '儿子')).toBe('ér zi');
    expect(splitErhuaPinyin('がくせい', '学生')).toBe('がくせい');
  });
  it('buildVocabularyCSV → csvToVocabRows 왕복에서 저장 꼴이 그대로 돌아온다', () => {
    const v = { id: 'v1', user_id: 'u1', word_text: '哪儿', furigana: 'nǎ r', meaning: '어디', pos: '대명사', language: 'Chinese' };
    const p = { kind: 'vocabulary-learning', version: 1, source: 'fsrs', memory: { stability: 1, difficulty: 5 }, review: { nextQuestionAt: null }, vocabulary: { id: 'v1', user_id: 'u1' } };
    const csv = buildVocabularyCSV([v], [p]);
    expect(csv).toContain('"nǎr"');
    const [row] = csvToVocabRows(csv, 'u1');
    expect(row.furigana).toBe('nǎ r');
    const girl = { ...v, id: 'v2', word_text: '女儿', furigana: 'nǚ ér' };
    const [back] = csvToVocabRows(buildVocabularyCSV([girl], [{ ...p, vocabulary: { id: 'v2', user_id: 'u1' } }]), 'u1');
    expect(back.furigana).toBe('nǚ ér');
  });
});

describe('읽기 문자열을 그대로 그리는 자리는 공용 함수를 거친다', () => {
  const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
  it.each([
    ['src/views/VocabList.jsx', 'displayReading(v.furigana, v.language)'],
    ['src/views/VocabDetailCard.jsx', 'displayReading(v.furigana, v.language)'],
    ['src/lib/reviewCard.js', 'joinErhuaPinyin(reading)'],
    ['src/views/StudySessionPage.jsx', 'displayReading(item.word.furigana, item.word.language || lang)'],
    ['src/components/classroom/ClassStudyHistory.jsx', 'joinErhuaPinyin(entry.reading)'],
    ['src/components/classroom/ClassroomUI.jsx', 'displayReading(entry.reading, lang)'],
    ['src/views/ViewerPage.jsx', 'displayReading(t.furigana, materialLang)'],
    ['src/views/ViewerPage.jsx', 'displayReading(g.reading, materialLang)'],
    ['src/views/PdfViewerPage.jsx', 'displayReading(wordDetail.token.reading, language)'],
    ['src/lib/vocabIO.js', "displayReading(v.furigana || '', v.language)"],
    ['src/lib/vocabIO.js', 'splitErhuaPinyin(furigana.trim(), text)'],
    ['src/views/QuickPage.jsx', 'displayReading(wordDetail.token.furigana, language)'],
    ['src/views/PdfViewerPage.jsx', 'displayReading(wordDetail.token.furigana, language)'],
  ])('%s — %s', (f, s) => { expect(read(f)).toContain(s); });
});
