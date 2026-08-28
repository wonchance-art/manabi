import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { charDetail, charEtym, isInspectableChar, materialWordsWithChar, wordsWithChar } from '../charInspect.js';

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

// 증강 R2·R3(오너 승인 2026-08-28) — 자원 블록: 부수는 배지·메타로만, 설명 없음.
describe('charEtym', () => {
  const etymTable = { 想: [13, '心', '相心'], 语: [9, '言', '讠吾', '語'], 心: [4, '心'] };
  const koTable = { 想: '상', 相: '상', 心: '심', 语: '어', 言: '언', 讠: '언' };
  const hunTable = { 想: '생각', 相: '서로', 心: '마음' };

  it('성분에 훈음 라벨 + 부수 성분 배지(isRadical) — 메타는 획수·부수·부수 훈음', () => {
    const e = charEtym('想', etymTable, { koTable, hunTable });
    expect(e.strokes).toBe(13);
    expect(e.radical).toBe('心');
    expect(e.radicalHun).toBe('마음 심');
    expect(e.comps).toEqual([
      { ch: '相', label: '서로 상', isRadical: false },
      { ch: '心', label: '마음 심', isRadical: true },
    ]);
  });

  it('훈 미등재 성분은 음만(charDetail 관례), 간번체는 배열로 푼다', () => {
    const e = charEtym('语', etymTable, { koTable, hunTable });
    expect(e.comps[0]).toEqual({ ch: '讠', label: '언', isRadical: false });
    expect(e.comps[1].label).toBe(''); // 吾 미등재 — 조용히 생략(빈 라벨)
    expect(e.trad).toEqual(['語']);
    expect(e.simp).toEqual([]);
  });

  it('분해 없는 글자는 comps 빈 배열, 테이블 미로드·미등재·비한자는 null', () => {
    expect(charEtym('心', etymTable, { koTable, hunTable }).comps).toEqual([]);
    expect(charEtym('想', null, { koTable, hunTable })).toBeNull();
    expect(charEtym('魚', etymTable, { koTable, hunTable })).toBeNull();
    expect(charEtym('あ', etymTable, { koTable, hunTable })).toBeNull();
  });
});

// 증강 R1 — 이 자료 재등장 스캔(신규 데이터 0): 본문 순서가 곧 "곧 다시 만난다"다.
describe('materialWordsWithChar', () => {
  const json = {
    sequence: ['id_0_0', 'br_0', 'id_1_0', 'id_1_1', 'id_2_0', 'failed_1'],
    dictionary: {
      id_0_0: { text: '想起', pos: '動詞' },
      br_0: { text: '\n', pos: '개행' },
      id_1_0: { text: '理想', pos: '名詞' },
      id_1_1: { text: '想起', pos: '動詞' }, // 재등장 — 표기 기준 중복 제거
      id_2_0: { text: '感想', pos: '名詞' },
      failed_1: { text: '想念', failed: true }, // 실패 토큰은 앵커가 아니다
    },
  };

  it('본문 등장 순서 · 중복 제거 · 지금 단어 제외 · 실패/개행 제외', () => {
    expect(materialWordsWithChar('想', json, { excludeText: '感想' }).map((t) => t.text))
      .toEqual(['想起', '理想']);
  });

  it('상한을 지키고, 무입력·비한자는 빈 배열(로딩 중 안전)', () => {
    expect(materialWordsWithChar('想', json, { cap: 1 }).map((t) => t.text)).toEqual(['想起']);
    expect(materialWordsWithChar('想', null)).toEqual([]);
    expect(materialWordsWithChar('a', json)).toEqual([]);
  });
});

// 뷰어 배선 계약 — 자원 테이블 지연 로드 조건과 카드 구획이 실재해야 한다.
describe('글자 카드 배선(R1~R3)', () => {
  const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');

  it('자원·스토리 테이블은 글자 카드가 실제로 열릴 때만 지연 로드 — 한자 대조 토글로는 안 부른다', () => {
    expect(viewer).toContain("import('../lib/data/hanjaEtym.json')");
    expect(viewer).toContain("import('../lib/data/hanjaStory.json')");
    expect(viewer).toContain('inspectChar === null || hanjaEtymTable');
  });

  it('구성 풀이 스토리(R4)는 시드 저작분에만 — 미등재는 조용히 생략', () => {
    expect(viewer).toContain('hanjaStoryTable?.[inspectChar.ch]');
    expect(viewer).toContain('char-inspect__story');
  });

  it('카드가 구성(성분 탭=재귀)·다시 만나기(이 자료·내 단어)·메타 줄을 그린다', () => {
    for (const s of [
      'charEtym(inspectChar.ch',
      'materialWordsWithChar(inspectChar.ch',
      '다시 만나기',
      '이 자료',
      'comp_${c.ch}',
      'char-inspect__badge',
      'char-inspect__meta',
    ]) expect(viewer).toContain(s);
  });
});
