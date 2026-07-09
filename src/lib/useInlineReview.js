'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { recordActivity } from './streak';
import { friendlyToastMessage } from './errorMessage';
import { logReviewEvents } from './reviewEvents';
import { detectLang } from './constants';

/**
 * 뷰어 인라인 복습: 단어 클릭 후 평가(1/2/3) 시 FSRS 갱신.
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
      const { error } = await supabase
        .from('user_vocabulary')
        .update({ ...nextStats, last_reviewed_at: new Date().toISOString() })
        .eq('id', vocab.id);
      if (error) throw error;
      return { vocab, rating, nextStats };
    },
    onSuccess: async ({ vocab, rating }) => {
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
      }]);
      toast?.('복습 완료!', 'success', 2000);
    },
    onError: (err) => toast?.('복습 저장 실패 — ' + friendlyToastMessage(err), 'error'),
  });
}
