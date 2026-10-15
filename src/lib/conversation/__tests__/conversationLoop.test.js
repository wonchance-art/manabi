// 대화 모드 v2-Z Z-R3 — 순환 강화(써 볼 말 · 못 쓴 말 파생 · 다시 꺼내기 · 새 단어 수 난이도 · 마치기 요약).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { harvestWritingGaps } from '../../writingGaps';
import { buildTurnPrompt } from '../turnModel';
import {
  REASK_AFTER_MS, conversationCorrections, conversationGapRows, conversationSummary, difficultyNote,
  newWordCount, reaskSucceeded, reaskTarget,
} from '../conversationLoop';

const read = (rel) => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');
const DAY = 24 * 3600e3;
const T0 = Date.UTC(2026, 9, 10, 3);

const turns = [
  { who: 'tutor', lines: [0], at: T0 },
  { who: 'me', text: '我昨天见面了朋友。', at: T0 + 60e3, focus: { from: '见面了朋友', to: '我昨天跟朋友见面了。', level: 'retry', state: 'fixed' } },
  { who: 'tutor', lines: [2], at: T0 + 70e3 },
  { who: 'me', text: '我们去了电影院看。', at: T0 + 120e3, later: { from: '电影院看', to: '我们去电影院看了。' } },
  { who: 'tutor', lines: [4], at: T0 + 130e3 },
  { who: 'me', text: '打算看电影', at: T0 + 300e3 },
];

describe('고친 말과 못 쓴 말', () => {
  it('짚은 말·넘어간 말을 상태와 함께 꺼낸다', () => {
    expect(conversationCorrections({ turns }).map((c) => [c.to, c.state])).toEqual([
      ['我昨天跟朋友见面了。', 'fixed'], ['我们去电影院看了。', 'later'],
    ]);
  });
  it('작문 수확기가 먹는 {sentence, corrected} 모양으로만 파생한다 — 수확 규칙은 작문 것 그대로', () => {
    const rows = conversationGapRows([{ id: 7, language: 'Chinese', turns }]);
    expect(rows[0]).toMatchObject({ id: 'conversation-7-0', language: 'Chinese', sentence: '我昨天见面了朋友。', corrected: '我昨天跟朋友见面了。', errors: [] });
    const gaps = harvestWritingGaps(rows).map((g) => g.text);
    expect(gaps).toContain('跟朋友');
  });
});

describe('다시 꺼내기', () => {
  const rows = [{ id: 7, language: 'Chinese', turns, reask: [] }];
  it('하루 이상 지난 고친 문형 하나를 고른다(같은 언어만)', () => {
    expect(reaskTarget(rows, { language: 'Chinese', now: T0 + DAY - 1 })).toBeNull();
    expect(reaskTarget(rows, { language: 'Chinese', now: T0 + REASK_AFTER_MS + 300e3 })?.to).toBe('我们去电影院看了。');
    expect(reaskTarget(rows, { language: 'Japanese', now: T0 + 2 * DAY })).toBeNull();
  });
  it('두 번 맞힌 문형·지금 묻는 중인 문형은 다시 묻지 않는다', () => {
    const done = [...rows,
      { id: 8, language: 'Chinese', turns: [], reask: [{ to: '我们去电影院看了。', ok: true }] },
      { id: 9, language: 'Chinese', turns: [], reask: [{ to: '我们去电影院看了。', ok: true }, { to: '我昨天跟朋友见面了。', ok: null }] }];
    expect(reaskTarget(done, { language: 'Chinese', now: T0 + 2 * DAY })).toBeNull();
  });
  it('새로 쓴 조각을 모두 쓰고 그 턴에 새로 짚힌 곳이 없으면 맞힌 것', () => {
    const target = { text: '我昨天见面了朋友。', to: '我昨天跟朋友见面了。' };
    expect(reaskSucceeded(target, '我今天跟朋友见面了！', {})).toBe(true);
    expect(reaskSucceeded(target, '我今天见面了朋友', {})).toBe(false);
    expect(reaskSucceeded(target, '我今天跟朋友见面了', { focus: { from: 'x' } })).toBe(false);
  });
  it('프롬프트에 정답 문장을 보이지 말고 한 번 물으라고 넣는다', () => {
    const p = buildTurnPrompt({ language: 'Chinese', level: 'H2 초급', topic: '주말', safetyRules: '', start: true, reask: { to: '我昨天跟朋友见面了。' } });
    expect(p).toContain('Once in this conversation, ask a question whose natural answer needs that pattern');
    expect(p).toContain('Do not show that sentence');
  });
});

describe('새 단어 수 난이도', () => {
  it('내 단어장에 없는 표제어만, 기능어·기호·실패 줄은 빼고 센다', () => {
    const tokens = [
      { text: '你', base_form: '你', pos: '대사' }, { text: '最近', base_form: '最近', pos: '명사' },
      { text: '看', base_form: '看', pos: '동사' }, { text: '了', base_form: '了', pos: '조사' },
      { text: '？', pos: '기호' }, { text: '看', base_form: '看', pos: '동사' }, { text: 'x', failed: true, pos: '미분석' },
    ];
    expect(newWordCount(tokens, new Set(['你']))).toBe(2);
  });
  it('목표 1~2개에 맞춰 다음 답장 문장을 고른다', () => {
    expect(difficultyNote(undefined)).toBeNull();
    expect(difficultyNote(5)).toContain('simpler');
    expect(difficultyNote(0)).toContain('slightly new');
    expect(difficultyNote(2)).toContain('Keep about 1-2');
  });
});

describe('대화 마치기 요약', () => {
  it('써 본 말 ✓ · 스스로 고친 문장 · 다음에 볼 것 · 담은 말 · 시간', () => {
    const s = conversationSummary({ turns, reask: [{ to: 'A', ok: true }, { to: 'B', ok: null }] }, { outputWords: ['打算', '电影', '最近'], savedWords: ['最近'] });
    expect(s.myTurns).toBe(3);
    expect(s.minutes).toBe(5);
    expect(s.used).toEqual(['打算', '电影']);
    expect(s.fixed.map((c) => c.to)).toEqual(['我昨天跟朋友见面了。']);
    expect(s.later.map((c) => c.to)).toEqual(['我们去电影院看了。']);
    expect(s.saved).toEqual(['最近']);
    expect(s.reaskOk.map((r) => r.to)).toEqual(['A']);
  });
});

describe('화면 계약', () => {
  it('머리 ⋯에 마치기, 정답 줄에 [따라 말해 보기](채점 없음)', () => {
    const thread = read('components/conversation/ConversationThread.jsx');
    expect(thread).toContain('>마치기</button>');
    expect(thread).toContain("'따라 말해 보기'");
    expect(thread).not.toMatch(/score|점수/);
  });
  it('요약은 표시만 — 복습 기록·채점 경로를 부르지 않는다(M7)', () => {
    const summary = read('components/conversation/ConversationSummary.jsx').replace(/^\s*\/\/.*$/gm, '');
    expect(summary).not.toMatch(/review_events|persistVocabGrade|recordReview/);
  });
  it('작문 「못 쓴 말」에 대화 교정을 합친다', () => {
    expect(read('views/WritingStudioPage.jsx')).toContain('fetchConversationTurns(supabase, user.id).then(conversationGapRows');
  });
});
