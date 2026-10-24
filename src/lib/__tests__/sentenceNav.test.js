import { describe, expect, it } from 'vitest';
import { pickableSentences, pickableSentenceUnits, adjacentSentence, cleanLineText } from '../sentenceNav.js';

// 계약: 문장 이동(오너 승인 2026-08-19) — "문장"의 단위는 문장 막대(¦)와 동일해야 한다.
const rawLines = ['# 제목 문장', '第一句话。', '', '。', '第二句话。'];
const lineGroups = [
  { rawIdx: 0, tokenIds: ['id_0_0'] },
  { rawIdx: 1, tokenIds: ['id_1_0', 'id_1_1'] },
  { rawIdx: 3, tokenIds: ['id_3_0'] },  // 정리 후 1자(。) — 막대 임계 미달
  { rawIdx: 4, tokenIds: ['id_4_0'] },
];

describe('pickableSentences', () => {
  it('토큰 있는 줄 중 정리 텍스트 2자 이상만 — 막대(¦) 조건과 동일', () => {
    const s = pickableSentences(lineGroups, rawLines);
    expect(s.map((x) => x.rawIdx)).toEqual([0, 1, 4]);
    expect(s[0]).toEqual({ rawIdx: 0, text: '제목 문장', firstTokenId: 'id_0_0' });
  });

  it('헤딩 마커를 렌더와 같은 규칙으로 벗긴다', () => {
    expect(cleanLineText('## 소제목')).toBe('소제목');
    expect(cleanLineText('  본문  ')).toBe('본문');
  });

  it('빈 그룹·빈 입력 안전', () => {
    expect(pickableSentences([], rawLines)).toEqual([]);
    expect(pickableSentences(null, null)).toEqual([]);
    expect(pickableSentences([{ rawIdx: 0, tokenIds: [] }], rawLines)).toEqual([]);
  });
});

describe('adjacentSentence', () => {
  const s = pickableSentences(lineGroups, rawLines);

  it('아래/위 한 문장씩, 경계 밖은 null(순환 없음 — 버튼 비활성 근거)', () => {
    expect(adjacentSentence(s, 1, 1)?.rawIdx).toBe(4);
    expect(adjacentSentence(s, 1, -1)?.rawIdx).toBe(0);
    expect(adjacentSentence(s, 0, -1)).toBeNull();
    expect(adjacentSentence(s, 4, 1)).toBeNull();
  });

  it('지정 가능 목록을 건너뛴다 — 막대 없는 줄(rawIdx 3)로는 절대 안 간다', () => {
    expect(adjacentSentence(s, 1, 1)?.rawIdx).not.toBe(3);
  });

  it('현재 지정이 목록에 없으면 방향 기준 가장 가까운 문장으로 회복', () => {
    expect(adjacentSentence(s, 2, 1)?.rawIdx).toBe(4);
    expect(adjacentSentence(s, 2, -1)?.rawIdx).toBe(1);
    expect(adjacentSentence([], 1, 1)).toBeNull();
  });
});

// 계약: 문장 단위 지정(오너 선택 2026-10-24 「전부 문장 단위」) — 단어 탭·¦·▲▼·[문장] 탭·듣기·저장 출처가
// 원문 한 줄(문단) 전체가 아니라 마침표까지 한 문장을 단위로 쓴다. 열쇠 = 「줄:순번」.
describe('pickableSentenceUnits', () => {
  const para = '今天天气很好。我们去公园吧！你觉得怎么样？';
  const words = ['今天', '天气', '很', '好', '。', '我们', '去', '公园', '吧', '！', '你', '觉得', '怎么样', '？'];
  const dictionary = Object.fromEntries(words.map((text, i) => [`t${i}`, { text }]));
  const ids = words.map((_, i) => `t${i}`);

  it('한 줄 문단을 마침표마다 끊어 문장 셋으로 — 문장부호 토큰은 앞 문장에 붙는다', () => {
    const units = pickableSentenceUnits([{ rawIdx: 0, tokenIds: ids }], [para], { dictionary, language: 'Chinese' });
    expect(units.map((u) => u.key)).toEqual(['0:0', '0:1', '0:2']);
    expect(units.map((u) => u.text)).toEqual(['今天天气很好。', '我们去公园吧！', '你觉得怎么样？']);
    expect(units[0].tokenIds).toEqual(['t0', 't1', 't2', 't3', 't4']);
    expect(units[1].firstTokenId).toBe('t5');
    expect(units.every((u) => u.rawIdx === 0 && u.lineText === para)).toBe(true);
  });

  it('2자 미만 조각은 앞 문장에 합친다 — 막대(¦) 임계와 같은 하한', () => {
    const line = '好。啊。我们走吧。';
    const dict = { a: { text: '好' }, b: { text: '。' }, c: { text: '啊' }, d: { text: '。' }, e: { text: '我们' }, f: { text: '走' }, g: { text: '吧' }, h: { text: '。' } };
    const units = pickableSentenceUnits([{ rawIdx: 2, tokenIds: Object.keys(dict) }], ['', '', line], { dictionary: dict, language: 'Chinese' });
    expect(units.every((u) => u.text.length >= 2)).toBe(true);
    expect(units.flatMap((u) => u.tokenIds)).toEqual(Object.keys(dict));
    expect(units.at(-1).text).toBe('我们走吧。');
  });

  it('토큰 위치를 못 찾으면 줄 전체를 한 문장으로 — 예전 동작으로 안전 폴백', () => {
    const units = pickableSentenceUnits([{ rawIdx: 0, tokenIds: ['x', 'y'] }], [para], { dictionary: {}, language: 'Chinese' });
    expect(units).toEqual([{ key: '0:0', rawIdx: 0, text: para, lineText: para, firstTokenId: 'x', tokenIds: ['x', 'y'] }]);
  });

  it('모든 토큰이 정확히 한 문장에 속한다(빠짐·중복 없음)', () => {
    const units = pickableSentenceUnits([{ rawIdx: 0, tokenIds: ids }], [para], { dictionary, language: 'Chinese' });
    expect(units.flatMap((u) => u.tokenIds)).toEqual(ids);
  });

  it('열쇠 기반 ▲▼ — 같은 줄 안 문장 사이를 오가고, 사라진 열쇠는 순서로 회복', () => {
    const units = pickableSentenceUnits([{ rawIdx: 0, tokenIds: ids }, { rawIdx: 2, tokenIds: ['z'] }], [para, '', '再见。'], { dictionary: { ...dictionary, z: { text: '再见' } }, language: 'Chinese' });
    expect(adjacentSentence(units, '0:0', 1).key).toBe('0:1');
    expect(adjacentSentence(units, '0:2', 1).key).toBe('2:0');
    expect(adjacentSentence(units, '0:0', -1)).toBeNull();
    expect(adjacentSentence(units, '1:0', 1).key).toBe('2:0');
    expect(adjacentSentence(units, '1:0', -1).key).toBe('0:2');
    // 예전 줄 번호(숫자) = 그 줄의 첫 문장 위치
    expect(adjacentSentence(units, 1, -1).key).toBe('0:2');
  });
});
