// 단어 페이지 네 영역 체크(오너 승인 2026-10-21 KST) — 그날 첫 답 · 같은 날 규칙 · FSRS로 다시 돌린 기억률 · 단어 영역 · 연습 순서.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AREA_STATES, PRACTICE_AREAS, areaOfView, areaPercents, levelWordAreas, noteOpened, noteWordGrade, practiceAreaState, practiceCounts,
  practiceFirstAnswers, practiceOrder, readAreaDay, seenTodayElsewhere, shownState, soundCheckKeys, wordAreaState, wordGradedOn,
} from '../levelWordAreas';
import { learningDay } from '../fsrsScheduler';

const DAY = 86400000;
// KST 2026-10-21 12:00 — 04시 경계와 멀리.
const NOON = Date.parse('2026-10-21T03:00:00Z');
const at = (days, hours = 0) => new Date(NOON + days * DAY + hours * 3600000).toISOString();
const ev = (word, view, correct, created_at, extra = {}) => ({ item_key: word, correct, created_at, detail: { level: 'H3', view, round: 1, ...extra } });

describe('세 상태 이름 — 네 칸 · 상태 표시와 겹치지 않는다', () => {
  it('맞힘 · 놓침 · 처음 (en Hit · Miss · New)', () => {
    expect(Object.values(AREA_STATES).map((s) => s.ko)).toEqual(['맞힘', '놓침', '처음']);
    expect(Object.values(AREA_STATES).map((s) => s.en)).toEqual(['Hit', 'Miss', 'New']);
    for (const s of Object.values(AREA_STATES)) expect(['다시', '어려움', '알맞음', '쉬움', '오늘', '복습', '졸업']).not.toContain(s.ko);
  });
  it('흐려진 맞힘은 처음처럼 보인다 · 탭 「소리」는 저장 이름 audio', () => {
    expect(shownState('faded')).toBe('new');
    expect(areaOfView('sound')).toBe('audio');
    expect(areaOfView('all')).toBe(null);
  });
});

describe('그날의 첫 답만 — 학습일(04시) 경계', () => {
  it('같은 날 여러 번 눌러도 첫 답 하나', () => {
    const f = practiceFirstAnswers([ev('经验', 'audio', false, at(0)), ev('经验', 'audio', true, at(0, 1)), ev('经验', 'audio', true, at(1))]);
    expect(f.get('经验').get('audio').map((a) => a.correct)).toEqual([false, true]);
  });
  it('04시 전은 전날', () => {
    const before4 = new Date(Date.parse('2026-10-21T18:30:00Z')).toISOString(); // KST 10-22 03:30 → 10-21 학습일
    const f = practiceFirstAnswers([ev('经验', 'meaning', true, at(0)), ev('经验', 'meaning', false, before4)]);
    expect(f.get('经验').get('meaning')).toHaveLength(1);
  });
  it('같은 날 규칙에 걸린 알아요가 그날 첫 답이면 그날은 세지 않는다 · 놓침은 센다', () => {
    const f = practiceFirstAnswers([ev('经验', 'audio', true, at(0), { sameDay: true }), ev('经验', 'sentence', false, at(0), { sameDay: true })]);
    expect(f.get('经验').has('audio')).toBe(false);
    expect(f.get('经验').get('sentence').map((a) => a.correct)).toEqual([false]);
  });
  it('취소 줄은 바로 앞 답을 지운다', () => {
    const f = practiceFirstAnswers([ev('经验', 'audio', true, at(0)), ev('经验', 'audio', false, at(0, 1), { cancel: true })]);
    expect(f.has('经验')).toBe(false);
  });
  it('단어 · 전체 보기의 옛 바퀴 답은 연습 영역이 아니다', () => {
    expect(practiceFirstAnswers([ev('经验', 'word', true, at(0)), ev('经验', 'all', true, at(0))]).size).toBe(0);
  });
  it('10-15 탭 표시는 marked_at의 답 한 건으로 이어받는다', () => {
    const f = practiceFirstAnswers([], [{ word_text: '经验', facet: 'audio', mark: 'o', marked_at: at(-3) }, { word_text: '经验', facet: 'word', mark: 'o', marked_at: at(-3) }]);
    expect([...f.get('经验').keys()]).toEqual(['audio']);
    expect(f.get('经验').get('audio')[0]).toMatchObject({ correct: true, day: learningDay(Date.parse(at(-3))) });
  });
});

describe('연습 영역 — FSRS로 다시 돌린 기억률이 90% 아래면 흐려진다(고정 일수 없음)', () => {
  const first = (days, correct) => ({ day: learningDay(Date.parse(at(days))), at: Date.parse(at(days)), correct });
  it('처음 → 맞힘 → 며칠 뒤 흐려짐', () => {
    expect(practiceAreaState(undefined, Date.parse(at(0))).state).toBe('new');
    expect(practiceAreaState([first(0, true)], Date.parse(at(1))).state).toBe('hit');
    expect(practiceAreaState([first(0, true)], Date.parse(at(10))).state).toBe('faded');
  });
  it('여러 번 맞힐수록 오래 간다(단어마다 다름)', () => {
    const once = [first(0, true)], twice = [first(-6, true), first(0, true)];
    const lasts = (list) => { let d = 1; while (practiceAreaState(list, Date.parse(at(d))).state === 'hit') d += 1; return d; };
    expect(lasts(twice)).toBeGreaterThan(lasts(once));
  });
  it('마지막 첫 답이 놓침이면 놓침', () => {
    expect(practiceAreaState([first(-3, true), first(0, false)], Date.parse(at(0))).state).toBe('miss');
  });
});

describe('단어 영역 — 단어장 카드의 마지막 결과', () => {
  const card = ({ last = at(-2), next = at(3), state = 'Review' } = {}) => ({ source: 'fsrs-v1', memory: { state, lastReview: last },
    review: { nextQuestionAt: next, known: false, excluded: false, available: true } });
  const now = Date.parse(at(0));
  it('채점한 적 없음 = 처음 · 아는 단어 표시 = 맞힘', () => {
    expect(wordAreaState({ projection: null, at: now })).toBe('new');
    expect(wordAreaState({ projection: null, known: true, at: now })).toBe('hit');
  });
  it('복습일 전 = 맞힘 · 복습일이 되면 흐려짐', () => {
    expect(wordAreaState({ projection: card(), at: now })).toBe('hit');
    expect(wordAreaState({ projection: card({ last: at(-5), next: at(-1) }), at: now })).toBe('faded');
  });
  it('학습 단계(다음 차례가 하루 안) = 놓침 · 이 기기의 오늘 첫 채점이 다시 · 어려움 = 놓침', () => {
    expect(wordAreaState({ projection: card({ last: at(0), next: at(0, 0.2), state: 'Learning' }), at: now })).toBe('miss');
    expect(wordAreaState({ projection: card(), todayFirst: 2, at: now })).toBe('miss');
    expect(wordAreaState({ projection: card(), todayFirst: 3, at: now })).toBe('hit');
  });
  it('오늘 채점했는가(같은 날 규칙)', () => {
    expect(wordGradedOn(card({ last: at(0, -1) }), now)).toBe(true);
    expect(wordGradedOn(card({ last: at(-1) }), now)).toBe(false);
  });
});

describe('같은 날 규칙 — 오늘 다른 곳에서 먼저 본 단어', () => {
  it('단어 채점 · 다른 영역 답 · 다른 영역에서 펼침이면 걸린다, 같은 영역은 아니다', () => {
    expect(seenTodayElsewhere({ area: 'audio', wordGradedToday: true })).toBe(true);
    expect(seenTodayElsewhere({ area: 'audio', answeredToday: ['meaning'] })).toBe(true);
    expect(seenTodayElsewhere({ area: 'audio', answeredToday: ['audio'] })).toBe(false);
    expect(seenTodayElsewhere({ area: 'audio', openedIn: 'word' })).toBe(true);
    expect(seenTodayElsewhere({ area: 'audio', openedIn: 'audio' })).toBe(false);
    expect(seenTodayElsewhere({ area: 'word', wordGradedToday: true })).toBe(false);
  });
  it('이 기기의 오늘 기록 — 첫 채점 · 처음 펼친 영역만, 날이 바뀌면 비운다', () => {
    let d = readAreaDay(null, NOON);
    d = noteWordGrade(noteWordGrade(d, '经验', 1), '经验', 3);
    d = noteOpened(noteOpened(d, '经验', 'word'), '经验', 'audio');
    expect(d.first['经验']).toBe(1);
    expect(d.opened['经验']).toBe('word');
    expect(readAreaDay(d, NOON + DAY).first).toEqual({});
  });
});

describe('탭 % · 네 영역 다 맞힘 · 연습 순서', () => {
  const A = (w, s, m, a, recall = 0.95) => ({ word: { state: w }, sentence: { state: s, recall }, meaning: { state: m, recall }, audio: { state: a, recall } });
  const table = new Map([['a', A('hit', 'hit', 'hit', 'hit')], ['b', A('hit', 'faded', 'new', 'miss', 0.8)], ['c', A('new', 'new', 'new', 'new')], ['d', A('miss', 'hit', 'new', 'hit', 0.91)]]);
  it('흐려진 맞힘은 %에서 빠지고, 0%도 숫자다', () => {
    expect(areaPercents(['a', 'b', 'c', 'd'], (k) => table.get(k))).toEqual({ word: 50, sentence: 50, meaning: 25, audio: 50, all: 1 });
    expect(areaPercents(['c'], (k) => table.get(k)).meaning).toBe(0);
  });
  it('놓침 → 흐려진 맞힘 → 처음 → 맞힘(기억률 낮은 것부터), 오늘 본 단어는 맨 뒤', () => {
    const entries = ['a', 'b', 'c', 'd', 'e'].map((key) => ({ key }));
    const state = new Map([['a', { state: 'hit', recall: 0.99 }], ['b', { state: 'faded', recall: 0.7 }], ['c', { state: 'new' }],
      ['d', { state: 'miss' }], ['e', { state: 'hit', recall: 0.92 }]]);
    expect(practiceOrder(entries, (k) => state.get(k)).map((e) => e.key)).toEqual(['d', 'b', 'c', 'e', 'a']);
    expect(practiceOrder(entries, (k) => state.get(k), (k) => k === 'd').map((e) => e.key)).toEqual(['b', 'c', 'e', 'a', 'd']);
    expect(practiceCounts(['a', 'b', 'c', 'd', 'e'], (k) => state.get(k))).toEqual({ miss: 1, new: 2, hit: 2 });
  });
  it('한 단어의 네 영역 — 연습 영역은 세 개뿐', () => {
    expect(PRACTICE_AREAS).toEqual(['sentence', 'meaning', 'audio']);
    expect(Object.keys(levelWordAreas({ firsts: new Map(), projection: null, at: NOON }))).toEqual(['word', 'sentence', 'meaning', 'audio']);
  });
  it('소리로 확인할 단어 — 어제까지 단어 영역에서 본 것 중 소리가 맞힘이 아닌 것', () => {
    const proj = { y: { memory: { lastReview: at(-1) } }, t: { memory: { lastReview: at(0, -1) } }, n: null, h: { memory: { lastReview: at(-2) } } };
    const areas = { y: { audio: { state: 'new' } }, t: { audio: { state: 'new' } }, n: { audio: { state: 'new' } }, h: { audio: { state: 'hit' } } };
    expect(soundCheckKeys(['y', 't', 'n', 'h'].map((key) => ({ key })), { projectionOf: (k) => proj[k], areasOf: (k) => areas[k], at: NOON })).toEqual(['y']);
  });
});

describe('기록 — 새 표 · 새 열 없음, 바퀴 답과 같은 모양(활동 전용)', () => {
  const hook = fs.readFileSync('src/lib/useLevelWordAreas.js', 'utf8');
  it('쓰기는 levelAnswerEvent · logReviewEvents뿐, 탭 표시 표는 읽기만', () => {
    expect(hook).toMatch(/levelAnswerEvent\(/);
    expect(hook).not.toMatch(/setWordFacet|\.upsert\(|\.insert\(/);
    expect(fs.readFileSync('src/lib/weeklyReport.js', 'utf8')).toMatch(/ACTIVITY_ONLY_SOURCES = Object\.freeze\(new Set\(\[[^\]]*'level'/);
  });
  it('연습 기억은 일정과 같은 FSRS 엔진 · 같은 목표 기억률(엔진을 따로 만들지 않는다)', () => {
    const src = fs.readFileSync('src/lib/levelWordAreas.js', 'utf8');
    expect(src).toMatch(/replayPracticeMemory/);
    expect(src).not.toMatch(/new FSRSAlgorithm|from 'ts-fsrs'/);
  });
});
