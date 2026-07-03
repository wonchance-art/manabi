'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { recordActivity } from './streak';
import { friendlyToastMessage } from './errorMessage';
import { logReviewEvents } from './reviewEvents';
import { REF_LANGS } from '../content/refLangs';

/**
 * 자료 완독 처리: reading_progress upsert + 퀴즈 생성.
 * deps가 많지만 모두 외부 context/hook에서 받아오므로 hook 자체는 순수.
 *
 * @returns useMutation 결과 (markCompleteMutation)
 */
export function useReadingCompletion({
  materialId, user, profile, fetchProfile,
  material, generateQuiz,
  toast,
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('reading_progress').upsert({
        user_id: user.id,
        material_id: materialId,
        is_completed: true,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,material_id' });
      if (error) throw error;

      const now = new Date().toISOString();
      const [
        { count: wordsSaved },
        { count: dueCount },
      ] = await Promise.all([
        supabase.from('user_vocabulary').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('source_material_id', materialId),
        supabase.from('user_vocabulary').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).lte('next_review_at', now),
      ]);

      return { wordsSaved: wordsSaved || 0, dueCount: dueCount || 0 };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['reading-progress', user?.id, materialId] });
      queryClient.invalidateQueries({ queryKey: ['reading-progress-list', user?.id] });
      recordActivity(user.id, () => fetchProfile(user.id));
      // 완독을 학습 기록에 합류 — fire-and-forget, 실패 무해
      const eventLang = material?.processed_json?.metadata?.language;
      if (eventLang && REF_LANGS[eventLang]) {
        logReviewEvents(user.id, [{
          lang: eventLang,
          source: 'reading',
          item_key: 'material:' + materialId,
          correct: true,
          detail: { qtype: 'read', mode: 'viewer' },
        }]);
      }
      const pendingCompletion = {
        wordsSaved: data.wordsSaved,
        dueCount: data.dueCount,
        streak: (profile?.streak_count || 0) + 1,
      };
      const rawText = material?.raw_text || '';
      const lang = material?.processed_json?.metadata?.language || 'Japanese';
      generateQuiz(rawText, lang, pendingCompletion);
    },
    onError: (err) => toast?.(friendlyToastMessage(err), 'error'),
  });
}
