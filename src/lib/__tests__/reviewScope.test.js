import { describe, expect, it } from 'vitest';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler.js';
import { projectVocabularyLearning } from '../vocabularyLearningRead.js';
import {
  BACKLOG_DEFAULT_DAILY, bookChapterSlugs, countReviewScope, parseReviewScope, reviewScopeHref, reviewScopeLine,
  reviewScopeMatcher, reviewScopeSourceLabel, serializeReviewScope,
} from '../reviewScope.js';

// REV-SCOPE R1-A 계약(#1337 6106712027 §5, 설계 §8). 범위 하나가 개수 · 시작 · 줄을 함께 정한다.
const actorId = 'learner', at = '2026-10-13T06:00:00.000Z';
let seq = 0;
const word = (extra = {}) => ({ id: `w${++seq}`, user_id: actorId, word_text: `語${seq}`, meaning: '뜻', language: 'Japanese',
  interval: 3, repetitions: 1, last_reviewed_at: '2026-10-01T00:00:00.000Z', next_review_at: '2026-10-10T00:00:00.000Z',
  source_material_id: null, source_ref: null, ...extra });
const fresh = extra => word({ interval: 0, repetitions: 0, last_reviewed_at: null, next_review_at: '2026-10-12T00:00:00.000Z', ...extra });
const later = extra => word({ next_review_at: '2026-10-20T00:00:00.000Z', ...extra });
const registry = (raw, extra = {}) => ({ cardId: raw.id, userId: actorId, enrolled: false, card: null, eligible: true,
  known: false, excluded: false, nextQuestionAt: null, firstQuestionAt: null, ...extra });
const project = (raw, extra) => projectVocabularyLearning({ actorId, vocabulary: raw, registry: registry(raw, extra),
  enabled: true, registryAvailable: true, complete: true, at });
const fsrsProject = (raw, card) => project(raw, { enrolled: true, card, nextQuestionAt: card.due });
const quota = (remaining, admittedLegacyCardIds = []) => ({ remaining, admittedLegacyCardIds });
const now = Date.parse(at);

describe('범위 주소 문법 — 주소 → 범위 → 주소 왕복이 같은 문자열', () => {
  it.each([
    'lang=Japanese',
    'lang=Chinese&level=H2',
    'lang=Chinese&level=NONE&src=material:12,34&state=fragile',
    'lang=Japanese&src=book:japanese-n5:5-10',
    'lang=Japanese&src=book:japanese-n5:7-7&state=new',
    'lang=Chinese&src=deck:%EC%A4%91%EA%B5%AD%EC%96%B4%20%C2%B7%20H3',
    'lang=French&src=note:91',
    'lang=English&src=study',
  ])('%s', query => {
    const parsed = parseReviewScope(Object.fromEntries(new URLSearchParams(query)));
    expect(parsed.invalid).toBe(false);
    expect(parsed.explicit).toBe(true);
    expect(serializeReviewScope(parsed.scope)).toBe(query);
    expect(reviewScopeHref(parsed.scope)).toBe(`/vocab?${query}`);
  });

  it('범위 값이 없으면 배움 언어 하나가 기본이다(전 언어 혼합이 아니다)', () => {
    expect(parseReviewScope({}, { defaultLang: 'Chinese' })).toMatchObject({ invalid: false, explicit: false, scope: { lang: 'Chinese', state: 'due' } });
    expect(parseReviewScope({ utm: 'x' }, { defaultLang: 'Korean' }).scope.lang).toBe('Japanese');
  });

  it('예전 ?book= 링크는 교재 전체 과 범위 + 돌아갈 곳으로 읽는다', () => {
    const reading = '/books/japanese-n5?edition=8a8c1c1fd452773810abaf8c#u42-message-reading';
    const parsed = parseReviewScope({ book: 'japanese-n5', returnTo: reading });
    expect(parsed.scope).toEqual({ lang: 'Japanese', src: { kind: 'book', bookId: 'japanese-n5', from: 1, to: 42 }, state: 'due' });
    expect(parsed.returnTo).toBe(reading);
    expect(reviewScopeHref(parsed.scope, { returnTo: reading })).toBe(`/vocab?lang=Japanese&src=book:japanese-n5:1-42&returnTo=${encodeURIComponent(reading)}`);
    expect(parseReviewScope({ book: 'japanese-n5', returnTo: 'https://evil.test' }).returnTo).toBeNull();
  });

  it.each([
    [{ lang: 'Korean' }], [{ lang: 'japanese' }], [{ lang: ['Japanese', 'Chinese'] }],
    [{ lang: 'Japanese', level: 'H2' }], [{ lang: 'Chinese', level: 'H7' }], [{ lang: 'Chinese', level: 'N5' }],
    [{ lang: 'Chinese', src: 'book:japanese-n5:1-3' }], [{ src: 'book:japanese-n5:10-5' }], [{ src: 'book:japanese-n5:1-43' }],
    [{ src: 'book:japanese-n5:01-3' }], [{ src: 'book:other:1-3' }], [{ src: 'material:' }], [{ src: 'material:1,1' }],
    [{ src: 'material:abc' }], [{ src: 'note:1,2' }], [{ src: 'deck:' }], [{ src: 'deck:오늘 학습' }], [{ src: 'all' }],
    [{ state: 'later' }], [{ book: 'unknown' }], [{ book: 'japanese-n5', src: 'study' }],
  ])('무효 값 %j → 닫힘(전체로 새지 않는다)', params => {
    const parsed = parseReviewScope(params);
    expect(parsed.invalid).toBe(true);
    expect(parsed).not.toHaveProperty('scope');
  });

  it('교재 과 범위를 저장된 과 slug로 옮긴다', () => {
    expect(bookChapterSlugs({ kind: 'book', bookId: 'japanese-n5', from: 5, to: 7 })).toEqual(['n5-book-u05', 'n5-book-u06', 'n5-book-u07']);
    expect(reviewScopeSourceLabel({ kind: 'book', bookId: 'japanese-n5', from: 5, to: 10 })).toBe('교재 5–10과');
    expect(reviewScopeSourceLabel({ kind: 'book', bookId: 'japanese-n5', from: 1, to: 42 })).toBe('교재 · 전체 과');
  });
});

describe('countReviewScope — 화면 숫자 = 시작하는 줄 길이', () => {
  it('중국어 · HSK 2 · 내 서재 자료 범위: 다른 언어 카드는 0장이고 숫자와 줄 길이가 같다', () => {
    const rows = [
      word({ language: 'Chinese', word_text: '早餐', source_material_id: 12 }),
      word({ language: 'Chinese', word_text: '地铁', source_material_id: 34 }),
      word({ language: 'Chinese', word_text: '周末', source_material_id: 12 }),
      fresh({ language: 'Chinese', word_text: '喜欢', source_material_id: 12 }),
      word({ language: 'Chinese', word_text: '早餐2', source_material_id: 99 }),
      word({ language: 'Japanese', word_text: 'カフェ', source_material_id: 12 }),
      word({ language: 'English', word_text: 'coffee', source_material_id: 12 }),
    ];
    const levels = { 早餐: 'H2', 地铁: 'H2', 周末: 'H3', 喜欢: 'H2', 早餐2: 'H2' };
    const snapshot = rows.map(raw => project(raw));
    const parsed = parseReviewScope({ lang: 'Chinese', level: 'H2', src: 'material:12' });
    const context = { levelOf: w => levels[w.word_text] || null };
    const count = countReviewScope({ snapshot, quota: quota(5), scope: parsed.scope, now, context });
    const line = reviewScopeLine({ snapshot, quota: quota(5), scope: parsed.scope, now, context });
    const started = [...line.legacyReviews, ...line.legacyNew, ...line.fsrsIds];
    expect(count).toMatchObject({ due: 1, newAllowed: 1, total: 2, newLocked: 0 });
    expect(started).toHaveLength(count.total);
    expect([...line.legacyReviews, ...line.legacyNew].map(w => w.word_text)).toEqual(['早餐', '喜欢']);
    expect([...line.legacyReviews, ...line.legacyNew].every(w => w.language === 'Chinese')).toBe(true);
    // 국기 칩 숫자는 그 언어 하나만 고른 범위다(급수 · 출처를 넘어 그 언어의 오늘 복습).
    expect(count.byLang).toEqual({ Japanese: 1, Chinese: 5, English: 1, French: 0 });
  });

  it('아는 단어 · 제외 · 뜻 없음은 어느 범위에서도 세지 않는다', () => {
    const snapshot = [
      project(word()), project(word(), { eligible: false, known: true }), project(word(), { eligible: false, excluded: true }),
      project(word({ meaning: '' })), project(word({ meaning: null })),
    ];
    expect(countReviewScope({ snapshot, quota: quota(5), scope: { lang: 'Japanese', state: 'due' }, now }).total).toBe(1);
  });

  it('새 표현은 계정 한도 남은 수 이내 · 이미 시작한 카드는 한도를 다시 쓰지 않는다 · 문법은 별줄', () => {
    const started = fresh();
    const snapshot = [project(word()), project(started), ...Array.from({ length: 6 }, () => project(fresh()))];
    const scope = { lang: 'Japanese', state: 'due' };
    expect(countReviewScope({ snapshot, quota: quota(2), scope, now })).toMatchObject({ due: 1, newAllowed: 2, newLocked: 5, total: 3, remaining: 2 });
    expect(countReviewScope({ snapshot, quota: quota(2, [started.id]), scope, now, grammarDue: 4 }))
      .toMatchObject({ due: 1, newAllowed: 3, total: 4, grammarDue: 4 });
    expect(countReviewScope({ snapshot, quota: null, scope, now })).toMatchObject({ newAllowed: 0, total: 1 });
    expect(countReviewScope({ snapshot, quota: quota(9), scope: { ...scope, state: 'new' }, now })).toMatchObject({ due: 0, newAllowed: 7, total: 7 });
  });

  it('FSRS 카드도 같은 범위로 걸러지고, 새 FSRS 카드가 한도를 먼저 쓴다(지금 세션과 같은 순서)', () => {
    const card = introduceFsrsCard('2026-10-12T00:00:00.000Z');
    const review = scheduleFsrsReview(card, 3, card.due).card;
    const zhNew = word({ language: 'Chinese' }), jaNew = word(), zhReview = word({ language: 'Chinese' });
    const snapshot = [fsrsProject(zhNew, card), fsrsProject(jaNew, card), fsrsProject(zhReview, review), project(fresh({ language: 'Chinese' }))];
    const fsrsEntries = [zhNew, jaNew, zhReview].map((raw, index) => ({ cardId: raw.id, card: index === 2 ? review : card, firstQuestionAt: null }));
    const scope = { lang: 'Chinese', state: 'due' };
    const line = reviewScopeLine({ snapshot, fsrsEntries, quota: quota(1), scope, now });
    expect(line.fsrsIds).toEqual([zhReview.id, zhNew.id]);
    expect(line.legacyNew).toHaveLength(0);
    expect(countReviewScope({ snapshot, fsrsEntries, quota: quota(1), scope, now })).toMatchObject({ due: 1, newAllowed: 1, newLocked: 1, total: 2 });
  });

  it('밀린 복습이 그 언어 하루 평균의 2배를 넘으면 그 언어 새 표현은 0이다(다른 언어는 그대로)', () => {
    const overdue = Array.from({ length: 2 * BACKLOG_DEFAULT_DAILY + 1 }, () => project(word()));
    const snapshot = [...overdue, project(fresh()), project(fresh({ language: 'French' }))];
    const scope = { lang: 'Japanese', state: 'due' };
    const blocked = countReviewScope({ snapshot, quota: quota(10), scope, now });
    expect(blocked).toMatchObject({ newAllowed: 0, newLocked: 1, backlogBlocked: true, remaining: 10 });
    expect(blocked.byLang.French).toBe(1);
    // 평균이 높은 학습자에게는 같은 양이 밀린 게 아니다
    expect(countReviewScope({ snapshot, quota: quota(10), scope, now, history: { Japanese: 14 * 30 } })).toMatchObject({ newAllowed: 1, backlogBlocked: false });
    // 기준은 범위가 아니라 그 언어 전체다
    const narrow = countReviewScope({ snapshot, quota: quota(10), scope: { ...scope, src: { kind: 'study' } }, now });
    expect(narrow.backlogBlocked).toBe(true);
  });

  it('흐릿 · 위험 범위는 기억 확률 0.7 미만만 · 새 표현은 넣지 않는다', () => {
    const faded = later({ last_reviewed_at: '2026-08-01T00:00:00.000Z', interval: 2 });
    const clear = later({ last_reviewed_at: '2026-10-12T00:00:00.000Z', interval: 30 });
    const snapshot = [project(faded), project(clear), project(fresh())];
    const line = reviewScopeLine({ snapshot, quota: quota(5), scope: { lang: 'Japanese', state: 'fragile' }, now });
    expect(line.legacyReviews.map(w => w.id)).toEqual([faded.id]);
    expect(line.legacyNew).toEqual([]);
  });

  it('출처 범위: 덱 · 오늘 학습은 source_ref, 교재 · 노트는 서버가 돌려준 id 묶음만', () => {
    const deck = word({ source_ref: '중국어 · H3', language: 'Chinese' }), study = word({ source_ref: '오늘 학습' }), book = word();
    expect(reviewScopeMatcher({ lang: 'Chinese', src: { kind: 'deck', ref: '중국어 · H3' } })(deck)).toBe(true);
    expect(reviewScopeMatcher({ lang: 'Japanese', src: { kind: 'study' } })(study)).toBe(true);
    expect(reviewScopeMatcher({ lang: 'Japanese', src: { kind: 'study' } })(book)).toBe(false);
    const bookScope = { lang: 'Japanese', src: { kind: 'book', bookId: 'japanese-n5', from: 5, to: 10 } };
    expect(reviewScopeMatcher(bookScope, { sourceIds: [book.id] })(book)).toBe(true);
    expect(reviewScopeMatcher(bookScope)(book)).toBe(false);
  });
});
