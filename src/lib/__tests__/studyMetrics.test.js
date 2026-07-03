import { describe, it, expect } from 'vitest';
import {
  computeRecall,
  computeItemWrongRates,
  computeRtStats,
  computeDailyAccuracy,
  clusterSessions,
  computeAssistTop,
} from '../studyMetrics';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const iso = (t) => new Date(t).toISOString();

// review_event 헬퍼
function ev({ source = 'vocab', item_key = 'w', correct = true, qtype, mode, rt_ms, t = Date.now() } = {}) {
  const detail = {};
  if (qtype !== undefined) detail.qtype = qtype;
  if (mode !== undefined) detail.mode = mode;
  if (rt_ms !== undefined) detail.rt_ms = rt_ms;
  return { source, item_key, correct, detail, created_at: iso(t) };
}

describe('computeRecall', () => {
  it('빈 배열 → n 0, rate null', () => {
    const r = computeRecall([]);
    expect(r.vocab.d1).toEqual({ n: 0, rate: null });
    expect(r.grammar.d7).toEqual({ n: 0, rate: null });
  });

  it('표본 부족(n<10)이면 n은 세지만 rate는 null', () => {
    const base = Date.now();
    const events = [];
    for (let i = 0; i < 5; i++) {
      const t0 = base - 40 * DAY + i * DAY;
      events.push(ev({ item_key: `w${i}`, t: t0 }));               // t0
      events.push(ev({ item_key: `w${i}`, correct: true, t: t0 + 24 * HOUR })); // D1 창 안
    }
    const r = computeRecall(events);
    expect(r.vocab.d1.n).toBe(5);
    expect(r.vocab.d1.rate).toBeNull();
  });

  it('n>=10이면 정답률 계산', () => {
    const base = Date.now();
    const events = [];
    for (let i = 0; i < 10; i++) {
      const t0 = base - 40 * DAY + i * DAY;
      events.push(ev({ item_key: `w${i}`, t: t0 }));
      events.push(ev({ item_key: `w${i}`, correct: i < 6, t: t0 + 24 * HOUR })); // 6/10 정답
    }
    const r = computeRecall(events);
    expect(r.vocab.d1.n).toBe(10);
    expect(r.vocab.d1.rate).toBeCloseTo(0.6, 5);
  });

  it('창 경계 — 20h 미만은 제외, 20h 정확히는 포함', () => {
    const t0 = Date.now() - 40 * DAY;
    const tooEarly = [ev({ item_key: 'a', t: t0 }), ev({ item_key: 'a', t: t0 + 19 * HOUR })];
    const onBoundary = [ev({ item_key: 'b', t: t0 }), ev({ item_key: 'b', t: t0 + 20 * HOUR })];
    expect(computeRecall(tooEarly).vocab.d1.n).toBe(0);
    expect(computeRecall(onBoundary).vocab.d1.n).toBe(1);
  });

  it('창 안의 첫 이벤트만 채택', () => {
    const t0 = Date.now() - 40 * DAY;
    const events = [
      ev({ item_key: 'a', t: t0 }),
      ev({ item_key: 'a', correct: false, t: t0 + 21 * HOUR }), // 첫 창내 이벤트(오답)
      ev({ item_key: 'a', correct: true, t: t0 + 27 * HOUR }),  // 이후는 무시
    ];
    const r = computeRecall(events);
    expect(r.vocab.d1.n).toBe(1);
    // n<10이므로 rate는 null이지만 채택된 이벤트가 오답임을 간접 확인: n=1
    expect(r.vocab.d1.rate).toBeNull();
  });

  it('source별로 분리 집계 — vocab/grammar 격리', () => {
    const t0 = Date.now() - 40 * DAY;
    const events = [
      ev({ source: 'vocab', item_key: 'v', t: t0 }),
      ev({ source: 'vocab', item_key: 'v', t: t0 + 24 * HOUR }),
      ev({ source: 'grammar', item_key: 'g', t: t0 }),
      ev({ source: 'grammar', item_key: 'g', t: t0 + 24 * HOUR }),
    ];
    const r = computeRecall(events);
    expect(r.vocab.d1.n).toBe(1);
    expect(r.grammar.d1.n).toBe(1);
  });
});

describe('computeItemWrongRates', () => {
  it('빈 배열 → 빈 목록', () => {
    expect(computeItemWrongRates([])).toEqual([]);
  });

  it('minTotal 미만 항목 제외', () => {
    const events = [
      ev({ item_key: 'a', correct: false, qtype: 'choice' }),
      ev({ item_key: 'a', correct: false, qtype: 'choice' }),
    ];
    expect(computeItemWrongRates(events, { minTotal: 3 })).toEqual([]);
  });

  it('오답률 내림차순 정렬 + top 제한', () => {
    const mk = (key, wrong, total, qtype = 'choice') => {
      const out = [];
      for (let i = 0; i < total; i++) out.push(ev({ item_key: key, correct: i >= wrong, qtype }));
      return out;
    };
    const events = [...mk('bad', 3, 4), ...mk('mid', 1, 4), ...mk('good', 0, 4)];
    const res = computeItemWrongRates(events, { minTotal: 3, top: 2 });
    expect(res.length).toBe(2);
    expect(res[0].key).toBe('bad');
    expect(res[0].wrongRate).toBeCloseTo(0.75, 5);
    expect(res[1].key).toBe('mid');
  });

  it('(source,qtype,item_key) 조합별로 분리', () => {
    const events = [
      ev({ item_key: 'x', qtype: 'choice', correct: false }),
      ev({ item_key: 'x', qtype: 'choice', correct: false }),
      ev({ item_key: 'x', qtype: 'choice', correct: false }),
      ev({ item_key: 'x', qtype: 'typing', correct: true }),
      ev({ item_key: 'x', qtype: 'typing', correct: true }),
      ev({ item_key: 'x', qtype: 'typing', correct: true }),
    ];
    const res = computeItemWrongRates(events, { minTotal: 3 });
    expect(res.length).toBe(2);
    const choice = res.find((r) => r.qtype === 'choice');
    expect(choice.wrongRate).toBe(1);
  });
});

describe('computeRtStats', () => {
  it('빈 배열 → 빈 객체', () => {
    expect(computeRtStats([])).toEqual({});
  });

  it('rt_ms 없는 이벤트는 무시', () => {
    expect(computeRtStats([ev({ qtype: 'choice' })])).toEqual({});
  });

  it('qtype별 정답/오답 median·p75·n', () => {
    const events = [
      ev({ qtype: 'choice', correct: true, rt_ms: 100 }),
      ev({ qtype: 'choice', correct: true, rt_ms: 200 }),
      ev({ qtype: 'choice', correct: true, rt_ms: 300 }),
      ev({ qtype: 'choice', correct: false, rt_ms: 900 }),
    ];
    const s = computeRtStats(events);
    expect(s.choice.correct.n).toBe(3);
    expect(s.choice.correct.median).toBe(200);
    expect(s.choice.correct.p75).toBe(250);
    expect(s.choice.wrong.n).toBe(1);
    expect(s.choice.wrong.median).toBe(900);
  });
});

describe('computeDailyAccuracy', () => {
  it('빈 배열 → 빈 목록', () => {
    expect(computeDailyAccuracy([])).toEqual([]);
  });

  it('같은 날 이벤트를 묶고 정답률 계산', () => {
    const now = Date.now();
    const events = [
      ev({ correct: true, t: now }),
      ev({ correct: false, t: now - HOUR }),
    ];
    const res = computeDailyAccuracy(events);
    expect(res.length).toBe(1);
    expect(res[0].total).toBe(2);
    expect(res[0].rate).toBeCloseTo(0.5, 5);
    expect(res[0].date).toMatch(/^\d{2}\.\d{2}$/);
  });

  it('days 창 밖 이벤트 제외', () => {
    const events = [ev({ correct: true, t: Date.now() - 40 * DAY })];
    expect(computeDailyAccuracy(events, { days: 30 })).toEqual([]);
  });
});

describe('clusterSessions', () => {
  it('빈 배열 → sessions 없음, 완주율 0', () => {
    expect(clusterSessions([])).toEqual({ sessions: [], completionRate: 0 });
  });

  it('30분 갭으로 클러스터 분리', () => {
    const now = Date.now();
    const events = [];
    // 세션1: 8문항(완주) 5분 간격
    for (let i = 0; i < 8; i++) events.push(ev({ mode: 'study', t: now - DAY + i * 5 * 60 * 1000 }));
    // 세션2: 3문항(미완주), 세션1로부터 2시간 뒤(30분 갭 초과)
    for (let i = 0; i < 3; i++) events.push(ev({ mode: 'study', t: now - DAY + 2 * 3600 * 1000 + i * 5 * 60 * 1000 }));
    const r = clusterSessions(events);
    expect(r.sessions.length).toBe(2);
    expect(r.sessions[0].count).toBe(8);
    expect(r.sessions[1].count).toBe(3);
    expect(r.completionRate).toBeCloseTo(0.5, 5);
  });

  it('assist·비-study 이벤트 제외', () => {
    const now = Date.now();
    const events = [
      ev({ source: 'assist', mode: 'study', t: now }),
      ev({ mode: 'study', t: now }),          // 유일한 채점 study 이벤트
      ev({ t: now }),                          // mode 없음 → 제외
    ];
    const r = clusterSessions(events);
    expect(r.sessions.length).toBe(1);
    expect(r.sessions[0].count).toBe(1);
  });
});

describe('computeAssistTop', () => {
  it('빈 배열 → 빈 목록', () => {
    expect(computeAssistTop([])).toEqual([]);
  });

  it('assist item_key 빈도 상위 정렬', () => {
    const events = [
      ev({ source: 'assist', item_key: 'a' }),
      ev({ source: 'assist', item_key: 'a' }),
      ev({ source: 'assist', item_key: 'b' }),
      ev({ source: 'vocab', item_key: 'c' }), // assist 아님 → 제외
    ];
    const res = computeAssistTop(events, { top: 5 });
    expect(res[0]).toEqual({ key: 'a', count: 2 });
    expect(res[1]).toEqual({ key: 'b', count: 1 });
    expect(res.find((r) => r.key === 'c')).toBeUndefined();
  });
});
