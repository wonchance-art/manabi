import { describe, expect, it } from 'vitest';
import { charDetail, isInspectableChar, wordsWithChar } from '../charInspect.js';

// 계약: 글자 탐색(④) — 탭 대상은 한자만, 정보는 기존 테이블에서, 미등재는 조용히 생략.

describe('isInspectableChar', () => {
  it('한자만 참 — 간체·정체·신자체 모두', () => {
    for (const ch of ['强', '學', '学', '図']) expect(isInspectableChar(ch)).toBe(true);
  });
  it('가나·라틴·구두점·다글자·빈 값은 거짓', () => {
    for (const v of ['あ', 'ㄱ', 'a', '。', '强调', '', null]) expect(isInspectableChar(v)).toBe(false);
  });
});

describe('charDetail', () => {
  const koTable = { 强: '강', 転: '전' };
  const hunTable = { 强: '굳셀' };
  const jaTable = { 强: '強' };

  it('훈음이 대표 — 옥편 표제 관례 그대로(hanjaHunEum 위임)', () => {
    expect(charDetail('强', { koTable, hunTable, jaTable })).toEqual({
      hunEum: '굳셀 강', eum: null, ja: '強',
    });
  });

  it('훈 미등재(신자체 등)면 음만 — 転은 훈 테이블에 없어도 음 "전"은 나온다', () => {
    expect(charDetail('転', { koTable, hunTable, jaTable })).toEqual({
      hunEum: null, eum: '전', ja: null,
    });
  });

  it('일본식 자형은 상이할 때만 — 동형이면 생략', () => {
    expect(charDetail('强', { koTable, hunTable, jaTable: { 强: '强' } }).ja).toBeNull();
  });

  it('한자가 아니면 null, 테이블 미로드는 전부 null 필드(로딩 중 안전)', () => {
    expect(charDetail('あ', { koTable, hunTable, jaTable })).toBeNull();
    expect(charDetail('强', {})).toEqual({ hunEum: null, eum: null, ja: null });
  });
});

describe('wordsWithChar', () => {
  const rows = [
    { word_text: '强调', language: 'Chinese', id: 1 },
    { word_text: '加强', language: 'Chinese', id: 2 },
    { word_text: '强い', language: 'Japanese', id: 3 },
    { word_text: '强调', language: 'Chinese', id: 4 }, // byKey 중복(표면+기본형)
    { word_text: '效率', language: 'Chinese', id: 5 },
  ];

  it('같은 언어·글자 포함만, 지금 단어 제외, word_text 중복 제거', () => {
    const out = wordsWithChar('强', rows, { language: 'Chinese', excludeText: '强调' });
    expect(out.map((v) => v.word_text)).toEqual(['加强']);
  });

  it('상한(cap)을 지키고, 한자가 아니면 빈 배열', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ word_text: `强${i}`, language: 'Chinese' }));
    expect(wordsWithChar('强', many, { language: 'Chinese' })).toHaveLength(6);
    expect(wordsWithChar('あ', rows, { language: 'Japanese' })).toEqual([]);
  });
});
