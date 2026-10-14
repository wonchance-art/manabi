// 「한자」 탭 넘기기 · 기록 · 답 카드 계약(HANZI-TAB-AL-001 · 인계 #1337 6146776723 §1 · §2 · §4, 수용 기준 1 · 3 · 4).
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  hanziRunMisses, hanziRunProgress, lastHanziMarks, shuffleHanzi, startHanziRun, stepHanziRun,
} from '../hanziSession.js';
import { hanziBrief, hanziCardModel } from '../hanziCard.js';
import { buildWeeklyReport, isGradedReviewEvent } from '../weeklyReport.js';
import { weaknessProfile } from '../weaknessProfile.js';
import { loadHanziInputs, readZhDictionary } from '../../../scripts/build-zh-hanzi.mjs';

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** 동작을 차례로 — 확정 기록을 모은다(화면이 logReviewEvents로 쓰는 것). */
function play(order, actions) {
  let state = startHanziRun(order, { set: 3 });
  const commits = [];
  for (const a of actions) {
    const r = stepHanziRun(state, a);
    state = r.state;
    commits.push(...r.commits);
  }
  return { state, commits };
}

describe('섞기 — 같은 묶음을 두 번 시작해도 순서가 고정되지 않는다(수용 기준 3)', () => {
  const set = [...'学会行好天中用说后过高分'];
  it('여러 번 섞으면 순서가 여럿 · 글자는 그대로', () => {
    const orders = new Set(Array.from({ length: 20 }, () => shuffleHanzi(set).join('')));
    expect(orders.size).toBeGreaterThan(1);
    for (const o of orders) expect([...o].sort()).toEqual([...set].sort());
  });
  it('rand를 주면 결정적(테스트용)', () => {
    expect(shuffleHanzi([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
});

describe('기록 — 글자마다 1건(수용 기준 4)', () => {
  const order = [...'学会行'];
  const count = (commits) => Object.fromEntries(order.map((c) => [c, commits.filter((x) => x.ch === c).length]));

  it('알아요 → 탭 1번에 다음 글자, 몰라요 → 답 카드 → 다음(탭 2번)', () => {
    let s = startHanziRun(order);
    s = stepHanziRun(s, 'know').state;
    expect([s.view, s.order[s.i], s.last]).toEqual(['q', '会', '学']);
    s = stepHanziRun(s, 'dontKnow').state;
    expect([s.view, s.order[s.i]]).toEqual(['card', '会']);
    s = stepHanziRun(s, 'next').state;
    expect([s.view, s.order[s.i], s.last]).toEqual(['q', '行', null]);
  });

  it('끝까지 넘기면 글자당 1건, 결정은 다음 결정 · 끝에서 확정', () => {
    const { state, commits } = play(order, ['know', 'dontKnow', 'next', 'know']);
    expect(state.view).toBe('end');
    expect(commits).toEqual([{ ch: '学', correct: true }, { ch: '会', correct: false }, { ch: '行', correct: true }]);
    expect(hanziRunMisses(state)).toEqual(['会']);
  });

  it('방금 줄 [몰랐어요]는 기록을 늘리지 않고 그 1건을 바꾼다', () => {
    const { commits } = play(order, ['know', 'fixLast', 'know', 'know']);
    expect(count(commits)).toEqual({ 学: 1, 会: 1, 行: 1 });
    expect(commits.find((c) => c.ch === '学').correct).toBe(false);
  });

  it('이전 → 다시 고르기도 1건(마지막 고른 값)', () => {
    const { commits } = play(order, ['know', 'prev', 'dontKnow', 'next', 'know', 'know']);
    expect(count(commits)).toEqual({ 学: 1, 会: 1, 行: 1 });
    expect(commits.find((c) => c.ch === '学').correct).toBe(false);
  });

  it('이전은 한 걸음(대기 글자)까지만', () => {
    const { state } = play(order, ['know', 'know', 'prev', 'prev']);
    expect(state.order[state.i]).toBe('会');
  });

  it('몰라요 취소 = 그 결정을 없앰(기록 0), 같은 글자 문제로', () => {
    const { state, commits } = play(order, ['dontKnow', 'cancel']);
    expect([state.view, state.order[state.i], state.pending]).toEqual(['q', '学', null]);
    expect(commits).toEqual([]);
    expect(state.results).toEqual({});
  });

  it('중간에 나가도 그때까지의 기록은 남는다(대기 1건 확정)', () => {
    const { commits } = play(order, ['know', 'dontKnow', 'exit']);
    expect(commits).toEqual([{ ch: '学', correct: true }, { ch: '会', correct: false }]);
  });

  it('진행 표시', () => {
    const { state } = play(order, ['know']);
    expect(hanziRunProgress(state)).toEqual({ n: 2, total: 3 });
  });
});

describe('표시 — 그 글자의 마지막 hanzi 기록', () => {
  it('최신 순 행에서 글자마다 첫 행', () => {
    const marks = lastHanziMarks([
      { item_key: '学', correct: false, created_at: '2026-10-14T02:00:00Z' },
      { item_key: '学', correct: true, created_at: '2026-10-13T02:00:00Z' },
      { item_key: '会', correct: true, created_at: '2026-10-12T02:00:00Z' },
    ]);
    expect([...marks]).toEqual([['学', false], ['会', true]]);
  });
});

describe('주간 보고 · 약점 — hanzi는 활동량에만', () => {
  const NOW = Date.UTC(2026, 9, 14, 3);
  const at = new Date(NOW - 3600000).toISOString();
  it('활동 수에는 넣고 정답률에는 섞지 않는다', () => {
    const report = buildWeeklyReport({
      now: NOW,
      events: [
        { source: 'vocab', correct: true, created_at: at },
        { source: 'hanzi', item_key: '学', correct: false, created_at: at },
        { source: 'hanzi', item_key: '会', correct: false, created_at: at },
      ],
    });
    expect(report.reviews).toEqual({ total: 3, correct: 1, accuracy: 1 });
    expect(isGradedReviewEvent({ source: 'hanzi' })).toBe(false);
  });
  it('약점 진단은 hanzi를 보지 않는다(회상 방식 qtype 없음)', () => {
    const events = Array.from({ length: 8 }, (_, i) => ({ source: 'hanzi', item_key: `学${i}`, correct: false, created_at: at, detail: { level: 'H1', set: 1, std: 'hsk2026' } }));
    expect(weaknessProfile(events, { now: NOW })).toEqual([]);
  });
  it('EWMA 다이얼도 채점 이벤트만(studyMaterials)', () => {
    expect(read('src/lib/studyMaterials.js')).toMatch(/filter\(countsForDifficulty\)\.filter\(e => !ACTIVITY_ONLY_SOURCES\.has\(e\.source\)\)/);
  });
});

describe('화면 — 기존 함수로만 쓰고, 로그인 전에는 쓰지 않는다', () => {
  const src = read('src/components/levels/HanziBoard.jsx');
  it('logReviewEvents(source:hanzi) · std 고정 · 다른 쓰기 경로 0 · 브라우저 저장 0', () => {
    expect(src).toMatch(/import \{ logReviewEvents \} from '@\/lib\/reviewEvents'/);
    expect(src).toMatch(/source: 'hanzi'/);
    expect(src).not.toMatch(/\.insert\(|\.upsert\(|localStorage|sessionStorage|indexedDB/);
    expect(src).toMatch(/if \(!userId\) return;\n\s+logReviewEvents/);
    expect(src).toMatch(/if \(!userId\) return undefined;\n\s+let alive = true;\n\s+supabase\.from\('review_events'\)\.select/);
  });
});

const inputs = await loadHanziInputs();
const dict = new Map([...(await readZhDictionary())].map(([k, w]) => [k, { word: w }]));
describe('답 카드 모델', () => {
  const h1 = JSON.parse(read('src/lib/data/zhHanzi/H1.json')).chars;
  it('소리 단어 수 순 · 칩 = 사전 병음/뜻 · 누른 글자 자리', () => {
    const m = hanziCardModel('只', h1['只'], { dict, tables: { tradTable: inputs.trad, panel: inputs.panel } });
    expect(m.head.readings).toEqual(['zhǐ', 'zhī']);
    expect(m.head.perReading).toBe(true);
    expect(m.rd.map((r) => r.zheng)).toEqual(['只', '隻']);
    const chip = m.rd[0].senses[0].chips.find((c) => c.zh === '只是');
    expect(chip.syl).toEqual(['zhǐ', 'shì']);
    expect(chip.at).toEqual([0]);
    expect(chip.ko).toBeTruthy();
  });
  it('방금 줄 · 끝 목록 — 소리 전부 + 첫 뜻', () => {
    expect(hanziBrief(h1['只']).readings).toBe('zhǐ · zhī');
    expect(hanziBrief(h1['得']).readings).toMatch(/dé · de · děi/);
  });
});
