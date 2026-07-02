import { describe, it, expect } from 'vitest';
import { qtypeRungLevel, computeRung, computeEwma, dialFromEwma, vocabTypeForRung } from '../skillRung';

// 정답/오답 이벤트 헬퍼
const ok = qtype => ({ qtype, correct: true });
const no = qtype => ({ qtype, correct: false });

describe('qtypeRungLevel', () => {
  it('qtype을 사다리 레벨로 매핑', () => {
    expect(qtypeRungLevel('choice')).toBe(1);
    expect(qtypeRungLevel('cloze')).toBe(2);
    expect(qtypeRungLevel('typing')).toBe(2);
    expect(qtypeRungLevel('listening')).toBe(3);
    expect(qtypeRungLevel('produce')).toBe(4);
  });
  it('그 외/누락은 보수적으로 choice(1)', () => {
    expect(qtypeRungLevel('order')).toBe(1);
    expect(qtypeRungLevel(undefined)).toBe(1);
    expect(qtypeRungLevel(null)).toBe(1);
  });
});

describe('computeRung', () => {
  it('이벤트가 없으면 0(노출 전)', () => {
    expect(computeRung([])).toBe(0);
    expect(computeRung(null)).toBe(0);
  });

  it('choice 2연속 정답 → rung 2', () => {
    expect(computeRung([ok('choice'), ok('choice')])).toBe(2);
  });

  it('rung 2에서 typing 2연속 정답 → rung 3', () => {
    // choice×2 → r2, typing×2 → r3
    expect(computeRung([ok('choice'), ok('choice'), ok('typing'), ok('typing')])).toBe(3);
  });

  it('2연속 실패로 강등', () => {
    // choice×2 → r2, typing×2 정답 → r3, listening 2연속 실패 → r2
    const events = [ok('choice'), ok('choice'), ok('typing'), ok('typing'), no('listening'), no('listening')];
    expect(computeRung(events)).toBe(2);
  });

  it('강등은 최소 1까지만', () => {
    expect(computeRung([no('choice'), no('choice'), no('choice'), no('choice')])).toBe(1);
  });

  it('너무 쉬운 성공은 승급 안 됨', () => {
    // r1에서 choice 정답으로 r? — choice(q1)>=r1 이므로 승급함. 승급 후 쉬운 성공 검증:
    // choice×2 → r2. 이후 choice(q1<r2) 정답 2번은 승급 크레딧 없음 → r2 유지.
    expect(computeRung([ok('choice'), ok('choice'), ok('choice'), ok('choice')])).toBe(2);
  });

  it('과난도 실패는 강등 안 됨', () => {
    // r1에서 listening(q3>r1) 오답 2번 — 강등 크레딧 없음 → r1 유지.
    expect(computeRung([no('listening'), no('listening')])).toBe(1);
  });

  it('qtype 누락 이벤트는 choice(1) 취급', () => {
    // qtype 없는 정답 2번 = choice 2연속 → r2
    expect(computeRung([{ correct: true }, { correct: true }])).toBe(2);
  });
});

describe('computeEwma', () => {
  it('이벤트 없으면 null', () => {
    expect(computeEwma([])).toBeNull();
    expect(computeEwma(null)).toBeNull();
  });
  it('전부 정답이면 1에 수렴', () => {
    const events = Array.from({ length: 30 }, () => ({ correct: true }));
    expect(computeEwma(events)).toBeCloseTo(1, 5);
  });
  it('전부 오답이면 0에 수렴', () => {
    const events = Array.from({ length: 30 }, () => ({ correct: false }));
    expect(computeEwma(events)).toBeCloseTo(0, 5);
  });
});

describe('dialFromEwma', () => {
  it('표본 부족이면 normal', () => {
    expect(dialFromEwma(0.99, 20, 5)).toBe('normal');
    expect(dialFromEwma(null, 20, 40)).toBe('normal');
  });
  it('고정확도(>0.9)면 hard', () => {
    expect(dialFromEwma(0.95, 20, 40)).toBe('hard');
  });
  it('저정확도(<0.75)면 easy', () => {
    expect(dialFromEwma(0.6, 20, 40)).toBe('easy');
  });
  it('중간이면 normal', () => {
    expect(dialFromEwma(0.8, 20, 40)).toBe('normal');
  });
});

describe('vocabTypeForRung', () => {
  it('기본 매핑', () => {
    expect(vocabTypeForRung(0)).toBe('vocab-choice');
    expect(vocabTypeForRung(1)).toBe('vocab-choice');
    expect(vocabTypeForRung(2)).toBe('vocab-typing');
    expect(vocabTypeForRung(3)).toBe('vocab-listening');
    expect(vocabTypeForRung(4)).toBe('vocab-listening');
  });
  it('easy는 무조건 choice', () => {
    expect(vocabTypeForRung(2, 'easy')).toBe('vocab-choice');
    expect(vocabTypeForRung(3, 'easy')).toBe('vocab-choice');
  });
  it('hard는 한 단계 상향(listening은 유지)', () => {
    expect(vocabTypeForRung(1, 'hard')).toBe('vocab-typing');
    expect(vocabTypeForRung(2, 'hard')).toBe('vocab-listening');
    expect(vocabTypeForRung(3, 'hard')).toBe('vocab-listening');
  });
});
