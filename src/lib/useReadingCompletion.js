'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { recordActivity } from './streak';
import { awardXP, XP_REWARDS } from './xp';
import { checkAndAwardAchievements } from './achievements';
import { friendlyToastMessage } from './errorMessage';

/**
 * 자료 완독 처리: reading_progress upsert + XP 부여 + 업적 체크 + 퀴즈 생성.
 * deps가 많지만 모두 외부 context/hook에서 받아오므로 hook 자체는 순수.
 *
 * @returns useMutation 결과 (markCompleteMutation)
 */
export function useReadingCompletion({
  materialId, user, profile, fetchProfile,
  material, generateQuiz, celebrate, checkLevelUp,
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
      const prevXP = profile?.xp ?? 0;
      try {
        await awardXP(user.id, XP_REWARDS.MATERIAL_COMPLETED, prevXP);
        checkLevelUp(prevXP, prevXP + XP_REWARDS.MATERIAL_COMPLETED);
        checkAndAwardAchievements(user.id, { xp: prevXP, streak: profile?.streak_count }).then(newBadges => {
          newBadges.forEach(b => celebrate({ type: 'achievement', icon: b.icon, name: b.name, desc: b.desc }));
        });
      } catch {
        console.error('XP 부여 실패 — 완독 기록은 저장됨');
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
