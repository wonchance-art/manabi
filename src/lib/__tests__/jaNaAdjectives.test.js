// な형용사 표시(오너 승인 2026-11-06 KST ①②③) — 목록 · 판정 · 문맥 계약.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JA_NA_ADJECTIVES, isJaNaAdjective, jaNaNounUseAt, jaDisplayPos } from '../jaNaAdjectives.js';

describe('な형용사 목록', () => {
  it('정본 읽기 색인(jaYomiIndex)의 분류 na와 같다 — 따로 낡지 않게', () => {
    const index = JSON.parse(readFileSync(new URL('../data/jaYomiIndex.json', import.meta.url), 'utf8'));
    const na = new Set();
    for (const entries of Object.values(index)) for (const [word, , cls] of entries) if (cls === 'na') na.add(word);
    expect([...JA_NA_ADJECTIVES].sort()).toEqual([...na].sort());
  });
});

describe('isJaNaAdjective', () => {
  it('새 분석 표식(na_stem)은 목록 밖이어도 な형용사', () => {
    expect(isJaNaAdjective({ text: 'ささやか', pos: '명사', na_stem: true })).toBe(true);
  });
  it('지난 자료 · 단어장: 명사로 분석된 목록 단어를 보정', () => {
    expect(isJaNaAdjective({ text: '静か', base_form: '静か', pos: '명사' })).toBe(true);
    expect(isJaNaAdjective({ word_text: 'きれい', pos: '명사' })).toBe(true);
    expect(isJaNaAdjective({ word_text: '静か', pos: '' })).toBe(true);
  });
  it('목록 밖 · 다른 품사는 그대로', () => {
    expect(isJaNaAdjective({ word_text: '学校', pos: '명사' })).toBe(false);
    expect(isJaNaAdjective({ word_text: '静か', pos: '부사' })).toBe(false);
    expect(isJaNaAdjective(null)).toBe(false);
  });
});

describe('jaNaNounUseAt — 읽기 카드 문맥', () => {
  const dict = {
    id_0_0_x: { text: '自由', pos: '명사' }, id_0_1_x: { text: 'を', pos: '조사' },
    id_0_2_x: { text: '静か', pos: '명사' }, id_0_3_x: { text: 'な', pos: '조동사' },
    id_0_4_x: { text: '安全', pos: '명사' },
    id_1_0_x: { text: 'は', pos: '조사' },
  };
  const seq = Object.keys(dict);
  it('뒤가 を · は 같은 조사면 명사 쓰임', () => {
    expect(jaNaNounUseAt(seq, dict, 'id_0_0_x')).toBe(true);
  });
  it('뒤가 な(형용 활용)면 な형용사 쓰임', () => {
    expect(jaNaNounUseAt(seq, dict, 'id_0_2_x')).toBe(false);
  });
  it('줄 끝 — 다음 줄 첫 조사는 보지 않는다', () => {
    expect(jaNaNounUseAt(seq, dict, 'id_0_4_x')).toBe(false);
  });
  it('입력이 없으면 false', () => {
    expect(jaNaNounUseAt(null, dict, 'id_0_0_x')).toBe(false);
    expect(jaNaNounUseAt(seq, dict, 'missing')).toBe(false);
  });
});

describe('jaDisplayPos — 단어장 칩 · 복습', () => {
  it('일본어 목록 단어는 「な형용사」, 저장된 품사 칸은 바꾸지 않는다', () => {
    const v = { language: 'Japanese', word_text: '静か', pos: '명사' };
    expect(jaDisplayPos(v)).toBe('な형용사');
    expect(v.pos).toBe('명사');
  });
  it('다른 언어 · 다른 단어는 그대로', () => {
    expect(jaDisplayPos({ language: 'Chinese', word_text: '安静', pos: '형용사' })).toBe('형용사');
    expect(jaDisplayPos({ language: 'Japanese', word_text: '学校', pos: '명사' })).toBe('명사');
  });
});
