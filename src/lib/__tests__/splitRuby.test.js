import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
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

// 분석기는 활용형 토큰에도 기본형 읽기를 준다(운영 자료 47 · 49 실측: 違い + ちがう, 待っ + まつ).
// 기본형이 없으면 독음 전체가 한자 위에 얹혀 「違[ちがう]い」로 보였다 — 기본형으로 한자 읽기를 구해 옮긴다(VIEWER-LANG-AUDIT).
describe('splitRuby — 활용형은 기본형 읽기에서 한자 읽기만 옮긴다', () => {
  it('違い(違う · ちがう) → 違[ちが]い, 待っ(待つ · まつ) → 待[ま]っ', () => {
    expect(splitRuby('違い', 'ちがう', '違う')).toEqual([{ kanji: '違', reading: 'ちが' }, { plain: 'い' }]);
    expect(splitRuby('待っ', 'まつ', '待つ')).toEqual([{ kanji: '待', reading: 'ま' }, { plain: 'っ' }]);
    expect(splitRuby('新しかっ', 'あたらしい', '新しい')).toEqual([{ kanji: '新', reading: 'あたら' }, { plain: 'しかっ' }]);
  });
  it('来る는 뒤 가나로 읽기를 고른다(来 · くる)', () => {
    expect(splitRuby('来', 'くる', '来る')).toEqual([{ kanji: '来', reading: 'き' }]); // 来 | た · 来 | ます(가장 흔함)
    expect(splitRuby('来な', 'くる', '来る')[0].reading).toBe('こ');
    expect(splitRuby('来ま', 'くる', '来る')[0].reading).toBe('き');
    expect(splitRuby('来れ', 'くる', '来る')[0].reading).toBe('く');
    expect(splitRuby('見', 'みる', '見る')).toEqual([{ kanji: '見', reading: 'み' }]);
  });
  it('표면 앵커가 맞으면(기본형 = 표면) 지금과 같고, 기본형이 없거나 한자가 다르면 옛 폴백 그대로', () => {
    expect(splitRuby('休み', 'やすみ', '休み')).toEqual([{ kanji: '休', reading: 'やす' }, { plain: 'み' }]);
    expect(splitRuby('違い', 'ちがう')).toEqual([{ kanji: '違', reading: 'ちがう' }, { plain: 'い' }]);
    expect(splitRuby('行っ', 'いく', '往く')).toEqual([{ kanji: '行', reading: 'いく' }, { plain: 'っ' }]);
  });
  it('중국어 병음은 기본형을 받아도 그대로다', () => {
    expect(splitRuby('图书馆', 'tú shū guǎn', '图书馆')[0]).toEqual({ kanji: '图', reading: 'tú', pinyin: true });
  });
});

describe('splitRuby — 독음이 표면 읽기면 표면 앵커가 이긴다(기본형으로 바꾸지 않는다)', () => {
  it('食べ + たべ(표면) + 食べる → 食[た]べ', () => {
    expect(splitRuby('食べ', 'たべ', '食べる')).toEqual([{ kanji: '食', reading: 'た' }, { plain: 'べ' }]);
    expect(splitRuby('食べ', 'たべる', '食べる')).toEqual([{ kanji: '食', reading: 'た' }, { plain: 'べ' }]);
    expect(splitRuby('来', 'き', '来る')).toEqual([{ kanji: '来', reading: 'き' }]);
  });
  it('기존 앵커 분해는 그대로다(引っ張る · 思い出す · 今日)', () => {
    expect(splitRuby('引っ張る', 'ひっぱる')).toEqual([{ kanji: '引', reading: 'ひ' }, { plain: 'っ' }, { kanji: '張', reading: 'ぱ' }, { plain: 'る' }]);
    expect(splitRuby('思い出す', 'おもいだす')).toEqual([{ kanji: '思', reading: 'おも' }, { plain: 'い' }, { kanji: '出', reading: 'だ' }, { plain: 'す' }]);
    expect(splitRuby('今日', 'きょう')).toEqual([{ kanji: '今日', reading: 'きょう' }]);
  });
});

describe('본문 · 카드 · 미리보기 · 빠른 읽기가 기본형을 넘긴다(VIEWER-LANG-AUDIT)', () => {
  const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  it('토큰 독음 분해 자리마다 base_form을 함께 준다', () => {
    expect(read('src/views/ViewerPage.jsx')).toContain('splitRuby(token.text, token.furigana, token.base_form)');
    expect(read('src/views/ViewerPage.jsx')).toContain('splitRuby(headText, headReading, headIsBase ? undefined : selectedToken?.base_form)');
    expect(read('src/views/QuickPage.jsx')).toContain('splitRuby(token.text, token.furigana, token.base_form)');
    expect(read('src/components/viewer/ViewerPreview.jsx')).toContain('splitRuby(token.text,token.furigana,token.base_form)');
  });
});
