'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { persistVocabGrade } from './fsrs';
import { recordActivity } from './streak';
import { friendlyToastMessage } from './errorMessage';
import { logReviewEvents } from './reviewEvents';
import { detectLang } from './constants';

// W R3 undo 스냅샷이 복원하는 SRS 5필드(persistVocabGrade 페이로드와 같은 snake_case)
export const INLINE_SRS_FIELDS = ['interval', 'ease_factor', 'repetitions', 'next_review_at', 'last_reviewed_at'];

/**
 * 뷰어 인라인 복습: 단어 카드에서 평가 시 FSRS 갱신.
 * 척도는 복습 화면 정본과 동일한 4등급(1 다시 · 2 어려움 · 3 알맞음 · 4 쉬움 — W R3, #1077
 * 5504387198). 예전 `모름/애매/알아`=1/2/3은 Easy(4)가 없어 아무리 잘 알아도 D가 2.12에
 * 머물렀다(복습 화면의 「쉬움」은 1.00). 같은 라벨 = 같은 값.
 * 결과에 `prev`(채점 직전 5필드)·`reviewedAt`을 실어 호출부(카드)가 undo 스냅샷을 만든다 —
 * 훅은 채점만 하고 스냅샷은 호출부가 갖는다.
 */
export function useInlineReview({ user, fetchProfile, toast }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vocab, rating }) => {
      const { calculateFSRS } = await import('./fsrs');
      const nextStats = calculateFSRS(rating, {
        interval: vocab.interval ?? 0,
        ease_factor: vocab.ease_factor ?? 0,
        repetitions: vocab.repetitions ?? 0,
        next_review_at: vocab.next_review_at,
      });
      const prev = Object.fromEntries(INLINE_SRS_FIELDS.filter((k) => vocab[k] !== undefined).map((k) => [k, vocab[k]]));
      // 채점 시각을 한 번 찍어 SRS·이벤트가 같은 시각을 쓴다 — undo 보상 이벤트가 이 값으로 원 채점을 가리킨다
      const reviewedAt = new Date().toISOString();
      await persistVocabGrade(supabase, vocab.id, nextStats, reviewedAt);
      return { vocab, rating, nextStats, prev, reviewedAt };
    },
    onSuccess: async ({ vocab, rating, reviewedAt }) => {
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
      recordActivity(user.id, () => fetchProfile(user.id));
      // 약점 진단 데이터 — VocabPage와 동일 규약(item_key=word_text, detail.qtype)으로 적재.
      // 인라인 평가(모름/애매/알아)는 자기채점이라 flash와 동일 — 비대칭 신뢰(성공 rung 크레딧 0, 오답 자인만 강등)로 skillRung에서 다뤄진다.
      // fire-and-forget: logReviewEvents 내부에서 실패를 삼키므로 학습 흐름에 영향 없음.
      logReviewEvents(user?.id, [{
        lang: vocab.language || detectLang(vocab.word_text),
        source: 'vocab',
        item_key: vocab.word_text,
        correct: rating > 1,
        detail: { word_id: vocab.id, meaning: vocab.meaning, rating, qtype: 'flash' },
        created_at: reviewedAt,
      }]);
      toast?.('복습 완료!', 'success', 2000);
    },
    onError: (err) => toast?.('복습 저장 실패 — ' + friendlyToastMessage(err), 'error'),
  });
}
