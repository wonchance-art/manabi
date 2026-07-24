import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateFSRS } from '../fsrs';
import { recordReviewCompleted } from '../learn/progressStore';
import {
  buildStudyReviewRef,
  buildStudyReviewRefs,
  recordStudyReviewCompleted,
} from '../studyExerciseBridge';

vi.mock('../fsrs', () => ({
  calculateFSRS: vi.fn(() => ({
    interval: 4,
    ease_factor: 5.5,
    repetitions: 1,
    next_review_at: '2026-07-28T00:00:00.000Z',
  })),
}));

vi.mock('../learn/progressStore', () => ({
  recordReviewCompleted: vi.fn().mockResolvedValue(undefined),
}));

describe('studyExerciseBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('문법 문항 완료를 F2 recordReviewCompleted 계약으로 변환한다', async () => {
    const item = {
      uid: 'g-1',
      type: 'grammar-cloze',
      quiz: { ko: '저는 학생이에요.' },
      effect: { kind: 'grammar-due', srs: { slug: 'a1-etre' } },
    };

    await recordStudyReviewCompleted('user-1', {
      correct: true,
      item,
      lang: 'French',
      rtMs: 840,
    });

    expect(recordReviewCompleted).toHaveBeenCalledOnce();
    expect(recordReviewCompleted).toHaveBeenCalledWith('user-1', {
      type: 'grammar',
      itemKey: 'a1-etre',
      lang: 'French',
      correct: true,
      detail: {
        ko: '저는 학생이에요.',
        mode: 'study',
        qtype: 'cloze',
        rt_ms: 840,
      },
    });
  });

  it('어휘 채점과 기존 FSRS 상태를 progressStore nextStats로 함께 넘긴다', async () => {
    const item = {
      uid: 'v-1',
      type: 'vocab-typing',
      word: {
        id: 'word-1',
        word_text: 'bonjour',
        meaning: '안녕하세요',
        interval: 2,
        ease_factor: 4.8,
        repetitions: 0,
        next_review_at: '2026-07-24T00:00:00.000Z',
      },
      effect: { kind: 'vocab', wordId: 'word-1' },
    };

    await recordStudyReviewCompleted('user-1', {
      correct: false,
      item,
      lang: 'French',
      rtMs: 1200,
    });

    expect(calculateFSRS).toHaveBeenCalledWith(1, {
      interval: 2,
      ease_factor: 4.8,
      repetitions: 0,
      next_review_at: '2026-07-24T00:00:00.000Z',
    });
    expect(recordReviewCompleted).toHaveBeenCalledWith(
      'user-1',
      {
        type: 'vocab',
        itemKey: 'bonjour',
        lang: 'French',
        correct: false,
        detail: {
          word_id: 'word-1',
          meaning: '안녕하세요',
          mode: 'study',
          qtype: 'typing',
          rt_ms: 1200,
        },
      },
      {
        interval: 4,
        ease_factor: 5.5,
        repetitions: 1,
        next_review_at: '2026-07-28T00:00:00.000Z',
      },
    );
  });

  it('게스트도 같은 F2 경계를 거쳐 로컬 폴백에 위임한다', async () => {
    const item = {
      uid: 'v-guest',
      type: 'vocab-choice',
      word: {
        id: 'word-guest',
        word_text: 'bonjour',
        meaning: '안녕하세요',
      },
      effect: { kind: 'vocab', wordId: 'word-guest' },
    };

    await expect(recordStudyReviewCompleted(undefined, {
      correct: true,
      item,
      lang: 'French',
      rtMs: 500,
    })).resolves.toBeUndefined();

    expect(calculateFSRS).not.toHaveBeenCalled();
    expect(recordReviewCompleted).toHaveBeenCalledWith(undefined, {
      type: 'vocab',
      itemKey: 'bonjour',
      lang: 'French',
      correct: true,
      detail: {
        word_id: 'word-guest',
        meaning: '안녕하세요',
        mode: 'study',
        qtype: 'choice',
        rt_ms: 500,
      },
    });
  });

  it('4쌍 매칭을 쌍별 정오답·FSRS로 recordReviewCompleted에 연결한다', async () => {
    const words = [
      { id: 'w1', word_text: 'bonjour', meaning: '안녕하세요', interval: 1 },
      { id: 'w2', word_text: 'merci', meaning: '감사합니다', interval: 2 },
      { id: 'w3', word_text: 'gare', meaning: '역', interval: 3 },
      { id: 'w4', word_text: 'billet', meaning: '표', interval: 4 },
    ];
    const item = {
      uid: 'm-1',
      type: 'vocab-match',
      words,
      effect: { kind: 'vocab-match' },
    };
    const result = {
      pairResults: words.map((word, index) => ({
        word,
        correct: index !== 1,
      })),
    };

    expect(buildStudyReviewRefs({
      correct: false,
      item,
      lang: 'French',
      rtMs: 900,
      result,
    })).toEqual(words.map((word, index) => ({
      type: 'vocab',
      itemKey: word.word_text,
      lang: 'French',
      correct: index !== 1,
      detail: {
        word_id: word.id,
        meaning: word.meaning,
        mode: 'study',
        qtype: 'match',
        rt_ms: 900,
      },
    })));

    await recordStudyReviewCompleted('user-1', {
      correct: false,
      item,
      lang: 'French',
      rtMs: 900,
      result,
    });

    expect(calculateFSRS).toHaveBeenCalledTimes(4);
    expect(calculateFSRS.mock.calls.map(([rating]) => rating)).toEqual([3, 1, 3, 3]);
    expect(recordReviewCompleted).toHaveBeenCalledTimes(4);
    expect(recordReviewCompleted.mock.calls.map(([, reviewRef]) => [
      reviewRef.itemKey,
      reviewRef.correct,
      reviewRef.detail.qtype,
    ])).toEqual([
      ['bonjour', true, 'match'],
      ['merci', false, 'match'],
      ['gare', true, 'match'],
      ['billet', true, 'match'],
    ]);
  });

  it('매칭 게스트도 네 쌍 모두 동일한 로컬 폴백 경계를 지난다', async () => {
    const words = [
      { id: 'w1', word_text: 'bonjour', meaning: '안녕하세요' },
      { id: 'w2', word_text: 'merci', meaning: '감사합니다' },
      { id: 'w3', word_text: 'gare', meaning: '역' },
      { id: 'w4', word_text: 'billet', meaning: '표' },
    ];
    await recordStudyReviewCompleted(undefined, {
      correct: true,
      item: {
        uid: 'm-guest',
        type: 'vocab-match',
        words,
        effect: { kind: 'vocab-match' },
      },
      lang: 'French',
      rtMs: 400,
    });

    expect(calculateFSRS).not.toHaveBeenCalled();
    expect(recordReviewCompleted).toHaveBeenCalledTimes(4);
    expect(recordReviewCompleted.mock.calls.every(([userId, ref, nextStats]) => (
      userId === undefined && ref.detail.qtype === 'match' && nextStats === undefined
    ))).toBe(true);
  });

  it('지원하지 않거나 불완전한 effect는 원격 기록 없이 fail-closed 한다', async () => {
    expect(buildStudyReviewRef({
      correct: true,
      item: { type: 'teach', effect: { kind: 'new-chapter', meta: {} } },
      lang: 'French',
    })).toBeNull();

    await recordStudyReviewCompleted('user-1', {
      correct: true,
      item: { type: 'teach', effect: { kind: 'unknown' } },
      lang: 'French',
    });
    expect(recordReviewCompleted).not.toHaveBeenCalled();
  });
});
