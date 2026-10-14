import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPracticeEvent, countsForDifficulty, countsForSkillLadder, practiceAsWeaknessEvents, practiceFragileIds } from '../practiceEvents';
import { deriveVocabRungs } from '../skillRung';
import { confusedVocabWords } from '../confusedQueue';
import { weaknessProfile } from '../weaknessProfile';
import { buildWeeklyReport, isGradedReviewEvent } from '../weeklyReport';
import { isWeaknessEvent } from '../errorTags';
import { sliceBetween } from './helpers/sliceBetween';

// REV-SCOPE-R1B-1 §6-1 ⑤ 연습 기록 형식 · 읽는 곳 표 — 기본은 모든 기존 읽는 곳에서 제외, 표가 말한 곳만 포함.
const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const NOW = Date.parse('2026-10-13T03:00:00.000Z');
const word = { id: '11111111-1111-4111-8111-111111111111', word_text: '早餐', language: 'Chinese', meaning: '아침 식사' };
const other = { id: '22222222-2222-4222-8222-222222222222', word_text: '地铁', language: 'Chinese', meaning: '지하철' };
const at = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const practice = (w, qtype, result, minutes = 5) => ({ ...buildPracticeEvent({ word: w, qtype, scope: '/vocab?lang=Chinese', result }), created_at: at(minutes) });

describe('연습 기록 형식', () => {
  it('source practice · item_key = 단어 id · detail {qtype, scope, result} — word_id는 넣지 않는다(DB guard_legacy_event가 FSRS 카드를 막는 칸)', () => {
    const event = buildPracticeEvent({ word, qtype: 'self', scope: '/vocab?lang=Chinese&state=fragile', result: 'unknown' });
    expect(event).toEqual({ lang: 'Chinese', source: 'practice', item_key: word.id, correct: false,
      detail: { qtype: 'self', scope: '/vocab?lang=Chinese&state=fragile', result: 'unknown' } });
    expect(event.detail).not.toHaveProperty('word_id');
    expect(buildPracticeEvent({ word, qtype: 'typing', scope: 's', result: 'correct' }).correct).toBe(true);
    expect(buildPracticeEvent({ word, qtype: 'self', scope: 's', result: 'correct' })).toBeNull();
    expect(buildPracticeEvent({ word, qtype: 'typing', scope: 's', result: 'known' })).toBeNull();
    expect(buildPracticeEvent({ word, qtype: 'flash', scope: 's', result: 'known' })).toBeNull();
  });
});

describe('읽는 곳 표 — 포함', () => {
  it('숙련 사다리: 정답이 정해진 문항(choice · cloze · typing · listening)만 오르고, self는 넣지 않는다', () => {
    const graded = [practice(word, 'typing', 'correct', 9), practice(word, 'typing', 'correct', 8), practice(word, 'typing', 'correct', 7), practice(word, 'typing', 'correct', 6)];
    expect(deriveVocabRungs(graded, [word])[word.word_text]).toBeGreaterThan(1);
    const selfOnly = Array.from({ length: 6 }, (_, i) => practice(word, 'self', 'known', 10 - i));
    expect(deriveVocabRungs(selfOnly, [word])[word.word_text]).toBe(0);
    expect(countsForSkillLadder(practice(word, 'listening', 'wrong'))).toBe(true);
    expect(countsForSkillLadder(practice(word, 'self', 'unknown'))).toBe(false);
  });
  it('난이도 다이얼(EWMA): 정답이 정해진 연습은 표본, self는 아니다 — 기존 ui · dict 제외 그대로', () => {
    expect(countsForDifficulty(practice(word, 'choice', 'wrong'))).toBe(true);
    expect(countsForDifficulty(practice(word, 'self', 'unknown'))).toBe(false);
    expect(countsForDifficulty({ source: 'vocab', correct: true })).toBe(true);
    expect(countsForDifficulty({ source: 'ui', correct: true })).toBe(false);
    expect(countsForDifficulty({ source: 'dict', correct: true })).toBe(false);
  });
  it('헷갈린 표현: 「몰랐어요」 · 오답이 그 단어의 오답으로 들어간다 — 「알았어요」(자기 채점 성공)는 넣지 않는다', () => {
    const events = [practice(word, 'self', 'unknown', 9), practice(word, 'self', 'unknown', 8), practice(word, 'self', 'known', 7),
      practice(other, 'self', 'known', 6), practice(other, 'self', 'known', 5)];
    const confused = confusedVocabWords(events, [word, other], { now: NOW });
    expect(confused.map(row => row.word.id)).toEqual([word.id]);
    expect(confused[0]).toMatchObject({ wrong: 2, total: 2 });
    expect(practiceAsWeaknessEvents(events, [word, other]).filter(e => e.source === 'vocab')).toHaveLength(2);
  });
  it('약점(유형 축): 정답이 정해진 연습은 그 회상 방식의 표본 — self는 축이 아니다', () => {
    const events = [practice(word, 'typing', 'wrong', 9), practice(other, 'typing', 'wrong', 8), practice(word, 'self', 'unknown', 7)];
    const profile = weaknessProfile(events, { now: NOW });
    expect(profile.map(row => row.tag)).toEqual(['retrieval:typing']);
    expect(isWeaknessEvent(practice(word, 'self', 'unknown'))).toBe(false);
  });
  it('흐릿 범위: 지난 14일 연습의 「몰랐어요」 · 오답 표현', () => {
    const ids = practiceFragileIds([practice(word, 'self', 'unknown', 60), practice(other, 'listening', 'correct', 60),
      { ...practice(other, 'typing', 'wrong'), created_at: new Date(NOW - 15 * 86_400_000).toISOString() }], { now: NOW });
    expect([...ids]).toEqual([word.id]);
  });
});

describe('읽는 곳 표 — 제외(주간 리포트 · 복습 수 · 히트맵 · 알림 · 관리자 지표 · 산출 단어 · 그 밖)', () => {
  it('채점 이벤트 판정(isGradedReviewEvent — 주간 리포트 · 복습 수 · 산출 단어)에서 빠진다', () => {
    expect(isGradedReviewEvent(practice(word, 'typing', 'correct'))).toBe(false);
    expect(isGradedReviewEvent({ source: 'vocab', correct: true })).toBe(true);
    const report = buildWeeklyReport({ events: [practice(word, 'self', 'known', 1), { source: 'vocab', correct: true, created_at: at(2) }], now: NOW });
    expect(report.reviews.total).toBe(1);
  });
  it('알림 시각 추정(push) · 콜드스타트(오늘 학습 재료)는 연습을 거른다', () => {
    expect(sliceBetween(read('src/lib/push.js'), 'async function fetchRecentSessionTimes', '.limit(500)')).toContain(".neq('source', 'practice')");
    const study = read('src/lib/studyMaterials.js');
    expect(study).toContain('deriveColdStart(progressRows, languageRows, reviewEventRows.filter(e => !isPracticeEvent(e)), chapterSlugs)');
    expect(study).toContain('const gradedEvents = eventsAsc.filter(countsForDifficulty)');
    expect(study).toContain('computeWeakness(practiceAsWeaknessEvents(reviewEventRows, legacyRows)');
  });
  it('펫 · 읽기 속도 · 발송 상한 · undo 마커 · 드릴 통계는 source/item_key로 이미 좁혀 읽는다(연습이 섞일 수 없다)', () => {
    const pet = read('src/lib/world/pet.js');
    expect((pet.match(/\.eq\('source', 'vocab'\)/g) || []).length).toBe(3);
    expect(read('src/lib/readingSpeedRows.js').match(/\.eq\('source', 'reading'\)/g)).toHaveLength(2);
    expect(read('src/lib/server/pushSend.js')).toContain(".eq('source', 'ui').eq('item_key', '-')");
    expect(read('src/lib/undoneReviewsRows.js')).toContain(".eq('source', 'ui')");
    expect(read('src/components/ChapterDrills.jsx')).toContain(".in('item_key', drills.map((d) => d.id))");
  });
});
