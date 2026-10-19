import { describe, expect, it } from 'vitest';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler.js';
import { projectVocabularyLearning } from '../vocabularyLearningRead.js';
import {
  GRAD_DAYS, HARD_LAPSES, LEVEL_RANGES, LEVEL_WORD_STATUS, OLD_DAYS, daysSinceReview, entriesInRange, gradeEngine,
  gradePreviews, gradeToastText, intervalLabel, lapsesOf, levelProgressPercent, levelWordGraded, levelWordStatus, rangeOfGroup,
} from '../levelWordStatus.js';
import {
  AGAIN_GAP, gradeLevelSession, nextLevelScope, sessionCurrent, sessionDone, skipLevelSession, startLevelSession, undoLevelSession,
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

  it('범위 ▾ — 대명사 · 수 · 양사 · 기능어 · 표현은 기타', () => {
    expect(LEVEL_RANGES).toEqual(['전체', '명사', '동사', '형용사', '부사', '기타']);
    expect(rangeOfGroup('대명사 · 수 · 양사')).toBe('기타');
    expect(rangeOfGroup('동사')).toBe('동사');
    const groups = [{ name: '명사', entries: [{ key: 'a' }] }, { name: '기능어', entries: [{ key: 'b' }] }, { name: '표현', entries: [{ key: 'c' }] }];
    expect(entriesInRange(groups, '전체').map((e) => e.key)).toEqual(['a', 'b', 'c']);
    expect(entriesInRange(groups, '기타').map((e) => e.key)).toEqual(['b', 'c']);
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

describe('한 단어 모드 세션 줄', () => {
  const entries = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => ({ key }));
  const status = { a: 'new', b: 'today', c: 'review', d: 'grad', e: 'today', f: 'new' };

  it('오늘 복습 먼저 · 그다음 새 단어 · 복습 중 · 졸업은 빠진다', () => {
    const s = startLevelSession(entries, (k) => status[k]);
    expect(s.queue).toEqual(['b', 'e', 'a', 'f']);
    expect(s.total).toBe(4);
    expect(sessionCurrent(s)).toBe('b');
  });

  it(`다시는 ${AGAIN_GAP}장 뒤 · 줄이 짧으면 끝에서 이어간다`, () => {
    let s = startLevelSession(entries, (k) => status[k]);
    s = gradeLevelSession(s, 'b', 1);
    expect(s.queue).toEqual(['e', 'a', 'f', 'b']);
    s = gradeLevelSession(s, 'e', 3);
    s = gradeLevelSession(s, 'a', 1);
    expect(s.queue).toEqual(['f', 'b', 'a']);
    expect(s.counts).toEqual({ 1: 2, 2: 0, 3: 1, 4: 0 });
    expect(gradeLevelSession(s, 'b', 3)).toBe(s); // 지금 카드가 아니면 그대로
    s = gradeLevelSession(gradeLevelSession(gradeLevelSession(s, 'f', 4), 'b', 3), 'a', 2);
    expect(sessionDone(s)).toBe(true);
    expect(s.graded).toBe(6);
  });

  it('되돌리기 = 그 카드가 다시 맨 앞 · 넘기기는 세지 않는다', () => {
    let s = startLevelSession(entries, (k) => status[k]);
    s = gradeLevelSession(s, 'b', 4);
    s = undoLevelSession(s);
    expect(s.queue[0]).toBe('b');
    expect(s.graded).toBe(0);
    expect(undoLevelSession(s)).toBe(s);
    s = skipLevelSession(s, 'b');
    expect(s.queue).toEqual(['e', 'a', 'f']);
    expect(s.graded).toBe(0);
  });

  it('계속 진행 = 다음 품사 · 기타 다음은 다음 레벨 전체 · 마지막이면 없음', () => {
    const levels = ['h1', 'h2'];
    expect(nextLevelScope({ levels, levelKey: 'h1', range: '명사', ranges: LEVEL_RANGES })).toEqual({ levelKey: 'h1', range: '동사' });
    expect(nextLevelScope({ levels, levelKey: 'h1', range: '기타', ranges: LEVEL_RANGES })).toEqual({ levelKey: 'h2', range: '전체' });
    expect(nextLevelScope({ levels, levelKey: 'h1', range: '전체', ranges: LEVEL_RANGES })).toEqual({ levelKey: 'h2', range: '전체' });
    expect(nextLevelScope({ levels, levelKey: 'h2', range: '전체', ranges: LEVEL_RANGES })).toBeNull();
  });
});
