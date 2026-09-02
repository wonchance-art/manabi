import { describe, expect, it } from 'vitest';
import { pickedRangeOf } from '../headwordPick';

/** 계약(R R2): 기본형 표제어 안 탭 구간 — 포함이면 그 자리, 아니면 공통 접두, 아니면 없음. 억지 매칭 금지. */
describe('pickedRangeOf — 기본형 표제어 안 탭한 구간', () => {
  it('이합사 조각: V(道)·O(歉) 각각 자기 자리', () => {
    expect(pickedRangeOf('道歉', '道')).toEqual([0, 1]);
    expect(pickedRangeOf('道歉', '歉')).toEqual([1, 2]);
  });
  it('활용형: 사전형의 접두 구간(食べた ↔ 食べる → 食べ)', () => {
    expect(pickedRangeOf('食べる', '食べた')).toEqual([0, 2]);
  });
  it('음편: 공통 접두 한 글자만(行った ↔ 行く → 行)', () => {
    expect(pickedRangeOf('行く', '行った')).toEqual([0, 1]);
  });
  it('겹치는 글자가 없으면 강조 없음(억지 매칭 금지)', () => {
    expect(pickedRangeOf('来る', '来た')).toEqual([0, 1]);
    expect(pickedRangeOf('する', 'した')).toBeNull(); // す≠し — 불규칙 활용은 강조하지 않는다
    expect(pickedRangeOf('道歉', '谢')).toBeNull();
    expect(pickedRangeOf('', '道')).toBeNull();
    expect(pickedRangeOf('道歉', '')).toBeNull();
  });
  it('코드포인트 단위 — 서러게이트 쌍 한자 뒤의 자리가 밀리지 않는다', () => {
    expect(pickedRangeOf('𠮷野', '野')).toEqual([1, 2]);
  });
});
