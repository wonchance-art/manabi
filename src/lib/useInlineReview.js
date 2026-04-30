'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { recordActivity } from './streak';
import { friendlyToastMessage } from './errorMessage';

/**
 * 뷰어 인라인 복습: 단어 클릭 후 평가(1/2/3) 시 FSRS 갱신 + XP 부여.
 */
export function useInlineReview({ user, profile, fetchProfile, toast }) {
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
    onSuccess: async ({ rating }) => {
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
      const prevXP = profile?.xp ?? 0;
      const xp = rating === 3 ? 12 : rating === 1 ? 5 : 8;
      const { awardXP } = await import('./xp');
      awardXP(user.id, xp, prevXP);
      recordActivity(user.id, () => fetchProfile(user.id));
      toast?.(`복습 완료! +${xp} XP`, 'success', 2000);
    },
    onError: (err) => toast?.('복습 저장 실패 — ' + friendlyToastMessage(err), 'error'),
  });
}
