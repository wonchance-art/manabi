import { describe, it, expect } from 'vitest';
import { qtypeRungLevel, computeRung, computeEwma, dialFromEwma, vocabTypeForRung, computeWeakness, sentenceIncludesWord } from '../skillRung';

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

  // 비대칭 신뢰: 플래시(자기채점) 성공은 무시, 오답 자인만 강등 신호
  it('flash 정답 2연속 → rung 불변(승급 크레딧 0)', () => {
    // 노출 전(r 시작 1) 상태에서 flash 정답만으로는 승급 없음 → r1 유지
    expect(computeRung([ok('flash'), ok('flash')])).toBe(1);
    // r2까지 올린 뒤 flash 정답 2번 — 승급 안 됨 → r2 유지
    expect(computeRung([ok('choice'), ok('choice'), ok('flash'), ok('flash')])).toBe(2);
  });

  it('flash 오답 2연속 → 강등', () => {
    // choice×2 → r2, flash 오답 2연속 → r1
    expect(computeRung([ok('choice'), ok('choice'), no('flash'), no('flash')])).toBe(1);
  });

  it('flash 정답은 진행 중인 downStreak을 리셋하지 않음', () => {
    // choice×2 → r2. choice 오답1 + flash 정답 + choice 오답1 → downStreak 유지되어 강등 → r1
    const events = [ok('choice'), ok('choice'), no('choice'), ok('flash'), no('choice')];
    expect(computeRung(events)).toBe(1);
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

describe('computeWeakness', () => {
  const ev = (source, item_key, correct, agoDays = 0) => ({
    source, item_key, correct,
    created_at: new Date(Date.now() - agoDays * 86400000).toISOString(),
  });

  it('(source,item_key)별 wrong/total 집계 · total<2 제외', () => {
    const events = [
      ev('vocab', 'A', false), ev('vocab', 'A', true),      // A: wrong1/total2
      ev('vocab', 'B', false),                               // B: total1 → 제외
      ev('grammar', 'C', false), ev('grammar', 'C', false), // C: wrong2/total2
    ];
    const out = computeWeakness(events, {});
    const keys = out.map(o => `${o.source}:${o.item_key}`);
    expect(keys).toContain('vocab:A');
    expect(keys).toContain('grammar:C');
    expect(keys).not.toContain('vocab:B');
    expect(out.find(o => o.item_key === 'A')).toMatchObject({ wrong: 1, total: 2 });
  });

  it('오답률·표본 가중으로 score 내림차순 정렬', () => {
    // C: 2/2·ln3 > A: 1/2·ln3
    const events = [
      ev('vocab', 'A', false), ev('vocab', 'A', true),
      ev('grammar', 'C', false), ev('grammar', 'C', false),
    ];
    const out = computeWeakness(events, {});
    expect(out[0].item_key).toBe('C');
    expect(out[1].item_key).toBe('A');
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  it('sinceMs 이전 이벤트는 제외', () => {
    const events = [
      ev('vocab', 'A', false, 20), ev('vocab', 'A', false, 20), // 20일 전
      ev('vocab', 'B', false, 1), ev('vocab', 'B', false, 1),   // 1일 전
    ];
    const out = computeWeakness(events, { sinceMs: Date.now() - 14 * 86400000 });
    const keys = out.map(o => o.item_key);
    expect(keys).toContain('B');
    expect(keys).not.toContain('A');
  });

  it('cap으로 상위 N개만', () => {
    const events = [];
    for (const k of ['A', 'B', 'C', 'D']) events.push(ev('vocab', k, false), ev('vocab', k, false));
    expect(computeWeakness(events, { cap: 2 })).toHaveLength(2);
  });

  it('source·item_key 없는 이벤트 무시 · 빈 입력 안전', () => {
    expect(computeWeakness([], {})).toEqual([]);
    expect(computeWeakness(null)).toEqual([]);
    expect(computeWeakness([{ correct: false }], {})).toEqual([]);
  });
});

describe('sentenceIncludesWord', () => {
  it('ZH — 정확 부분문자열', () => {
    expect(sentenceIncludesWord('我今天很高兴', '高兴', 'zh')).toBe(true);
    expect(sentenceIncludesWord('我今天很好', '高兴', 'zh')).toBe(false);
  });

  it('EN — 소문자화 + 단어 경계', () => {
    expect(sentenceIncludesWord('I made a Promise today', 'promise', 'en')).toBe(true);
    // 경계 없는 부분일치는 불인정 (promise ≠ promised의 부분문자열로 오탐하지 않음)
    expect(sentenceIncludesWord('They promised me', 'promise', 'en')).toBe(false);
    expect(sentenceIncludesWord('a compromise here', 'promise', 'en')).toBe(false);
    // 문장 끝/문두 경계
    expect(sentenceIncludesWord('Promise', 'promise', 'en')).toBe(true);
    expect(sentenceIncludesWord('It is a promise.', 'promise', 'en')).toBe(true);
  });

  it('FR — 액센트 문자 단어 경계', () => {
    expect(sentenceIncludesWord('je vais au café', 'café', 'fr')).toBe(true);
    expect(sentenceIncludesWord('une idée géniale', 'idée', 'fr')).toBe(true);
    expect(sentenceIncludesWord('cafétéria ouverte', 'café', 'fr')).toBe(false);
  });

  it('JA — 정확 부분문자열', () => {
    expect(sentenceIncludesWord('私は約束を守る', '約束', 'ja')).toBe(true);
    expect(sentenceIncludesWord('私は行く', '約束', 'ja')).toBe(false);
  });

  it('JA — 활용형은 어간 휴리스틱으로 매칭', () => {
    // 食べる(사전형)가 食べた(과거)/食べて(테형)로 활용 — 어간 食べ로 매칭
    expect(sentenceIncludesWord('昨日ラーメンを食べた', '食べる', 'ja')).toBe(true);
    expect(sentenceIncludesWord('パンを食べています', '食べる', 'ja')).toBe(true);
    // 관계 없는 문장은 어간으로도 안 잡힘
    expect(sentenceIncludesWord('水を飲んだ', '食べる', 'ja')).toBe(false);
  });

  it('JA — 어간이 2자 미만이면 휴리스틱 미적용', () => {
    // 見る(2자) → 어간 見(1자) < 2자라 휴리스틱 미적용, 정확 매칭만
    expect(sentenceIncludesWord('映画を見た', '見る', 'ja')).toBe(false);
    expect(sentenceIncludesWord('映画を見る', '見る', 'ja')).toBe(true);
  });

  it('빈 입력·누락 안전', () => {
    expect(sentenceIncludesWord('', '約束', 'ja')).toBe(false);
    expect(sentenceIncludesWord('私は約束', '', 'ja')).toBe(false);
    expect(sentenceIncludesWord('hello world', 'world')).toBe(true); // langCode 누락 → 부분문자열
  });
});

// P1 배선 봉합 — produce 이벤트가 어휘 rung 사다리 상단(4)에 반영되는지.
describe('produce → rung 배선', () => {
  it('rung 3에서 produce 2연속 성공 → rung 4', () => {
    // choice×2 → r2, typing×2 → r3, produce×2(q4>=r3) → r4
    const events = [ok('choice'), ok('choice'), ok('typing'), ok('typing'), ok('produce'), ok('produce')];
    expect(computeRung(events)).toBe(4);
  });

  it('rung 4는 상한 — produce 추가 성공에도 4 유지', () => {
    const events = [
      ok('choice'), ok('choice'), ok('typing'), ok('typing'),
      ok('produce'), ok('produce'), ok('produce'), ok('produce'),
    ];
    expect(computeRung(events)).toBe(4);
  });

  it('루브릭<2(correct:false)면 승급 안 됨', () => {
    // r3 도달 후 produce 오답(루브릭<2) 2연속 — 과난도 실패라 강등 크레딧 없음(q4>r3) → r3 유지, 승급도 없음
    const events = [ok('choice'), ok('choice'), ok('typing'), ok('typing'), no('produce'), no('produce')];
    expect(computeRung(events)).toBe(3);
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
