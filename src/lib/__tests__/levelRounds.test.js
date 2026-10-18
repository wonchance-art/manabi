// 단어 목록 바퀴 답(LEVEL-ROUND-001) — 같은 날 규칙 · 마지막 답 · 대기 → 확정 · 읽기 페이지 · 활동 전용.
import { describe, expect, it } from 'vitest';
import {
  LEVEL_SOURCE, applyLevelAnswer, createLevelAnswerQueue, currentLevelRound, deleteLevelRounds, fetchLevelAnswers, fetchLevelRounds,
  insertLevelRounds, isSameDayAnswer, lastLevelAnswers, levelAnswerEvent, levelAnswerOf, levelAnswersOfView, levelCancelEvent,
  levelRoundProgress, levelRoundScope, levelRowsBetween, roundLabel,
  LEVEL_NEXT_VIEW, LEVEL_ROUND_SPACING_DAYS, LEVEL_SAVES_KEY, countLevelSave, LEVEL_EXAM_LADDER_DAYS, levelExamHint, levelExamOf, levelForgotten, levelRoundHint, levelRoundOrder, nextFullRoundAt,
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

describe('바퀴(LEVEL-ROUND-001 ②) — 줄 없으면 1바퀴, 범위 · 진도 · 글로 쓴 바퀴', () => {
  const rounds = [
    { view: 'all', round_no: 2, scope: 'missed', started_at: '2026-10-19T01:00:00Z' },
    { view: 'all', round_no: 3, scope: 'all', started_at: '2026-10-26T01:00:00Z' },
    { view: 'meaning', round_no: 1, scope: 'all', started_at: '2026-10-19T00:00:00Z' },
  ];
  it('보기마다 가장 큰 바퀴 번호, 줄이 없으면 1바퀴(전부 · 시작 시각 없음)', () => {
    expect(currentLevelRound(rounds, 'all')).toEqual({ round: 3, scope: 'all', startedAt: Date.parse('2026-10-26T01:00:00Z'), recorded: true });
    expect(currentLevelRound(rounds, 'meaning').round).toBe(1);
    expect(currentLevelRound(rounds, 'word')).toEqual({ round: 1, scope: 'all', startedAt: null, recorded: false });
    expect(currentLevelRound([], 'all').recorded).toBe(false);
  });
  it('바퀴는 글로 — 「두 바퀴째」, 열을 넘으면 숫자', () => {
    expect([1, 2, 3, 10, 11].map(roundLabel)).toEqual(['한 바퀴째', '두 바퀴째', '세 바퀴째', '열 바퀴째', '11 바퀴째']);
  });
  it('모른 것만 = 시작 직전 마지막 답이 X, 답 없던 단어는 지금 상태(공부 중 · 탭 X)로', () => {
    const before = new Map([['a', { correct: false }], ['b', { correct: true }]]);
    const scope = levelRoundScope(['a', 'b', 'c', 'd'], { scope: 'missed' }, { before, stateMissed: new Set(['b', 'c']) });
    expect([...scope]).toEqual(['a', 'c']); // b는 마지막 답이 O라 상태(X)보다 답이 이긴다
    expect([...levelRoundScope(['a', 'b'], { scope: 'all' }, { before })]).toEqual(['a', 'b']);
  });
  it('진도 — 범위 안 단어만 센다', () => {
    const answers = new Map([['a', { correct: true }], ['c', { correct: false }], ['z', { correct: true }]]);
    expect(levelRoundProgress(new Set(['a', 'b', 'c']), answers)).toEqual({ total: 3, known: 1, studying: 1, left: 1 });
  });
  it('시각으로 자르기 · 보기 하나 뽑기', () => {
    const rows = [{ created_at: '2026-10-19T02:00:00Z' }, { created_at: '2026-10-19T01:00:00Z' }, { created_at: '2026-10-18T01:00:00Z' }];
    expect(levelRowsBetween(rows, { before: Date.parse('2026-10-19T01:00:00Z') })).toEqual([rows[2]]);
    expect(levelRowsBetween(rows, { since: Date.parse('2026-10-19T01:00:00Z') })).toEqual([rows[0], rows[1]]);
    const map = new Map([['爸爸|all', { correct: true }], ['爸爸|word', { correct: false }], ['a|b|all', { correct: false }]]);
    expect([...levelAnswersOfView(map, 'all')]).toEqual([['爸爸', { correct: true }], ['a|b', { correct: false }]]);
  });
  it('표가 없으면(42P01 · PGRST205) available=false로 물러서고, 다른 오류는 reject', async () => {
    const client = (error, data = []) => ({ from: () => { const c = { select: () => c, eq: () => c, order: () => Promise.resolve({ data, error }) }; return c; } });
    expect(await fetchLevelRounds(client({ code: 'PGRST205', message: "Could not find the table 'public.user_level_rounds' in the schema cache" }), 'u', { lang: 'zh', level: 'h1' }))
      .toEqual({ available: false, rows: [] });
    expect(await fetchLevelRounds(client({ code: '42P01' }), 'u', { lang: 'zh', level: 'h1' })).toEqual({ available: false, rows: [] });
    expect(await fetchLevelRounds(client(null, [{ view: 'all' }]), 'u', { lang: 'zh', level: 'h1' })).toEqual({ available: true, rows: [{ view: 'all' }] });
    await expect(fetchLevelRounds(client({ code: '500', message: 'boom' }), 'u', { lang: 'zh', level: 'h1' })).rejects.toMatchObject({ message: 'boom' });
  });
  it('쓰기 · 지우기 — 본인 · 언어 · 레벨로 좁힌다', async () => {
    const calls = [];
    const chain = (t) => { const c = { insert: (rows) => { calls.push(['insert', t, rows]); return Promise.resolve({ error: null }); },
      delete: () => { calls.push(['delete', t]); return c; }, eq: (k, v) => { calls.push(['eq', k, v]); return c; }, then: (f) => Promise.resolve({ error: null }).then(f) }; return c; };
    const client = { from: (t) => chain(t) };
    await insertLevelRounds(client, 'u', { lang: 'zh', level: 'h1' }, [{ view: 'all', round_no: 2, scope: 'missed', started_at: 'T' }]);
    expect(calls[0]).toEqual(['insert', 'user_level_rounds', [{ user_id: 'u', lang: 'zh', level: 'h1', view: 'all', round_no: 2, scope: 'missed', started_at: 'T' }]]);
    calls.length = 0;
    await deleteLevelRounds(client, 'u', { lang: 'zh', level: 'h1' }, { view: 'all', round: 2 });
    expect(calls).toEqual([['delete', 'user_level_rounds'], ['eq', 'user_id', 'u'], ['eq', 'lang', 'zh'], ['eq', 'level', 'h1'], ['eq', 'view', 'all'], ['eq', 'round_no', 2]]);
  });
  it('표는 auth.users만 참조하고 되돌리기 SQL이 있다(profiles 금지 — 10-16 장애)', () => {
    const sql = fs.readFileSync('supabase/migrations/20261019020000_user_level_rounds.sql', 'utf8').replace(/^--.*$/gm, '');
    expect(sql).toContain('REFERENCES auth.users(id) ON DELETE CASCADE');
    expect(sql).not.toMatch(/profiles/i);
    expect(sql).toContain('REVOKE ALL ON public.user_level_rounds FROM PUBLIC, anon, authenticated;');
    expect(fs.readFileSync('docs/sql/user-level-rounds-rollback.sql', 'utf8')).toContain('DROP TABLE IF EXISTS public.user_level_rounds;');
  });
});

describe('③ 섞기 · 잊은 수 · 다음 바퀴 안내(LEVEL-ROUND-001 ③)', () => {
  const list = Array.from({ length: 30 }, (_, i) => `w${i}`);
  it('1바퀴는 그대로, 2바퀴부터 섞는다 — 같은 씨앗 · 바퀴면 같은 순서, 바퀴가 바뀌면 다른 순서, 빠짐없이', () => {
    expect(levelRoundOrder(list, { seed: 'zh|H1|all|g', round: 1 })).toBe(list);
    const two = levelRoundOrder(list, { seed: 'zh|H1|all|g', round: 2 });
    expect(two).not.toEqual(list);
    expect([...two].sort()).toEqual([...list].sort());
    expect(levelRoundOrder(list, { seed: 'zh|H1|all|g', round: 2 })).toEqual(two);
    expect(levelRoundOrder(list, { seed: 'zh|H1|all|g', round: 3 })).not.toEqual(two);
    expect(levelRoundOrder(list, { seed: 'zh|H1|meaning|g', round: 2 })).not.toEqual(two);
  });

  it('잊은 수 = 지난번 O(같은 날 다른 탭의 O 제외) → 이번 X', () => {
    const before = new Map([['a', { correct: true }], ['b', { correct: true, sameDay: true }], ['c', { correct: false }], ['d', { correct: true }]]);
    const now = new Map([['a', { correct: false }], ['b', { correct: false }], ['c', { correct: false }], ['d', { correct: true }], ['e', { correct: false }]]);
    expect(levelForgotten(before, now)).toBe(1);
    expect(levelForgotten(new Map(), now)).toBe(0);
  });

  it('간격은 「전부」 바퀴만 센다: 1주 → 1달 → 3달, 그 뒤 3달 · 「모른 것만」 바퀴는 넣지 않는다', () => {
    const day = 86_400_000;
    const end = KST('2026-10-18T12:00:00');
    expect(LEVEL_ROUND_SPACING_DAYS).toEqual([7, 30, 90]);
    expect(nextFullRoundAt([], 'all', end)).toBe(end + 7 * day); // 줄 없는 1바퀴
    const r = (round_no, scope, s) => ({ view: 'all', round_no, scope, started_at: new Date(KST(s)).toISOString() });
    // 1바퀴(줄 없음) → 2바퀴 모른 것만 — 직전 「전부」(1바퀴)의 끝 = 2바퀴 시작
    expect(nextFullRoundAt([r(2, 'missed', '2026-10-10T09:00:00')], 'all', end)).toBe(KST('2026-10-10T09:00:00') + 7 * day);
    expect(nextFullRoundAt([r(2, 'all', '2026-10-10T09:00:00')], 'all', end)).toBe(end + 30 * day);
    const many = [r(2, 'all', '2026-09-01T09:00:00'), r(3, 'all', '2026-09-10T09:00:00'), r(4, 'all', '2026-10-01T09:00:00'), r(5, 'missed', '2026-10-02T09:00:00')];
    expect(nextFullRoundAt(many, 'all', end)).toBe(KST('2026-10-02T09:00:00') + 90 * day);
    expect(nextFullRoundAt(many, 'word', end)).toBe(end + 7 * day); // 보기마다 따로
    expect(nextFullRoundAt([], 'all', NaN)).toBeNull();
  });

  it('안내 한 줄 — 다음 보기 권유(단어 → 뜻 → 소리) · KST 날짜 · 지났으면 「지금」', () => {
    const now = KST('2026-10-18T12:00:00');
    expect(LEVEL_NEXT_VIEW).toMatchObject({ all: 'meaning', word: 'meaning', meaning: 'audio', audio: null });
    expect(levelRoundHint({ nextLabel: '뜻', dueAt: KST('2026-10-25T12:00:00'), nowMs: now })).toBe('다음 바퀴는 뜻 탭으로 — 1주 뒤(10월 25일)부터');
    expect(levelRoundHint({ nextLabel: '소리', dueAt: KST('2026-10-19T01:00:00'), nowMs: now })).toBe('다음 바퀴는 소리 탭으로 — 내일부터');
    expect(levelRoundHint({ dueAt: KST('2026-11-17T12:00:00'), nowMs: now })).toBe('처음부터 전부는 11월 17일부터');
    expect(levelRoundHint({ dueAt: KST('2026-10-18T00:30:00'), nowMs: now })).toBe('처음부터 전부 다시 돌 때예요');
    expect(levelRoundHint({ nextLabel: '뜻', dueAt: now - 1, nowMs: now })).toBe('다음 바퀴는 뜻 탭으로 — 지금 돌아도 좋아요');
    expect(levelRoundHint({ dueAt: null })).toBeNull();
  });

  it('계약: 섞기는 shuffleHanzi 하나, 간격 [7, 30, 90]은 levelRounds 한 곳', () => {
    const src = fs.readFileSync('src/lib/levelRounds.js', 'utf8');
    expect(src).toContain('return shuffleHanzi(entries, rand);');
    expect(src).not.toMatch(/Math\.random/);
    const page = fs.readFileSync('src/views/LevelListPage.jsx', 'utf8');
    expect(page).toContain('levelRoundOrder(scoped, {');
    expect(page).not.toMatch(/\b(7|30|90)\s*\*\s*86_?400_?000|\[7,\s*30,\s*90\]/);
    expect(page).not.toMatch(/sort\(\(\)\s*=>\s*Math\.random/);
  });
});

describe('④ 하루 분량 알림(LEVEL-ROUND-001 ④)', () => {
  const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
  const noon = KST('2026-10-18T12:00:00');
  it('오늘 담은 수가 남은 새 카드 자리를 넘으면 한 번만 true · 자리를 모르면 세기만 · KST 자정에 새로', () => {
    const st = memory();
    const quota = { remaining: 2 };
    expect([1, 2, 3, 4].map(() => countLevelSave(st, quota, noon))).toEqual([false, false, true, false]);
    expect(JSON.parse(st.getItem(LEVEL_SAVES_KEY))).toEqual({ day: '2026-10-18', n: 4, told: true });
    expect(countLevelSave(st, null, KST('2026-10-19T00:00:00'))).toBe(false); // 다음 날 — 0부터
    expect(countLevelSave(st, { remaining: 0 }, KST('2026-10-19T01:00:00'))).toBe(true);
    st.setItem(LEVEL_SAVES_KEY, '{');
    expect(countLevelSave(st, { remaining: 0 }, noon)).toBe(true); // 깨진 값은 버린다
  });

  it('계약: 자리는 reviewScopeQuota 하나(dailyNewLimit 정본) · 목록 화면은 import()로만', () => {
    const page = fs.readFileSync('src/views/LevelListPage.jsx', 'utf8');
    expect(page).toContain("import('@/lib/levelDailyLoad')");
    expect(page).not.toMatch(/^import[^;]*(levelDailyLoad|useLearningAdmission|reviewScope'|learningAdmission)/m);
    expect(page).not.toMatch(/DEFAULT_NEW_PER_DAY|vocab_new_per_day/);
    const load = fs.readFileSync('src/lib/levelDailyLoad.js', 'utf8');
    expect(load).toContain('reviewScopeQuota({ quota, compatibility: canUseLegacyAdmissionCompatibility(quota) }');
    expect(load).toContain('newPerDay: loadNewPerDay()');
  });
});

describe('J 시험 모드 — 목표 날짜까지 간격 줄이기', () => {
  const day = 86_400_000;
  const levels = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'];
  const now = KST('2026-10-15T12:00:00');
  const profile = { dday_date: '2026-11-14', goal_lang: 'Chinese', goal_level: 'H4' };
  it('목표 언어 · 급수 이하 레벨 · 날짜가 남았을 때만 — 급수는 누적(HSK 4면 1~4급)', () => {
    expect(levelExamOf(profile, { language: 'Chinese', levels, level: 'h2', nowMs: now })).toEqual({ examMs: KST('2026-11-14T00:00:00'), daysLeft: 30, level: 'H4' });
    expect(levelExamOf(profile, { language: 'Chinese', levels, level: 'H5', nowMs: now })).toBeNull();
    expect(levelExamOf(profile, { language: 'Japanese', levels: ['N5', 'N4'], level: 'N5', nowMs: now })).toBeNull();
    expect(levelExamOf({ ...profile, dday_date: '2026-10-15' }, { language: 'Chinese', levels, level: 'H1', nowMs: now })).toBeNull(); // 시험 날부터 평소대로
    expect(levelExamOf({ ...profile, dday_date: null }, { language: 'Chinese', levels, level: 'H1', nowMs: now })).toBeNull();
    expect(levelExamOf({ ...profile, goal_level: 'OT' }, { language: 'Chinese', levels, level: 'H1', nowMs: now })).toBeNull();
    expect(levelExamOf(null, { language: 'Chinese', levels, level: 'H1', nowMs: now })).toBeNull();
  });

  it('사다리 — 시험 60 · 30 · 14 · 7 · 3일 전 중 직전 「전부」 끝에서 2일 이상 뒤의 첫 칸, 평소 간격이 더 이르면 그쪽, D-3을 넘기면 null', () => {
    expect(LEVEL_EXAM_LADDER_DAYS).toEqual([60, 30, 14, 7, 3]);
    const exam = { examMs: KST('2026-11-14T00:00:00') };
    const end = (s) => KST(s);
    // 30일 남음 · 두 번째 「전부」(평소 30일) → D-14
    const second = [{ view: 'all', round_no: 2, scope: 'all', started_at: new Date(KST('2026-10-01T09:00:00')).toISOString() }];
    expect(nextFullRoundAt(second, 'all', end('2026-10-15T12:00:00'), exam)).toBe(exam.examMs - 14 * day);
    // 첫 「전부」면 평소 7일이 더 이르다
    expect(nextFullRoundAt([], 'all', end('2026-10-15T12:00:00'), exam)).toBe(end('2026-10-15T12:00:00') + 7 * day);
    // 7일 남음 → D-3, D-4에 끝냈으면 null(총정리 직전)
    expect(nextFullRoundAt(second, 'all', end('2026-11-07T12:00:00'), exam)).toBe(exam.examMs - 3 * day);
    expect(nextFullRoundAt(second, 'all', end('2026-11-10T12:00:00'), exam)).toBeNull();
  });

  it('끝 카드 두 줄 — 시험까지 · 다음 바퀴 · 마지막 총정리(뜻 · 소리), 총정리 날 · 뒤 문구', () => {
    const exam = { examMs: KST('2026-11-14T00:00:00'), daysLeft: 30 };
    expect(levelExamHint({ examName: 'HSK 4', exam, dueAt: KST('2026-10-31T00:00:00'), nowMs: now }))
      .toEqual(['HSK 4 시험까지 30일 · 다음 바퀴 10월 31일', '마지막 총정리 11월 11일 (뜻 · 소리)']);
    expect(levelExamHint({ examName: 'HSK 4', exam, dueAt: KST('2026-11-11T00:00:00'), nowMs: now })[0]).toBe('HSK 4 시험까지 30일');
    expect(levelExamHint({ examName: 'HSK 4', exam: { ...exam, daysLeft: 3 }, dueAt: null, nowMs: KST('2026-11-11T09:00:00') }))
      .toEqual(['HSK 4 시험까지 3일', '오늘 총정리 — 뜻 · 소리 탭으로 처음부터 전부']);
    expect(levelExamHint({ examName: 'JLPT N3', exam: { ...exam, daysLeft: 1 }, dueAt: null, nowMs: KST('2026-11-13T09:00:00') })[1])
      .toBe('시험 전까지 총정리에서 모른 것만 다시');
  });

  it('계약: 목표는 profiles 그대로(새 표 · 새 목표 저장 없음) · 간격 함수는 nextFullRoundAt 하나', () => {
    const page = fs.readFileSync('src/views/LevelListPage.jsx', 'utf8');
    expect(page).toContain('levelExamOf(profile, { language: conf.language, levels: conf.levels, level: levelKey })');
    expect(page).toContain('nextFullRoundAt(rounds.roundRows, answerView, endedAt || Date.now(), exam)');
    expect(page).not.toContain("from('profiles')"); // 읽기만 — 목표 저장은 목표 창(ProfileStats) 한 곳
  });
});
