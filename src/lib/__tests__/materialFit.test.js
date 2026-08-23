import { describe, expect, it } from 'vitest';
import { FIT_MIN_TYPES, fitBand, fitSortRank, materialContentWords, materialFit } from '../materialFit.js';

// 🈁 자료 맞춤도 엔진(rfc-material-fit R1) — 결정적 커버리지·밴드 계약.

function pj(tokens) {
  const dictionary = {};
  const sequence = [];
  tokens.forEach((t, i) => {
    const id = `t${i}`;
    dictionary[id] = t;
    sequence.push(id);
  });
  return { sequence, dictionary };
}

describe('materialContentWords — 고유 내용어(types)', () => {
  it('base_form 우선 키로 첫 등장 순서를 유지하며 중복·기능어를 거른다', () => {
    const words = materialContentWords(pj([
      { text: '食べます', base_form: '食べる', pos: '동사' },
      { text: '食べた', base_form: '食べる', pos: '동사' },   // 같은 타입 — 1회
      { text: 'を', base_form: 'を', pos: '조사' },            // 기능어 — 제외
      { text: '、', base_form: '、', pos: '기호' },            // 기호 — 제외
      { text: '3', base_form: '3', pos: '수사' },              // 수사 — 제외
      { text: '\n', pos: '개행' },                             // 개행 — 제외
      { text: 'ラーメン', base_form: 'ラーメン', pos: '명사' },
      { text: '謎', pos: null },                               // pos null 내용어 — 포함(base 없음 → text 키)
    ]));
    expect(words.map((w) => w.key)).toEqual(['食べる', 'ラーメン', '謎']);
  });

  it('빈·깨진 입력은 빈 배열(안전)', () => {
    expect(materialContentWords(null)).toEqual([]);
    expect(materialContentWords({})).toEqual([]);
    expect(materialContentWords({ sequence: ['x'], dictionary: {} })).toEqual([]);
  });
});

describe('materialFit — 커버리지(뷰어 isSaved 관용구 대조)', () => {
  const json = pj([
    { text: '食べます', base_form: '食べる', pos: '동사' },
    { text: 'ラーメン', base_form: 'ラーメン', pos: '명사' },
    { text: '約束', base_form: '約束', pos: '명사' },
    { text: '謎の言葉', base_form: '謎の言葉', pos: '명사' },
  ]);

  it('surfaces(표면형)·bases(기본형) 어느 쪽으로든 잡히면 아는 말', () => {
    const fit = materialFit(json, {
      surfaces: new Set(['食べます']),     // 표면형으로 담김
      bases: new Set(['ラーメン']),        // 기본형으로 담김
    });
    expect(fit).toEqual({ total: 4, known: 2, unknown: 2, coverage: 0.5 });
  });

  it('저장어 없음·내용어 없음의 경계', () => {
    expect(materialFit(json, { surfaces: new Set(), bases: new Set() }).known).toBe(0);
    expect(materialFit(json, null).known).toBe(0);
    expect(materialFit(pj([{ text: 'を', pos: '조사' }]), null)).toEqual({
      total: 0, known: 0, unknown: 0, coverage: null,
    });
  });
});

describe('fitBand·fitSortRank — i+1 밴드', () => {
  it('임계 핀: ≥0.95 comfort · ≥0.90 fit · ≥0.75 stretch · 미만 hard', () => {
    expect(fitBand(0.96, 50)).toBe('comfort');
    expect(fitBand(0.95, 50)).toBe('comfort');
    expect(fitBand(0.92, 50)).toBe('fit');
    expect(fitBand(0.9, 50)).toBe('fit');
    expect(fitBand(0.8, 50)).toBe('stretch');
    expect(fitBand(0.5, 50)).toBe('hard');
  });

  it('표본 부족·계산 불가는 null(무표기) — 최소 표본은 저작 상수', () => {
    expect(fitBand(0.92, FIT_MIN_TYPES - 1)).toBeNull();
    expect(fitBand(0.92, FIT_MIN_TYPES)).toBe('fit');
    expect(fitBand(null, 100)).toBeNull();
  });

  it('정렬 랭크: fit → stretch → comfort → hard → 밴드 없음', () => {
    expect(['fit', 'stretch', 'comfort', 'hard', null].map(fitSortRank)).toEqual([0, 1, 2, 3, 4]);
  });
});
