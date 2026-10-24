import { describe, expect, it } from 'vitest';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler.js';
import { projectVocabularyLearning } from '../vocabularyLearningRead.js';
import {
  GRAD_DAYS, HARD_LAPSES, LEVEL_WORD_STATUS, OLD_DAYS, daysSinceReview, gradeEngine,
  gradePreviews, gradeToastText, intervalLabel, lapsesOf, levelProgressPercent, levelWordGraded, levelWordStatus, todayAgainAt, newStartedToday,
} from '../levelWordStatus.js';
import {
  gradeLevelSession, moreLevelSession, nextLevelKey, pullLevelSession, sessionCurrent, sessionDone, sessionDue, sessionNextAt, sessionOrder,
  revertLevelGrade, sessionWaiting, skipLevelSession, startLevelSession, undoLevelSession,
} from '../levelWordSession.js';

const actorId = 'learner';
const now = '2026-10-19T03:00:00.000Z'; // 12:00 KST
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const at = Date.parse(now);

function legacy(row = {}, registry = {}) {
  const vocabulary = { id: 'w', user_id: actorId, language: 'Chinese', word_text: '经验', base_form: null, meaning: '경험',
    created_at: null, source_material_id: null, interval: 0, ease_factor: 0, repetitions: 0,
    last_reviewed_at: null, next_review_at: null, ...row };
  return { row: vocabulary, projection: projectVocabularyLearning({ actorId, vocabulary, enabled: true, registryAvailable: true,
    complete: true, at: now, registry: { cardId: 'w', userId: actorId, enrolled: false, card: null, known: false, excluded: false,
      eligible: true, nextQuestionAt: null, firstQuestionAt: null, ...registry } }) };
}

function enrolled(card, nextQuestionAt = card.due) {
  const vocabulary = { id: 'f', user_id: actorId, language: 'Chinese', word_text: '经验', base_form: null, meaning: '경험',
    created_at: null, source_material_id: null, interval: 0, ease_factor: 0, repetitions: 0, last_reviewed_at: null, next_review_at: null };
  return { row: vocabulary, projection: projectVocabularyLearning({ actorId, vocabulary, enabled: true, registryAvailable: true,
    complete: true, at: now, registry: { cardId: 'f', userId: actorId, enrolled: true, card, known: false, excluded: false,
      eligible: true, nextQuestionAt, firstQuestionAt: null } }) };
}

describe('HSK 단어 페이지 상태 칸', () => {
  it('상태 칸 글자는 두 글자 이내 · 화면 읽기에는 온전한 말', () => {
    for (const s of Object.values(LEVEL_WORD_STATUS)) {
      expect([...s.short].length).toBeLessThanOrEqual(2);
      expect(s.label.length).toBeGreaterThan(s.short.length - 1);
    }
    expect(Object.keys(LEVEL_WORD_STATUS)).toEqual(['new', 'today', 'review', 'grad']);
  });

  it('담지 않음 → ☆ · 아는 단어 표시 → 졸업', () => {
    expect(levelWordStatus({ projection: null, at })).toBe('new');
    expect(levelWordStatus({ projection: null, known: true, at })).toBe('grad');
    expect(levelWordStatus({ projection: legacy({}, { known: true, eligible: false }).projection, at })).toBe('grad');
  });

  it('오늘 = 일정 없음 또는 오늘 학습일(04시 경계) 안 · 복습 = 그 뒤 · 졸업 = 90일 이상', () => {
    expect(levelWordStatus({ projection: legacy().projection, at })).toBe('today');
    // 다음날 03:00 KST는 아직 오늘 학습일(04시 경계).
    expect(levelWordStatus({ projection: legacy({ next_review_at: '2026-10-19T18:00:00.000Z' }).projection, at })).toBe('today');
    expect(levelWordStatus({ projection: legacy({ next_review_at: '2026-10-19T20:00:00.000Z' }).projection, at })).toBe('review');
    expect(levelWordStatus({ projection: legacy({ next_review_at: iso(at + (GRAD_DAYS - 1) * DAY) }).projection, at })).toBe('review');
    expect(levelWordStatus({ projection: legacy({ next_review_at: iso(at + GRAD_DAYS * DAY) }).projection, at })).toBe('grad');
  });

  it('진행 = 한 번이라도 채점(첫 채점과 함께 담은 단어 포함) · 담기만 한 단어는 아직', () => {
    expect(levelWordGraded({ projection: null })).toBe(false);
    expect(levelWordGraded({ projection: legacy().projection })).toBe(false);
    expect(levelWordGraded({ projection: legacy({ interval: 2.3, ease_factor: 5 }).projection })).toBe(true);
    expect(levelWordGraded({ projection: legacy({ last_reviewed_at: '2026-10-18T03:00:00.000Z' }).projection })).toBe(true);
    const fresh = introduceFsrsCard('2026-10-18T03:00:00.000Z');
    expect(levelWordGraded({ projection: enrolled(fresh).projection })).toBe(false);
    const graded = scheduleFsrsReview(fresh, 3, '2026-10-18T03:05:00.000Z').card;
    expect(levelWordGraded({ projection: enrolled(graded).projection })).toBe(true);
    const keys = ['a', 'b', 'c'];
    expect(levelProgressPercent(keys, (k) => k !== 'c')).toBe(66);
    expect(levelProgressPercent([], () => true)).toBe(0);
  });

  it('자주 틀린 단어 · 오래된 단어 기준', () => {
    expect(HARD_LAPSES).toBe(4);
    expect(lapsesOf(legacy({ repetitions: 4 }).projection)).toBe(4);
    expect(OLD_DAYS).toBe(60);
    expect(daysSinceReview(legacy({ last_reviewed_at: iso(at - 61 * DAY) }).projection, at)).toBe(61);
    expect(daysSinceReview(legacy().projection, at)).toBeNull();
  });
});

describe('네 칸 채점 미리보기', () => {
  it('담지 않은 단어 = 담으면서 첫 채점(학습 단계 anki-v2 — 1분 · 6분 · 10분 · 8일, 문서 표와 같다)', () => {
    const p = gradePreviews({ projection: null, row: null, at });
    expect([1, 2, 3, 4].map((g) => p[g].label)).toEqual(['1분', '6분', '10분', '8일']);
    expect(gradeEngine({ projection: null, row: null, at })).toBe('save');
  });

  it('옛 일정 카드는 언제든 · 아는 단어 표시는 채점하지 않는다', () => {
    const w = legacy({ interval: 3, ease_factor: 5, next_review_at: iso(at + 3 * DAY), last_reviewed_at: iso(at - DAY) });
    expect(gradeEngine({ ...w, at })).toBe('legacy');
    const p = gradePreviews({ ...w, at });
    expect(p[4].ms).toBeGreaterThan(p[1].ms);
    const known = legacy({}, { known: true, eligible: false });
    expect(gradeEngine({ ...known, at })).toBeNull();
  });

  it('FSRS 카드는 복습 차례일 때만(서버 규칙) — 그 전에는 null', () => {
    const fresh = introduceFsrsCard('2026-10-18T03:00:00.000Z');
    const due = enrolled(fresh);
    expect(gradeEngine({ ...due, at })).toBe('fsrs');
    const p = gradePreviews({ ...due, at });
    expect(p[1].label).toBe('1분');
    expect(p[3].label).toBe('10분');
    const later = scheduleFsrsReview(scheduleFsrsReview(fresh, 3, '2026-10-18T03:05:00.000Z').card, 3, '2026-10-18T03:20:00.000Z').card;
    const notDue = enrolled(later);
    expect(gradeEngine({ ...notDue, at })).toBeNull();
    expect(gradePreviews({ ...notDue, at })).toBeNull();
  });

  it('간격 글자 · 되돌리기 안내', () => {
    expect(intervalLabel(0)).toBe('오늘');
    expect(intervalLabel(10 * 60_000)).toBe('10분');
    expect(intervalLabel(5 * 3600_000)).toBe('5시간');
    expect(intervalLabel(2 * DAY)).toBe('2일');
    expect(gradeToastText(3, { label: '2일' })).toBe('알맞음 · 2일 뒤 다시');
    expect(gradeToastText(1, { label: '오늘' })).toBe('다시 · 오늘 다시');
    expect(gradeToastText(4, null)).toBe('쉬움');
  });
});

describe('오늘 새로 시작한 단어 수(하루 새 단어 몫 — 시안 ⑧)', () => {
  it('그 언어 · 오늘 학습일(04시 경계)에 생기고 채점한 행만 센다 — DB 마이크로초 시각도 읽는다', () => {
    const rows = [
      { id: 1, language: 'Chinese', created_at: '2026-10-19T01:00:00.123456+00:00', next_review_at: '2026-10-20T01:00:00Z', interval: 2.3 }, // 10:00 KST 오늘
      { id: 2, language: 'Chinese', created_at: '2026-10-18T18:30:00+00:00', next_review_at: '2026-10-20T01:00:00Z', interval: 2.3 }, // 03:30 KST — 어제 학습일
      // ☆ · 원탭 담기 — 운영 행은 next_review_at = 담은 시각(buildVocabRow)이 실리고 채점 흔적은 없다.
      { id: 3, language: 'Chinese', created_at: '2026-10-19T02:00:00Z', next_review_at: '2026-10-19T02:00:00Z', interval: 0, last_reviewed_at: null },
      { id: 4, language: 'Japanese', created_at: '2026-10-19T02:00:00Z', next_review_at: '2026-10-20T01:00:00Z', interval: 2.3 },
      { id: 5, language: 'Chinese', created_at: '2026-10-19T02:00:00Z', next_review_at: null }, // FSRS 카드 — 일정은 투영에
      { id: 6, language: 'Chinese', created_at: '2026-10-19T02:00:00Z', next_review_at: '2026-10-19T02:00:00Z' }, // 옛 행 투영(일정 = 담은 시각)도 세지 않는다
    ];
    const byKey = new Map(rows.flatMap((r) => [[`s:${r.id}`, r], [`b:${r.id}`, r]]));
    const projectionsById = new Map([[5, { source: 'fsrs-v1', review: { nextQuestionAt: '2026-10-19T02:10:00Z' } }],
      [6, { source: 'legacy', review: { nextQuestionAt: '2026-10-19T02:00:00Z' } }]]);
    expect(newStartedToday({ byKey, projectionsById }, 'Chinese', at)).toBe(2);
    expect(newStartedToday({ byKey, projectionsById }, 'Japanese', at)).toBe(1);
    expect(newStartedToday(null, 'Chinese', at)).toBe(0);
  });
});

describe('오늘 할 줄 — 한 단어 · 리스트 모드가 같이 쓴다(오너 확정 2026-10-19 KST)', () => {
  const entries = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => ({ key }));
  const status = { a: 'new', b: 'today', c: 'review', d: 'grad', e: 'today', f: 'new' };
  const T = 1_000_000;
  const MIN = 60_000;

  it('오늘 복습 먼저 · 그다음 새 단어 · 복습 중 · 졸업은 빠진다 · 오늘 뒤에 올 카드는 기다린다', () => {
    const s = startLevelSession(entries, (k) => status[k], (k) => (k === 'e' ? T + 5 * MIN : 0), T);
    expect(s.queue).toEqual(['b', 'a', 'f']);
    expect(s.waiting).toEqual([{ key: 'e', at: T + 5 * MIN }]);
    expect(s.total).toBe(4);
    expect(sessionCurrent(s, T)).toBe('b');
    expect(sessionNextAt(s, T)).toBe(T + 5 * MIN);
  });

  it('시간이 된 카드 → 새 카드 → 기다리는 카드(남은 시간 짧은 순) · 내일 이후는 줄에서 빠진다', () => {
    let s = startLevelSession(entries, (k) => status[k], () => 0, T);
    s = gradeLevelSession(s, 'b', 1, T + MIN); // 다시 1분
    s = gradeLevelSession(s, 'e', 2, T + 6 * MIN); // 어려움 6분
    s = gradeLevelSession(s, 'a', 4, null); // 쉬움 — 내일 이후
    expect(sessionOrder(s, T)).toEqual(['f']);
    expect(sessionWaiting(s, T).map((w) => w.key)).toEqual(['b', 'e']);
    expect(sessionOrder(s, T + 2 * MIN)).toEqual(['b', 'f']); // 1분이 지나 맨 위로
    expect(sessionDue(s, T + 7 * MIN)).toEqual(['b', 'e']);
    expect(s.counts).toEqual({ 1: 1, 2: 1, 3: 0, 4: 1 });
  });

  it('리스트는 줄 어디의 카드든 채점한다 · 줄 밖 카드는 오늘 안으로 돌아올 때만 들어온다', () => {
    let s = startLevelSession(entries, (k) => status[k], () => 0, T);
    s = gradeLevelSession(s, 'f', 3, null);
    expect(s.queue).toEqual(['b', 'e', 'a']);
    expect(gradeLevelSession(s, 'c', 3, null)).toBe(s); // 다음에 볼 단어 · 내일 이후 → 그대로
    s = gradeLevelSession(s, 'c', 1, T + MIN);
    expect(sessionWaiting(s, T).map((w) => w.key)).toEqual(['c']);
  });

  it('하루 새 단어(시안 ⑧) — 새 단어만 newCap개, 오늘 복습 · 기다리는 카드는 한도 밖 · 더 단추는 남긴 새 단어를 이어 세운다', () => {
    const many = [...entries, { key: 'g' }, { key: 'h' }];
    const st = { ...status, g: 'new', h: 'new' };
    let s = startLevelSession(many, (k) => st[k], (k) => (k === 'e' ? T + 5 * MIN : 0), T, { newCap: 2 });
    expect(s.queue).toEqual(['b', 'a', 'f']);
    expect(s.held).toEqual(['g', 'h']);
    expect(s.waiting.map((w) => w.key)).toEqual(['e']);
    expect(startLevelSession(many, (k) => st[k], () => 0, T, { newCap: -3 }).queue).toEqual(['b', 'e']); // 이미 넘게 시작한 날
    s = gradeLevelSession(gradeLevelSession(gradeLevelSession(s, 'b', 3, null), 'a', 3, null), 'f', 3, null);
    s = gradeLevelSession(s, 'e', 3, null);
    expect(sessionDone(s)).toBe(true); // 남긴 새 단어는 끝을 막지 않는다
    const more = moreLevelSession(s, 1, (k) => k !== 'g'); // g는 그사이 다른 곳에서 채점됨
    expect(more.queue).toEqual(['h']);
    expect(more.held).toEqual([]);
    expect(moreLevelSession(more, 5)).toBe(more);
    const pulled = pullLevelSession(startLevelSession(many, (k) => st[k], () => 0, T, { newCap: 0 }), 'h');
    expect(pulled.queue[0]).toBe('h');
    expect(pulled.held).toEqual(['a', 'f', 'g']);
    // 남긴 새 단어를 리스트(다음에 볼 단어)에서 「다시」로 채점하면 기다리는 카드로 옮기고 남긴 줄에서는 뺀다.
    const again = gradeLevelSession(startLevelSession(many, (k) => st[k], () => 0, T, { newCap: 0 }), 'g', 1, T + MIN);
    expect(again.held).toEqual(['a', 'f', 'h']);
    expect(again.waiting.map((w) => w.key)).toEqual(['g']);
  });

  it('기다리는 카드만 남으면 한 단어 모드는 가장 먼저 될 카드를 앞당긴다 · 둘 다 비면 끝', () => {
    let s = startLevelSession([{ key: 'a' }], () => 'new', () => 0, T);
    s = gradeLevelSession(s, 'a', 1, T + MIN);
    expect(sessionOrder(s, T)).toEqual([]);
    expect(sessionCurrent(s, T)).toBe('a');
    expect(sessionDone(s)).toBe(false);
    s = gradeLevelSession(s, 'a', 3, null);
    expect(sessionDone(s)).toBe(true);
    expect(s.graded).toBe(2);
  });

  it('다음 차례가 오늘 안이면 기다리는 시각, 내일 이후면 null', () => {
    const noon = Date.parse('2026-10-19T03:00:00Z'); // KST 정오
    expect(todayAgainAt({ ms: 10 * MIN }, noon)).toBe(noon + 10 * MIN);
    expect(todayAgainAt({ ms: 8 * 86_400_000 }, noon)).toBeNull();
    expect(todayAgainAt({ ms: 0 }, noon)).toBeNull();
    expect(todayAgainAt(null, noon)).toBeNull();
  });

  it('되돌리기 = 그 카드가 채점 전 자리로 · 넘기기는 세지 않는다', () => {
    let s = startLevelSession(entries, (k) => status[k], () => 0, T);
    s = gradeLevelSession(s, 'b', 1, T + MIN);
    s = undoLevelSession(s);
    expect(s.queue[0]).toBe('b');
    expect(s.waiting).toEqual([]);
    expect(s.graded).toBe(0);
    expect(undoLevelSession(s)).toBe(s);
    s = skipLevelSession(s, 'b');
    expect(s.queue).toEqual(['e', 'a', 'f']);
    expect(s.graded).toBe(0);
  });

  it('계속 진행 = 다음 레벨 · 마지막이면 없음(품사 범위는 없앴다)', () => {
    expect(nextLevelKey(['h1', 'h2'], 'h1')).toBe('h2');
    expect(nextLevelKey(['h1', 'h2'], 'h2')).toBeNull();
  });
});

describe('저장 실패 되돌림 — 그사이 채점한 다른 카드는 두고 이 카드만(리스트는 두 카드를 잇달아 누를 수 있다)', () => {
  const T = 1_000_000;
  const start = () => startLevelSession(['a', 'b', 'c'].map((key) => ({ key })), () => 'new', () => 0, T);
  it('뒤에 아무것도 없으면 채점 전 그대로', () => {
    const before = start(), moved = gradeLevelSession(before, 'a', 3);
    expect(revertLevelGrade(moved, before, moved, 'a', 3)).toBe(before);
  });
  it('b를 채점한 뒤 a 저장이 실패하면 a만 줄 앞으로, b는 채점된 채', () => {
    const before = start(), moved = gradeLevelSession(before, 'a', 3), later = gradeLevelSession(moved, 'b', 4);
    const back = revertLevelGrade(later, before, moved, 'a', 3);
    expect(back.queue).toEqual(['a', 'c']);
    expect(back.graded).toBe(1);
    expect(back.counts).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1 });
  });
  it('기다리던 카드는 기다리는 자리로', () => {
    const before = gradeLevelSession(start(), 'a', 1, T + 60_000), moved = gradeLevelSession(before, 'a', 3), later = gradeLevelSession(moved, 'b', 3);
    expect(revertLevelGrade(later, before, moved, 'a', 3).waiting).toEqual([{ key: 'a', at: T + 60_000 }]);
  });
});
