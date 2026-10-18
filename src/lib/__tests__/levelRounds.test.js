// 단어 목록 바퀴 답(LEVEL-ROUND-001) — 같은 날 규칙 · 마지막 답 · 대기 → 확정 · 읽기 페이지 · 활동 전용.
import { describe, expect, it } from 'vitest';
import {
  LEVEL_SOURCE, applyLevelAnswer, createLevelAnswerQueue, fetchLevelAnswers, isSameDayAnswer, lastLevelAnswers,
  levelAnswerEvent, levelAnswerOf, levelCancelEvent,
} from '../levelRounds.js';
import { ACTIVITY_ONLY_SOURCES, isGradedReviewEvent } from '../weeklyReport.js';
import fs from 'node:fs';

const KST = (s) => Date.parse(`${s}+09:00`);

describe('같은 날 규칙(sameDay)', () => {
  const answers = new Map([['爸爸|word', { correct: false, at: KST('2026-10-19T08:00:00') }], ['妈妈|word', { correct: true, at: KST('2026-10-19T08:00:00') }]]);
  it('같은 KST 날 다른 보기에서 답한 단어 = sameDay, 같은 보기 · 다른 단어 · 어제는 아니다', () => {
    expect(isSameDayAnswer(answers, '爸爸', 'sentence', KST('2026-10-19T23:59:00'))).toBe(true);
    expect(isSameDayAnswer(answers, '爸爸', 'word', KST('2026-10-19T09:00:00'))).toBe(false);
    expect(isSameDayAnswer(answers, '哥哥', 'sentence', KST('2026-10-19T09:00:00'))).toBe(false);
    expect(isSameDayAnswer(answers, '爸爸', 'sentence', KST('2026-10-20T00:00:00'))).toBe(false); // 자정(KST)을 넘으면 다른 날
  });
  it('날짜 경계는 KST — UTC 자정이 아니다', () => {
    const late = new Map([['爸爸|word', { correct: false, at: KST('2026-10-19T08:30:00') }]]); // UTC 10-18 23:30
    expect(isSameDayAnswer(late, '爸爸', 'meaning', KST('2026-10-19T10:00:00'))).toBe(true); // UTC 10-19 01:00
  });
});

describe('마지막 답 · 취소', () => {
  const row = (item_key, view, correct, created_at, extra = {}) => ({ item_key, correct, created_at, detail: { level: 'h1', view, round: 1, ...extra } });
  it('단어 · 보기마다 가장 최신 줄만, 취소 줄이 최신이면 답 없음', () => {
    const map = lastLevelAnswers([
      row('爸爸', 'all', false, '2026-10-19T03:00:00Z', { cancel: true }),
      row('爸爸', 'word', true, '2026-10-19T02:00:00Z', { sameDay: true }),
      row('爸爸', 'all', true, '2026-10-19T01:00:00Z'),
      row('爸爸', 'word', false, '2026-10-18T01:00:00Z'),
    ]);
    expect(levelAnswerOf(map, '爸爸', 'all')).toBeNull();
    expect(levelAnswerOf(map, '爸爸', 'word')).toEqual({ correct: true, at: Date.parse('2026-10-19T02:00:00Z'), sameDay: true });
  });
  it('이벤트 모양 — source level, detail = { level, view, round, sameDay } · 취소는 cancel', () => {
    const at = Date.parse('2026-10-19T01:00:00Z');
    expect(levelAnswerEvent({ lang: 'zh', word: '爸爸', level: 'h1', view: 'word', correct: true, sameDay: true, at }))
      .toEqual({ lang: 'zh', source: 'level', item_key: '爸爸', correct: true, created_at: '2026-10-19T01:00:00.000Z', detail: { level: 'h1', view: 'word', round: 1, sameDay: true } });
    expect(levelCancelEvent({ lang: 'zh', word: '爸爸', level: 'h1', view: 'word', at }).detail).toEqual({ level: 'h1', view: 'word', round: 1, cancel: true });
  });
  it('화면 반영 — 답은 넣고 취소는 뺀다(원본은 그대로)', () => {
    const a = new Map();
    const b = applyLevelAnswer(a, '爸爸', 'all', { correct: true, at: 1, sameDay: false });
    expect(levelAnswerOf(b, '爸爸', 'all')?.correct).toBe(true);
    expect(a.size).toBe(0);
    expect(levelAnswerOf(applyLevelAnswer(b, '爸爸', 'all', null), '爸爸', 'all')).toBeNull();
  });
});

describe('대기 → 확정(한자 탭과 같은 규칙)', () => {
  it('다른 카드의 답이 와야 앞의 답을 쓴다 · 같은 카드는 바꾸기만 · flush는 남은 하나', () => {
    const written = [];
    const q = createLevelAnswerQueue((e) => written.push(e.item_key + e.correct));
    q.answer('爸爸', 'all', { item_key: '爸爸', correct: true });
    q.answer('爸爸', 'all', { item_key: '爸爸', correct: false });
    expect(written).toEqual([]);
    q.answer('妈妈', 'all', { item_key: '妈妈', correct: true });
    expect(written).toEqual(['爸爸false']);
    q.flush();
    q.flush();
    expect(written).toEqual(['爸爸false', '妈妈true']);
  });
  it('대기 중 취소는 기록 0(true), 확정 뒤 취소는 부르는 쪽이 취소 줄(false)', () => {
    const written = [];
    const q = createLevelAnswerQueue((e) => written.push(e));
    q.answer('爸爸', 'word', { item_key: '爸爸' });
    expect(q.cancel('爸爸', 'word')).toBe(true);
    q.flush();
    expect(written).toEqual([]);
    q.answer('爸爸', 'word', { item_key: '爸爸' });
    q.answer('妈妈', 'word', { item_key: '妈妈' });
    expect(q.cancel('爸爸', 'word')).toBe(false);
    expect(q.cancel('妈妈', 'sentence')).toBe(false); // 같은 단어라도 다른 보기면 다른 답
  });
});

describe('읽기 — 이 레벨 줄만, 1,000행 페이지 끝까지', () => {
  it('source level · lang · detail->>level · 상한 시각으로 좁히고, 꽉 찬 페이지면 다음 페이지', async () => {
    const calls = [];
    const pages = [Array.from({ length: 2 }, (_, i) => ({ id: i })), [{ id: 9 }]];
    const client = { from(t) {
      const q = { t, eqs: [] };
      const chain = { select: () => chain, eq: (k, v) => { q.eqs.push([k, v]); return chain; }, lte: (k, v) => { q.lte = [k, v]; return chain; },
        order: () => chain, range: (a, b) => { q.range = [a, b]; calls.push(q); return Promise.resolve({ data: pages[calls.length - 1], error: null }); } };
      return chain;
    } };
    const rows = await fetchLevelAnswers(client, 'u1', { lang: 'zh', level: 'h1', page: 2, untilIso: 'T' });
    expect(rows.map((r) => r.id)).toEqual([0, 1, 9]);
    expect(calls.map((c) => c.range)).toEqual([[0, 1], [2, 3]]);
    expect(calls[0].eqs).toEqual([['user_id', 'u1'], ['source', 'level'], ['lang', 'zh'], ['detail->>level', 'h1']]);
    expect(calls[0].lte).toEqual(['created_at', 'T']);
  });
  it('오류면 reject — 빈 답으로 그리지 않는다', async () => {
    const chain = { select: () => chain, eq: () => chain, lte: () => chain, order: () => chain, range: () => Promise.resolve({ data: null, error: new Error('x') }) };
    await expect(fetchLevelAnswers({ from: () => chain }, 'u1', { lang: 'zh', level: 'h1' })).rejects.toThrow('x');
  });
});

describe('활동 전용 — 정답률 · 다이얼 · 산출에 넣지 않는다', () => {
  it('ACTIVITY_ONLY_SOURCES에 level · 채점 판정에서 제외', () => {
    expect(LEVEL_SOURCE).toBe('level');
    expect(ACTIVITY_ONLY_SOURCES.has('level')).toBe(true);
    expect(isGradedReviewEvent({ source: 'level', correct: true })).toBe(false);
  });
  it('오늘 학습 재료(최근 400행)는 활동 전용 출처를 빼고 읽는다 — 목록 O · X 수백 건이 채점 기록을 밀어내지 않게', () => {
    const src = fs.readFileSync('src/lib/studyMaterials.js', 'utf8');
    expect(src).toContain(".not('source', 'in', `(${[...ACTIVITY_ONLY_SOURCES].join(',')})`)");
  });
  it('바퀴 답은 FSRS를 건드리지 않는다 — 쓰기는 logReviewEvents 한 길, 저장 클라이언트 · 복습 채점 부품 없음', () => {
    const hook = fs.readFileSync('src/lib/useLevelAnswers.js', 'utf8');
    expect(hook).toContain("import { logReviewEvents } from './reviewEvents';");
    expect(hook).not.toMatch(/fsrs|persistVocabGrade|user_vocabulary/i);
  });
});
