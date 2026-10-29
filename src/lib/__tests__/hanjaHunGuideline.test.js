import { describe, expect, it } from 'vitest';
import { hunLabelEm } from '../viewerHunRuby';
import { hanjaReadingsOf } from '../hanjaKo';
import koTable from '../data/hanjaKo.json';
import hunTable from '../data/hanjaHun.json';
import tradTable from '../data/hanjaTrad.json';
import hskLevels from '../data/zhHskLevel.json';

/**
 * 계약: 긴 훈 가이드라인(오너 2026-10-23 KST — 뷰어 훈음 정렬).
 * ① 자료가 먼저: 훈은 대표 훈 하나 · 괄호 풀이 0(쇠뇌(여러 개의…) → 쇠뇌). 표 전체에 건다.
 * ② HSK 1~6급 단어에 나오는 글자는 훈이 한글 5자 폭(5em) 이하 — 넘으면 scripts/hanja-curated.mjs HUN_MANUAL에
 *    같은 행의 대표 항목(어문회 대표훈 우선)을 더하고 표를 다시 만든다. 그보다 긴 훈(7~9급 · 희귀 글자)은
 *    화면 안전망(훈/음 두 줄 → 말줄임, 전체는 한자 창)이 받는다.
 */
const real = { koTable, hunTable, tradTable };
const HUN_MAX_EM = 5;

describe('긴 훈 가이드라인', () => {
  it('훈 표에 괄호 풀이가 없다', () => {
    expect(Object.entries(hunTable).filter(([, hun]) => /[()（）]/.test(hun))).toEqual([]);
  });
  it('HSK 1~6급 단어 글자의 훈은 5em 이하다', () => {
    const long = new Map();
    for (const [word, level] of Object.entries(hskLevels)) {
      if (!(level <= 6)) continue;
      for (const { ch, hun } of hanjaReadingsOf(word, real)) {
        if (hun && hunLabelEm(hun) > HUN_MAX_EM) long.set(ch, `${hun} (${word})`);
      }
    }
    expect([...long]).toEqual([]);
  });
});
